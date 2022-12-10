import { BigNumber } from 'ethers';
import { ButterProtocol } from './protocol';

//mutilcall contract address
export const UNISWAP_MULTICALL_ADDRESS =
  '0x1F98415757620B543A52E61c46B32eB19261F984';
export const BSC_MULTICALL_ADDRESS =
  '0xC4b8A415EB2A1EABe12bfc34251e32ba2345036C';
export const BSC_TESTNET_MULTICALL_ADDRESS =
  '0xb10b46E2636B971FF73c140DA907214BEE076E4e';
export const MAP_MULTICALL_ADDRESS =
  '0x4CeBB149dc672c9d0e008C40698ca8A0b8ac6c0a';
export const MULTICALL2_ADDRESS = 
  '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696';


//factory contract address
export const V3_CORE_FACTORY_ADDRESS = 
  "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const MAP_FACTORY_ADDRESS = 
  '0x29c3d087302e3fCb75F16175A09E4C39119459B2';
export const BSC_TEST_FACTORY_ADDRESS = 
  '0x49C03F798790383E84C50Bc3EA71efA85d51B075';

//other contract address
export const QUOTER_V2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';
export const OVM_GASPRICE_ADDRESS = '0x420000000000000000000000000000000000000F';
export const ARB_GASINFO_ADDRESS = '0x000000000000000000000000000000000000006C';


export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NULL_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff';

// export const ROUTER_INDEX: {
//   [protocol in ButterProtocol]: BigNumber;
// } = {
//   V2: BigNumber.from(0),
//   V3: BigNumber.from(0),
//   SUSHISWAP: BigNumber.from(1),
//   QUICKSWAP: BigNumber.from(2),
//   PANCAKESWAP: BigNumber.from(3),
//   CURVE: BigNumber.from(4),
//   HIVESWAP: BigNumber.from(5),
//   REF: BigNumber.from(6),
// };

/*

export const ROUTER_ADDRESSES: {
  [protocol in ButterProtocol]: string;
} = {
  V2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  V3: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  QUICKSWAP: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
  SUSHISWAP: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  PANCAKESWAP: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  CURVE: ZERO_ADDRESS,
  HIVESWAP: ZERO_ADDRESS,
  REF: ZERO_ADDRESS,
};

export const WETH9: {
  [chainId in Exclude<
    ChainId,
    ChainId.POLYGON | ChainId.POLYGON_MUMBAI
  >]: Token;
} = {
  [ChainId.MAINNET]: new Token(
    ChainId.MAINNET,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.ROPSTEN]: new Token(
    ChainId.ROPSTEN,
    '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.RINKEBY]: new Token(
    ChainId.RINKEBY,
    '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.GÖRLI]: new Token(
    ChainId.GÖRLI,
    '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.KOVAN]: new Token(
    ChainId.KOVAN,
    '0xd0A1E359811322d97991E03f863a0C30C2cF029C',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.OPTIMISM]: new Token(
    ChainId.OPTIMISM,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.OPTIMISTIC_KOVAN]: new Token(
    ChainId.OPTIMISTIC_KOVAN,
    '0x4200000000000000000000000000000000000006',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.ARBITRUM_ONE]: new Token(
    ChainId.ARBITRUM_ONE,
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.ARBITRUM_RINKEBY]: new Token(
    ChainId.ARBITRUM_RINKEBY,
    '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.BSC]: new Token(
    ChainId.BSC,
    '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    18,
    'WETH',
    'Wrapped Ether'
  ),
};
*/
