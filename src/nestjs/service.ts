import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { RouteWithValidQuote, SwapRoute } from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import { TradeType } from '../util/constants';
import { ButterProtocol } from '../util/protocol';

@Injectable()
export class RouterService {

  async getBestRoute(
    chainId: number,
    amountIn: string,
    tokenInAddress: string,
    tokenInDecimal: number,
    tokenOutAddress: string,
    tokenOutDecimal: number,
  ): Promise<RouteWithValidQuote[]> {
    let rpcProvide
    let protocols
    switch (chainId) {
      case 1:
        rpcProvide = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/26b081ad80d646ad97c4a7bdb436a372', chainId);
        protocols = [
          ButterProtocol.UNI_V2,
          ButterProtocol.UNI_V3,
          ButterProtocol.SUSHISWAP,
        ];
        break
      case 56:
        rpcProvide = new ethers.providers.JsonRpcProvider('https://bsc-dataseed1.defibit.io/', chainId);
        protocols = [
          ButterProtocol.PANCAKESWAP,
        ];
        break
      case 137:
        rpcProvide = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.infura.io/v3/26b081ad80d646ad97c4a7bdb436a372', chainId);
        protocols = [
          ButterProtocol.QUICKSWAP,
        ];
        break
      default:
        rpcProvide = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/26b081ad80d646ad97c4a7bdb436a372', chainId);
        protocols = [
          ButterProtocol.UNI_V2,
          ButterProtocol.UNI_V3,
          ButterProtocol.SUSHISWAP,
        ];
        break
    }
    
    const swapRoute = await getBestRoute(
      chainId,
      rpcProvide,
      protocols,
      amountIn,
      tokenInAddress,
      tokenInDecimal,
      tokenOutAddress,
      tokenOutDecimal,
      TradeType.EXACT_INPUT
    );
    if (swapRoute?.route == null) {
      return []
    }
    return swapRoute.route;
  }

  async getRefRoute(
    amountIn: string,
    tokenInAddress: string,
    tokenOutAddress: string,
  ): Promise<RouteWithValidQuote[]> {
    let provider: any
    const protocols = [
      ButterProtocol.REF,
    ];
    const swapRoute = await getBestRoute(
      1313161554,
      provider,
      protocols,
      amountIn,
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      18,
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      18,
      TradeType.EXACT_INPUT,
      '',
      tokenInAddress,
      '',
      tokenOutAddress
    );
    if (swapRoute?.route == null) {
      return []
    }
    return swapRoute.route;
  }
}