import { BigNumber, ethers, Signer } from 'ethers';
import { Token } from './token';
import { Provider } from '@ethersproject/abstract-provider';
import TokenRegisterMetadata from '../abis/TokenRegister.json';
import { Eth } from 'web3-eth';
import { Contract } from 'web3-eth-contract';
import { Method } from 'web3-core-method';
import Web3 from 'web3';
import BN from 'bn.js';
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
  USDC_NEART,
  mUSDC_MAPT,
  USDC_ETHT,
} from '../providers/token-provider';
import VaultTokenMetadata from '../abis/VaultToken.json';

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

const MOS_CONTRACT_ADDRESS_SET: { [chainId in mosSupportedChainId]: string } = {
  [mosSupportedChainId.MAP_MAINNET]:
    '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.BSC_MAINNET]:
    '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.POLYGON_MAINNET]:
    '0x630105189c7114667a7179Aa57f07647a5f42B7F',
  [mosSupportedChainId.NEAR_MAINNET]: 'mos.mfac.butternetwork.near',

  [mosSupportedChainId.ETH_PRIV]: '0x43130059C655314d7ba7eDfb8299d26FbDE726F1',
  [mosSupportedChainId.BSC_TEST]: '0x220bE51C717c4E257Cb8e96be8591740336623F8',
  [mosSupportedChainId.MAP_TEST]: '0xB6c1b689291532D11172Fb4C204bf13169EC0dCA',
  [mosSupportedChainId.POLYGON_TEST]:
    '0x688f3Ef5f728995a9DcB299DAEC849CA2E49ddE1',
  [mosSupportedChainId.NEAR_TESTNET]: 'mos2.mfac.maplabs.testnet',
};
const TOKEN_REGISTER_ADDRESS_SET: { [mosSupportedChainId: string]: string } = {
  [mosSupportedChainId.MAP_TEST]: '0x648349aDd3790813787746A7A569a87216944003',
  [mosSupportedChainId.MAP_MAINNET]:
    '0xff44790d336d3C004F2Dac7e401E4EA5680529dD',
};
const ID_TO_ALL_TOKEN = (id: string): Token[] => {
  switch (id) {
    case '212':
      return [mUSDC_MAPT];
    case '5':
      return [USDC_ETHT];
    case '5566818579631833089':
      return [USDC_NEART];
    case '97':
      return [BUSD_BSCT];
    case '80001':
      return [PUSD_POLYGON_MUMBAI];
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};
const ID_TO_SUPPORTED_TOKEN = (id: string): Token[] => {
  switch (Number(id)) {
    case ChainId.MAP:
      return [];
    case ChainId.BSC:
      return [USDC_BNB];
    case ChainId.POLYGON:
      return [USDC_POLYGON];
    case ChainId.NEAR:
      return [USDC_NEAR];
    case ChainId.GÖRLI:
      return [USDC_ETHT];
    case 212:
      return [mUSDC_MAPT];
    case ChainId.NEAR_TEST:
      return [USDC_NEART];
    case ChainId.BSC_TEST:
      return [BUSD_BSCT];
    case ChainId.POLYGON_MUMBAI:
      return [PUSD_POLYGON_MUMBAI];
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};
const ID_TO_DEFAULT_RPC_URL = (id: string): string => {
  switch (Number(id)) {
    // mainnet
    case ChainId.MAP:
      return 'https://poc3-rpc.maplabs.io/';
    case ChainId.BSC:
      return 'https://bsc-dataseed1.defibit.io/';
    case ChainId.POLYGON:
      return 'https://polygon-rpc.com/';
    case ChainId.NEAR:
      return 'https://rpc.mainnet.near.org';
    // testnet
    case 212:
      return 'https://testnet-rpc.maplabs.io';
    case ChainId.GÖRLI:
      return 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
    case ChainId.BSC_TEST:
      return 'https://data-seed-prebsc-2-s2.binance.org:8545';
    case ChainId.POLYGON_MUMBAI:
      return 'https://rpc-mumbai.maticvigil.com/';
    case ChainId.NEAR_TEST:
      return 'https://rpc.testnet.near.org';
    default:
      throw new Error(`Unknown chain id: ${id}`);
  }
};
const IS_MAP = (id: string): boolean => {
  switch (id) {
    case '22776':
    case '212':
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
const TOKEN_REGISTER_ADDRESS = '0x648349aDd3790813787746A7A569a87216944003';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getBridgeFee(
  srcToken: Token,
  targetChain: string,
  amount: string,
  provider: ethers.providers.JsonRpcProvider,
  providerChainId: string
): Promise<ButterFee> {
  let srcChainId = isNearChainId(srcToken.chainId.toString());
  let targetChainId = isNearChainId(targetChain);
  const tokenRegister = new TokenRegister(
    TOKEN_REGISTER_ADDRESS_SET[providerChainId]!,
    provider
  );
  let feeAmount = '';
  let feeRate: ButterFeeRate = { lowest: '0', rate: '0', highest: '0' };
  if (IS_MAP(srcChainId)) {
    const tokenAddress = srcToken.isNative
      ? srcToken.wrapped.address
      : srcToken.address;
    const tokenFeeRate = await tokenRegister.getFeeRate(
      tokenAddress,
      targetChainId
    );
    feeRate.lowest = tokenFeeRate.lowest.toString();
    feeRate.highest = tokenFeeRate.highest.toString();
    feeRate.rate = BigNumber.from(tokenFeeRate.rate).div(100).toString();
    feeAmount = _getFeeAmount(amount, feeRate);
  } else {
    const mapTokenAddress = await tokenRegister.getRelayChainToken(
      srcChainId,
      srcToken
    );
    const relayChainAmount = await tokenRegister.getRelayChainAmount(
      mapTokenAddress,
      srcChainId,
      amount
    );
    const tokenFeeRate: ButterFeeRate = await tokenRegister.getFeeRate(
      mapTokenAddress,
      targetChainId
    );
    feeRate.lowest = tokenFeeRate.lowest;
    feeRate.highest = tokenFeeRate.highest;
    feeRate.rate = BigNumber.from(tokenFeeRate.rate).div(100).toString();
    const feeAmountInMappingToken = _getFeeAmount(relayChainAmount, feeRate);
    const feeAmountBN = BigNumber.from(feeAmountInMappingToken);

    feeRate.lowest = BigNumber.from(feeRate.lowest)
      .mul(amount)
      .div(relayChainAmount)
      .toString();
    feeRate.highest = BigNumber.from(feeRate.highest)
      .mul(amount)
      .div(relayChainAmount)
      .toString();
    feeAmount = feeAmountBN.mul(amount).div(relayChainAmount).toString();
  }
  return Promise.resolve({
    feeToken: srcToken,
    feeRate: feeRate,
    amount: feeAmount.toString(),
  });
}

export async function getVaultBalance(
  fromChainId: string,
  fromToken: Token,
  toChainId: string,
  rpcProvider: ethers.providers.JsonRpcProvider,
  mapChainId: string
): Promise<VaultBalance> {
  let fromChain = isNearChainId(fromChainId);
  let toChain = isNearChainId(toChainId);
  const tokenRegister = new TokenRegister(TOKEN_REGISTER_ADDRESS, rpcProvider);

  if (fromToken.isNative) {
    fromToken = fromToken.wrapped;
  }
  const mapTokenAddress = IS_MAP(fromChain)
    ? fromToken.address
    : await tokenRegister.getRelayChainToken(fromChain, fromToken);
  const vaultAddress = await tokenRegister.getVaultToken(mapTokenAddress);

  if (vaultAddress === ZERO_ADDRESS) {
    throw new Error('vault address not found for token: ' + mapTokenAddress);
  }
  const vaultToken = new VaultToken(vaultAddress, rpcProvider);

  let tokenBalance = await vaultToken.getVaultBalance(toChain);
  let toChainTokenAddress = mapTokenAddress;
  if (!IS_MAP(toChain)) {
    toChainTokenAddress = await tokenRegister.getToChainToken(
      mapTokenAddress,
      toChain
    );

    if (toChainTokenAddress === '0x') {
      throw new Error(
        'Internal Error: Cannot find corresponding target token on target chain'
      );
    }

    const mapToken = getTokenByAddressAndChainId(mapTokenAddress, mapChainId);
    const toChainToken = getTokenByAddressAndChainId(
      toChainTokenAddress,
      toChain
    );
    tokenBalance = BigNumber.from(tokenBalance)
      .mul(ethers.utils.parseUnits('1', toChainToken.decimals))
      .div(ethers.utils.parseUnits('1', mapToken.decimals))
      .toString();
  }
  return Promise.resolve({
    token: getTokenByAddressAndChainId(toChainTokenAddress, toChain),
    balance: tokenBalance.toString(),
  });
}

export async function getTokenCandidates(
  fromChainId: string,
  toChainId: string,
  //provider: ethers.providers.JsonRpcProvider,
  mapChainId: string
): Promise<Token[]> {
  const mapUrl = ID_TO_DEFAULT_RPC_URL(mapChainId);
  const web3 = new Web3(mapUrl);

  const tokenRegisterContract = new web3.eth.Contract(
    TokenRegisterMetadata.abi as any,
    TOKEN_REGISTER_ADDRESS_SET[mapChainId]
  );

  let tokenArr = ID_TO_SUPPORTED_TOKEN(fromChainId).map((token: Token) => {
    if (IS_NEAR(token.chainId.toString())) {
      if (token.isNative) {
        return getHexAddress(
          token.wrapped.address,
          token.chainId.toString(),
          false
        );
      } else
        return getHexAddress(token.address, token.chainId.toString(), false);
    } else {
      if (token.isNative) {
        return token.wrapped.address;
      } else return token.address;
    }
  });
  if (!IS_MAP(fromChainId)) {
    tokenArr = await batchGetRelayChainToken(
      tokenRegisterContract,
      fromChainId,
      tokenArr,
      mapUrl
    );
  }

  if (IS_MAP(toChainId)) {
    return ID_TO_SUPPORTED_TOKEN(fromChainId);
  }
  const toChainTokenList = await batchGetToChainToken(
    tokenRegisterContract,
    tokenArr,
    toChainId,
    mapUrl
  );
  let supportedFromChainTokenArr: Token[] = [];
  for (let i = 0; i < toChainTokenList.length; i++) {
    if (toChainTokenList[i] != null && toChainTokenList[i] != '0x') {
      supportedFromChainTokenArr.push(ID_TO_SUPPORTED_TOKEN(fromChainId)[i]!);
    }
  }
  return supportedFromChainTokenArr;
  //return Promise.resolve([USDC_MAP]);
}

export async function getTargetToken(
  srcToken: Token,
  targetChainId: string,
  //rpcProvider: ethers.providers.JsonRpcProvider,
  mapChainId: string
): Promise<Token> {
  const tokenAddress = await getTargetTokenAddress(
    srcToken,
    targetChainId,
    mapChainId
  );
  if (tokenAddress === '0x') {
    throw new Error('token does not exist');
  }
  return getTokenByAddressAndChainId(tokenAddress, targetChainId);
  //return USDC_MAP;
}

export async function getTargetTokenAddress(
  srcToken: Token,
  targetChainId: string,
  //rpcProvider: ethers.providers.JsonRpcProvider,
  mapChainId: string
): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider(
    ID_TO_DEFAULT_RPC_URL(mapChainId)
  );
  const tokenRegister = new TokenRegister(
    TOKEN_REGISTER_ADDRESS_SET[mapChainId]!,
    provider
  );
  let mapTokenAddress = srcToken.address;
  if (!IS_MAP(srcToken.chainId.toString())) {
    mapTokenAddress = await tokenRegister.getRelayChainToken(
      srcToken.chainId.toString(),
      srcToken
    );
  }
  let targetTokenAddress = mapTokenAddress;
  if (!IS_MAP(targetChainId)) {
    targetTokenAddress = await tokenRegister.getToChainToken(
      mapTokenAddress,
      targetChainId
    );
  }
  return targetTokenAddress;
}

export function toTargetToken(chainId: number, token: Token) {
  let targetToken: Token;
  switch (chainId) {
    case ChainId.MAINNET:
      targetToken = USDC_MAINNET;
      break;
    case ChainId.GÖRLI:
      targetToken = USDC_ETHT;
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
      targetToken = USDC_NEART;
      break;
    default:
      throw new Error(`There is no such token in the ${chainId} chain`);
  }

  return targetToken;
}

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
      let address = fromToken.address;
      if (
        fromChain == '5566818579631833088' ||
        fromChain == '5566818579631833089'
      ) {
        address = fromToken.name!;
      }
      return await this.contract.getRelayChainToken(
        fromChain,
        getHexAddress(address, fromChain, false)
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
    let address = supportedToken[i]!.address;
    if (chainId == '5566818579631833089' || chainId == '5566818579631833088') {
      address = supportedToken[i]!.name!;
    }
    if (
      getHexAddress(address, chainId, false).toLowerCase() ===
      tokenAddress.toLowerCase()
    ) {
      return supportedToken[i]!;
    }
  }
  throw new Error(
    `Internal Error: could not find token ${tokenAddress} on chain: ${chainId}`
  );
}

async function batchGetRelayChainToken(
  contract: Contract,
  fromChainId: string,
  tokenAddressArr: string[],
  mapRpcUrl: string
): Promise<string[]> {
  let calls: any[] = [];

  for (let i = 0; i < tokenAddressArr.length; i++) {
    const fromTokenAddress = tokenAddressArr[i];
    calls.push(
      contract.methods.getRelayChainToken(fromChainId, fromTokenAddress).call
    );
  }
  return await _makeBatchRequest(calls, mapRpcUrl);
}

async function batchGetToChainToken(
  contract: Contract,
  tokenAddressArr: string[],
  toChain: string,
  mapRpcUrl: string
): Promise<string[]> {
  let calls: any[] = [];

  for (let i = 0; i < tokenAddressArr.length; i++) {
    const tokenAddress = tokenAddressArr[i];
    calls.push(
      contract.methods.getToChainToken(tokenAddress, new BN(toChain, 10)).call
    );
  }
  return await _makeBatchRequest(calls, mapRpcUrl);
}

function _makeBatchRequest(calls: any[], mapRpcUrl: string): Promise<string[]> {
  const web3 = new Web3(mapRpcUrl);
  const batch = new web3.BatchRequest();

  const promises = calls.map((call: Method) => {
    return new Promise((resolve: any, reject: any) => {
      // @ts-ignore
      const req = call.request({}, (err, data: string) => {
        if (err) reject(err);
        else resolve(data);
      });
      batch.add(req);
    });
  });
  batch.execute();

  // @ts-ignore
  return Promise.all(promises);
}

function _getFeeAmount(amount: string, feeRate: ButterFeeRate): string {
  const feeAmount = BigNumber.from(amount).mul(feeRate.rate).div(10000);

  if (feeAmount.gt(feeRate.highest)) {
    return feeRate.highest.toString();
  } else if (feeAmount.lt(feeRate.lowest)) {
    return feeRate.lowest.toString();
  }
  return feeAmount.toString();
}

function isNearChainId(chainId: string): string {
  if (chainId == ChainId.NEAR.toString()) {
    return '5566818579631833088';
  } else if (chainId == ChainId.NEAR_TEST.toString()) {
    return '5566818579631833089';
  } else {
    return chainId;
  }
}
