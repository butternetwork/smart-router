import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { BRIDGE_SUPPORTED_TOKEN, USDC_MAP } from '../providers/token-provider';
import { RefRoute, RefRouteWithValidQuote, RouteWithValidQuote, SwapRoute } from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import { ChainId, getChainProvider, ROUTER_INDEX, ZERO_ADDRESS } from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getTargetToken, toTargetToken } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

interface sortObj {
  index:Token,
  value:number
}

interface swapPrams{
  amountIn:string, 
  minAmountOut:string, 
  tokenIn:string,
  tokenOut:string,
  platform:string,
  poolId:string[]
}

interface swapData{
  path:swapPrams[],
  targetToken:string
}

interface AllRouter {
  srcChain:swapData,
  mapChain:swapData,
  targetChain:swapData
}

@Injectable()
export class RouterService {

  async crossChainRouter(tokenInAddr:string,tokenInDecimals:number,tokenOutAddr:string,tokenOutDecimals:number,amount:string,fromChainId:string,toChainId:string):Promise<AllRouter>{
    const tokenADecimals:number = Number(tokenInDecimals)
    const tokenBDecimals:number = Number(tokenOutDecimals)
    let ChainAId:number
    let ChainBId:number
    let tokenIn:Token
    let tokenOut:Token
    if(fromChainId == '5566818579631833088'){
      ChainAId = ChainId.NEAR
      tokenIn = new Token(ChainAId,ZERO_ADDRESS,6,"TOKEN IN",tokenInAddr)
    }else{
      ChainAId = Number(fromChainId)
      tokenIn = new Token(ChainAId,tokenInAddr,tokenADecimals)
    }
    if(toChainId == '5566818579631833088'){
      ChainBId = ChainId.NEAR 
      tokenOut = new Token(ChainBId,ZERO_ADDRESS,6,"TOKEN OUT",tokenOutAddr)
    }else{
      ChainBId = Number(toChainId)
      tokenOut = new Token(ChainBId,tokenOutAddr,tokenBDecimals)
    }

    const srcRouter = await srcChainRouter(tokenIn,amount,ChainAId)
    const targetRouter = await targetChainRouter(tokenOut,amount,ChainBId)
    const mapRouter:swapData = {
      path:[],
      targetToken:USDC_MAP.address
    } 
    const result:AllRouter = {
      srcChain:srcRouter,
      mapChain:mapRouter,
      targetChain:targetRouter
    }
    return result
  }

}

async function findBestRouter(chainId: number, tokenIn: Token, tokenOut: Token, amount: string): Promise<any> {
  const config = getChainProvider(chainId)
  let swapRoute

  if (chainId != ChainId.NEAR){
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
    );
  }else{
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
  }

  let total = 0
  let gasCostInUSD = 0
  
  if (swapRoute == null) {
    return [total, gasCostInUSD, []];
  }

  for (let route of swapRoute.route) {
    total += Number(route.output.toExact())
    gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
  }

  return [total, gasCostInUSD, swapRoute.route]
}

async function srcChainRouter(tokenIn:Token,amount:string,chainId:number):Promise<swapData> {
  // data of demo, wait to deploy mos contract  
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)
  const TokenList = BRIDGE_SUPPORTED_TOKEN //await getTokenCandidates('212',chainId.toString(),rpcProvider)
  let tmp:sortObj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let bridgeFee = await getBridgeFee(token,'212',amount,rpcProvider) // chainId
    let targetToken = toTargetToken(chainId,token) //await getTargetToken(token,chainId.toString(),rpcProvider)
    let [total,gas,router] = await findBestRouter(chainId,tokenIn,targetToken,amount)
    tmp.push({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    })
    RouterMap.set(token,router)
  }

  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))

  const key:Token = tmp[tmp.length-1]!.index
  const bestRouter:RouteWithValidQuote[] = RouterMap.get(key)
  let path:swapPrams[] = []

  if(bestRouter == null){
    return {
      path:[],
      targetToken:tokenIn.address
    }
  }

  for (let i=0;i<bestRouter.length;i++){
    if(chainId == ChainId.NEAR){
      const refRouter = bestRouter[i]!
      if (refRouter instanceof RefRouteWithValidQuote) {
        for(let r of refRouter.swapData!){
          let param:swapPrams = {
            amountIn: r.amountIn,
            minAmountOut: r.amountOut,
            tokenIn: r.tokenIn,
            tokenOut: r.tokenOut,
            poolId: [r.poolId.toString()],
            platform: bestRouter[i]!.platform 
          }
          path.push(param)
        }
      }else{
        throw("get ref router fail")
      }
    }else{
      let param:swapPrams = {
        amountIn: bestRouter[i]!.amount.toExact(),
        minAmountOut: bestRouter[i]!.output.toExact(),
        tokenIn:tokenIn.address,
        tokenOut:key.address,
        poolId:bestRouter[i]!.poolAddresses,
        platform: bestRouter[i]!.platform 
      }
      path.push(param)
    }
  }

  return {
    path:path,
    targetToken:tokenIn.address
  }
}

async function targetChainRouter(tokenOut:Token,amount:string,chainId:number):Promise<swapData> {
  // data of demo, wait to deploy mos contract  
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)
  const TokenList = BRIDGE_SUPPORTED_TOKEN //await getTokenCandidates('212',chainId.toString(),rpcProvider)

  let tmp:sortObj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let bridgeFee = await getBridgeFee(token,'212',amount,rpcProvider) // chainId
    let targetToken = toTargetToken(chainId,token) //await getTargetToken(token,chainId.toString(),rpcProvider)
    let [total,gas,router] = await findBestRouter(chainId,targetToken,tokenOut,amount)
    tmp.push({
      index:token,
      value:total-gas-Number(bridgeFee.amount)
    })
    RouterMap.set(token,router)
  }

  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))

  const key:Token = tmp[tmp.length-1]!.index
  const bestRouter:RouteWithValidQuote[] = RouterMap.get(key)
  let path:swapPrams[] = []

  if(bestRouter == null){
    return {
      path:path,
      targetToken:tokenOut.address
    }
  }

  for (let i=0;i<bestRouter.length;i++){
    if(chainId == ChainId.NEAR){
      const refRouter = bestRouter[i]!
      if (refRouter instanceof RefRouteWithValidQuote) {
        for(let r of refRouter.swapData!){
          let param:swapPrams = {
            amountIn: r.amountIn,
            minAmountOut: r.amountOut,
            tokenIn: r.tokenIn,
            tokenOut: r.tokenOut,
            poolId: [r.poolId.toString()],
            platform: bestRouter[i]!.platform 
          }
          path.push(param)
        }
      }else{
        throw("get ref router fail")
      }
    }else{
      let param:swapPrams = {
        amountIn: bestRouter[i]!.amount.toExact(),
        minAmountOut: bestRouter[i]!.output.toExact(),
        tokenIn:key.address,
        tokenOut:tokenOut.address,
        poolId:bestRouter[i]!.poolAddresses,
        platform: bestRouter[i]!.platform
      }
      path.push(param)
    }
  }

  return {
    path:path,
    targetToken:tokenOut.address
  }
}