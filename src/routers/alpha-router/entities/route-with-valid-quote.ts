import {
  Route as QRoute,
  Token as QToken,
} from '@davidwgrossman/quickswap-sdk';
import { Route as PRoute, Token as PToken } from '@pancakeswap/sdk';
import { Route as SRoute } from '@sushiswap/sdk';
import { Protocol } from '@uniswap/router-sdk';
import { Token, TradeType } from '@uniswap/sdk-core';
import { Route } from '@uniswap/v2-sdk';
import { BigNumber, ethers } from 'ethers';
import _ from 'lodash';
import { pancakeTokenToUniToken } from '../../../adapter/pancake-adapter';
import { quickTokenToUniToken } from '../../../adapter/quick-adapter';
import { IV2PoolProvider } from '../../../providers/interfaces/IPoolProvider';
import { PancakeV2PoolProvider } from '../../../providers/pancakeswap/v2/pool-provider';
import { QuickV2PoolProvider } from '../../../providers/quickswap/v2/pool-provider';
import { SushiV2PoolProvider } from '../../../providers/sushiswap/v2/pool-provider';
import { V2PoolProvider } from '../../../providers/uniswap/v2/pool-provider';
import { IV3PoolProvider } from '../../../providers/uniswap/v3/pool-provider';
import { CurrencyAmount } from '../../../util/amounts';
import { ButterProtocol } from '../../../util/protocol';
import { routeToString } from '../../../util/routes';
import {
  PancakeV2Route,
  QuickV2Route,
  SushiV2Route,
  V2Route,
  V3Route,
} from '../../router';
import { IGasModel } from '../gas-models/gas-model';
import { IRoute, IRouteStep } from '@curvefi/api/lib/interfaces';
import { EstimateSwapView } from '@ref-finance/ref-sdk';
import { numberToBinInt16LE } from '@bitauth/libauth';
/**
 * Represents a route, a quote for swapping some amount on it, and other
 * metadata used by the routing algorithm.
 *
 * @export
 * @interface IRouteWithValidQuote
 * @template Route
 */
export interface IRouteWithValidQuote<
  Route extends
    | V3Route
    | V2Route
    | SushiV2Route
    | QuickV2Route
    | PancakeV2Route
    | CurveRoute
    | RefRoute
> {
  amount: CurrencyAmount;
  percent: number;
  // If exact in, this is (quote - gasCostInToken). If exact out, this is (quote + gasCostInToken).
  quoteAdjustedForGas: CurrencyAmount;
  quote: CurrencyAmount;
  route: Route;
  gasEstimate: BigNumber;
  // The gas cost in terms of the quote token.
  gasCostInToken: CurrencyAmount;
  gasCostInUSD: CurrencyAmount;
  tradeType: TradeType;
  poolAddresses: string[];
  tokenPath: Token[] | QToken[] | PToken[];
}

// Discriminated unions on protocol field to narrow types.
export type IV2RouteWithValidQuote = {
  protocol: Protocol.V2;
} & IRouteWithValidQuote<
  V2Route | QuickV2Route | SushiV2Route | PancakeV2Route
>;

export type IV3RouteWithValidQuote = {
  protocol: Protocol.V3;
} & IRouteWithValidQuote<V3Route>;

export type RouteWithValidQuote =
  | V2RouteWithValidQuote
  | V3RouteWithValidQuote
  | CurveRouteWithValidQuote
  | RefRouteWithValidQuote;

export type V2RouteWithValidQuoteParams = {
  amount: CurrencyAmount;
  rawQuote: BigNumber;
  percent: number;
  route: V2Route | QuickV2Route | SushiV2Route | PancakeV2Route;
  gasModel: IGasModel<V2RouteWithValidQuote>;
  quoteToken: Token;
  tradeType: TradeType;
  v2PoolProvider: IV2PoolProvider;
  platform: ButterProtocol;
};
/**
 * Represents a quote for swapping on a V2 only route. Contains all information
 * such as the route used, the amount specified by the user, the type of quote
 * (exact in or exact out), the quote itself, and gas estimates.
 *
 * @export
 * @class V2RouteWithValidQuote
 */
export class V2RouteWithValidQuote implements IV2RouteWithValidQuote {
  public readonly protocol = Protocol.V2;
  public amount: CurrencyAmount;
  // The BigNumber representing the quote.
  public rawQuote: BigNumber;
  public quote: CurrencyAmount;
  public quoteAdjustedForGas: CurrencyAmount;
  public percent: number;
  public route: V2Route | QuickV2Route | SushiV2Route | PancakeV2Route;
  public quoteToken: Token;
  public gasModel: IGasModel<V2RouteWithValidQuote>;
  public gasEstimate: BigNumber;
  public gasCostInToken: CurrencyAmount;
  public gasCostInUSD: CurrencyAmount;
  public tradeType: TradeType;
  public poolAddresses: string[];
  public tokenPath: Token[] | QToken[] | PToken[];
  public platform: ButterProtocol;
  public output: CurrencyAmount;
  public toString(): string {
    return `${this.platform}: ${this.percent.toFixed(
      2
    )}% QuoteGasAdj[${this.quoteAdjustedForGas.toExact()}] Quote[${this.quote.toExact()}] Gas[${this.gasEstimate.toString()}] = ${routeToString(
      this.route
    )}`;
  }

  constructor({
    amount,
    rawQuote,
    percent,
    route,
    gasModel,
    quoteToken,
    tradeType,
    v2PoolProvider,
    platform,
  }: V2RouteWithValidQuoteParams) {
    this.amount = amount;
    this.rawQuote = rawQuote;
    this.quote = CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
    this.percent = percent;
    this.route = route;
    this.gasModel = gasModel;
    this.quoteToken = quoteToken;
    this.tradeType = tradeType;

    const { gasEstimate, gasCostInToken, gasCostInUSD } =
      this.gasModel.estimateGasCost(this);

    this.gasCostInToken = gasCostInToken;
    this.gasCostInUSD = gasCostInUSD;
    this.gasEstimate = gasEstimate;
    this.platform = platform;
    // If its exact out, we need to request *more* of the input token to account for the gas.
    if (this.tradeType == TradeType.EXACT_INPUT) {
      const quoteGasAdjusted = this.quote.subtract(gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    } else {
      const quoteGasAdjusted = this.quote.add(gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    }
    this.output = this.quote;
    this.quote = this.quoteAdjustedForGas;
    if (
      v2PoolProvider instanceof QuickV2PoolProvider &&
      route instanceof QRoute
    ) {
      this.poolAddresses = _.map(
        route.pairs,
        (p) =>
          v2PoolProvider.getPoolAddress(
            quickTokenToUniToken(p.token0),
            quickTokenToUniToken(p.token1)
          ).poolAddress
      );
    } else if (
      v2PoolProvider instanceof PancakeV2PoolProvider &&
      route instanceof PRoute
    ) {
      this.poolAddresses = _.map(
        route.pairs,
        (p) =>
          v2PoolProvider.getPoolAddress(
            pancakeTokenToUniToken(p.token0),
            pancakeTokenToUniToken(p.token1)
          ).poolAddress
      );
    } else if (
      v2PoolProvider instanceof V2PoolProvider &&
      route instanceof Route
    ) {
      this.poolAddresses = _.map(
        route.pairs,
        (p) => v2PoolProvider.getPoolAddress(p.token0, p.token1).poolAddress
      );
    } else if (
      v2PoolProvider instanceof SushiV2PoolProvider &&
      route instanceof SRoute
    ) {
      this.poolAddresses = _.map(
        route.pairs,
        (p) => v2PoolProvider.getPoolAddress(p.token0, p.token1).poolAddress
      );
    } else {
      throw new Error(
        'cannot get pool address: v2PoolProvider not found for current protocol'
      );
    }
    this.tokenPath = this.route.path;
  }
}

export type V3RouteWithValidQuoteParams = {
  amount: CurrencyAmount;
  rawQuote: BigNumber;
  sqrtPriceX96AfterList: BigNumber[];
  initializedTicksCrossedList: number[];
  quoterGasEstimate: BigNumber;
  percent: number;
  route: V3Route;
  gasModel: IGasModel<V3RouteWithValidQuote>;
  quoteToken: Token;
  tradeType: TradeType;
  v3PoolProvider: IV3PoolProvider;
  platform: ButterProtocol;
};

/**
 * Represents a quote for swapping on a V3 only route. Contains all information
 * such as the route used, the amount specified by the user, the type of quote
 * (exact in or exact out), the quote itself, and gas estimates.
 *
 * @export
 * @class V3RouteWithValidQuote
 */
export class V3RouteWithValidQuote implements IV3RouteWithValidQuote {
  public readonly protocol = Protocol.V3;
  public amount: CurrencyAmount;
  public rawQuote: BigNumber;
  public quote: CurrencyAmount;
  public quoteAdjustedForGas: CurrencyAmount;
  public sqrtPriceX96AfterList: BigNumber[];
  public initializedTicksCrossedList: number[];
  public quoterGasEstimate: BigNumber;
  public percent: number;
  public route: V3Route;
  public quoteToken: Token;
  public gasModel: IGasModel<V3RouteWithValidQuote>;
  public gasEstimate: BigNumber;
  public gasCostInToken: CurrencyAmount;
  public gasCostInUSD: CurrencyAmount;
  public tradeType: TradeType;
  public poolAddresses: string[];
  public tokenPath: Token[];
  public platform: ButterProtocol;
  public output: CurrencyAmount;

  public toString(): string {
    return `${this.percent.toFixed(
      2
    )}% QuoteGasAdj[${this.quoteAdjustedForGas.toExact()}] Quote[${this.quote.toExact()}] Gas[${this.gasEstimate.toString()}] = ${routeToString(
      this.route
    )}`;
  }

  constructor({
    amount,
    rawQuote,
    sqrtPriceX96AfterList,
    initializedTicksCrossedList,
    quoterGasEstimate,
    percent,
    route,
    gasModel,
    quoteToken,
    tradeType,
    v3PoolProvider,
    platform,
  }: V3RouteWithValidQuoteParams) {
    this.amount = amount;
    this.rawQuote = rawQuote;
    this.sqrtPriceX96AfterList = sqrtPriceX96AfterList;
    this.initializedTicksCrossedList = initializedTicksCrossedList;
    this.quoterGasEstimate = quoterGasEstimate;
    this.quote = CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
    this.percent = percent;
    this.route = route;
    this.gasModel = gasModel;
    this.quoteToken = quoteToken;
    this.tradeType = tradeType;

    const { gasEstimate, gasCostInToken, gasCostInUSD } =
      this.gasModel.estimateGasCost(this);

    this.gasCostInToken = gasCostInToken;
    this.gasCostInUSD = gasCostInUSD;
    this.gasEstimate = gasEstimate;
    this.platform = platform;
    // If its exact out, we need to request *more* of the input token to account for the gas.
    if (this.tradeType == TradeType.EXACT_INPUT) {
      const quoteGasAdjusted = this.quote.subtract(gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    } else {
      const quoteGasAdjusted = this.quote.add(gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    }
    this.output = this.quote;
    this.quote = this.quoteAdjustedForGas;
    this.poolAddresses = _.map(
      route.pools,
      (p) =>
        v3PoolProvider.getPoolAddress(p.token0, p.token1, p.fee).poolAddress
    );

    this.tokenPath = this.route.tokenPath;
  }
}

export class CurveRoute implements IRoute {
  readonly steps: IRouteStep[];
  readonly _output: ethers.BigNumber;
  readonly outputUsd: number;
  readonly txCostUsd: number;
  constructor(
    steps: IRouteStep[],
    _output: ethers.BigNumber,
    outputUsd: number,
    txCostUsd: number
  ) {
    this.steps = steps;
    this._output = _output;
    this.outputUsd = outputUsd;
    this.txCostUsd = txCostUsd;
  }
}

export type ICurveRouteWithValidQuote = {
  protocol: ButterProtocol.CURVE;
} & IRouteWithValidQuote<CurveRoute>;

export type CurveRouteWithValidQuoteParams = {
  chainId: number;
  amount: CurrencyAmount;
  rawQuote: BigNumber;
  percent: number;
  route: CurveRoute;
  quoteToken: Token;
  gasPriceWei: BigNumber;
  tokenOutPrice: number;
  ethPrice: number;
  tradeType: TradeType;
  platform: ButterProtocol;
};

export class CurveRouteWithValidQuote implements ICurveRouteWithValidQuote {
  public readonly protocol = ButterProtocol.CURVE;
  public amount: CurrencyAmount;
  // The BigNumber representing the quote.
  public rawQuote: BigNumber;
  public quote: CurrencyAmount;
  public percent: number;
  public route: CurveRoute;
  public quoteToken: Token;
  public tradeType: TradeType;
  public platform: ButterProtocol;
  public tokenPath: Token[] | QToken[] | PToken[];
  public poolAddresses: string[];

  public quoteAdjustedForGas: CurrencyAmount;
  public gasCostInToken: CurrencyAmount;
  public gasCostInUSD: CurrencyAmount;
  public gasEstimate: BigNumber;
  public output: CurrencyAmount;

  public toString(): string {
    return `${this.platform}: ${this.percent.toFixed(
      2
    )}% Quote[${this.quote.toExact()}] outputUsd[${
      this.route.outputUsd
    }] txCostUsd[${this.route.txCostUsd}] `;
  }

  constructor({
    chainId,
    amount,
    rawQuote,
    percent,
    route,
    gasPriceWei,
    tokenOutPrice,
    ethPrice,
    quoteToken,
    tradeType,
    platform,
  }: CurveRouteWithValidQuoteParams) {
    this.amount = amount;
    this.rawQuote = rawQuote;
    this.quote = CurrencyAmount.fromRawAmount(quoteToken, rawQuote.toString());
    this.percent = percent;
    this.route = route;
    this.quoteToken = quoteToken;
    this.tradeType = tradeType;
    this.platform = platform;
    this.tokenPath = [];
    this.poolAddresses = [];
    for (let i = 0; i < this.route.steps.length; i++) {
      this.poolAddresses[i] = this.route.steps[i]!.poolAddress;
      this.tokenPath[i] = new Token(
        chainId,
        this.route.steps[i]!.outputCoinAddress,
        6
      );
    }

    // Constant cost for doing any swap regardless of pools.
    const BASE_SWAP_COST = BigNumber.from(180000);
    // Constant per extra hop in the route.
    const COST_PER_EXTRA_HOP = BigNumber.from(120000);
    this.gasEstimate = BASE_SWAP_COST.add(
      COST_PER_EXTRA_HOP.mul(route.steps.length - 1)
    );
    const totalGasCostWei = gasPriceWei.mul(this.gasEstimate);
    const gas_usd =
      totalGasCostWei.div(Math.pow(10, 9)).div(Math.pow(10, 3)).toNumber() *
      ethPrice;
    const gas_token = gas_usd * tokenOutPrice;
    this.gasCostInToken = CurrencyAmount.fromRawAmount(
      quoteToken,
      gas_token.toFixed(0)
    );
    this.gasCostInUSD = CurrencyAmount.fromRawAmount(
      quoteToken,
      gas_usd.toFixed(0)
    );
    if (this.tradeType == TradeType.EXACT_INPUT) {
      const quoteGasAdjusted = this.quote.subtract(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    } else {
      const quoteGasAdjusted = this.quote.add(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    }
    this.output = this.quote;
    this.quote = this.quoteAdjustedForGas;
  }
}

type swapParams = {
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  poolId: number;
  tokenInName: string;
  tokenOutName: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInIcon: string;
  tokenOutIcon: string;
};
export class RefRoute {
  readonly allRoute: EstimateSwapView[] = [];
  readonly swapData: swapParams[] = [];

  constructor(routes: EstimateSwapView[], amount: string) {
    this.allRoute = routes;
    let amountIn = amount;
    let tokenInName: string = '';
    let tokenOutName: string = '';
    let tokenInSymbol: string = '';
    let tokenOutSymbol: string = '';
    let tokenInIcon: string = '';
    let tokenOutIcon: string = '';

    for (let r of routes) {
      if (r.tokens) {
        for (let t of r.tokens) {
          if (t.id == r.inputToken) {
            tokenInName = t.name;
            tokenInSymbol = t.symbol;
            tokenInIcon = t.icon;
          }
          if (t.id == r.outputToken) {
            tokenOutName = t.name;
            tokenOutSymbol = t.symbol;
            tokenOutIcon = t.icon;
          }
        }
      }
      this.swapData.push({
        amountIn: amountIn,
        amountOut: r.estimate,
        tokenIn: r.inputToken!,
        tokenOut: r.outputToken!,
        poolId: r.pool.id!,
        tokenInName: tokenInName,
        tokenInSymbol: tokenInSymbol,
        tokenInIcon: tokenInIcon,
        tokenOutName: tokenOutName,
        tokenOutSymbol: tokenOutSymbol,
        tokenOutIcon: tokenOutIcon,
      });
      amountIn = r.estimate;
    }
  }
}

export type IRefRouteWithValidQuote = {
  protocol: ButterProtocol.REF;
} & IRouteWithValidQuote<RefRoute>;

export type RefRouteWithValidQuoteParams = {
  amount: CurrencyAmount;
  rawQuote: BigNumber;
  percent: number;
  route: RefRoute;
  expectedOutput: string;
  quoteToken: Token;
  gasPriceWei: BigNumber;
  tradeType: TradeType;
  platform: ButterProtocol;
};

export class RefRouteWithValidQuote implements IRefRouteWithValidQuote {
  public readonly protocol = ButterProtocol.REF;
  public amount: CurrencyAmount;
  // The BigNumber representing the quote.
  public rawQuote: BigNumber;
  public quote: CurrencyAmount;
  public percent: number;
  public route: RefRoute;
  public quoteToken: Token;
  public tradeType: TradeType;
  public platform: ButterProtocol;
  public tokenPath: Token[] | QToken[] | PToken[];
  public poolAddresses: string[];
  public swapData: swapParams[] | undefined;
  public quoteAdjustedForGas: CurrencyAmount;
  public gasCostInToken: CurrencyAmount;
  public gasCostInUSD: CurrencyAmount;
  public gasEstimate: BigNumber;
  public output: CurrencyAmount;
  public expectedOutput: string;
  public toString(): string {
    return this.expectedOutput;
  }

  constructor({
    amount,
    rawQuote,
    percent,
    route,
    expectedOutput,
    gasPriceWei,
    quoteToken,
    tradeType,
    platform,
  }: RefRouteWithValidQuoteParams) {
    this.amount = amount;
    this.rawQuote = rawQuote;
    this.quote = CurrencyAmount.fromRawAmount(
      quoteToken,
      rawQuote.mul(1000000).toHexString()
    );
    this.expectedOutput = expectedOutput;
    this.percent = percent;
    this.route = route;
    this.quoteToken = quoteToken;
    this.tradeType = tradeType;
    this.platform = platform;
    this.tokenPath = [];
    this.poolAddresses = [];
    for (let i = 0; i < this.route.swapData.length; i++) {
      this.poolAddresses[i] = this.route.swapData[i]!.poolId.toString();
    }
    this.swapData = this.route.swapData;
    // Constant cost for doing any swap regardless of pools.
    const BASE_SWAP_COST = BigNumber.from(180000);
    // Constant per extra hop in the route.
    const COST_PER_EXTRA_HOP = BigNumber.from(120000);
    this.gasEstimate = BASE_SWAP_COST.add(
      COST_PER_EXTRA_HOP.mul(route.allRoute.length - 1)
    );
    const totalGasCostWei = gasPriceWei.mul(this.gasEstimate);
    const gas_usd =
      totalGasCostWei.div(Math.pow(10, 9)).div(Math.pow(10, 3)).toNumber() * 2;
    const gas_token = gas_usd * 1;
    this.gasCostInToken = CurrencyAmount.fromRawAmount(
      quoteToken,
      gas_token.toFixed(0)
    );
    this.gasCostInUSD = CurrencyAmount.fromRawAmount(
      quoteToken,
      gas_usd.toFixed(0)
    );
    if (this.tradeType == TradeType.EXACT_INPUT) {
      const quoteGasAdjusted = this.quote.subtract(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    } else {
      const quoteGasAdjusted = this.quote.add(this.gasCostInToken);
      this.quoteAdjustedForGas = quoteGasAdjusted;
    }
    this.output = this.quote;
    this.quote = this.quoteAdjustedForGas;
  }
}
