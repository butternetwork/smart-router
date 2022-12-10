import { Token, TradeType } from '@uniswap/sdk-core';
import { ethers, providers } from 'ethers';
import JSBI from 'jsbi';
import { AlphaRouter, AlphaRouterConfig } from '.';
import { ChainId } from '../util';
import { CurrencyAmount } from '../util/amounts';
import { TradeType as VTradeType } from '../util/constants';
import { ButterProtocol } from '../util/protocol';
import { BSCAlphaRouter } from './alpha-router/bsc-alpha-router';
import { MapAlphaRouter } from './alpha-router/map-alpha-router';
import { NearRouter } from './alpha-router/near-alpha-router';
import { SwapOptions, SwapRoute } from './router';

export async function getBestRoute(
  chainId: number,
  provider: providers.BaseProvider,
  protocols: ButterProtocol[],
  swapAmountHumanReadable: string,
  tokenInAddress: string,
  tokenInDecimal: number,
  tokenOutAddress: string,
  tokenOutDecimal: number,
  tradeType: VTradeType,
  tokenInSymbol?: string,
  tokenInName?: string,
  tokenOutSymbol?: string,
  tokenOutName?: string
): Promise<SwapRoute | null> {
  let router;
  switch (chainId) {
    case ChainId.MAINNET:
      router = new AlphaRouter({
        chainId: chainId,
        provider: provider,
      });
      break;
    case ChainId.BSC:
      router = new BSCAlphaRouter({
        chainId: chainId,
        provider: provider,
      });
      break;
    case ChainId.BSC_TEST:
        router = new BSCAlphaRouter({
          chainId: chainId,
          provider: provider,
        });
        break;
    case ChainId.POLYGON:
      router = new AlphaRouter({
        chainId: chainId,
        provider: provider,
      });
      break;
    case ChainId.POLYGON_MUMBAI:
        router = new AlphaRouter({
          chainId: chainId,
          provider: provider,
        });
        break;
    case ChainId.MAP:
      router = new MapAlphaRouter({
        chainId: chainId,
        provider: provider,
      });
      break;
    case ChainId.NEAR:
      router = new NearRouter(chainId);
      break;
    default:
      router = new AlphaRouter({
        chainId: chainId,
        provider: provider,
      });
      break;
  }

  const tokenIn = new Token(
    chainId,
    tokenInAddress,
    tokenInDecimal,
    tokenInSymbol,
    tokenInName
  );

  const tokenOut = new Token(
    chainId,
    tokenOutAddress,
    tokenOutDecimal,
    tokenOutSymbol,
    tokenOutName
  );

  const amountInRaw = ethers.utils.parseUnits(
    swapAmountHumanReadable,
    tokenIn.decimals
  );
  const inAmount = CurrencyAmount.fromRawAmount(
    tokenIn,
    JSBI.BigInt(amountInRaw)
  );

  const routerConfig: Partial<AlphaRouterConfig> = {
    protocols: protocols,
  };

  const swapRoute = await router.route(
    inAmount,
    tokenOut,
    tradeType === VTradeType.EXACT_INPUT
      ? TradeType.EXACT_INPUT
      : TradeType.EXACT_OUTPUT,
    {} as SwapOptions,
    routerConfig
  );

  return swapRoute;
}
