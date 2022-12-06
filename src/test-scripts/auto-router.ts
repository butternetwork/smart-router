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
import { ChainId, nearRouterToString, routeAmountToString, ROUTER_INDEX, ZERO_ADDRESS } from '../util';
import { TradeType } from '../util/constants';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

let rpcUrl: string
let provider: any
let protocols: ButterProtocol[] = [];
const amount = '10000'

async function main() {
  // const [total1,gasCostInUSD1,_] = await findBestRouter(56,WBNB_BNB,USDC_BNB,amount)
  // const [total2,gasCostInUSD2,__] = await findBestRouter(ChainId.NEAR,USDC_NEAR,WNEAR_NEAR,amount)
  // console.log("final output:",total2)
  // console.log("swap gas(USD)",gasCostInUSD1!+gasCostInUSD2!)
  
  // await findBestRouter(22776,WMAP_MAP,USDC_MAP,amount)
  // await findBestRouter(1,USDT,USDC,amount)
  // await findBestRouter(137,USDT_MATIC,USDC_MATIC,amount)
  
}
async function findBestRouter(chainId: number, tokenIn: Token, tokenOut: Token, amount: string) :Promise<[number,number,RouteWithValidQuote[]]>{
  switch (chainId) {
    case 1:
      rpcUrl = "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 1);
      protocols = [
        ButterProtocol.UNI_V2,
        ButterProtocol.UNI_V3,
        ButterProtocol.SUSHISWAP,
        //ButterProtocol.CURVE,
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
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      protocols = [
        ButterProtocol.QUICKSWAP,
        ButterProtocol.UNI_V3,
        ButterProtocol.SUSHISWAP
      ];
      break;
    case 22776: //map
      rpcUrl = 'https://poc3-rpc.maplabs.io/';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      protocols = [
        ButterProtocol.HIVESWAP
      ];
      break;
    case ChainId.NEAR: //near
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

  if (chainId == ChainId.NEAR) {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});