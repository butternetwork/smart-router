import { BigNumber, ethers, Signer } from 'ethers';
import { Token } from './token';
import { Provider } from '@ethersproject/abstract-provider';
import TokenRegisterMetadata from '../abis/TokenRegister.json';
import { Eth } from 'web3-eth';
import { Contract } from 'web3-eth-contract';
import { ChainId } from './chains';
import {
  USDC_MAP,
  USDC_BNB,
  USDC_MAINNET,
  USDC_POLYGON,
  USDC_NEAR,
  BUSD_BSCT,
  PUSD_POLYGON_MUMBAI,
  AURORA_NEART,
} from '../providers/token-provider';
import VaultTokenMetadata from '../abis/VaultToken.json';

interface ButterFee {
  feeToken: Token;
  amount: string;
}

interface VaultBalance {
  token: Token; // vault token
  balance: string; // amount in minimal uint
}

type ButterProviderType = Signer | Provider | Eth;
type ButterContractType = ethers.Contract | Contract;
type ButterFeeRate = {
  lowest: string;
  highest: string;
  rate: string; // bps
};

enum mosSupportedChainId {
  MAP_MAINNET = '22776',
  BSC_MAINNET = '56',
  POLYGON_MAINNET = '137',
  NEAR_MAINNET = '5566818579631833088',

  MAP_TEST = '212',
  ETH_PRIV = '34434',
  BSC_TEST = '97',
  POLYGON_TEST = '80001',
  NEAR_TESTNET = '5566818579631833089',
}

const MOS_CONTRACT_ADDRESS_SET: { [chainId in mosSupportedChainId]: string } = {
  [mosSupportedChainId.MAP_MAINNET]: '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.BSC_MAINNET]: '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.POLYGON_MAINNET]: '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.NEAR_MAINNET]: 'mos.mfac.butternetwork.near',

  [mosSupportedChainId.ETH_PRIV]: '0x43130059C655314d7ba7eDfb8299d26FbDE726F1',
  [mosSupportedChainId.BSC_TEST]: '0x220bE51C717c4E257Cb8e96be8591740336623F8',
  [mosSupportedChainId.MAP_TEST]: '0xB6c1b689291532D11172Fb4C204bf13169EC0dCA',
  [mosSupportedChainId.POLYGON_TEST]: '0x688f3Ef5f728995a9DcB299DAEC849CA2E49ddE1',
  [mosSupportedChainId.NEAR_TESTNET]: 'mos2.mfac.maplabs.testnet',
};


export const TOKEN_REGISTER_ADDRESS_SET: { [mosSupportedChainId: string]: string } = {
  [mosSupportedChainId.MAP_TEST]: '0x2a1E22c89754735c90f507844BDcd94A0193D986',
  [mosSupportedChainId.MAP_MAINNET]: '0xff44790d336d3C004F2Dac7e401E4EA5680529dD',
};

const TOKEN_REGISTER_ADDRESS = '0x2a1E22c89754735c90f507844BDcd94A0193D986';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getBridgeFee(
  srcToken: Token,
  targetChain: string,
  amount: string,
  provider: ethers.providers.JsonRpcProvider,
  providerChainId:string
): Promise<ButterFee> {
  const tokenRegister = new TokenRegister(
    TOKEN_REGISTER_ADDRESS_SET[providerChainId]!,
    provider
  );
  let feeAmount = '';
  let feeRate: ButterFeeRate = { lowest: '0', rate: '0', highest: '0' };
  if (IS_MAP(srcToken.chainId)) {
    const tokenAddress = srcToken.isNative
      ? srcToken.wrapped.address
      : srcToken.address;
    const tokenFeeRate = await tokenRegister.getFeeRate(
      tokenAddress,
      targetChain
    );
    feeRate.lowest = tokenFeeRate.lowest.toString();
    feeRate.highest = tokenFeeRate.highest.toString();
    feeRate.rate = BigNumber.from(tokenFeeRate.rate).div(100).toString();
    feeAmount = _getFeeAmount(amount, feeRate);
  } else {
    const mapTokenAddress = await tokenRegister.getRelayChainToken(
      srcToken.chainId.toString(),
      srcToken
    );
console.log("mapTokenAddress",mapTokenAddress)
    const relayChainAmount = await tokenRegister.getRelayChainAmount(
      mapTokenAddress,
      srcToken.chainId.toString(),
      amount
    );
    const tokenFeeRate: ButterFeeRate = await tokenRegister.getFeeRate(
      mapTokenAddress,
      targetChain
    );
    feeRate.lowest = tokenFeeRate.lowest;
    feeRate.highest = tokenFeeRate.highest;
    feeRate.rate = BigNumber.from(tokenFeeRate.rate).div(100).toString();

    const feeAmountInMappingToken = _getFeeAmount(relayChainAmount, feeRate);
    const feeAmountBN = BigNumber.from(feeAmountInMappingToken);
    console.log('fee amount in mapping token', feeAmountBN.toString());
    const ratio = BigNumber.from(amount).div(BigNumber.from(relayChainAmount));
    feeRate.lowest = BigNumber.from(feeRate.lowest).mul(ratio).toString();
    feeRate.highest = BigNumber.from(feeRate.highest).mul(ratio).toString();
    feeAmount = feeAmountBN.mul(ratio).toString();
  }
  return Promise.resolve({
    feeToken: srcToken,
    feeRate: feeRate,
    amount: feeAmount.toString(),
  });
}

export async function getVaultBalance(
  fromChainId: number,
  fromToken: Token,
  toChainId: number,
  rpcProvider: ethers.providers.JsonRpcProvider
): Promise<VaultBalance> {
  const tokenRegister = new TokenRegister(TOKEN_REGISTER_ADDRESS, rpcProvider);

  if (fromToken.isNative) {
    fromToken = fromToken.wrapped;
  }
  const mapTokenAddress = IS_MAP(fromChainId)
    ? fromToken.address
    : await tokenRegister.getRelayChainToken(fromChainId.toString(), fromToken);
  const vaultAddress = await tokenRegister.getVaultToken(mapTokenAddress);

  if (vaultAddress === ZERO_ADDRESS) {
    throw new Error('vault address not found for token: ' + mapTokenAddress);
  }
  const vaultToken = new VaultToken(vaultAddress, rpcProvider);

  const tokenBalance = await vaultToken.getVaultBalance(toChainId.toString());
  let toChainTokenAddress = mapTokenAddress;
  if (!IS_MAP(toChainId)) {
    toChainTokenAddress = await tokenRegister.getToChainToken(
      mapTokenAddress,
      toChainId.toString()
    );

    if (toChainTokenAddress === '0x') {
      throw new Error(
        'Internal Error: Cannot find corresponding target token on target chain'
      );
    }
  }
  return Promise.resolve({
    token: getTokenByAddressAndChainId(
      toChainTokenAddress,
      toChainId.toString()
    ),
    balance: tokenBalance.toString(),
  });
}

export async function getTokenCandidates(
  fromChainId: string,
  toChainId: string,
  provider: ethers.providers.JsonRpcProvider
): Promise<Token[]> {
  return Promise.resolve([USDC_MAP]);
}

export async function getTargetToken(
  srcToken: Token,
  targetChainId: string,
  rpcProvider: ethers.providers.JsonRpcProvider
): Promise<Token> {
  // const tokenAddress = await getTargetTokenAddress(
  //   srcToken,
  //   targetChainId,
  //   rpcProvider
  // );
  // if (tokenAddress === '0x') {
  //   throw new Error('token does not exist');
  // }
  // return getTokenByAddressAndChainId(tokenAddress, targetChainId);
  return USDC_MAP;
}

export function toTargetToken(chainId: number, token: Token) {
  let targetToken: Token;
  switch (chainId) {
    case ChainId.MAINNET:
      targetToken = USDC_MAINNET;
      break;
    case ChainId.BSC:
      targetToken = USDC_BNB;
      break;
    case ChainId.BSC_TEST:
      targetToken = BUSD_BSCT;
      break;  
    case ChainId.POLYGON:
      targetToken = USDC_POLYGON;
      break;
    case ChainId.POLYGON_MUMBAI:
      targetToken = PUSD_POLYGON_MUMBAI;
      break;
    case ChainId.NEAR:
      targetToken = USDC_NEAR;
      break;
    case ChainId.NEAR_TEST:
      targetToken = AURORA_NEART;
      break;
    default:
      throw new Error('There is no such token in the chain');
  }

  return targetToken;
}

const IS_MAP = (id: number): boolean => {
  switch (id) {
    case 22776:
    case 212:
      return true;
    default:
      return false;
  }
};

const IS_EVM = (id: string): boolean => {
  switch (id) {
    case '1':
    case '3':
    case '4':
    case '5':
    case '42':
    case '10':
    case '69':
    case '42161':
    case '421611':
    case '137':
    case '97':
    case '80001':
    case '56':
    case '22776':
    case '212':
    case '34434':
      return true;
    case '5566818579631833089':
      return false;
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

const IS_NEAR = (id: string): boolean => {
  switch (id) {
    case '1':
    case '3':
    case '4':
    case '5':
    case '42':
    case '10':
    case '69':
    case '97':
    case '42161':
    case '421611':
    case '137':
    case '80001':
    case '56':
    case '22776':
    case '212':
    case '34434':
      return false;
    case '5566818579631833089':
      return true;
    default:
      throw new Error(`Unsupported chain id: ${id}`);
  }
};

class TokenRegister {
  private readonly contract: ButterContractType;
  private readonly provider: ButterProviderType;
  constructor(contractAddress: string, signerOrProvider: ButterProviderType) {
    if (
      signerOrProvider instanceof Signer ||
      signerOrProvider instanceof Provider
    ) {
      this.contract = new ethers.Contract(
        contractAddress,
        TokenRegisterMetadata.abi,
        signerOrProvider
      );
    } else {
      this.contract = new signerOrProvider.Contract(
        TokenRegisterMetadata.abi as any,
        contractAddress
      );
    }
    this.provider = signerOrProvider;
  }

  async getRelayChainToken(
    fromChain: string,
    fromToken: Token
  ): Promise<string> {
    if (fromToken.isNative) {
      fromToken = fromToken.wrapped;
    }
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.getRelayChainToken(
        fromChain,
        getHexAddress(fromToken.address, fromToken.chainId.toString(), false)
      );
    } else return '';
  }


  async getFeeRate(
    tokenAddress: string,
    toChain: string
  ): Promise<ButterFeeRate> {
    if (this.contract instanceof ethers.Contract) {
      return (await this.contract.getToChainTokenInfo(tokenAddress, toChain))
        .feeRate;
    } else throw new Error('contract type not supported');
  }

  async getRelayChainAmount(
    tokenAddress: string,
    fromChain: string,
    amount: string
  ): Promise<string> {
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.getRelayChainAmount(
        tokenAddress,
        fromChain,
        amount
      );
    } else return '';
  }

  async getTokenFee(
    tokenAddress: string,
    amount: string,
    toChain: string
  ): Promise<string> {
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.getTokenFee(
        tokenAddress,
        BigNumber.from(amount),
        BigNumber.from(toChain)
      );
    } else return '';
  }

  async getVaultToken(tokenAddress: string): Promise<string> {
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.getVaultToken(tokenAddress);
    } else return '';
  }

  async getToChainToken(
    tokenAddress: string,
    targetChain: string
  ): Promise<string> {
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.getToChainToken(tokenAddress, targetChain);
    } else return '';
  }
}

class VaultToken {
  private readonly contract: ButterContractType;
  private readonly provider: ButterProviderType;
  constructor(contractAddress: string, signerOrProvider: ButterProviderType) {
    if (
      signerOrProvider instanceof Signer ||
      signerOrProvider instanceof Provider
    ) {
      this.contract = new ethers.Contract(
        contractAddress,
        VaultTokenMetadata.abi,
        signerOrProvider
      );
    } else {
      this.contract = new signerOrProvider.Contract(
        VaultTokenMetadata.abi as any,
        contractAddress
      );
    }
    this.provider = signerOrProvider;
  }

  async getVaultBalance(chainId: string): Promise<string> {
    if (this.contract instanceof ethers.Contract) {
      return await this.contract.vaultBalance(chainId);
    } else return '';
  }
}

function getHexAddress(
  address: string,
  chainId: string,
  isAddress: boolean
): string {
  if (IS_EVM(chainId)) {
    return address;
  } else if (IS_NEAR(chainId)) {
    return address.startsWith('0x') ? address : asciiToHex(address, isAddress);
  } else {
    throw new Error(`chain id: ${chainId} not supported`);
  }
}

function asciiToHex(input: string, isAddress: boolean): string {
  let hexArr = [];
  for (let i = 0; i < input.length; i++) {
    let hex = Number(input.charCodeAt(i)).toString(16);
    hexArr.push(hex);
  }
  let res = hexArr.join('');
  if (isAddress) {
    if (res.length > 40) {
      res = res.substring(0, 40);
    } else if (res.length < 40) {
      let diff = 40 - res.length;
      for (let i = 0; i < diff; i++) {
        res = '0' + res;
      }
    }
  }
  return '0x' + res;
}

function getTokenByAddressAndChainId(
  tokenAddress: string,
  chainId: string
): Token {
  const supportedToken: Token[] = ID_TO_ALL_TOKEN(chainId);
  for (let i = 0; i < supportedToken.length; i++) {
    if (
      getHexAddress(
        supportedToken[i]!.address,
        chainId,
        false
      ).toLowerCase() === tokenAddress.toLowerCase()
    ) {
      return supportedToken[i]!;
    }
  }
  throw new Error(
    `Internal Error: could not find token ${tokenAddress} on chain: ${chainId}`
  );
}

// export async function getDistributeRate(
//   mapChainId: string
// ): Promise<ButterFeeDistribution> {
// }

//Waiting for data to be injected
const ID_TO_ALL_TOKEN = (id: string): Token[] => {
  //test token
  const MAP_TEST_MOST = new Token(
    212,
    '0xc74bc33a95a62D90672aEFAf4bA784285903cf09',
    18,
    'MOST',
    'MOST Token'
  );

  const BSC_TEST_MOST = new Token(
    97,
    '0x688f3Ef5f728995a9DcB299DAEC849CA2E49ddE1',
    18,
    'MOST',
    'MOST Token'
  );

  switch (id) {
    case '212':
      return [MAP_TEST_MOST];
    case '34434':
      return [];
    case '5566818579631833089':
      return [];
    case '97':
      return [BSC_TEST_MOST];
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};

function _getFeeAmount(amount: string, feeRate: ButterFeeRate): string {
  const feeAmount = BigNumber.from(amount).mul(feeRate.rate).div(10000);

  if (feeAmount.gt(feeRate.highest)) {
    return feeRate.highest.toString();
  } else if (feeAmount.lt(feeRate.lowest)) {
    return feeRate.lowest.toString();
  }
  return feeAmount.toString();
}
