import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { BRIDGE_SUPPORTED_TOKEN, USDC_MAP } from '../providers/token-provider';
import { RouteWithValidQuote, SwapRoute } from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import { ChainId, getChainProvider, ZERO_ADDRESS } from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getTargetToken, toTargetToken } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

interface obj {
  index:Token,
  value:number
}

interface AllRouter {
  srcChain:string[][],
  mapChain:string[][],
  targetChain:string[][]
}

@Injectable()
export class RouterService {

  async crossChainRouter(tokenInAddr:string,tokenInDecimals:number,tokenOutAddr:string,tokenOutDecimals:number,amount:string,fromChainId:number,toChainId:number):Promise<AllRouter>{
    const tokenADecimals:number = Number(tokenInDecimals)
    const tokenBDecimals:number = Number(tokenOutDecimals)
    const ChainAId:number = Number(fromChainId)
    const ChainBId:number = Number(toChainId)
    
    let tokenIn:Token
    let tokenOut:Token
    if(ChainAId == ChainId.NEAR){
      tokenIn = new Token(ChainAId,ZERO_ADDRESS,6,"TOKEN IN",tokenInAddr)
    }else{
      tokenIn = new Token(ChainAId,tokenInAddr,tokenADecimals)
    }
    if(ChainBId == ChainId.NEAR){
      tokenOut = new Token(ChainBId,ZERO_ADDRESS,6,"TOKEN OUT",tokenOutAddr)
    }else{
      tokenOut = new Token(ChainBId,tokenOutAddr,tokenBDecimals)
    }

    const srcRouter = await srcChainRouter(tokenIn,amount,ChainAId)
    const targetRouter = await targetChainRouter(tokenOut,amount,ChainBId)
    const result:AllRouter = {
      srcChain:srcRouter,
      mapChain:[],
      targetChain:targetRouter
    }
    return result
  }

}

async function findBestRouter(chainId: number, tokenIn: Token, tokenOut: Token, amount: string): Promise<[number, number, RouteWithValidQuote[]]> {
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

async function srcChainRouter(tokenIn:Token,amount:string,chainId:number):Promise<string[][]> {
  // data of demo, wait to deploy mos contract  
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)
  const TokenList = BRIDGE_SUPPORTED_TOKEN //await getTokenCandidates('212',chainId.toString(),rpcProvider)
  let tmp:obj[] = []
  let RouterMap = new Map();
  let m = new Map()
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

  const bestRouter:RouteWithValidQuote[] = RouterMap.get(tmp[tmp.length-1]?.index)
  let path:string[][] = []

  if(bestRouter == null){
    return path
  }

  for (let pool of bestRouter){
    path.push(pool.poolAddresses)
  }

  return path
}

async function targetChainRouter(tokenOut:Token,amount:string,chainId:number):Promise<string[][]> {
  // data of demo, wait to deploy mos contract  
  const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)
  const TokenList = BRIDGE_SUPPORTED_TOKEN //await getTokenCandidates('212',chainId.toString(),rpcProvider)

  let tmp:obj[] = []
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

  const bestRouter:RouteWithValidQuote[] = RouterMap.get(tmp[tmp.length-1]?.index)
  let path:string[][] = []

  if(bestRouter == null){
    return path
  }

  for (let pool of bestRouter){
    path.push(pool.poolAddresses)
  }

  return path
}