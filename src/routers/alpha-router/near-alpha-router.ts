import {
  estimateSwap,
  EstimateSwapView,
  fetchAllPools,
  ftGetTokenMetadata,
  getExpectedOutputFromSwapTodos,
  getStablePools,
  init_env,
  Pool as RefPool,
  StablePool,
  SwapOptions as RefSwapOptions,
} from '@ref-finance/ref-sdk';
import { Currency, Token, TradeType } from '@uniswap/sdk-core';
import { MethodParameters, Position } from '@uniswap/v3-sdk';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import { CurrencyAmount } from '../../util/amounts';
import { ChainId } from '../../util/chains';
import { log } from '../../util/log';
import { ButterProtocol } from '../../util/protocol';
import {
  IRouter,
  ISwapToRatio,
  SwapAndAddConfig,
  SwapAndAddOptions,
  SwapOptions,
  SwapRoute,
} from '../router';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN } from './config';
import {
  RefRoute,
  RefRouteWithValidQuote,
  RouteWithValidQuote,
} from './entities/route-with-valid-quote';
import { getBestSwapRoute } from './functions/best-swap-route';

import {
  _getBestRouteAndOutput,
  _getUsdRate,
} from './functions/get-curve-best-router';
import axios from 'axios';

/**
 * Determines the pools that the algorithm will consider when finding the optimal swap.
 *
 * All pools on each protocol are filtered based on the heuristics specified here to generate
 * the set of candidate pools. The Top N pools are taken by Total Value Locked (TVL).
 *
 * Higher values here result in more pools to explore which results in higher latency.
 */
type ProtocolPoolSelection = {
  /**
   * The top N pools by TVL out of all pools on the protocol.
   */
  topN: number;
  /**
   * The top N pools by TVL of pools that consist of tokenIn and tokenOut.
   */
  topNDirectSwaps: number;
  /**
   * The top N pools by TVL of pools where one token is tokenIn and the
   * top N pools by TVL of pools where one token is tokenOut tokenOut.
   */
  topNTokenInOut: number;
  /**
   * Given the topNTokenInOut pools, gets the top N pools that involve the other token.
   * E.g. for a WETH -> USDC swap, if topNTokenInOut found WETH -> DAI and WETH -> USDT,
   * a value of 2 would find the top 2 pools that involve DAI or USDT.
   */
  topNSecondHop: number;
  /**
   * The top N pools for token in and token out that involve a token from a list of
   * hardcoded 'base tokens'. These are standard tokens such as WETH, USDC, DAI, etc.
   * This is similar to how the legacy routing algorithm used by Uniswap would select
   * pools and is intended to make the new pool selection algorithm close to a superset
   * of the old algorithm.
   */
  topNWithEachBaseToken: number;
  /**
   * Given the topNWithEachBaseToken pools, takes the top N pools from the full list.
   * E.g. for a WETH -> USDC swap, if topNWithEachBaseToken found WETH -0.05-> DAI,
   * WETH -0.01-> DAI, WETH -0.05-> USDC, WETH -0.3-> USDC, a value of 2 would reduce
   * this set to the top 2 pools from that full list.
   */
  topNWithBaseToken: number;
};

type AlphaRouterConfig = {
  /**
   * The block number to use for all on-chain data. If not provided, the router will
   * use the latest block returned by the provider.
   */
  blockNumber?: number | Promise<number>;
  /**
   * The protocols to consider when finding the optimal swap. If not provided all protocols
   * will be used.
   */
  protocols?: ButterProtocol[];
  /**
   * Config for selecting which pools to consider routing via on V2.
   */
  v2PoolSelection: ProtocolPoolSelection;
  /**
   * Config for selecting which pools to consider routing via on V3.
   */
  v3PoolSelection: ProtocolPoolSelection;
  /**
   * For each route, the maximum number of hops to consider. More hops will increase latency of the algorithm.
   */
  maxSwapsPerPath: number;
  /**
   * The maximum number of splits in the returned route. A higher maximum will increase latency of the algorithm.
   */
  maxSplits: number;
  /**
   * The minimum number of splits in the returned route.
   * This parameters should always be set to 1. It is only included for testing purposes.
   */
  minSplits: number;
  /**
   * Forces the returned swap to route across all protocols.
   * This parameter should always be false. It is only included for testing purposes.
   */
  forceCrossProtocol: boolean;
  /**
   * The minimum percentage of the input token to use for each route in a split route.
   * All routes will have a multiple of this value. For example is distribution percentage is 5,
   * a potential return swap would be:
   *
   * 5% of input => Route 1
   * 55% of input => Route 2
   * 40% of input => Route 3
   */
  distributionPercent: number;
};

export class NearRouter
  implements
    IRouter<AlphaRouterConfig>,
    ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>
{
  protected chainId: ChainId;

  constructor(chainId: number) {
    this.chainId = chainId;
  }

  public async routeToRatio(
    token0Balance: CurrencyAmount,
    token1Balance: CurrencyAmount,
    position: Position,
    swapAndAddConfig: SwapAndAddConfig,
    swapAndAddOptions?: SwapAndAddOptions,
    routingConfig: Partial<AlphaRouterConfig> = DEFAULT_ROUTING_CONFIG_BY_CHAIN(
      this.chainId
    )
  ): Promise<any> {}

  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    swapConfig?: SwapOptions,
    partialRoutingConfig: Partial<AlphaRouterConfig> = {}
  ): Promise<SwapRoute | null> {
    const routingConfig: AlphaRouterConfig = _.merge(
      {},
      DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId),
      partialRoutingConfig
    );

    const { protocols } = routingConfig;
    const protocolsSet = new Set(protocols ?? []);

    const currencyIn =
      tradeType == TradeType.EXACT_INPUT ? amount.currency : quoteCurrency;
    const currencyOut =
      tradeType == TradeType.EXACT_INPUT ? quoteCurrency : amount.currency;
    const tokenIn = currencyIn.wrapped;
    const tokenOut = currencyOut.wrapped;

    const percents: number[] = [100];
    const amounts: CurrencyAmount[] = [amount];

    const gasData = await axios.get('https://api.curve.fi/api/getGas');
    const gasPriceWei = BigNumber.from(gasData.data.data.gas.standard);
    const quoteToken = quoteCurrency.wrapped;

    const quoteRefPromises: Promise<{
      routesWithValidQuotes: RouteWithValidQuote[];
    }>[] = [];
    if (protocolsSet.has(ButterProtocol.REF)) {
      quoteRefPromises.push(
        this.getRefQuotes(
          tokenIn,
          tokenOut,
          amounts,
          percents,
          quoteToken,
          gasPriceWei,
          tradeType
        )
      );
    }

    let allRoutesWithValidQuotes: RouteWithValidQuote[] = [];
    let methodParameters: MethodParameters | undefined;
    const routesWithValidQuotesByRefProtocol = await Promise.all(
      quoteRefPromises
    );

    for (const {
      routesWithValidQuotes,
    } of routesWithValidQuotesByRefProtocol) {
      allRoutesWithValidQuotes = [
        ...allRoutesWithValidQuotes,
        ...routesWithValidQuotes,
      ];
    }

    if (allRoutesWithValidQuotes.length == 0) {
      log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
      return null;
    }

    const swapRouteRaw = await getBestSwapRoute(
      amount,
      percents,
      allRoutesWithValidQuotes,
      tradeType,
      this.chainId,
      routingConfig
    );

    if (!swapRouteRaw) {
      return null;
    }

    const {
      quote,
      quoteGasAdjusted,
      estimatedGasUsed,
      routes: routeAmounts,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
    } = swapRouteRaw;

    return {
      quote,
      quoteGasAdjusted,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      route: routeAmounts,
      methodParameters,
      blockNumber: BigNumber.from(0),
    };
  }

  private async getRefQuotes(
    token0: Token,
    token1: Token,
    amounts: CurrencyAmount[],
    percents: number[],
    quoteToken: Token,
    gasPriceWei: BigNumber,
    swapType: TradeType
  ): Promise<{
    routesWithValidQuotes: RefRouteWithValidQuote[];
  }> {
    init_env('mainnet');

    let token0Name: string;
    let token1Name: string;
    if (token0.name && token1.name) {
      token0Name = token0.name;
      token1Name = token1.name;
    } else {
      throw 'ref-router Quotes error: token id is null';
    }

    const tokenIn = await ftGetTokenMetadata(token0Name);
    const tokenOut = await ftGetTokenMetadata(token1Name);
    const { ratedPools, unRatedPools, simplePools } = await fetchAllPools();
    const stablePools: RefPool[] = unRatedPools.concat(ratedPools);
    const stablePoolsDetail: StablePool[] = await getStablePools(stablePools);
    const options: RefSwapOptions = {
      enableSmartRouting: true,
      stablePools,
      stablePoolsDetail,
    };

    let routes = [];
    let outputs = [];
    for (let i = 0; i < amounts.length; i++) {
      let swapTodos: EstimateSwapView[] = await estimateSwap({
        tokenIn,
        tokenOut,
        amountIn: amounts[i]!.toExact(),
        simplePools,
        options,
      });
      let amountOut = getExpectedOutputFromSwapTodos(swapTodos, tokenOut.id);
      routes.push(swapTodos);
      outputs.push(amountOut);
    }

    if (outputs.length == 0) {
      return { routesWithValidQuotes: [] };
    }

    let routesWithValidQuotes: RefRouteWithValidQuote[] = [];
    for (let i = 0; i < amounts.length; i++) {
      const percent = percents[i]!;
      const amount = amounts[i]!;
      const refRoute = new RefRoute(routes[i]!, amount.toExact());
      const quote = getExpectedOutputFromSwapTodos(routes[i]!, tokenOut.id);
      const routeWithValidQuote = new RefRouteWithValidQuote({
        amount: amount,
        rawQuote: BigNumber.from(quote.toFixed(0)),
        percent: percent,
        route: refRoute,
        quoteToken: quoteToken,
        gasPriceWei: gasPriceWei,
        tradeType: swapType,
        platform: ButterProtocol.REF,
      });
      routesWithValidQuotes.push(routeWithValidQuote);
    }

    return { routesWithValidQuotes };
  }
}
