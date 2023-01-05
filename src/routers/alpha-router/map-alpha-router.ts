import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Currency, Fraction, Token, TradeType } from '@uniswap/sdk-core';
import { TokenList } from '@uniswap/token-lists';
import { Pair } from '@uniswap/v2-sdk';
import {
  MethodParameters,
  Pool,
  Position,
  SqrtPriceMath,
  TickMath,
} from '@uniswap/v3-sdk';
import { default as retry } from 'async-retry';
import { BigNumber, providers } from 'ethers';
import JSBI from 'jsbi';
import _ from 'lodash';
import NodeCache from 'node-cache';
import {
  CachingGasStationProvider,
  CachingTokenProviderWithFallback,
  EIP1559GasPriceProvider,
  ETHGasStationInfoProvider,
  ISwapRouterProvider,
  IV2QuoteProvider,
  LegacyGasPriceProvider,
  NodeJSCache,
  OnChainGasPriceProvider,
  SwapRouterProvider,
  UniswapMulticallProvider,
  V2QuoteProvider,
} from '../../providers';
import {
  CachingTokenListProvider,
  ITokenListProvider,
} from '../../providers/caching-token-list-provider';
import {
  GasPrice,
  IGasPriceProvider,
} from '../../providers/gas-price-provider';
import { IV2PoolProvider } from '../../providers/interfaces/IPoolProvider';
import { RawETHV2SubgraphPool } from '../../providers/interfaces/ISubgraphProvider';
import { ITokenProvider, TokenProvider } from '../../providers/token-provider';
import {
  ITokenValidatorProvider,
  TokenValidationResult,
  TokenValidatorProvider,
} from '../../providers/token-validator-provider';
import {
  ArbitrumGasData,
  IL2GasDataProvider,
  OptimismGasData,
} from '../../providers/uniswap/v3/gas-data-provider';

import { CurrencyAmount } from '../../util/amounts';
import { ChainId } from '../../util/chains';
import { log } from '../../util/log';
import { metric, MetricLoggerUnit } from '../../util/metric';
import {
  getETHPoolsFromServer,
  getMapPoolsFromOneProtocol,
} from '../../util/pool';
import { ButterProtocol } from '../../util/protocol';
import { poolToString, routeToString } from '../../util/routes';
import { UNSUPPORTED_TOKENS } from '../../util/unsupported-tokens';
import {
  IRouter,
  ISwapToRatio,
  SwapAndAddConfig,
  SwapAndAddOptions,
  SwapOptions,
  SwapRoute,
} from '../router';
import {
  DEFAULT_ROUTING_CONFIG_BY_CHAIN,
  ETH_GAS_STATION_API_URL,
} from './config';
import {
  RouteWithValidQuote,
  V2RouteWithValidQuote,
} from './entities/route-with-valid-quote';
import { getBestSwapRoute } from './functions/best-swap-route';
import { computeAllV2Routes } from './functions/compute-all-routes';
import {
  CandidatePoolsBySelectionCriteria,
  getV2CandidatePools,
  PoolId,
} from './functions/get-candidate-pools';
import { IV2GasModelFactory } from './gas-models/gas-model';
import { V2HeuristicGasModelFactory } from './gas-models/v2/v2-heuristic-gas-model';
import {
  _getBestRouteAndOutput,
  _getUsdRate,
} from './functions/get-curve-best-router';
import axios from 'axios';
import { MAP_MULTICALL_ADDRESS } from '../../util/addresses';
import { MapPoolProvider } from '../../providers/hiveswap/pool-provider';
export type AlphaRouterParams = {
  /**
   * The chain id for this instance of the Alpha Router.
   */
  chainId: ChainId;
  /**
   * The Web3 provider for getting on-chain data.
   */
  provider: providers.BaseProvider;
  /**
   * The provider to use for making multicalls. Used for getting on-chain data
   * like pools, tokens, quotes in batch.
   */
  multicall2Provider?: UniswapMulticallProvider;
  /**
   * The provider for getting data about V2 pools.
   */
  v2PoolProvider?: IV2PoolProvider;
  /**
   * The provider for getting V3 quotes.
   */
  v2QuoteProvider?: IV2QuoteProvider;
  /**
   * A factory for generating a gas model that is used when estimating the gas used by
   * V2 routes.
   */
  v2GasModelFactory?: IV2GasModelFactory;

  tokenProvider?: ITokenProvider;
  /**
   * The provider for getting the current gas price to use when account for gas in the
   * algorithm.
   */
  gasPriceProvider?: IGasPriceProvider;
  /**
   * A token list that specifies Token that should be blocked from routing through.
   * Defaults to Uniswap's unsupported token list.
   */
  blockedTokenListProvider?: ITokenListProvider;

  /**
   * Calls lens function on SwapRouter02 to determine ERC20 approval types for
   * LP position tokens.
   */
  swapRouterProvider?: ISwapRouterProvider;

  /**
   * A token validator for detecting fee-on-transfer tokens or tokens that can't be transferred.
   */
  tokenValidatorProvider?: ITokenValidatorProvider;
};

/**
 * Determines the pools that the algorithm will consider when finding the optimal swap.
 *
 * All pools on each protocol are filtered based on the heuristics specified here to generate
 * the set of candidate pools. The Top N pools are taken by Total Value Locked (TVL).
 *
 * Higher values here result in more pools to explore which results in higher latency.
 */
export type ProtocolPoolSelection = {
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

export type AlphaRouterConfig = {
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

export class MapAlphaRouter
  implements
    IRouter<AlphaRouterConfig>,
    ISwapToRatio<AlphaRouterConfig, SwapAndAddConfig>
{
  protected chainId: ChainId;
  protected provider: providers.BaseProvider;
  protected multicall2Provider: UniswapMulticallProvider;
  protected v2PoolProvider: IV2PoolProvider;
  protected v2QuoteProvider: IV2QuoteProvider;
  protected tokenProvider: ITokenProvider;
  protected gasPriceProvider: IGasPriceProvider;
  protected swapRouterProvider: ISwapRouterProvider;
  protected v2GasModelFactory: IV2GasModelFactory;
  protected tokenValidatorProvider?: ITokenValidatorProvider;
  protected blockedTokenListProvider?: ITokenListProvider;
  protected l2GasDataProvider?:
    | IL2GasDataProvider<OptimismGasData>
    | IL2GasDataProvider<ArbitrumGasData>;

  constructor({
    chainId,
    provider,
    multicall2Provider,
    v2PoolProvider,
    v2QuoteProvider,
    tokenProvider,
    blockedTokenListProvider,
    gasPriceProvider,
    v2GasModelFactory,
    swapRouterProvider,
    tokenValidatorProvider,
  }: AlphaRouterParams) {
    this.chainId = chainId;
    this.provider = provider;
    this.multicall2Provider =
      multicall2Provider ??
      new UniswapMulticallProvider(
        chainId,
        provider,
        375_000,
        MAP_MULTICALL_ADDRESS
      );
    this.v2PoolProvider =
      v2PoolProvider ?? new MapPoolProvider(chainId, this.multicall2Provider);
    this.v2QuoteProvider = v2QuoteProvider ?? new V2QuoteProvider();
    this.v2GasModelFactory =
      v2GasModelFactory ?? new V2HeuristicGasModelFactory();
    this.blockedTokenListProvider =
      blockedTokenListProvider ??
      new CachingTokenListProvider(
        chainId,
        UNSUPPORTED_TOKENS as TokenList,
        new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))
      );
    this.tokenProvider =
      tokenProvider ??
      new CachingTokenProviderWithFallback(
        chainId,
        new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })),
        new CachingTokenListProvider(
          chainId,
          DEFAULT_TOKEN_LIST,
          new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))
        ),
        new TokenProvider(chainId, this.multicall2Provider)
      );
    this.gasPriceProvider =
      gasPriceProvider ??
      new CachingGasStationProvider(
        chainId,
        this.provider instanceof providers.JsonRpcProvider
          ? new OnChainGasPriceProvider(
              chainId,
              new EIP1559GasPriceProvider(this.provider),
              new LegacyGasPriceProvider(this.provider)
            )
          : new ETHGasStationInfoProvider(ETH_GAS_STATION_API_URL),
        new NodeJSCache<GasPrice>(
          new NodeCache({ stdTTL: 15, useClones: false })
        )
      );
    this.swapRouterProvider =
      swapRouterProvider ?? new SwapRouterProvider(this.multicall2Provider);

    if (tokenValidatorProvider) {
      this.tokenValidatorProvider = tokenValidatorProvider;
    } else if (this.chainId == ChainId.MAINNET) {
      this.tokenValidatorProvider = new TokenValidatorProvider(
        this.chainId,
        this.multicall2Provider,
        new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false }))
      );
    }
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

  /**
   * @inheritdoc IRouter
   */
  public async route(
    amount: CurrencyAmount,
    quoteCurrency: Currency,
    tradeType: TradeType,
    swapConfig?: SwapOptions,
    partialRoutingConfig: Partial<AlphaRouterConfig> = {}
  ): Promise<SwapRoute | null> {
    metric.putMetric(
      `QuoteRequestedForChain${this.chainId}`,
      1,
      MetricLoggerUnit.Count
    );

    // Get a block number to specify in all our calls. Ensures data we fetch from chain is
    // from the same block.
    const blockNumber =
      partialRoutingConfig.blockNumber ?? this.getBlockNumberPromise();

    const routingConfig: AlphaRouterConfig = _.merge(
      {},
      DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId),
      partialRoutingConfig,
      { blockNumber }
    );

    const { protocols } = routingConfig;

    const currencyIn =
      tradeType == TradeType.EXACT_INPUT ? amount.currency : quoteCurrency;
    const currencyOut =
      tradeType == TradeType.EXACT_INPUT ? quoteCurrency : amount.currency;
    const tokenIn = currencyIn.wrapped;
    const tokenOut = currencyOut.wrapped;

    // Generate our distribution of amounts, i.e. fractions of the input amount.
    // We will get quotes for fractions of the input amount for different routes, then
    // combine to generate split routes.
    const [percents, amounts] = this.getAmountDistribution(
      amount,
      routingConfig
    );

    // Get an estimate of the gas price to use when estimating gas cost of different routes.
    const beforeGas = Date.now();
    const gasData = await axios.get('https://api.curve.fi/api/getGas');
    const gasPriceWei = BigNumber.from(gasData.data.data.gas.standard);
    //const gasPriceWei = await this.gasPriceProvider.getGasPrice();
    metric.putMetric(
      'GasPriceLoad',
      Date.now() - beforeGas,
      MetricLoggerUnit.Milliseconds
    );

    const quoteToken = quoteCurrency.wrapped;

    const quotePromises: Promise<{
      routesWithValidQuotes: RouteWithValidQuote[];
      candidatePools: CandidatePoolsBySelectionCriteria;
    }>[] = [];

    const protocolsSet = new Set(protocols ?? []);

    const allPoolsUnsanitizedJsonStr = await getETHPoolsFromServer(
      protocolsSet,
      this.chainId
    );

    if (protocolsSet.has(ButterProtocol.HIVESWAP)) {
      let PoolsUnsanitized: RawETHV2SubgraphPool[] = getMapPoolsFromOneProtocol(
        allPoolsUnsanitizedJsonStr,
        ButterProtocol.HIVESWAP
      );
      quotePromises.push(
        this.getMapQuotes(
          tokenIn,
          tokenOut,
          amounts,
          percents,
          quoteToken,
          gasPriceWei,
          tradeType,
          routingConfig,
          PoolsUnsanitized
        )
      );
    }

    const routesWithValidQuotesByProtocol = await Promise.all(quotePromises);

    let allRoutesWithValidQuotes: RouteWithValidQuote[] = [];
    let allCandidatePools: CandidatePoolsBySelectionCriteria[] = [];
    for (const {
      routesWithValidQuotes,
      candidatePools,
    } of routesWithValidQuotesByProtocol) {
      allRoutesWithValidQuotes = [
        ...allRoutesWithValidQuotes,
        ...routesWithValidQuotes,
      ];
      allCandidatePools = [...allCandidatePools, candidatePools];
    }

    if (allRoutesWithValidQuotes.length == 0) {
      log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
      return null;
    }
    // Given all the quotes for all the amounts for all the routes, find the best combination.
    const beforeBestSwap = Date.now();
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

    let methodParameters: MethodParameters | undefined;

    metric.putMetric(
      'FindBestSwapRoute',
      Date.now() - beforeBestSwap,
      MetricLoggerUnit.Milliseconds
    );

    metric.putMetric(
      `QuoteFoundForChain${this.chainId}`,
      1,
      MetricLoggerUnit.Count
    );

    this.emitPoolSelectionMetrics(swapRouteRaw, allCandidatePools);

    return {
      quote,
      quoteGasAdjusted,
      estimatedGasUsed,
      estimatedGasUsedQuoteToken,
      estimatedGasUsedUSD,
      gasPriceWei,
      route: routeAmounts,
      methodParameters,
      blockNumber: BigNumber.from(await blockNumber),
    };
  }

  private async applyTokenValidatorToPools<T extends Pool | Pair>(
    pools: T[],
    isInvalidFn: (
      token: Currency,
      tokenValidation: TokenValidationResult | undefined
    ) => boolean
  ): Promise<T[]> {
    if (!this.tokenValidatorProvider) {
      return pools;
    }

    log.info(`Running token validator on ${pools.length} pools`);

    const tokens = _.flatMap(pools, (pool) => [pool.token0, pool.token1]);

    const tokenValidationResults =
      await this.tokenValidatorProvider.validateTokens(tokens);

    const poolsFiltered = _.filter(pools, (pool: T) => {
      const token0Validation = tokenValidationResults.getValidationByToken(
        pool.token0
      );
      const token1Validation = tokenValidationResults.getValidationByToken(
        pool.token1
      );

      const token0Invalid = isInvalidFn(pool.token0, token0Validation);
      const token1Invalid = isInvalidFn(pool.token1, token1Validation);

      if (token0Invalid || token1Invalid) {
        log.info(
          `Dropping pool ${poolToString(pool)} because token is invalid. ${
            pool.token0.symbol
          }: ${token0Validation}, ${pool.token1.symbol}: ${token1Validation}`
        );
      }

      return !token0Invalid && !token1Invalid;
    });

    return poolsFiltered;
  }

  private async getMapQuotes(
    tokenIn: Token,
    tokenOut: Token,
    amounts: CurrencyAmount[],
    percents: number[],
    quoteToken: Token,
    gasPriceWei: BigNumber,
    swapType: TradeType,
    routingConfig: AlphaRouterConfig,
    v2PoolsUnsanitized: RawETHV2SubgraphPool[]
  ): Promise<{
    routesWithValidQuotes: V2RouteWithValidQuote[];
    candidatePools: CandidatePoolsBySelectionCriteria;
  }> {
    const { poolAccessor, candidatePools } = await getV2CandidatePools({
      tokenIn,
      tokenOut,
      tokenProvider: this.tokenProvider,
      blockedTokenListProvider: this.blockedTokenListProvider,
      poolProvider: this.v2PoolProvider,
      routeType: swapType,
      v2PoolsUnsanitized,
      routingConfig,
      chainId: this.chainId,
    });
    const poolsRaw = poolAccessor.getAllPools();
    // Drop any pools that contain tokens that can not be transferred according to the token validator.
    const pools = await this.applyTokenValidatorToPools(
      poolsRaw,
      (
        token: Currency,
        tokenValidation: TokenValidationResult | undefined
      ): boolean => {
        // If there is no available validation result we assume the token is fine.
        if (!tokenValidation) {
          return false;
        }

        // Only filters out *intermediate* pools that involve tokens that we detect
        // cant be transferred. This prevents us trying to route through tokens that may
        // not be transferrable, but allows users to still swap those tokens if they
        // specify.
        if (
          tokenValidation == TokenValidationResult.STF &&
          (token.equals(tokenIn) || token.equals(tokenOut))
        ) {
          return false;
        }

        return tokenValidation == TokenValidationResult.STF;
      }
    );

    // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
    const { maxSwapsPerPath } = routingConfig;
    const routes = computeAllV2Routes(
      tokenIn,
      tokenOut,
      pools as Pair[],
      maxSwapsPerPath
    );

    if (routes.length == 0) {
      return { routesWithValidQuotes: [], candidatePools };
    }

    // For all our routes, and all the fractional amounts, fetch quotes on-chain.
    const quoteFn =
      swapType == TradeType.EXACT_INPUT
        ? this.v2QuoteProvider.getQuotesManyExactIn.bind(this.v2QuoteProvider)
        : this.v2QuoteProvider.getQuotesManyExactOut.bind(this.v2QuoteProvider);

    const beforeQuotes = Date.now();

    log.info(
      `Getting quotes for V2 for ${routes.length} routes with ${amounts.length} amounts per route.`
    );
    const { routesWithQuotes } = await quoteFn(amounts, routes);

    const gasModel = await this.v2GasModelFactory.buildGasModel(
      this.chainId,
      gasPriceWei,
      this.v2PoolProvider,
      quoteToken
    );

    const routesWithValidQuotes = [];

    for (const routeWithQuote of routesWithQuotes) {
      const [route, quotes] = routeWithQuote;

      for (let i = 0; i < quotes.length; i++) {
        const percent = percents[i]!;
        const amountQuote = quotes[i]!;
        const { quote, amount } = amountQuote;

        if (!quote) {
          log.debug(
            {
              route: routeToString(route),
              amountQuote,
            },
            'Dropping a null V2 quote for route.'
          );
          continue;
        }

        const routeWithValidQuote = new V2RouteWithValidQuote({
          route,
          rawQuote: quote,
          amount,
          percent,
          gasModel,
          quoteToken,
          tradeType: swapType,
          v2PoolProvider: this.v2PoolProvider,
          platform: ButterProtocol.HIVESWAP,
        });

        routesWithValidQuotes.push(routeWithValidQuote);
      }
    }
    return { routesWithValidQuotes, candidatePools };
  }

  // Note multiplications here can result in a loss of precision in the amounts (e.g. taking 50% of 101)
  // This is reconcilled at the end of the algorithm by adding any lost precision to one of
  // the splits in the route.
  private getAmountDistribution(
    amount: CurrencyAmount,
    routingConfig: AlphaRouterConfig
  ): [number[], CurrencyAmount[]] {
    const { distributionPercent } = routingConfig;
    let percents = [];
    let amounts = [];

    for (let i = 1; i <= 100 / distributionPercent; i++) {
      percents.push(i * distributionPercent);
      amounts.push(amount.multiply(new Fraction(i * distributionPercent, 100)));
    }

    return [percents, amounts];
  }

  private emitPoolSelectionMetrics(
    swapRouteRaw: {
      quote: CurrencyAmount;
      quoteGasAdjusted: CurrencyAmount;
      routes: RouteWithValidQuote[];
      estimatedGasUsed: BigNumber;
    },
    allPoolsBySelection: CandidatePoolsBySelectionCriteria[]
  ) {
    const poolAddressesUsed = new Set<string>();
    const { routes: routeAmounts } = swapRouteRaw;
    _(routeAmounts)
      .flatMap((routeAmount) => {
        const { poolAddresses } = routeAmount;
        return poolAddresses;
      })
      .forEach((address: string) => {
        poolAddressesUsed.add(address.toLowerCase());
      });

    for (const poolsBySelection of allPoolsBySelection) {
      const { protocol } = poolsBySelection;
      _.forIn(
        poolsBySelection.selections,
        (pools: PoolId[], topNSelection: string) => {
          const topNUsed =
            _.findLastIndex(pools, (pool) =>
              poolAddressesUsed.has(pool.id.toLowerCase())
            ) + 1;
          metric.putMetric(
            _.capitalize(`${protocol}${topNSelection}`),
            topNUsed,
            MetricLoggerUnit.Count
          );
        }
      );
    }

    let hasV3Route = false;
    let hasV2Route = false;
    for (const routeAmount of routeAmounts) {
      if (
        routeAmount.protocol.toString() === ButterProtocol.UNI_V3.toString()
      ) {
        hasV3Route = true;
      }
      if (
        routeAmount.protocol.toString() === ButterProtocol.UNI_V2.toString()
      ) {
        hasV2Route = true;
      }
    }

    if (hasV3Route && hasV2Route) {
      metric.putMetric(`V3AndV2SplitRoute`, 1, MetricLoggerUnit.Count);
      metric.putMetric(
        `V3AndV2SplitRouteForChain${this.chainId}`,
        1,
        MetricLoggerUnit.Count
      );
    } else if (hasV3Route) {
      if (routeAmounts.length > 1) {
        metric.putMetric(`V3SplitRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(
          `V3SplitRouteForChain${this.chainId}`,
          1,
          MetricLoggerUnit.Count
        );
      } else {
        metric.putMetric(`V3Route`, 1, MetricLoggerUnit.Count);
        metric.putMetric(
          `V3RouteForChain${this.chainId}`,
          1,
          MetricLoggerUnit.Count
        );
      }
    } else if (hasV2Route) {
      if (routeAmounts.length > 1) {
        metric.putMetric(`V2SplitRoute`, 1, MetricLoggerUnit.Count);
        metric.putMetric(
          `V2SplitRouteForChain${this.chainId}`,
          1,
          MetricLoggerUnit.Count
        );
      } else {
        metric.putMetric(`V2Route`, 1, MetricLoggerUnit.Count);
        metric.putMetric(
          `V2RouteForChain${this.chainId}`,
          1,
          MetricLoggerUnit.Count
        );
      }
    }
  }

  private calculateOptimalRatio(
    position: Position,
    sqrtRatioX96: JSBI,
    zeroForOne: boolean
  ): Fraction {
    const upperSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickUpper);
    const lowerSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickLower);

    // returns Fraction(0, 1) for any out of range position regardless of zeroForOne. Implication: function
    // cannot be used to determine the trading direction of out of range positions.
    if (
      JSBI.greaterThan(sqrtRatioX96, upperSqrtRatioX96) ||
      JSBI.lessThan(sqrtRatioX96, lowerSqrtRatioX96)
    ) {
      return new Fraction(0, 1);
    }

    const precision = JSBI.BigInt('1' + '0'.repeat(18));
    let optimalRatio = new Fraction(
      SqrtPriceMath.getAmount0Delta(
        sqrtRatioX96,
        upperSqrtRatioX96,
        precision,
        true
      ),
      SqrtPriceMath.getAmount1Delta(
        sqrtRatioX96,
        lowerSqrtRatioX96,
        precision,
        true
      )
    );
    if (!zeroForOne) optimalRatio = optimalRatio.invert();
    return optimalRatio;
  }

  private absoluteValue(fraction: Fraction): Fraction {
    const numeratorAbs = JSBI.lessThan(fraction.numerator, JSBI.BigInt(0))
      ? JSBI.unaryMinus(fraction.numerator)
      : fraction.numerator;
    const denominatorAbs = JSBI.lessThan(fraction.denominator, JSBI.BigInt(0))
      ? JSBI.unaryMinus(fraction.denominator)
      : fraction.denominator;
    return new Fraction(numeratorAbs, denominatorAbs);
  }

  private getBlockNumberPromise(): number | Promise<number> {
    return retry(
      async (_b, attempt) => {
        if (attempt > 1) {
          log.info(`Get block number attempt ${attempt}`);
        }
        return this.provider.getBlockNumber();
      },
      {
        retries: 2,
        minTimeout: 100,
        maxTimeout: 1000,
      }
    );
  }
}
