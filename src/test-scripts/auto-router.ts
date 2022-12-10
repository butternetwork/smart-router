import { BigNumber, ethers } from 'ethers';
import { GET_TOKEN_ICON } from '../providers';
import {
  USDC_MAINNET,
  USDT_MAINNET,
  USDC_BNB,
  USDT_BNB,
  WBNB_BNB,
  USDC_NEAR,
  WNEAR_NEAR,
  USDT_NEAR,
  USDC_POLYGON,
  USDT_POLYGON,
  WMAP_MAP,
  USDC_MAP,
  BMOS_BSCT,
  BUSD_BSCT,
  PMOS_POLYGON_MUMBAI,
  PUSD_POLYGON_MUMBAI
} from '../providers/token-provider';
import { RouteWithValidQuote } from '../routers';
import { _getExchangeMultipleArgs } from '../routers/alpha-router/functions/get-curve-best-router';
import { getBestRoute } from '../routers/butter-router';
import {
  ChainId,
  nearRouterToString,
  routeAmountToString,
} from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';
import { BSC_MAINNET_URL, BSC_TESTNET_URL, ETH_MAINNET_URL, MAP_MAINNET_URL, POLYGON_MAINNET_URL, POLYGON_MUMBAI_URL } from '../util/urls';

async function main() {
  const amount = '9957';

  // await findBestRouter(ChainId.BSC,WBNB_BNB,USDC_BNB,amount);
  // await findBestRouter(ChainId.BSC_TEST,BMOS_BSCT,BUSD_BSCT,amount);
  // await findBestRouter(ChainId.NEAR,USDC_NEAR,WNEAR_NEAR,amount)
   await findBestRouter(ChainId.NEAR_TEST,USDC_NEAR,WNEAR_NEAR,amount)
  // await findBestRouter(ChainId.MAP,WMAP_MAP,USDC_MAP,amount)
  // await findBestRouter(ChainId.MAINNET,USDC_MAINNET,USDT_MAINNET,amount)
  // await findBestRouter(ChainId.POLYGON,USDT_POLYGON,USDC_POLYGON,amount)
  // await findBestRouter(ChainId.POLYGON_MUMBAI,PMOS_POLYGON_MUMBAI,PUSD_POLYGON_MUMBAI,amount)
}

async function findBestRouter(
  chainId: number,
  tokenIn: Token,
  tokenOut: Token,
  amount: string
): Promise<[number, number, RouteWithValidQuote[]]> {
  let provider: any;
  let protocols: ButterProtocol[] = [];
  let total = 0;
  let gasCostInUSD = 0;

  switch (chainId) {
    case ChainId.MAINNET:
      provider = new ethers.providers.JsonRpcProvider(ETH_MAINNET_URL, 1);
      protocols = [
        //ButterProtocol.UNI_V2,
        ButterProtocol.UNI_V3,
        //ButterProtocol.SUSHISWAP,
        //ButterProtocol.CURVE,
      ];
      break;
    case ChainId.BSC: //bsc
      provider = new ethers.providers.JsonRpcProvider(BSC_MAINNET_URL, chainId); //forked net chianId
      protocols = [ButterProtocol.PANCAKESWAP];
      break;
    case ChainId.BSC_TEST: //bsc
      provider = new ethers.providers.JsonRpcProvider(BSC_TESTNET_URL, chainId); //forked net chianId
      protocols = [ButterProtocol.PANCAKESWAP];
      break;
    case ChainId.POLYGON:
      provider = new ethers.providers.JsonRpcProvider(POLYGON_MAINNET_URL, chainId);
      protocols = [
        ButterProtocol.QUICKSWAP,
        ButterProtocol.UNI_V3,
        ButterProtocol.SUSHISWAP,
      ];
      break;
    case ChainId.POLYGON_MUMBAI:
      provider = new ethers.providers.JsonRpcProvider(POLYGON_MUMBAI_URL, chainId);
      protocols = [
        ButterProtocol.QUICKSWAP
      ];
      break;
    case ChainId.MAP: //map
      provider = new ethers.providers.JsonRpcProvider(MAP_MAINNET_URL, chainId);
      protocols = [ButterProtocol.HIVESWAP];
      break;
    case ChainId.NEAR: //near
      protocols = [ButterProtocol.REF];
      break;
    case ChainId.NEAR_TEST: //near
      protocols = [ButterProtocol.REF];
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
    return [0, 0, []];
  }

  if (chainId == ChainId.NEAR || chainId == ChainId.NEAR_TEST) {
    for (let route of swapRoute.route) {
      total += Number(route.output.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
      console.log(nearRouterToString(route, tokenIn.symbol, tokenOut.symbol));
    }
  } else {
    for (let route of swapRoute.route) {
      console.log(`${routeAmountToString(route)} = ${route.quote.toExact()})}`);
      total += Number(route.output.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
    }
  }

  return [total, gasCostInUSD, swapRoute.route];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
