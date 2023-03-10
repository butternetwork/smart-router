import {
  Pair as QPair,
  Route as QuickV2RouteRaw,
} from '@davidwgrossman/quickswap-sdk';
import { Pair as PPair, Route as PancakeV2RouteRaw } from '@pancakeswap/sdk';
import { Percent } from '@uniswap/sdk-core';
import { Pair, Route as V2RouteRaw } from '@uniswap/v2-sdk';
import { Pool, Route as V3RouteRaw } from '@uniswap/v3-sdk';
import _ from 'lodash';
import { platform } from 'os';
import { CurrencyAmount } from '.';
import {
  CurveRoute,
  RefRoute,
  RouteWithValidQuote,
} from '../routers/alpha-router';
import {
  PancakeV2Route,
  QuickV2Route,
  SushiV2Route,
  V2Route,
  V3Route,
} from '../routers/router';

export const pancakeRouteToString = (route: PancakeV2Route): string => {
  const routeStr = [];
  const tokens = route.path;
  const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
  const pools = route.pairs;
  const poolFeePath = _.map(
    pools,
    (pool) =>
      `${
        pool instanceof Pool
          ? ` -- ${pool.fee / 10000}% [${Pool.getAddress(
              pool.token0,
              pool.token1,
              pool.fee
            )}]`
          : ` -- [${PPair.getAddress(
              (pool as PPair).token0,
              (pool as PPair).token1
            )}]`
      } --> `
  );

  for (let i = 0; i < tokenPath.length; i++) {
    routeStr.push(tokenPath[i]);
    if (i < poolFeePath.length) {
      routeStr.push(poolFeePath[i]);
    }
  }

  return routeStr.join('');
};

export const quickRouteToString = (route: QuickV2Route): string => {
  const routeStr = [];
  const tokens = route.path;
  const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
  const pools = route.pairs;
  const poolFeePath = _.map(
    pools,
    (pool) =>
      `${
        pool instanceof Pool
          ? ` -- ${pool.fee / 10000}% [${Pool.getAddress(
              pool.token0,
              pool.token1,
              pool.fee
            )}]`
          : ` -- [${QPair.getAddress(
              (pool as QPair).token0,
              (pool as QPair).token1
            )}]`
      } --> `
  );

  for (let i = 0; i < tokenPath.length; i++) {
    routeStr.push(tokenPath[i]);
    if (i < poolFeePath.length) {
      routeStr.push(poolFeePath[i]);
    }
  }

  return routeStr.join('');
};

export const uniRouteToString = (
  route: V3Route | V2Route | SushiV2Route
): string => {
  const isV3Route = (
    route: V3Route | V2Route | SushiV2Route
  ): route is V3Route => (route as V3Route).pools != undefined;
  const routeStr = [];
  const tokens = isV3Route(route) ? route.tokenPath : route.path;
  const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
  const pools = isV3Route(route) ? route.pools : route.pairs;
  const poolFeePath = _.map(
    pools,
    (pool) =>
      `${
        pool instanceof Pool
          ? ` -- ${pool.fee / 10000}% [${Pool.getAddress(
              pool.token0,
              pool.token1,
              pool.fee
            )}]`
          : ` -- [${Pair.getAddress(
              (pool as Pair).token0,
              (pool as Pair).token1
            )}]`
      } --> `
  );

  for (let i = 0; i < tokenPath.length; i++) {
    routeStr.push(tokenPath[i]);
    if (i < poolFeePath.length) {
      routeStr.push(poolFeePath[i]);
    }
  }
  return routeStr.join('');
};

export const routeAmountsToString = (
  routeAmounts: RouteWithValidQuote[]
): string => {
  const total = _.reduce(
    routeAmounts,
    (total: CurrencyAmount, cur: RouteWithValidQuote) => {
      return total.add(cur.amount);
    },
    CurrencyAmount.fromRawAmount(routeAmounts[0]!.amount.currency, 0)
  );

  const routeStrings = _.map(routeAmounts, ({ protocol, route, amount }) => {
    const portion = amount.divide(total);
    const percent = new Percent(portion.numerator, portion.denominator);
    return `[${platform} ${protocol}] ${percent.toFixed(2)}% = ${routeToString(
      route
    )}`;
  });

  return _.join(routeStrings, ', ');
};

export const routeAmountToString = (
  routeAmount: RouteWithValidQuote
): string => {
  const { route, amount } = routeAmount;
  return `${routeAmount.platform} ${amount.toExact()} = ${routeToString(
    route
  )}`;
};

export const poolToString = (p: Pool | Pair | PPair): string => {
  return `${p.token0.symbol}/${p.token1.symbol}${
    p instanceof Pool ? `/${p.fee / 10000}%` : ``
  }`;
};

export function routeToString(
  route:
    | V2Route
    | V3Route
    | SushiV2Route
    | QuickV2Route
    | PancakeV2Route
    | CurveRoute
    | RefRoute
): string {
  let routeStr = 'route type not found';
  if (route instanceof V2RouteRaw || route instanceof V3RouteRaw) {
    routeStr = uniRouteToString(route);
  } else if (route instanceof QuickV2RouteRaw) {
    routeStr = quickRouteToString(route);
  } else if (route instanceof PancakeV2RouteRaw) {
    routeStr = pancakeRouteToString(route);
  } else {
    routeStr = otherRouteToString(route);
  }
  return routeStr;
}

export const otherRouteToString = (route: any): string => {
  if (!route.steps) {
    const isV3Route = (
      route: V3Route | V2Route | SushiV2Route
    ): route is V3Route => (route as V3Route).pools != undefined;
    const routeStr = [];
    const tokens = isV3Route(route) ? route.tokenPath : route.path;
    const tokenPath = _.map(tokens, (token) => `${token.symbol}`);
    const pools = isV3Route(route) ? route.pools : route.pairs;
    const poolFeePath = _.map(
      pools,
      (pool) =>
        `${
          pool instanceof Pool
            ? ` -- ${pool.fee / 10000}% [${Pool.getAddress(
                pool.token0,
                pool.token1,
                pool.fee
              )}]`
            : ` -- [${Pair.getAddress(
                (pool as Pair).token0,
                (pool as Pair).token1
              )}]`
        } --> `
    );

    for (let i = 0; i < tokenPath.length; i++) {
      routeStr.push(tokenPath[i]);
      if (i < poolFeePath.length) {
        routeStr.push(poolFeePath[i]);
      }
    }

    return routeStr.join('');
  }
  const routeStr = [];
  const steps = route.steps;
  const swapPath = _.map(
    steps,
    (token) => `swapAddress:${token.swapAddress}-->`
  );
  const outputCoinPath = _.map(
    steps,
    (token) => `outputCoinAddress:${token.outputCoinAddress}-->`
  );
  const poolAddresses = _.map(
    steps,
    (pool) => `[${pool.poolId} : ${pool.poolAddress}]--> `
  );
  routeStr.push('tokenIn --> ');
  for (let i = 0; i < poolAddresses.length; i++) {
    if (i < poolAddresses.length) {
      //routeStr.push(swapPath[i]);
      routeStr.push(poolAddresses[i]);
      //routeStr.push(outputCoinPath[i]);
    }
  }
  routeStr.push('tokenOut');
  return routeStr.join('');
};

export function nearRouterToString(
  route: RouteWithValidQuote,
  symbolA: string | undefined,
  symbolB: string | undefined
): string {
  let total = 0;
  let routerString =
    'ref ' + route.amount.toExact() + ' = ' + symbolA + ' --> ';
  for (let pool of route.poolAddresses) {
    routerString = routerString + 'poolId:' + pool + ' --> ';
  }
  total += Number(route.toString());
  routerString = routerString + symbolB + ' = ' + total.toString();
  return routerString;
}
