import _ from 'lodash';
import { IERC20Metadata__factory } from '../../../types/v3';
import { ChainId, log } from '../../../util';
import { Token } from '../../../util/token';
import { IMulticallProvider } from './../../multicall-provider';
import { ProviderConfig } from './../../provider';

/**
 * Provider for getting token data.
 *
 * @export
 * @interface ITokenProvider
 */
export interface ITokenProvider {
  /**
   * Gets the token at each address. Any addresses that are not valid ERC-20 are ignored.
   *
   * @param addresses The token addresses to get.
   * @param [providerConfig] The provider config.
   * @returns A token accessor with methods for accessing the tokens.
   */
  getTokens(
    addresses: string[],
    providerConfig?: ProviderConfig
  ): Promise<TokenAccessor>;
}

export type TokenAccessor = {
  getTokenByAddress(address: string): Token | undefined;
  getTokenBySymbol(symbol: string): Token | undefined;
  getAllTokens: () => Token[];
};

//NEAR tokens
export const USDT_NEAR = new Token(
  ChainId.NEAR,
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  6,
  'USDT.e',
  'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near'
);

export const USDC_NEAR = new Token(
  ChainId.NEAR,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'USDC',
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near'
);

export const WNEAR_NEAR = new Token(
  ChainId.NEAR,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'WNEAR',
  'wrap.near'
);

//

export const WRAP_NEART = new Token(
  ChainId.NEAR_TEST,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'wrap',
  'wrap.testnet'
);

export const AURORA_NEARTT = new Token(
  ChainId.NEAR_TEST,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'aurora',
  'aurora.fakes.testnet'
);

//BSC tokens
export const USDT_BNB = new Token(
  56,
  '0x55d398326f99059fF775485246999027B3197955',
  18,
  'USDT.e',
  'USDT.e'
);

export const USDC_BNB = new Token(
  56,
  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  18,
  'USDC',
  'USDC'
);

export const WBNB_BNB = new Token(
  56,
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  18,
  'WBNB',
  'WBNB'
);

//MAP tokens

export const ETH_MAP = new Token(
  22776,
  '0x05ab928d446d8ce6761e368c8e7be03c3168a9ec',
  18,
  'Mapped Wrapped Ether',
  'ETH'
);

export const WMAP_MAP = new Token(
  22776,
  '0x13cb04d4a5dfb6398fc5ab005a6c84337256ee23',
  18,
  'WMAP',
  'Wrapped MAP'
);

export const USDC_MAP = new Token(
  22776,
  '0x9f722b2cb30093f766221fd0d37964949ed66918',
  18,
  'Mapped USD Coin',
  'USDC'
);

export const GLD_MAP = new Token(
  212,
  '0xdeebb41da493606119c9dcc89069ca51753e9000',
  18,
  'GLD',
  'Gold'
);

export const KUN_MAP = new Token(
  212,
  '0x144e00194a0641dec63dfd0bfe0063ae74794304',
  18,
  'KUN',
  'Gold'
);

//ETH tokens
export const USDC = new Token(
  1,
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  6,
  'USDC',
  'USD//C'
);

export const USDT = new Token(
  1,
  '0xdac17f958d2ee523a2206206994597c13d831ec7',
  6,
  'USDT',
  'Tether USD'
);

//MATIC tokens
export const WMATIC_MATIC = new Token(
  ChainId.POLYGON,
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  18,
  'WMATIC',
  'Wrapped MATIC'
);

export const WETH_MATIC = new Token(
  ChainId.NEAR_TEST,
  '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  18,
  'WETH',
  'Wrapped Ether'
);

export const USDC_MATIC = new Token(
  ChainId.POLYGON,
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  6,
  'USDC',
  'USD//C'
);
export const USDT_MATIC = new Token(
  ChainId.POLYGON,
  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  6,
  'USDT',
  'Tether'
);
export const DAI_MATIC = new Token(
  ChainId.POLYGON,
  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  18,
  'DAI',
  'Dai Stablecoin'
);

export class TokenProvider implements ITokenProvider {
  constructor(
    private chainId: ChainId,
    protected multicall2Provider: IMulticallProvider
  ) {}

  public async getTokens(
    _addresses: string[],
    providerConfig?: ProviderConfig
  ): Promise<TokenAccessor> {
    const addressToToken: { [address: string]: Token } = {};
    const symbolToToken: { [symbol: string]: Token } = {};

    const addresses = _(_addresses)
      .map((address) => address.toLowerCase())
      .uniq()
      .value();

    if (addresses.length > 0) {
      const [symbolsResult, decimalsResult] = await Promise.all([
        this.multicall2Provider.callSameFunctionOnMultipleContracts<
          undefined,
          [string]
        >({
          addresses,
          contractInterface: IERC20Metadata__factory.createInterface(),
          functionName: 'symbol',
          providerConfig,
        }),
        this.multicall2Provider.callSameFunctionOnMultipleContracts<
          undefined,
          [number]
        >({
          addresses,
          contractInterface: IERC20Metadata__factory.createInterface(),
          functionName: 'decimals',
          providerConfig,
        }),
      ]);

      const { results: symbols } = symbolsResult;
      const { results: decimals } = decimalsResult;

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]!;

        const symbolResult = symbols[i];
        const decimalResult = decimals[i];

        if (!symbolResult?.success || !decimalResult?.success) {
          log.info(
            {
              symbolResult,
              decimalResult,
            },
            `Dropping token with address ${address} as symbol or decimal are invalid`
          );
          continue;
        }

        const symbol = symbolResult.result[0]!;
        const decimal = decimalResult.result[0]!;

        addressToToken[address.toLowerCase()] = new Token(
          this.chainId,
          address,
          decimal,
          symbol
        );
        symbolToToken[symbol.toLowerCase()] =
          addressToToken[address.toLowerCase()]!;
      }

      log.info(
        `Got token symbol and decimals for ${
          Object.values(addressToToken).length
        } out of ${addresses.length} tokens on-chain ${
          providerConfig ? `as of: ${providerConfig?.blockNumber}` : ''
        }`
      );
    }

    return {
      getTokenByAddress: (address: string): Token | undefined => {
        return addressToToken[address.toLowerCase()];
      },
      getTokenBySymbol: (symbol: string): Token | undefined => {
        return symbolToToken[symbol.toLowerCase()];
      },
      getAllTokens: (): Token[] => {
        return Object.values(addressToToken);
      },
    };
  }
}
