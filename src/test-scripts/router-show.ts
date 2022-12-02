import { ethers } from 'ethers';
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
import { RouteWithValidQuote } from '../routers';
import { _getExchangeMultipleArgs } from '../routers/alpha-router/functions/get-curve-best-router';
import { getBestRoute } from '../routers/butter-router';
import { nearRouterToString, routeAmountToString } from '../util';
import { TradeType } from '../util/constants';
import { getUsdcLiquidity } from '../util/mapLiquidity';
import { getBridgeFee, getTokenCandidates, toSrcToken } from '../util/mosFee';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

let rpcUrl: string
let provider: any
let protocols: ButterProtocol[] = [];
const amount = '10'

async function findBestRouter(chainId: number, tokenIn: Token, tokenOut: Token, amount: string) :Promise<[number,number,RouteWithValidQuote[]]>{
  switch (chainId) {
    case 1: //fork_eth
      rpcUrl = 'http://54.255.196.147:9003'  //"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337); //forked net chianId
      protocols = [
        ButterProtocol.UNI_V2,
        ButterProtocol.UNI_V3,
        ButterProtocol.SUSHISWAP,
        ButterProtocol.CURVE,
      ];
      break;
    case 56: //bsc
      rpcUrl = 'https://bsc-dataseed1.defibit.io/'
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);//forked net chianId
      protocols = [
        ButterProtocol.PANCAKESWAP,
      ];
      break;
    case 137:
      rpcUrl = 'https://polygon-mainnet.infura.io/v3/26b081ad80d646ad97c4a7bdb436a372'
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);//forked net chianId
      protocols = [
        ButterProtocol.QUICKSWAP,
      ];
      break;
      break;
    case 22776: //map
      rpcUrl = 'https://poc3-rpc.maplabs.io/';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      protocols = [
        ButterProtocol.HIVESWAP
      ];
      break;
    case 1313161554: //near
      protocols = [
        ButterProtocol.REF,
      ];
      break;
    default:
      protocols = [
        ButterProtocol.UNI_V2,
        ButterProtocol.UNI_V3,
        ButterProtocol.SUSHISWAP,
        ButterProtocol.CURVE,
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
    return [0, 0,[]];
  }
  let total = 0
  let gasCostInUSD = 0

  if (chainId == 1313161554) {
    for (let route of swapRoute.route) {
      total += Number(route.output.toExact())
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
      console.log(nearRouterToString(route, tokenIn.symbol, tokenOut.symbol))
    }
  } else {
    for (let route of swapRoute.route) {
      console.log(`${routeAmountToString(route)} = ${route.quote.toExact()})}`);
      total += Number(route.output.toExact())
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
    }
  }
  return [total, gasCostInUSD,swapRoute.route]
}

interface obj {
  index:Token,
  value:number
}

async function srcChainRouter(tokenIn:Token,chainId:number) {
  // data of demo 
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)// map testnet chainId:212
  //get the tokens common to both src chain and map chain
  const TokenList = await getTokenCandidates('212',chainId.toString(),rpcProvider)
  
  let tmp:obj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let bridgeFee = await getBridgeFee(token,'212',amount,rpcProvider)
    let [total,gas,router] = await findBestRouter(chainId,tokenIn,toSrcToken(token),amount)
    //check the liquidity of token is enough or not.
    let usdcLiquidity = await getUsdcLiquidity(USDC_MAP.address)
    if (total&&total>=Number(usdcLiquidity)){
      continue
    }
    tmp.push({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    })
    RouterMap.set({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    },router)
  }
  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))
  //get router of most output
  let bestRouter = RouterMap.get(tmp[tmp.length-1])
  console.log("best router in src chain",bestRouter)
  return [RouterMap,tmp]
}

async function mapRouter() {
  // data of demo 
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)// map testnet chainId:212
  //get the tokens common to both src chain and map chain
  const TokenList = await getTokenCandidates('212','56',rpcProvider)
  
  let tmp:obj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let bridgeFee = await getBridgeFee(token,'212',amount,rpcProvider)
    let [total,gas,router] = await findBestRouter(56,WBNB_BNB,toSrcToken(token),amount)
    //check the liquidity of token is enough or not.
    let usdcLiquidity = await getUsdcLiquidity(USDC_MAP.address)
    if (total&&total>=Number(usdcLiquidity)){
      continue
    }
    tmp.push({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    })
    RouterMap.set({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    },router)
  }
  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))
  //get router of most output
  let bestRouter = RouterMap.get(tmp[tmp.length-1])
  console.log("best router in src chain",bestRouter)
  return [RouterMap,tmp]
}

async function targetChainRouter(tokenOut:Token,chainId:number) {
  // data of demo 
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)// map testnet chainId:212
  //get the tokens common to both src chain and map chain
  const TokenList = await getTokenCandidates('212',chainId.toString(),rpcProvider)
  
  let tmp:obj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let bridgeFee = await getBridgeFee(token,'212',amount,rpcProvider)
    let [total,gas,router] = await findBestRouter(chainId,toSrcToken(token),tokenOut,amount)
    //check the liquidity of token is enough or not.
    let usdcLiquidity = await getUsdcLiquidity(USDC_MAP.address)
    if (total&&total>=Number(usdcLiquidity)){
      continue
    }
    tmp.push({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    })
    RouterMap.set({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    },router)
  }
  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))
  //get router of most output
  let bestRouter = RouterMap.get(tmp[tmp.length-1])
  console.log("best router in src chain",bestRouter)
  return [RouterMap,tmp]
}

async function crossChainRouter() {
  const [bscRouters,bscToken] = await srcChainRouter(WBNB_BNB,56)
  const [mapRouters,mapToken] = await mapRouter()
  const [nearRouters,nearToken] = await targetChainRouter(WBNB_BNB,1313161554)
  
}