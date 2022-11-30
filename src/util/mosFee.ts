import { BigNumber, ethers, Signer } from 'ethers';
import { Token } from './token';
import { Provider } from '@ethersproject/abstract-provider';
import TokenRegisterMetadata from '../abis/TokenRegister.json';
import { Eth } from 'web3-eth';
import { Contract } from 'web3-eth-contract';

const TOKEN_REGISTER_ADDRESS = '0xc81Fe3f111d44b5469B9179D3b40B99A2527cF7A'

export async function getBridgeFee(
    srcToken: Token,
    targetChain: string,
    amount: string,
    rpcProvider:ethers.providers.JsonRpcProvider
  ): Promise<ButterFee> {
    const tokenRegister = new TokenRegister(
      TOKEN_REGISTER_ADDRESS,
      rpcProvider
    );
    let feeAmount = '';
    if (IS_MAP(srcToken.chainId)) {
      const tokenAddress = srcToken.isNative
        ? srcToken.wrapped.address
        : srcToken.address;
      feeAmount = await tokenRegister.getTokenFee(
        tokenAddress,
        amount,
        targetChain
      );
    } else {
      const mapTokenAddress = await tokenRegister.getRelayChainToken(
        srcToken.chainId.toString(),
        srcToken
      );
  
      const relayChainAmount = await tokenRegister.getRelayChainAmount(
        mapTokenAddress,
        srcToken.chainId.toString(),
        amount
      );
      const feeAmountInMappingToken = await tokenRegister.getTokenFee(
        mapTokenAddress,
        amount,
        targetChain
      );
      const feeAmountBN = BigNumber.from(feeAmountInMappingToken);
      const ratio = BigNumber.from(amount).div(BigNumber.from(relayChainAmount));
      feeAmount = feeAmountBN.mul(ratio).toString();
    }
    return Promise.resolve({
      feeToken: srcToken,
      amount: feeAmount.toString(),
    });
  }
  
  interface ButterFee {
    feeToken: Token;
    amount: string;
  }

  type ButterProviderType = Signer | Provider | Eth;
  type ButterContractType = ethers.Contract | Contract;

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
      fromToken: Token,
    ): Promise<string> {
      // if (fromToken.isNative) {
      //   fromToken = fromToken.wrapped;
      // }
      if (this.contract instanceof ethers.Contract) {
        return await this.contract.getRelayChainToken(
          fromChain,
          getHexAddress(fromToken.address, fromToken.chainId.toString(), false)
        );
      } else return '';
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

  export async function getTokenCandidates(
    fromChainId: string,
    toChainId: string,
    provider: ethers.providers.JsonRpcProvider
  ): Promise<Token[]> { 
    const SHOW_TOKEN = new Token(
      56,
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      18,
      'WBNB',
      'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near'
    );
    return Promise.resolve([SHOW_TOKEN])
  }

  export function toSrcToken(t:Token){
    const SHOW_TOKEN = new Token(
      56,
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      18,
      'WBNB',
      'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near'
    );
    return SHOW_TOKEN
  }