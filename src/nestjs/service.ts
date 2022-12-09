import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  BRIDGE_SUPPORTED_TOKEN,
  GET_TOKEN_ICON,
  USDC_MAP,
  WMAP_MAP,
} from '../providers/token-provider';
import {
  RefRoute,
  RefRouteWithValidQuote,
  RouteWithValidQuote,
  SwapRoute,
} from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import {
  ChainId,
  getChainProvider,
  IS_SUPPORT_CHAIN,
  routeAmountToString,
  ROUTER_INDEX,
  ZERO_ADDRESS,
} from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getTargetToken, toTargetToken } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

type sortObj = {
  index: Token;
  value: number;
};

type swapData = {
  chainId: string;
  dexName: string;
  amountIn: string;
  amountOut: string;
  tokenIn: token;
  tokenOut: token;
  path: {
    tokenIn: {
      address: string;
      name: string;
      symbol: string;
      icon: string;
    };
    tokenOut: {
      address: string;
      name: string;
      symbol: string;
      icon: string;
    };
  }[];
};

type token = {
  address: string;
  name: string;
  decimals: number;
  symbol: string;
  icon: string;
};

type allRouter = {
  srcChain: swapData[];
  mapChain: swapData[];
  targetChain: swapData[];
};

enum RouterType {
  SRC_CHAIN = 0,
  TARGET_CHAIN = 1,
}

@Injectable()
export class RouterService {
  async crossChainRouter(
    tokenInAddr: string,
    tokenInDecimals: number,
    tokenInSymbol: string,
    tokenOutAddr: string,
    tokenOutDecimals: number,
    tokenOutSymbol: string,
    amount: string,
    fromChainId: string,
    toChainId: string
  ): Promise<allRouter> {
    IS_SUPPORT_CHAIN(fromChainId);
    IS_SUPPORT_CHAIN(toChainId);
    if (fromChainId == toChainId) {
      throw new Error('fromChainId and toChainId cannot be the same');
    }

    const rpcProvider = new ethers.providers.JsonRpcProvider(
      'http://18.142.54.137:7445',
      212
    );
    const tokenADecimals: number = Number(tokenInDecimals);
    const tokenBDecimals: number = Number(tokenOutDecimals);
    let ChainAId: number;
    let ChainBId: number;
    let tokenIn: Token;
    let tokenOut: Token;
    if (fromChainId == '5566818579631833088') {
      ChainAId = ChainId.NEAR;
      tokenIn = new Token(
        ChainAId,
        ZERO_ADDRESS,
        tokenADecimals,
        tokenInSymbol,
        tokenInAddr
      );
    } else {
      ChainAId = Number(fromChainId);
      tokenIn = new Token(ChainAId, tokenInAddr, tokenADecimals, tokenInSymbol);
    }
    if (toChainId == '5566818579631833088') {
      ChainBId = ChainId.NEAR;
      tokenOut = new Token(
        ChainBId,
        ZERO_ADDRESS,
        tokenBDecimals,
        tokenOutSymbol,
        tokenOutAddr
      );
    } else {
      ChainBId = Number(toChainId);
      tokenOut = new Token(
        ChainBId,
        tokenOutAddr,
        tokenBDecimals,
        tokenOutSymbol
      );
    }

    const srcRouter = await chainRouter(
      tokenIn,
      Number(amount),
      ChainAId,
      RouterType.SRC_CHAIN
    );
    let srcAmountOut = 0;
    for (let p of srcRouter) {
      srcAmountOut += Number(p.amountOut);
    }
    // let t = new Token(Number(fromChainId),srcRouter.contractPrams.targetToken,18)
    // toTargetToken(Number(fromChainId),t)
    // let bridgeFee = await getBridgeFee(BRIDGE_SUPPORTED_TOKEN[0]!,'212',srcAmountOut.toString(),rpcProvider) // chainId
    // srcAmountOut -= Number(bridgeFee)

    const targetRouter = await chainRouter(
      tokenOut,
      srcAmountOut,
      ChainBId,
      RouterType.TARGET_CHAIN
    );
    const mapRouter: swapData[] = [
      {
        chainId: ChainId.MAP.toString(),
        dexName: ButterProtocol.HIVESWAP,
        amountIn: '',
        amountOut: '',
        tokenIn: {
          address: USDC_MAP.address,
          name: USDC_MAP.name!,
          decimals: USDC_MAP.decimals,
          symbol: USDC_MAP.symbol!,
          icon: GET_TOKEN_ICON(USDC_MAP.address),
        },
        tokenOut: {
          address: USDC_MAP.address,
          name: USDC_MAP.name!,
          decimals: USDC_MAP.decimals,
          symbol: USDC_MAP.symbol!,
          icon: GET_TOKEN_ICON(USDC_MAP.address),
        },
        path: [],
      },
    ];

    return {
      srcChain: srcRouter,
      mapChain: mapRouter,
      targetChain: targetRouter,
    };
  }
}

async function findBestRouter(
  chainId: number,
  tokenIn: Token,
  tokenOut: Token,
  amount: string
): Promise<any> {
  const config = getChainProvider(chainId);
  let swapRoute;

  if (chainId != ChainId.NEAR) {
    swapRoute = await getBestRoute(
      chainId,
      config.provider!,
      config.protocols,
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
  } else {
    swapRoute = await getBestRoute(
      chainId,
      config.provider!,
      config.protocols,
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
  }

  let total = 0;
  let gasCostInUSD = 0;

  if (swapRoute == null) {
    return [total, gasCostInUSD, []];
  }

  for (let route of swapRoute.route) {
    total += Number(route.output.toExact());
    gasCostInUSD += Number(route.gasCostInUSD.toExact());
  }

  return [total, gasCostInUSD, swapRoute.route];
}

async function chainRouter(
  swapToken: Token,
  amount: number,
  chainId: number,
  routerType: number
): Promise<swapData[]> {
  // data of demo, wait to deploy mos contract
  const TokenList = BRIDGE_SUPPORTED_TOKEN; //await getTokenCandidates('212',chainId.toString(),rpcProvider)
  let tmp: sortObj[] = [];
  let RouterMap = new Map();
  for (let token of TokenList) {
    let tokenIn: Token = swapToken;
    let tokenOut: Token = toTargetToken(chainId, token);
    if (routerType == RouterType.TARGET_CHAIN) {
      tokenIn = toTargetToken(chainId, token); //await getTargetToken(token,chainId.toString(),rpcProvider)
      tokenOut = swapToken;
    }

    let [total, gas, router] = await findBestRouter(
      chainId,
      tokenIn,
      tokenOut,
      amount.toFixed(tokenIn.decimals)
    );
    tmp.push({
      index: token,
      value: total - gas,
    });
    RouterMap.set(token, router);
  }

  tmp.sort((a, b) => (a.value > b.value ? 1 : b.value > a.value ? -1 : 0));

  const key: Token = tmp[tmp.length - 1]!.index;
  const bestRouter: RouteWithValidQuote[] = RouterMap.get(key);

  if (bestRouter == null) {
    return [];
  }

  let icon_key1 = swapToken.address;
  let icon_key2 = key.address;
  if (swapToken.chainId == ChainId.NEAR) {
    icon_key1 = swapToken.name!;
  }
  if (key.chainId == ChainId.NEAR) {
    icon_key2 = key.name!;
  }

  const token1: token = {
    address: swapToken.address,
    name: swapToken.name!,
    decimals: swapToken.decimals!,
    symbol: swapToken.symbol!,
    icon: GET_TOKEN_ICON(icon_key1),
  };
  const token2: token = {
    address: key.address,
    name: key.name!,
    decimals: key.decimals!,
    symbol: key.symbol!,
    icon: GET_TOKEN_ICON(icon_key2),
  };

  if (routerType == RouterType.TARGET_CHAIN) {
    return formatData(bestRouter, token2, token1, chainId);
  }

  return formatData(bestRouter, token1, token2, chainId);
}

function formatData(
  bestRouter: RouteWithValidQuote[],
  tokenIn: token,
  tokenOut: token,
  chainId: number
): swapData[] {
  let pairs = [];
  let swapPath: swapData[] = [];

  for (let i = 0; i < bestRouter.length; i++) {
    if (chainId == ChainId.NEAR) {
      const refRouter = bestRouter[i]!;
      if (refRouter instanceof RefRouteWithValidQuote) {
        for (let r of refRouter.swapData!) {
          pairs.push({
            tokenIn: {
              address: r.tokenIn,
              name: r.tokenInName,
              symbol: r.tokenInSymbol,
              icon: r.tokenInIcon,
            },
            tokenOut: {
              address: r.tokenOut,
              name: r.tokenOutName,
              symbol: r.tokenOutSymbol,
              icon: r.tokenOutIcon,
            },
          });
        }

        swapPath.push({
          chainId: chainId.toString(),
          amountIn: refRouter.amount.toExact(),
          amountOut: refRouter.output.toExact(),
          path: pairs,
          dexName: bestRouter[i]!.platform,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
        });
      } else {
        throw 'get ref router fail';
      }
    } else {
      for (let j = 0; j < bestRouter[i]!.poolAddresses.length; j++) {
        pairs.push({
          tokenIn: {
            name: bestRouter[i]!.tokenPath[j]?.name!,
            symbol: bestRouter[i]!.tokenPath[j]?.symbol!,
            icon: GET_TOKEN_ICON(bestRouter[i]!.tokenPath[j]?.address!),
            address: bestRouter[i]!.tokenPath[j]?.address!,
          },
          tokenOut: {
            name: bestRouter[i]!.tokenPath[j + 1]?.name!,
            symbol: bestRouter[i]!.tokenPath[j + 1]?.symbol!,
            icon: GET_TOKEN_ICON(bestRouter[i]!.tokenPath[j + 1]?.address!),
            address: bestRouter[i]!.tokenPath[j + 1]?.address!,
          },
        });
      }

      swapPath.push({
        chainId: chainId.toString(),
        amountIn: bestRouter[i]!.amount.toExact(),
        amountOut: bestRouter[i]!.quote.toExact(),
        path: pairs,
        dexName: bestRouter[i]!.platform,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
      });

      pairs = [];
    }
  }

  return swapPath;
}
