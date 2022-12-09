import { ALIASES, curve } from '@curvefi/api/lib/curve';
import {
  ICoinFromPoolDataApi,
  IReward,
  IRoute,
} from '@curvefi/api/lib/interfaces';
import { _findAllRoutes } from '@curvefi/api/lib/pools';
import axios from 'axios';
import { ethers } from 'ethers';
import memoize from 'memoizee';

interface IDict<T> {
  [index: string]: T;
}

type INetworkName = 'ethereum' | 'polygon' | 'avalanche';

interface IExtendedPoolDataFromApi {
  poolData: IPoolDataFromApi[];
  tvl?: number;
  tvlAll: number;
}

interface IPoolDataFromApi {
  id: string;
  name: string;
  symbol: string;
  assetTypeName: string;
  address: string;
  lpTokenAddress?: string;
  gaugeAddress?: string;
  implementation: string;
  implementationAddress: string;
  coins: ICoinFromPoolDataApi[];
  gaugeRewards?: IReward[];
  usdTotal: number;
  totalSupply: number;
}

const _getCoinDecimals = (
  ...coinAddresses: string[] | string[][]
): number[] => {
  if (coinAddresses.length == 1 && Array.isArray(coinAddresses[0]))
    coinAddresses = coinAddresses[0];
  coinAddresses = coinAddresses as string[];

  return coinAddresses.map(
    (coinAddr) => curve.constants.DECIMALS[coinAddr.toLowerCase()] ?? 18
  ); // 18 for gauges
};

const formatNumber = (n: number | string, decimals = 18): string => {
  if (Number(n) !== Number(n)) throw Error(`${n} is not a number`); // NaN
  const [integer, fractional] = String(n).split('.');
  const result = !fractional
    ? integer
    : integer + '.' + fractional.slice(0, decimals);
  if (!result) {
    return 'number is undefined';
  }
  return result;
};

const parseUnits = (n: number | string, decimals = 18): ethers.BigNumber => {
  return ethers.utils.parseUnits(formatNumber(n, decimals), decimals);
};

const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const _getExchangeMultipleArgs = (
  inputCoinAddress: string,
  route: IRoute
): {
  _route: string[];
  _swapParams: number[][];
  _factorySwapAddresses: string[];
} => {
  let _route = [inputCoinAddress];
  let _swapParams = [];
  let _factorySwapAddresses = [];
  for (const routeStep of route.steps) {
    _route.push(routeStep.poolAddress, routeStep.outputCoinAddress);
    _swapParams.push([routeStep.i, routeStep.j, routeStep.swapType]);
    _factorySwapAddresses.push(routeStep.swapAddress);
  }
  _route = _route.concat(
    Array(9 - _route.length).fill(ethers.constants.AddressZero)
  );
  _swapParams = _swapParams.concat(
    Array(4 - _swapParams.length).fill([0, 0, 0])
  );
  _factorySwapAddresses = _factorySwapAddresses.concat(
    Array(4 - _factorySwapAddresses.length).fill(ethers.constants.AddressZero)
  );

  return { _route, _swapParams, _factorySwapAddresses };
};

const isEth = (address: string): boolean =>
  address.toLowerCase() === ETH_ADDRESS.toLowerCase();

const _getRouteKey = (
  route: IRoute,
  inputCoinAddress: string,
  outputCoinAddress: string
): string => {
  const sortedCoins = [inputCoinAddress, outputCoinAddress].sort();
  let key = `${sortedCoins[0]}-->`;
  for (const routeStep of route.steps) {
    key += `${routeStep.poolId}-->`;
  }
  key += sortedCoins[1];

  return key;
};

const _estimatedGasForDifferentRoutesCache: IDict<{
  gas: ethers.BigNumber;
  time: number;
}> = {};

const _estimateGasForDifferentRoutes = async (
  routes: IRoute[],
  inputCoinAddress: string,
  outputCoinAddress: string,
  _amount: ethers.BigNumber
): Promise<number[]> => {
  inputCoinAddress = inputCoinAddress.toLowerCase();
  outputCoinAddress = outputCoinAddress.toLowerCase();

  const contract = curve.contracts[ALIASES.registry_exchange]!.contract;
  const gasPromises: Promise<ethers.BigNumber>[] = [];
  const value = isEth(inputCoinAddress) ? _amount : ethers.BigNumber.from(0);
  for (const route of routes) {
    const routeKey = _getRouteKey(route, inputCoinAddress, outputCoinAddress);
    let gasPromise: Promise<ethers.BigNumber>;
    const { _route, _swapParams, _factorySwapAddresses } =
      _getExchangeMultipleArgs(inputCoinAddress, route);

    if (
      (_estimatedGasForDifferentRoutesCache[routeKey]?.time || 0) + 3600000 <
      Date.now()
    ) {
      if (contract.estimateGas) {
        let estimateGas: any = contract.estimateGas;
        gasPromise = estimateGas.exchange_multiple(
          _route,
          _swapParams,
          _amount,
          0,
          _factorySwapAddresses,
          { ...curve.constantOptions, value }
        );
      } else {
        throw 'contract.estimateGas is undefined';
      }
    } else {
      gasPromise = Promise.resolve(
        _estimatedGasForDifferentRoutesCache[routeKey]!.gas
      );
    }

    gasPromises.push(gasPromise);
  }

  try {
    const _gasAmounts: ethers.BigNumber[] = await Promise.all(gasPromises);

    routes.forEach((route, i: number) => {
      const routeKey = _getRouteKey(route, inputCoinAddress, outputCoinAddress);
      _estimatedGasForDifferentRoutesCache[routeKey] = {
        gas: _gasAmounts[i]!,
        time: Date.now(),
      };
    });

    return _gasAmounts.map((_g) => Number(ethers.utils.formatUnits(_g, 0)));
  } catch (err) {
    // No allowance
    return routes.map(() => 0);
  }
};

const _usdRatesCache: IDict<{ rate: number; time: number }> = {};

const _getPoolsFromApi = memoize(
  async (
    network: INetworkName,
    poolType: 'main' | 'crypto' | 'factory' | 'factory-crypto'
  ): Promise<IExtendedPoolDataFromApi> => {
    const url = `https://api.curve.fi/api/getPools/${network}/${poolType}`;
    const response = await axios.get(url, { validateStatus: () => true });
    return response.data.data ?? { poolData: [], tvl: 0, tvlAll: 0 };
  },
  {
    promise: true,
    maxAge: 5 * 60 * 1000, // 5m
  }
);

const _getUsdPricesFromApi = async (): Promise<IDict<number>> => {
  const network = curve.constants.NETWORK_NAME;
  const promises = [
    _getPoolsFromApi(network, 'main'),
    _getPoolsFromApi(network, 'crypto'),
    _getPoolsFromApi(network, 'factory'),
    _getPoolsFromApi(network, 'factory-crypto'),
  ];
  const allTypesExtendedPoolData = await Promise.all(promises);
  const priceDict: IDict<number> = {};

  for (const extendedPoolData of allTypesExtendedPoolData) {
    for (const pool of extendedPoolData.poolData) {
      const lpTokenAddress = pool.lpTokenAddress ?? pool.address;
      const totalSupply = pool.totalSupply / 10 ** 18;
      priceDict[lpTokenAddress.toLowerCase()] =
        pool.usdTotal && totalSupply ? pool.usdTotal / totalSupply : 0;

      for (const coin of pool.coins) {
        if (typeof coin.usdPrice === 'number')
          priceDict[coin.address.toLowerCase()] = coin.usdPrice;
      }

      for (const coin of pool.gaugeRewards ?? []) {
        if (typeof coin.tokenPrice === 'number')
          priceDict[coin.tokenAddress.toLowerCase()] = coin.tokenPrice;
      }
    }
  }

  return priceDict;
};

export const _getUsdRate = async (assetId: string): Promise<number> => {
  const pricesFromApi = await _getUsdPricesFromApi();
  if (assetId.toLowerCase() in pricesFromApi)
    return pricesFromApi[assetId.toLowerCase()]!;

  if (
    assetId === 'USD' ||
    (curve.chainId === 137 &&
      assetId.toLowerCase() === curve.constants.COINS.am3crv.toLowerCase())
  )
    return 1;

  let chainName = {
    1: 'ethereum',
    10: 'optimistic-ethereum',
    100: 'xdai',
    137: 'polygon-pos',
    250: 'fantom',
    1284: 'moonbeam',
    43114: 'avalanche',
    42161: 'arbitrum-one',
  }[curve.chainId];

  const nativeTokenName = {
    1: 'ethereum',
    10: 'ethereum',
    100: 'xdai',
    137: 'matic-network',
    250: 'fantom',
    1284: 'moonbeam',
    43114: 'avalanche-2',
    42161: 'ethereum',
  }[curve.chainId] as string;

  if (chainName === undefined) {
    throw Error('curve object is not initialized');
  }

  assetId =
    {
      CRV: 'curve-dao-token',
      EUR: 'stasis-eurs',
      BTC: 'bitcoin',
      ETH: 'ethereum',
      LINK: 'link',
    }[assetId.toUpperCase()] || assetId;
  assetId = isEth(assetId) ? nativeTokenName : assetId.toLowerCase();

  // No EURT on Coingecko Polygon
  if (
    curve.chainId === 137 &&
    assetId.toLowerCase() === curve.constants.COINS.eurt
  ) {
    chainName = 'ethereum';
    assetId = '0xC581b735A1688071A1746c968e0798D642EDE491'.toLowerCase(); // EURT Ethereum
  }

  // CRV
  if (assetId.toLowerCase() === curve.constants.ALIASES.crv) {
    assetId = 'curve-dao-token';
  }

  if ((_usdRatesCache[assetId]?.time || 0) + 600000 < Date.now()) {
    const url = [
      nativeTokenName,
      'ethereum',
      'bitcoin',
      'link',
      'curve-dao-token',
      'stasis-eurs',
    ].includes(assetId.toLowerCase())
      ? `https://api.coingecko.com/api/v3/simple/price?ids=${assetId}&vs_currencies=usd`
      : `https://api.coingecko.com/api/v3/simple/token_price/${chainName}?contract_addresses=${assetId}&vs_currencies=usd`;
    const response = await axios.get(url);
    try {
      _usdRatesCache[assetId] = {
        rate: response.data[assetId]['usd'] ?? 1,
        time: Date.now(),
      };
    } catch (err) {
      // TODO pay attention!
      _usdRatesCache[assetId] = { rate: 1, time: Date.now() };
    }
  }

  return _usdRatesCache[assetId]!['rate'];
};

export const _getBestRouteAndOutput = memoize(
  async (
    inputCoinAddress: string,
    inputCoinDecimals: number,
    outputCoinAddress: string,
    outputCoinDecimals: number,
    amount: number | string
  ): Promise<IRoute> => {
    const _amount = parseUnits(amount, inputCoinDecimals);
    if (_amount.eq(0))
      return {
        steps: [],
        _output: ethers.BigNumber.from(0),
        outputUsd: 0,
        txCostUsd: 0,
      };

    const routesRaw: IRoute[] = (
      await _findAllRoutes(inputCoinAddress, outputCoinAddress)
    ).map((steps) => ({
      steps,
      _output: ethers.BigNumber.from(0),
      outputUsd: 0,
      txCostUsd: 0,
    }));
    const routes: IRoute[] = [];

    try {
      const calls = [];
      const multicallContract =
        curve.contracts[ALIASES.registry_exchange]!.multicallContract;
      for (const route of routesRaw) {
        const { _route, _swapParams, _factorySwapAddresses } =
          _getExchangeMultipleArgs(inputCoinAddress, route);
        calls.push(
          multicallContract.get_exchange_multiple_amount(
            _route,
            _swapParams,
            _amount,
            _factorySwapAddresses
          )
        );
      }

      const _outputAmounts = (await curve.multicallProvider.all(
        calls
      )) as ethers.BigNumber[];

      for (let i = 0; i < _outputAmounts.length; i++) {
        routesRaw[i]!._output = _outputAmounts[i]!;
        routes.push(routesRaw[i]!);
      }
    } catch (err) {
      const promises = [];
      const contract = curve.contracts[ALIASES.registry_exchange]!.contract;
      for (const route of routesRaw) {
        const { _route, _swapParams, _factorySwapAddresses } =
          _getExchangeMultipleArgs(inputCoinAddress, route);
        promises.push(
          contract.get_exchange_multiple_amount(
            _route,
            _swapParams,
            _amount,
            _factorySwapAddresses,
            curve.constantOptions
          )
        );
      }

      // @ts-ignore
      const res = await Promise.allSettled(promises);

      for (let i = 0; i < res.length; i++) {
        if (res[i].status === 'rejected') {
          console.log(
            `Route ${routesRaw[i]!.steps.map((s) => s.poolId).join(
              ' --> '
            )} is unavailable`
          );
          continue;
        }
        routesRaw[i]!._output = res[i].value;
        routes.push(routesRaw[i]!);
      }
    }

    if (routes.length === 0) {
      return {
        steps: [],
        _output: ethers.BigNumber.from(0),
        outputUsd: 0,
        txCostUsd: 0,
      };
    }
    if (routes.length === 1) return routes[0]!;

    const [gasAmounts, outputCoinUsdRate, gasData, ethUsdRate] =
      await Promise.all([
        _estimateGasForDifferentRoutes(
          routes,
          inputCoinAddress,
          outputCoinAddress,
          _amount
        ),
        _getUsdRate(outputCoinAddress),
        axios.get('https://api.curve.fi/api/getGas'),
        _getUsdRate(ETH_ADDRESS),
      ]);
    const gasPrice = gasData.data.data.gas.standard;
    const expectedAmounts = routes.map((route) =>
      Number(ethers.utils.formatUnits(route._output, outputCoinDecimals))
    );

    const expectedAmountsUsd = expectedAmounts.map(
      (a) => a * outputCoinUsdRate
    );
    const txCostsUsd = gasAmounts.map(
      (a) => (ethUsdRate * a * gasPrice) / 1e18
    );

    routes.forEach((route, i) => {
      route.outputUsd = expectedAmountsUsd[i]!;
      route.txCostUsd = txCostsUsd[i]!;
    });

    return routes.reduce((route1, route2) =>
      route1.outputUsd -
        route1.txCostUsd -
        (route2.outputUsd - route2.txCostUsd) >=
      0
        ? route1
        : route2
    );
  },
  {
    promise: true,
    maxAge: 5 * 60 * 1000, // 5m
  }
);
