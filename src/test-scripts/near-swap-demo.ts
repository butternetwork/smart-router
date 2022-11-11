import { estimateSwap, EstimateSwapView, fetchAllPools, ftGetTokenMetadata, getExpectedOutputFromSwapTodos, getStablePools, init_env, Pool, StablePool, SwapOptions } from "@ref-finance/ref-sdk";
import { getTypedData } from "@sushiswap/sdk";
import axios from "axios";

async function main() {
    
    init_env('testnet');

    const tokenIn = await ftGetTokenMetadata('ref.fakes.testnet');
    const tokenOut = await ftGetTokenMetadata('wrap.testnet');
    
    const { ratedPools, unRatedPools, simplePools } = await fetchAllPools();

    const stablePools: Pool[] = unRatedPools.concat(ratedPools);

    const stablePoolsDetail: StablePool[] = await getStablePools(stablePools);
    
    const options: SwapOptions = {
        enableSmartRouting: true,
        stablePools,
        stablePoolsDetail,
      };

    const swapTodos: EstimateSwapView[] = await estimateSwap({
      tokenIn,
      tokenOut,
      amountIn: '1',
      simplePools,
      options
    });

    const amountOut = getExpectedOutputFromSwapTodos(swapTodos, tokenOut.id);
    
    for(let i=0;i<swapTodos.length;i++){
      console.log("pool:",swapTodos[i]?.pool.id)
      console.log("estimate:",swapTodos[i]?.estimate)
      console.log("outputToken:",swapTodos[i]?.outputToken)
    }
    // console.log("length:",swapTodos.length)
    // console.log("pool:",swapTodos[0]?.pool.id)
    // console.log("route:",swapTodos[0]?.route)
    // console.log("allNodeRoutes:",swapTodos[0]?.allNodeRoutes)
    // console.log("allRoutes:",swapTodos[0]?.allRoutes)
    // console.log("estimate:",swapTodos[0]?.estimate)
    //console.log("amountOut:",amountOut.toNumber())

}


//main()

async function getData(){
  axios.get("http://54.255.196.147:9004/list-token").then((res)=>{
   console.log(res)
  })

  init_env('mainnet');

  const { ratedPools, unRatedPools, simplePools } = await fetchAllPools();

  const stablePools: Pool[] = unRatedPools.concat(ratedPools);

  const stablePoolsDetail: StablePool[] = await getStablePools(stablePools);
  
  for(let i = 0 ; i < stablePools.length; i++){
    //console.log(i,stablePools[i])
  }
  const token1 = await ftGetTokenMetadata('usn');
  const token2 = await ftGetTokenMetadata('usdt.tether-token.near');//USDt
  const token3 = await ftGetTokenMetadata('dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near');//USDT.e

  const token4 = await ftGetTokenMetadata('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near');//USDC
  const token5 = await ftGetTokenMetadata('6b175474e89094c44da98b954eedeac495271d0f.factory.bridge.near');//DAI

  console.log(token1.name,token1.symbol)
  console.log(token2.name,token2.symbol)
  console.log(token3.name,token3.symbol)
  console.log(token4.name,token4.symbol)
  console.log(token5.name,token5.symbol)
  //console.log(token5,stablePools[0])
}

getData()
