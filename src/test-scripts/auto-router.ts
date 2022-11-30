import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { Protocol } from '@uniswap/router-sdk';
import { Pool } from '@uniswap/v3-sdk';
import { BigNumber, ethers } from 'ethers';
import {
  USDC,
  USDT,
  USDC_BNB,
  USDT_BNB,
  WBNB_BNB,
  USDC_NEAR,
  WNEAR_NEAR,
  USDT_NEAR,
  GLD_MAP,
  KUN_MAP,
  USDC_MATIC,
  USDT_MATIC,
  WMAP_MAP,
  USDC_MAP
} from '../providers/quickswap/util/token-provider';
import { SwapRoute } from '../routers';
import { _getExchangeMultipleArgs } from '../routers/alpha-router/functions/get-curve-best-router';
import { getBestRoute } from '../routers/barter-router';
import { nearRouterToString, routeAmountToString, ROUTER_INDEX } from '../util';
import { TradeType } from '../util/constants';
import { getUsdcLiquidity } from '../util/mapLiquidity';
import { BarterProtocol } from '../util/protocol';
import { Token } from '../util/token';
import eth_router_abi from './abi/eth-router.json';
import map_router_abi from './abi/map-router.json';
import ERC20_ABI from './abi/token.json';

const nearAPI = require("near-api-js");
const { keyStores, KeyPair, connect, Contract } = nearAPI;
const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = "ed25519:3vBnF4KwPAVcoaGWHFPD3NtKQgfdacajE8YGJzUoc7C9fzbnCr84tvKKg3Kjd75JetQu7b8EejyMKqZSgsCwnucE";
const keyPair = KeyPair.fromString(PRIVATE_KEY);
const accountId = "ashbarty.testnet"

let rpcUrl: string
let provider: any
let wallet: any
let signer: any
let routerContract: any
let protocols: BarterProtocol[] = [];
let tokenIn: Token;
let tokenOut: Token;


const amount = '10'
const abiCoder = new ethers.utils.AbiCoder();
const slippage = 3; // thousandth

async function main() {
  // const [total1,totalWithoutGas1,gasCostInUSD1] = await findBestRouter(1,WBNB_BNB,USDC_BNB,"10")
  // const usdcLiquidity = await getUsdcLiquidity()
  // if (total1&&total1>=Number(usdcLiquidity)){
  //   throw(`usdc liquidity ${usdcLiquidity} less than the swapped amount ${total1}`)
  // }
  // const [total2,totalWithoutGas2,gasCostInUSD2] = await findBestRouter(1313161554,USDC_NEAR,WNEAR_NEAR,total1!.toString())
  // console.log("final output:",total2)
  // console.log("gasCostInUSD",gasCostInUSD1!+gasCostInUSD2!)
  // console.log("outputWithoutGas:",totalWithoutGas2)
  console.log(await findBestRouter(22776, WMAP_MAP, USDC_MAP, "10000"))
}
async function findBestRouter(chainId: number, tokenA: Token, tokenB: Token, amount: string) {
  tokenIn = tokenA;
  tokenOut = tokenB;

  switch (chainId) {
    case 1: //fork_eth
      rpcUrl = 'http://54.255.196.147:9003'  //"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337); //forked net chianId
      wallet = new ethers.Wallet(
        'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0xAe9Ed85dE2670e3112590a2BB17b7283ddF44d9c', // wait to do
        eth_router_abi,
        signer
      );

      protocols = [
        BarterProtocol.UNI_V2,
        BarterProtocol.UNI_V3,
        BarterProtocol.SUSHISWAP,
        BarterProtocol.CURVE,
      ];
      break;
    case 56: //bsc
      rpcUrl = 'https://bsc-dataseed1.defibit.io/'
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);//forked net chianId
      wallet = new ethers.Wallet(
        '939ae45116ea2d4ef9061f13534bc451e9f9835e94f191970f23aac0299d5f7a'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x3044BED7679b031CCbefEC054FdA9aD350D372B4', // wait to do
        eth_router_abi,
        signer
      );

      protocols = [
        BarterProtocol.PANCAKESWAP,
      ];
      break;
    case 137:
      rpcUrl = 'https://polygon-mainnet.infura.io/v3/26b081ad80d646ad97c4a7bdb436a372'
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);//forked net chianId
      wallet = new ethers.Wallet(
        '939ae45116ea2d4ef9061f13534bc451e9f9835e94f191970f23aac0299d5f7a'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x3044BED7679b031CCbefEC054FdA9aD350D372B4',
        eth_router_abi,
        signer
      );

      protocols = [
        BarterProtocol.QUICKSWAP,
      ];
      break;
      break;
    case 212: //map test
      rpcUrl = 'http://18.142.54.137:7445';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      wallet = new ethers.Wallet(
        "438e472724961ae8a56e2247bebe921dc4e3437eecb6e15f9277871dfdb69383"
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x806e62028a4bab675dcf354ae190e8081b8a1137', // wait to do 
        map_router_abi,
        signer
      );
      protocols = [
        BarterProtocol.HIVESWAP
      ];
      break;
    case 22776: //map
      rpcUrl = 'https://poc3-rpc.maplabs.io/';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      wallet = new ethers.Wallet(
        "e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb"
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x806e62028a4bab675dcf354ae190e8081b8a1137', // wait to do 
        map_router_abi,
        signer
      );
      protocols = [
        BarterProtocol.HIVESWAP
      ];
      break;
    case 1313161554: //near
      protocols = [
        BarterProtocol.REF,
      ];
      break;
    default:
      tokenIn = USDT;
      tokenOut = USDC;
      rpcUrl = 'http://54.255.196.147:9003';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337); //forked net chianId
      wallet = new ethers.Wallet(
        'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0xB7ca895F81F20e05A5eb11B05Cbaab3DAe5e23cd', // wait to do
        eth_router_abi,
        signer
      );

      protocols = [
        BarterProtocol.UNI_V2,
        BarterProtocol.UNI_V3,
        BarterProtocol.SUSHISWAP,
        BarterProtocol.CURVE,
      ];
      break;
  }

  const swapRoute = await getBestRoute(
    chainId,
    provider,
    protocols,
    amount,
    tokenIn.address,
    tokenIn.decimals,
    tokenOut.address,
    tokenOut.decimals,
    TradeType.EXACT_INPUT,
    tokenIn.symbol,
    tokenIn.name,
    tokenOut.symbol,
    tokenOut.name
  );

  if (swapRoute == null) {
    return [0, 0, 0];
  }
  let total = 0
  let sum = 0;
  let gasCostInUSD = 0

  if (chainId == 1313161554) {
    for (let route of swapRoute.route) {
      total += Number(route.output.toExact())
      sum += parseFloat(route.quote.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
      console.log(nearRouterToString(route, tokenA.symbol, tokenB.symbol))
    }
  } else {
    for (let route of swapRoute.route) {
      console.log(`${routeAmountToString(route)} = ${route.quote.toExact()})}`);
      total += Number(route.output.toExact())
      sum += parseFloat(route.quote.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
    }
  }
  return [total, sum, gasCostInUSD]
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
