import { Injectable } from '@nestjs/common';
import { name } from '@sushiswap/sdk';
import { ethers } from 'ethers';
import {
  BRIDGE_SUPPORTED_TOKEN,
  GET_TOKEN_ICON,
  mUSDC_MAP,
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
  CurrencyAmount,
  getChainProvider,
  IS_SUPPORT_CHAIN,
  NULL_ADDRESS,
  ZERO_ADDRESS,
} from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getTargetToken, toTargetToken } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

type sortObj = {
  key: number,
  pair:[Token,Token];
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
    id:string,
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
    } else if (fromChainId == '5566818579631833089') {
      ChainAId = ChainId.NEAR_TEST;
      tokenIn = new Token(
        ChainAId,
        ZERO_ADDRESS,
        tokenADecimals,
        tokenInSymbol,
        tokenInAddr
      ) 
    }else {
      ChainAId = Number(fromChainId);
      tokenIn = new Token(ChainAId, tokenInAddr, tokenADecimals, tokenInSymbol);
    }
    if (toChainId == '5566818579631833088') {
      ChainBId = ChainId.NEAR;
      tokenOut = new Token(
        ChainBId,
        NULL_ADDRESS,
        tokenBDecimals,
        tokenOutSymbol,
        tokenOutAddr
      );
    } else if (toChainId == '5566818579631833089') {
      ChainBId = ChainId.NEAR_TEST;
      tokenOut = new Token(
        ChainBId,
        NULL_ADDRESS,
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
      srcAmountOut = calculate(srcAmountOut,Number(p.amountOut),"add");
    }

    if (srcRouter!=null){
      let tmp = srcRouter[0]!.tokenOut
      let fromToken = new Token(Number(fromChainId),tmp.address,tmp.decimals,tmp.symbol,tmp.name)
      let amount = srcAmountOut * Math.pow(10,tmp.decimals)
      let bridgeFee = await getBridgeFee(fromToken,toChainId,amount.toString(),rpcProvider,'212') // chainId
      srcAmountOut = calculate(srcAmountOut,Number(bridgeFee.amount)/Math.pow(10,tmp.decimals),"sub")
    }else{
      throw new Error("there isn't the best router in src Chain")
    }


    const targetRouter = await chainRouter(
      tokenOut,
      srcAmountOut,
      ChainBId,
      RouterType.TARGET_CHAIN
    );
    const mapRouter: swapData[] = directSwap(mUSDC_MAP,srcAmountOut.toString())

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
  let index = 0

  for (let token of TokenList) {
    let tokenIn: Token = swapToken;
    let tokenOut: Token = toTargetToken(chainId, token);
    if (routerType == RouterType.TARGET_CHAIN) {
      tokenIn = toTargetToken(chainId, token); //await getTargetToken(token,chainId.toString(),rpcProvider)
      tokenOut = swapToken;
    }

    if(tokenIn.address == tokenOut.address || tokenIn.name == tokenOut.name){
      return directSwap(tokenIn,amount.toString())
    }

    let [total, gas, router] = await findBestRouter(
      chainId,
      tokenIn,
      tokenOut,
      amount.toFixed(tokenIn.decimals)
    );
    tmp.push({
      key: index, 
      pair: [tokenIn,tokenOut],
      value: total,
    });
    RouterMap.set(index, router);
    index++;
  }

  tmp.sort((a, b) => (a.value > b.value ? 1 : b.value > a.value ? -1 : 0));

  const bestPair:sortObj  = tmp[tmp.length - 1]!;
  const bestRouter: RouteWithValidQuote[] = RouterMap.get(bestPair.key);

  if (bestRouter == null) {
    return [];
  }

  let icon_key1 = bestPair.pair[0].address;
  let icon_key2 = bestPair.pair[1].address;
  if (bestPair.pair[0].chainId == ChainId.NEAR || bestPair.pair[0].chainId == ChainId.NEAR_TEST) {
    icon_key1 = bestPair.pair[0].name!;
  }
  if (bestPair.pair[1].chainId == ChainId.NEAR || bestPair.pair[1].chainId == ChainId.NEAR_TEST) {
    icon_key2 = bestPair.pair[1].name!;
  }

  const token1: token = {
    address: bestPair.pair[0].address,
    name: bestPair.pair[0].name!,
    decimals: bestPair.pair[0].decimals!,
    symbol: bestPair.pair[0].symbol!,
    icon: GET_TOKEN_ICON(icon_key1),
  };
  const token2: token = {
    address: bestPair.pair[1].address,
    name: bestPair.pair[1].name!,
    decimals: bestPair.pair[1].decimals!,
    symbol: bestPair.pair[1].symbol!,
    icon: GET_TOKEN_ICON(icon_key2),
  };

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
    if (chainId == ChainId.NEAR ||chainId == ChainId.NEAR_TEST ) {
      const refRouter = bestRouter[i]!;
      if (refRouter instanceof RefRouteWithValidQuote) {
        for (let r of refRouter.swapData!) {
          pairs.push({
            id:r.poolId.toString(),
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
        
        let _chainId = '5566818579631833088'
        if(chainId == ChainId.NEAR_TEST){
          _chainId = '5566818579631833089'
        }
        swapPath.push({
          chainId: _chainId,
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
          id:bestRouter[i]!.poolAddresses[j]!,
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
        amountOut: bestRouter[i]!.output.toExact(),
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

function directSwap(token:Token,amount:string):swapData[]{   

  let icon_key = token.address;
  if (token.chainId == ChainId.NEAR) {
    icon_key = token.name!;
  }

  const router: swapData[] = [
    {
      chainId: token.chainId.toString(),
      dexName: "",
      amountIn: amount,
      amountOut: amount,
      tokenIn: {
        address: token.address,
        name: token.name!,
        decimals: token.decimals,
        symbol: token.symbol!,
        icon: GET_TOKEN_ICON(icon_key),
      },
      tokenOut: {
        address: token.address,
        name: token.name!,
        decimals: token.decimals,
        symbol: token.symbol!,
        icon: GET_TOKEN_ICON(icon_key),
      },
      path: [],
    },
  ];

  return router
}

function calculate (num1: number, num2: number, op: string):any {
  let a: number | string, b: number | string, len1: number, len2: number;
  try {
    len1 = num1.toString().split(".")[1]!.length;
  } catch (error) {
    len1 = 0;
  }
  try {
    len2 = num2.toString().split(".")[1]!.length;
  } catch (error) {
    len2 = 0;
  }
  a = num1.toString().split(".").join("");
  b = num2.toString().split(".").join("");
  let c = Math.pow(10, Math.abs(len1 - len2));
  len1 > len2 && (b = Number(b) * c);
  len1 < len2 && (a = Number(a) * c);
  let d = Math.pow(10, Math.max(len1, len2));
  if (op === "add") return (Number(a) + Number(b)) / d;
  if (op === "sub") return (Number(a) - Number(b)) / d;
  if (op === "mul") return (Number(a) * Number(b)) / Math.pow(10, Math.max(len1, len2) * 2);
  if (op === "div") return Number(a) / Number(b);
};