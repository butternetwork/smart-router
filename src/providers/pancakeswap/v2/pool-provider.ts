import { Pair, TokenAmount } from '@pancakeswap/sdk';
import { ChainId } from '../../../util/chains';
import { default as AsyncRetry, default as retry } from 'async-retry';
import _ from 'lodash';
import { uniTokenToPancakeToken } from '../../../adapter/pancake-adapter';
import { IUniswapV2Pair__factory } from '../../../types/v2';
import { log } from '../../../util/log';
import { poolToString } from '../../../util/routes';
import { Token } from '../../../util/token';
import {
  IReserves,
  IV2PoolProvider,
  V2PoolAccessor,
} from '../../interfaces/IPoolProvider';
import { IMulticallProvider, Result } from '../../multicall-provider';
import { ProviderConfig } from '../../provider';
import { getCreate2Address } from 'ethers/lib/utils';
import { pack, keccak256 } from '@ethersproject/solidity';
import { BSC_TESTNET_INIT_CODE_HASH } from '../../../util/constants';
import { BSC_TEST_FACTORY_ADDRESS } from '../../../util/addresses';

export type V2PoolRetryOptions = AsyncRetry.Options;

export class PancakeV2PoolProvider implements IV2PoolProvider {
  // Computing pool addresses is slow as it requires hashing, encoding etc.
  // Addresses never change so can always be cached.
  public POOL_ADDRESS_CACHE: { [key: string]: string } = {};

  /**
   * Creates an instance of V2PoolProvider.
   * @param chainId The chain id to use.
   * @param multicall2Provider The multicall provider to use to get the pools.
   * @param retryOptions The retry options for each call to the multicall.
   */
  constructor(
    protected chainId: ChainId,
    protected multicall2Provider: IMulticallProvider,
    protected retryOptions: V2PoolRetryOptions = {
      retries: 2,
      minTimeout: 50,
      maxTimeout: 500,
    }
  ) {}

  public async getPools(
    tokenPairs: [Token, Token][],
    providerConfig?: ProviderConfig
  ): Promise<V2PoolAccessor> {
    const poolAddressSet: Set<string> = new Set<string>();
    const sortedTokenPairs: Array<[Token, Token]> = [];
    const sortedPoolAddresses: string[] = [];
console.log("call me")
    for (let tokenPair of tokenPairs) {
      const [tokenA, tokenB] = tokenPair;
      const { poolAddress, token0, token1 } = this.getPoolAddress(
        tokenA,
        tokenB
      );

      if (poolAddressSet.has(poolAddress)) {
        continue;
      }

      poolAddressSet.add(poolAddress);
      sortedTokenPairs.push([token0, token1]);
      sortedPoolAddresses.push(poolAddress);
    }

    log.debug(
      `getPools called with ${tokenPairs.length} token pairs. Deduped down to ${poolAddressSet.size}`
    );

    const reservesResults = await this.getPoolsData<IReserves>(
      sortedPoolAddresses,
      'getReserves',
      providerConfig
    );

    log.info(
      `Got reserves for ${poolAddressSet.size} pools ${
        providerConfig?.blockNumber
          ? `as of block: ${await providerConfig?.blockNumber}.`
          : ``
      }`
    );

    const poolAddressToPool: { [poolAddress: string]: Pair } = {};

    const invalidPools: [Token, Token][] = [];

    for (let i = 0; i < sortedPoolAddresses.length; i++) {
      const reservesResult = reservesResults[i]!;

      if (!reservesResult?.success) {
        const [token0, token1] = sortedTokenPairs[i]!;
        invalidPools.push([token0, token1]);

        continue;
      }

      const [token0, token1] = sortedTokenPairs[i]!;
      const { reserve0, reserve1 } = reservesResult.result;

      const pool = new Pair(
        new TokenAmount(uniTokenToPancakeToken(token0), reserve0.toString()),
        new TokenAmount(uniTokenToPancakeToken(token1), reserve1.toString())
      );

      const poolAddress = sortedPoolAddresses[i]!;

      poolAddressToPool[poolAddress] = pool;
    }

    if (invalidPools.length > 0) {
      log.info(
        {
          invalidPools: _.map(
            invalidPools,
            ([token0, token1]) => `${token0.symbol}/${token1.symbol}`
          ),
        },
        `${invalidPools.length} pools invalid after checking their slot0 and liquidity results. Dropping.`
      );
    }

    const poolStrs = _.map(Object.values(poolAddressToPool), poolToString);

    log.debug({ poolStrs }, `Found ${poolStrs.length} valid pools`);
// console.log("poolAddressToPool",poolAddressToPool)
// console.log("Object.values(poolAddressToPool)",Object.values(poolAddressToPool))
    return {
      getPool: (tokenA: Token, tokenB: Token): Pair | undefined => {
        const { poolAddress } = this.getPoolAddress(tokenA, tokenB);
        return poolAddressToPool[poolAddress];
      },
      getPoolByAddress: (address: string): Pair | undefined =>
        poolAddressToPool[address],
      getAllPools: (): Pair[] => Object.values(poolAddressToPool),
    };
  }

  public getPoolAddress(
    tokenA: Token,
    tokenB: Token
  ): { poolAddress: string; token0: Token; token1: Token } {
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

    const cacheKey = `${this.chainId}/${token0.address}/${token1.address}`;

    const cachedAddress = this.POOL_ADDRESS_CACHE[cacheKey];

    if (cachedAddress) {
      return { poolAddress: cachedAddress, token0, token1 };
    }

    let poolAddress :string
    if(tokenA.chainId == ChainId.BSC){
      poolAddress = Pair.getAddress(
        uniTokenToPancakeToken(token0),
        uniTokenToPancakeToken(token1)
      );
    }else if(tokenA.chainId == ChainId.BSC_TEST){
      poolAddress = computePairAddress({
        factoryAddress:BSC_TEST_FACTORY_ADDRESS,
        tokenA:token0,
        tokenB:token1
      });
    }else{
      throw(new Error(`unknown token chianId ${tokenA.chainId}`))
    }

    this.POOL_ADDRESS_CACHE[cacheKey] = poolAddress;

    return { poolAddress, token0, token1 };
  }

  private async getPoolsData<TReturn>(
    poolAddresses: string[],
    functionName: string,
    providerConfig?: ProviderConfig
  ): Promise<Result<TReturn>[]> {
    const { results, blockNumber } = await retry(async () => {
      return this.multicall2Provider.callSameFunctionOnMultipleContracts<
        undefined,
        TReturn
      >({
        addresses: poolAddresses,
        contractInterface: IUniswapV2Pair__factory.createInterface(),
        functionName: functionName,
        providerConfig,
      });
    }, this.retryOptions);

    log.debug(`Pool data fetched as of block ${blockNumber}`);

    return results;
  }
}

const computePairAddress = ({
  factoryAddress,
  tokenA,
  tokenB,
}: {
  factoryAddress: string;
  tokenA: Token;
  tokenB: Token;
}): string => {
  const [token0, token1] = tokenA.sortsBefore(tokenB)
    ? [tokenA, tokenB]
    : [tokenB, tokenA]; // does safety checks
  return getCreate2Address(
    factoryAddress,
    keccak256(
      ['bytes'],
      [pack(['address', 'address'], [token0.address, token1.address])]
    ),
    BSC_TESTNET_INIT_CODE_HASH
  );
};