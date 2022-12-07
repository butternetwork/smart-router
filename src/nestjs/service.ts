import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { BRIDGE_SUPPORTED_TOKEN, GET_TOKEN_ICON, USDC_MAP, WMAP_MAP } from '../providers/token-provider';
import { RefRoute, RefRouteWithValidQuote, RouteWithValidQuote, SwapRoute } from '../routers/';
import { getBestRoute } from '../routers/butter-router';
import { ChainId, getChainProvider, IS_SUPPORT_CHAIN, ROUTER_INDEX, ZERO_ADDRESS } from '../util';
import { TradeType } from '../util/constants';
import { getBridgeFee, getTargetToken, toTargetToken } from '../util/mos';
import { ButterProtocol } from '../util/protocol';
import { Token } from '../util/token';

type sortObj = {
  index:Token,
  value:number
}

type swapPrams = {
  amountIn:string, 
  minAmountOut:string, 
  tokenIn:string,
  tokenOut:string,
  platform:string,
  poolId:string[]
}

type swapData = {
  path:swapPrams[],
  targetTokenAddress:string,
  targetTokenDecimals:number,
}

type frontData = {
  chainId:string,
  dexName: string,
  amountIn:string,
  amountOut:string,
  tokenIn:token,
  tokenOut:token,
  path:{
    tokenIn:{
      address:string
      name:string,
      symbol:string,
      icon:string
    },
    tokenOut:{
      address:string
      name:string,
      symbol:string,
      icon:string
    },
  }[]
}

type token = {
  address:string
  name:string,
  decimals:number,
  symbol:string,
  icon:string
}

type returnData = {
  contractPrams: swapData,
  frontParams: frontData
}

type allRouter =  {
  srcChain:swapData,
  mapChain:swapData,
  targetChain:swapData,
  front_srcChian:frontData,
  front_mapChian:frontData,
  front_targetChian:frontData,
}

enum RouterType {
  SRC_CHAIN = 0,
  TARGET_CHAIN = 1,
}

@Injectable()
export class RouterService {

  async crossChainRouter(tokenInAddr:string,tokenInDecimals:number,tokenOutAddr:string,tokenOutDecimals:number,amount:string,fromChainId:string,toChainId:string):Promise<allRouter>{
    IS_SUPPORT_CHAIN(fromChainId)
    IS_SUPPORT_CHAIN(toChainId)
    if (fromChainId == toChainId){
      throw new Error('fromChainId and toChainId cannot be the same')
    }
    const rpcProvider = new ethers.providers.JsonRpcProvider("http://18.142.54.137:7445", 212)
    const tokenADecimals:number = Number(tokenInDecimals)
    const tokenBDecimals:number = Number(tokenOutDecimals)
    let ChainAId:number
    let ChainBId:number
    let tokenIn:Token
    let tokenOut:Token
    if(fromChainId == '5566818579631833088'){
      ChainAId = ChainId.NEAR
      tokenIn = new Token(ChainAId,ZERO_ADDRESS,tokenBDecimals,"TOKEN IN",tokenInAddr)
    }else{
      ChainAId = Number(fromChainId)
      tokenIn = new Token(ChainAId,tokenInAddr,tokenADecimals)
    }
    if(toChainId == '5566818579631833088'){
      ChainBId = ChainId.NEAR 
      tokenOut = new Token(ChainBId,ZERO_ADDRESS,tokenBDecimals,"TOKEN OUT",tokenOutAddr)
    }else{
      ChainBId = Number(toChainId)
      tokenOut = new Token(ChainBId,tokenOutAddr,tokenBDecimals)
    }

    const srcRouter = await chainRouter(tokenIn,Number(amount),ChainAId,RouterType.SRC_CHAIN)
    let srcAmountOut = 0
    let srcAmountOutDecimals = srcRouter.contractPrams.targetTokenDecimals
    for(let p of srcRouter.contractPrams.path){
      srcAmountOut += Number(p.minAmountOut)
    }
    // let t = new Token(Number(fromChainId),srcRouter.contractPrams.targetToken,18)
    // toTargetToken(Number(fromChainId),t)
    // let bridgeFee = await getBridgeFee(BRIDGE_SUPPORTED_TOKEN[0]!,'212',srcAmountOut.toString(),rpcProvider) // chainId
    // srcAmountOut -= Number(bridgeFee)

    const targetRouter = await chainRouter(tokenOut,srcAmountOut,ChainBId,RouterType.TARGET_CHAIN)
    const mapRouter:returnData = {
      contractPrams:{
        path:[],
        targetTokenAddress:USDC_MAP.address,
        targetTokenDecimals:WMAP_MAP.decimals
      },
      frontParams:{
        chainId:ChainId.MAP.toString(),
        dexName:ButterProtocol.HIVESWAP,
        amountIn:'',
        amountOut:'',
        tokenIn:{
          address:USDC_MAP.address,
          name:USDC_MAP.name!,
          decimals:USDC_MAP.decimals,
          symbol:USDC_MAP.symbol!,
          icon:GET_TOKEN_ICON(USDC_MAP.address),
        },
        tokenOut:{
          address:USDC_MAP.address,
          name:USDC_MAP.name!,
          decimals:USDC_MAP.decimals,
          symbol:USDC_MAP.symbol!,
          icon:GET_TOKEN_ICON(USDC_MAP.address),
        },
        path:[]
      }
    } 
    const result:allRouter = {
      srcChain:srcRouter.contractPrams,
      mapChain:mapRouter.contractPrams,
      targetChain:targetRouter.contractPrams,
      front_srcChian:srcRouter.frontParams,
      front_mapChian:mapRouter.frontParams,
      front_targetChian:targetRouter.frontParams
    }
    return result
  }

}

const nullFrontRouter:frontData = {
  chainId:'',
  dexName:'',
  amountIn:'',
  amountOut:'',
  tokenIn:{
    address:'',
    decimals:0,
    name:'',
    symbol:'',
    icon:''
  },
  tokenOut:{
    address:'',
    decimals:0,
    name:'',
    symbol:'',
    icon:''
  },
  path:[]
} 

const nullContractPrams:swapData = {
    targetTokenAddress:'',
    targetTokenDecimals:0,
    path:[]
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
    gasCostInUSD += Number(route.gasCostInUSD.toExact());
  }

  return [total, gasCostInUSD, swapRoute.route]
}

async function chainRouter(swapToken:Token,amount:number,chainId:number,routerType:number):Promise<returnData> {
  // data of demo, wait to deploy mos contract  
  const TokenList = BRIDGE_SUPPORTED_TOKEN //await getTokenCandidates('212',chainId.toString(),rpcProvider)
  let tmp:sortObj[] = []
  let RouterMap = new Map();
  for(let token of TokenList){
    let tokenIn:Token = swapToken 
    let tokenOut:Token = toTargetToken(chainId,token)
    if(routerType == RouterType.TARGET_CHAIN){
      tokenIn = toTargetToken(chainId,token) //await getTargetToken(token,chainId.toString(),rpcProvider)
      tokenOut = swapToken 
    }

    let [total,gas,router] = await findBestRouter(chainId,tokenIn,tokenOut,amount.toFixed(tokenIn.decimals))
    tmp.push({
      index:token,
      value:total-gas
    })
    RouterMap.set(token,router)
  }

  tmp.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))

  const key:Token = tmp[tmp.length-1]!.index
  const bestRouter:RouteWithValidQuote[] = RouterMap.get(key)

  if(bestRouter == null){
    return {
      contractPrams:nullContractPrams,
      frontParams:nullFrontRouter
    }
  }

  const token1:token = {
    address:swapToken.address,
    name:swapToken.name!,
    decimals:swapToken.decimals!,
    symbol:swapToken.symbol!,
    icon:GET_TOKEN_ICON(swapToken.address)
  }
  const token2:token = {
    address:key.address,
    name:key.name!,
    decimals:key.decimals!,
    symbol:key.symbol!,
    icon:GET_TOKEN_ICON(key.address)
  }

  if (routerType == RouterType.TARGET_CHAIN){
    return formatData(
      bestRouter,
      token2,
      token1,
      chainId
      )
  }

  return formatData(
    bestRouter,
    token1,
    token2,
    chainId
    )
}

function formatData(bestRouter:RouteWithValidQuote[],tokenIn:token,tokenOut:token,chainId:number):returnData{
  let path:swapPrams[] = []
  let pairs = []
  let frontPath:frontData = nullFrontRouter
  let targetTokenAddr = tokenOut.address

  for (let i=0;i<bestRouter.length;i++){
    
    if(chainId == ChainId.NEAR){

      const refRouter = bestRouter[i]!
      if (refRouter instanceof RefRouteWithValidQuote) {

        for(let r of refRouter.swapData!){
          path.push({
            amountIn: r.amountIn,
            minAmountOut: r.amountOut,
            tokenIn: r.tokenIn,
            tokenOut: r.tokenOut,
            poolId: [r.poolId.toString()],
            platform: bestRouter[i]!.platform
          })
          targetTokenAddr = tokenOut.name!

          pairs.push({
            tokenIn:{
              address:r.tokenIn,
              name:r.tokenInName,
              symbol:r.tokenInSymbol,
              icon:r.tokenInIcon,
            },
            tokenOut:{
              address:r.tokenOut,
              name:r.tokenOutName,
              symbol:r.tokenOutSymbol,
              icon:r.tokenOutIcon,
            }
          })
        }

        frontPath = {
          chainId: chainId.toString(),
          amountIn: refRouter.amount.toExact(),
          amountOut: refRouter.output.toExact(),
          path: pairs,
          dexName:bestRouter[i]!.platform,
          tokenIn:tokenIn,
          tokenOut:tokenOut,
        }

      }else{
        throw("get ref router fail")
      }

    }else{

      bestRouter[i]!.tokenPath
      let param:swapPrams = {
        amountIn: bestRouter[i]!.amount.toExact(),
        minAmountOut: bestRouter[i]!.quote.toExact(),
        tokenIn:tokenIn.address,
        tokenOut:tokenOut.address,
        poolId:bestRouter[i]!.poolAddresses,
        platform: bestRouter[i]!.platform
      }
      path.push(param)

      for(let i=0;i<bestRouter[i]!.poolAddresses.length;i++){

        pairs.push({
          tokenIn: {
            name: bestRouter[i]!.tokenPath[i]?.name!,
            symbol: bestRouter[i]!.tokenPath[i]?.symbol!,
            icon: bestRouter[i]!.tokenPath[i]?.address!,
            address: bestRouter[i]!.tokenPath[i]?.address!
          },
          tokenOut: {
            name: bestRouter[i]!.tokenPath[i+1]?.name!,
            symbol: bestRouter[i]!.tokenPath[i+1]?.symbol!,
            icon: bestRouter[i]!.tokenPath[i+1]?.address!,
            address: bestRouter[i]!.tokenPath[i+1]?.address!
          },
        })

      }

      frontPath = {
        chainId: chainId.toString(),
        amountIn: bestRouter[i]!.amount.toExact(),
        amountOut: bestRouter[i]!.quote.toExact(),
        path: pairs,
        dexName:bestRouter[i]!.platform,
        tokenIn:tokenIn,
        tokenOut:tokenOut,
      }

    }
  }

  return {
    contractPrams:{
      targetTokenAddress:targetTokenAddr,
      targetTokenDecimals:tokenOut.decimals,
      path:path
    },
    frontParams:frontPath
  }
}
