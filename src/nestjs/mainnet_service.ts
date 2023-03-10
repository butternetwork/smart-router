import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  BRIDGE_SUPPORTED_TOKEN,
  GET_TOKEN_ICON,
  mUSDC_MAPT,
  USDC_MAP,
  WBNB_BNB,
  WBNB_BSCT,
  WETH_ETHT,
  WETH_MAINNET,
  WMAP_MAP,
  WMATIC_POLYGON,
  WMATIC_POLYGON_MUMBAI,
  WRAP_NEART,
} from '../providers/token-provider';
import { RefRouteWithValidQuote, RouteWithValidQuote } from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import {
  ChainId,
  getChainProvider,
  IS_SUPPORT_MAINNET,
  NULL_ADDRESS,
  ZERO_ADDRESS,
} from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getVaultBalance, toTargetToken } from '../util/mos';
import { Token } from '../util/token';

type sortObj = {
  key: number;
  pair: [Token, Token];
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
    id: string;
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
  srcChain?: swapData[];
  mapChain?: swapData[];
  targetChain?: swapData[];
};

enum RouterType {
  SRC_CHAIN = 0,
  TARGET_CHAIN = 1,
}
const mapChainId = '22776';

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
    IS_SUPPORT_MAINNET(fromChainId);
    IS_SUPPORT_MAINNET(toChainId);
    if (fromChainId == toChainId) {
      throw new HttpException({
        status: HttpStatus.OK,
        error: 'fromChainId and toChainId cannot be the same',
      }, HttpStatus.OK);
    }

    let rpcProvider = new ethers.providers.JsonRpcProvider('https://poc3-rpc.maplabs.io');
    let tokenIn: Token = newToken(fromChainId,tokenInAddr,tokenInDecimals,tokenInSymbol);
    let tokenOut: Token = newToken(toChainId,tokenOutAddr,tokenOutDecimals,tokenOutSymbol);
    let srcAmountOut = '0'
    let subFee = '0'
    let srcRouter: swapData[];
    let mapRouter: swapData[];
    let targetRouter: swapData[];

    if (fromChainId == mapChainId) {
      let amountBN = ethers.utils.parseUnits(amount, tokenIn.decimals)
      const bridgeFee = await getBridgeFee(
        tokenIn,
        toChainId,
        amountBN.toString(),
        rpcProvider,
        mapChainId
      ); // chainId

      srcAmountOut = amount
      subFee = ethers.utils.formatUnits(amountBN.sub(bridgeFee.amount), tokenIn.decimals)
      srcRouter = directSwap(
        mUSDC_MAPT,
        amount,
        subFee
      )
    } else {
      srcRouter = await chainRouter(
        tokenIn,
        amount,
        tokenIn.chainId,
        RouterType.SRC_CHAIN
      );

      if (srcRouter != null) {
        const token = srcRouter[0]!.tokenOut
        const fromToken = new Token(tokenIn.chainId, token.address, token.decimals, token.symbol, token.name)

        let amountOut = '0'
        for (let p of srcRouter) {
          amountOut = ethers.utils.parseUnits(amountOut, p.tokenOut.decimals).add(ethers.utils.parseUnits(p.amountOut, p.tokenOut.decimals)).toString()
        }

        const bridgeFee = await getBridgeFee(
          fromToken,
          toChainId,
          amountOut,
          rpcProvider,
          mapChainId
        )
        
        srcAmountOut = ethers.utils.formatUnits(amountOut, fromToken.decimals)
        amountOut = ethers.BigNumber.from(amountOut).sub(bridgeFee.amount).toString()
        subFee = ethers.utils.formatUnits(amountOut, fromToken.decimals)

        if (toChainId != mapChainId) {
          const vaultBalance = await getVaultBalance(fromChainId, fromToken, toChainId, rpcProvider, mapChainId)
          isSufficientLiquidity(
            amountOut,
            vaultBalance.balance,
            fromToken.decimals,
            vaultBalance.token.decimals
          )
        }

      } else {

        throw new HttpException({
          status: HttpStatus.OK,
          error: "there isn't the best router in src chain",
        }, HttpStatus.OK);
        
      }
    }

    mapRouter = directSwap(mUSDC_MAPT, srcAmountOut, subFee)

    if (toChainId == mapChainId) {
      targetRouter = directSwap(
        mUSDC_MAPT,
        srcAmountOut,
        subFee
      );
    } else {
      targetRouter = await chainRouter(
        tokenOut,
        subFee,
        tokenOut.chainId,
        RouterType.TARGET_CHAIN
      );
    }

    if (fromChainId == mapChainId) {
      return {
        mapChain: formatReturn(
          srcRouter,
          fromChainId,
          tokenInAddr,
          RouterType.SRC_CHAIN
        ),
        targetChain: formatReturn(
          targetRouter,
          toChainId,
          tokenOutAddr,
          RouterType.TARGET_CHAIN
        ),
      };
    } else if (toChainId == mapChainId) {
      return {
        srcChain: formatReturn(
          srcRouter,
          fromChainId,
          tokenInAddr,
          RouterType.SRC_CHAIN
        ),
        mapChain: formatReturn(
          targetRouter,
          toChainId,
          tokenOutAddr,
          RouterType.TARGET_CHAIN
        ),
      };
    } else {
      return {
        srcChain: formatReturn(
          srcRouter,
          fromChainId,
          tokenInAddr,
          RouterType.SRC_CHAIN
        ),
        mapChain: mapRouter,
        targetChain: formatReturn(
          targetRouter,
          toChainId,
          tokenOutAddr,
          RouterType.TARGET_CHAIN
        ),
      };
    }
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
  amount: string,
  chainId: number,
  routerType: number
): Promise<swapData[]> {
  // data of demo, wait to deploy mos contract
  const TokenList = BRIDGE_SUPPORTED_TOKEN; //await getTokenCandidates('212',chainId.toString(),rpcProvider)
  let tmp: sortObj[] = [];
  let RouterMap = new Map();
  let index = 0;

  for (let token of TokenList) {
    let tokenIn: Token = swapToken;
    let tokenOut: Token = toTargetToken(chainId, token);
    let swapAmount = amount;
    if (routerType == RouterType.TARGET_CHAIN) {
      tokenIn = toTargetToken(chainId, token); //await getTargetToken(token,chainId.toString(),rpcProvider)
      tokenOut = swapToken;
      swapAmount = notExceedDecimals(swapAmount, tokenIn.decimals);
    }

    if (tokenIn.address == tokenOut.address || tokenIn.name == tokenOut.name) {
      return directSwap(tokenIn, amount, amount);
    }

    let [total, gas, router] = await findBestRouter(
      chainId,
      tokenIn,
      tokenOut,
      swapAmount
    );
    tmp.push({
      key: index,
      pair: [tokenIn, tokenOut],
      value: total,
    });
    RouterMap.set(index, router);
    index++;
  }

  tmp.sort((a, b) => (a.value > b.value ? 1 : b.value > a.value ? -1 : 0));

  const bestPair: sortObj = tmp[tmp.length - 1]!;
  const bestRouter: RouteWithValidQuote[] = RouterMap.get(bestPair.key);

  if (bestRouter == null) {
    return [];
  }

  let icon_key1 = bestPair.pair[0].address;
  let icon_key2 = bestPair.pair[1].address;
  if (
    bestPair.pair[0].chainId == ChainId.NEAR ||
    bestPair.pair[0].chainId == ChainId.NEAR_TEST
  ) {
    icon_key1 = bestPair.pair[0].name!;
  }
  if (
    bestPair.pair[1].chainId == ChainId.NEAR ||
    bestPair.pair[1].chainId == ChainId.NEAR_TEST
  ) {
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
    if (chainId == ChainId.NEAR || chainId == ChainId.NEAR_TEST) {
      const refRouter = bestRouter[i]!;
      if (refRouter instanceof RefRouteWithValidQuote) {
        for (let r of refRouter.swapData!) {
          pairs.push({
            id: r.poolId.toString(),
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

        let _chainId = '5566818579631833088';
        swapPath.push({
          chainId: _chainId,
          amountIn: refRouter.amount.toExact(),
          amountOut: notExceedDecimals(refRouter.toString(), tokenOut.decimals),
          path: pairs,
          dexName: bestRouter[i]!.platform,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
        });
      } else {
        throw new HttpException({
          status: HttpStatus.OK,
          error: "cannot get router of ref",
        }, HttpStatus.OK); 
      }
    } else {
      for (let j = 0; j < bestRouter[i]!.poolAddresses.length; j++) {
        pairs.push({
          id: bestRouter[i]!.poolAddresses[j]!,
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


function directSwap(
  token: Token,
  amountIn: string,
  amountOut: string
): swapData[] {
  let icon_key = token.address;
  if (token.chainId == ChainId.NEAR) {
    icon_key = token.name!;
  }

  const router: swapData[] = [
    {
      chainId: token.chainId.toString(),
      dexName: '',
      amountIn: amountIn,
      amountOut: amountOut,
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
  return router;
}


function newToken(
  _chainId: string,
  _address: string,
  _decimals: number,
  _symbol: string
): Token {
  let token: Token;
  let chainId: number = Number(_chainId);
  const decimals: number = Number(_decimals);
  if (_chainId == '5566818579631833088') {
    chainId = ChainId.NEAR;
    let address = isWrapToken(_address, chainId);
    token = new Token(chainId, NULL_ADDRESS, decimals, _symbol, address);
  } else {
    let address = isWrapToken(_address, chainId);
    chainId = Number(_chainId);
    token = new Token(chainId, address, decimals, _symbol);
  }
  return token;
}


function isWrapToken(address: string, chainId: number): string {
  if (address == ZERO_ADDRESS) {
    switch (chainId) {
      case ChainId.MAINNET:
        return WETH_MAINNET.address;
      case ChainId.BSC:
        return WBNB_BNB.address;
      case ChainId.POLYGON:
        return WMATIC_POLYGON.address;
      case ChainId.NEAR:
        return WRAP_NEART.name!;
      case ChainId.MAP:
        return WMAP_MAP.address;
      default:
        return address;
    }
  }
  return address;
}


function formatReturn(
  params: swapData[],
  chainId: string,
  address: string,
  type: RouterType
) {
  if (type == RouterType.SRC_CHAIN) {
    let data: swapData[] = params;
    for (let i = 0; i < data.length; i++) {
      data[i]!.chainId = chainId;
      if (chainId == '5566818579631833088') {
        data[i]!.tokenIn.address = address;
        data[i]!.tokenOut.address = data[i]!.tokenOut.name;
      } else {
        data[i]!.tokenIn.address = address;
      }
    }
    return data;
  } else if (type == RouterType.TARGET_CHAIN) {
    let data: swapData[] = params;
    for (let i = 0; i < data.length; i++) {
      data[i]!.chainId = chainId;
      if ( chainId == '5566818579631833088') {
        data[i]!.tokenIn.address = data[i]!.tokenIn.name;
        data[i]!.tokenOut.address = address;
      } else {
        data[i]!.tokenOut.address = address;
      }
    }
    return data;
  } else {
    throw new Error('return incorrect data! please contact the administrator to fix.');
  }
}


function notExceedDecimals(num: string, decimal: number): string {
  let len = num.split(".")[1]!.length
  if (len > decimal) {
    return Number(num).toFixed(decimal + 1).slice(0, -1)
  }
  return num
}


function isSufficientLiquidity(amount: string, balance: string, amountDecimal: number, balanceDecimal: number) {

  if (amountDecimal > balanceDecimal) {
    let num1 = ethers.BigNumber.from(amount)
    let num2 = ethers.utils.parseUnits(balance, amountDecimal - balanceDecimal)
    if (num2.gte(num1)) {
      return true
    }
  } else {
    let num1 = ethers.utils.parseUnits(amount, balanceDecimal - amountDecimal)
    let num2 = ethers.BigNumber.from(balance)
    if (num2.gte(num1)) {
      return true
    }
  }

  throw new HttpException({
    status: HttpStatus.OK,
    error: "there isn't sufficiently liquidity to cross chain",
  }, HttpStatus.OK);

}