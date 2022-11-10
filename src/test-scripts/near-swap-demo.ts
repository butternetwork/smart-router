import { estimateSwap, EstimateSwapView, fetchAllPools, ftGetTokenMetadata, getExpectedOutputFromSwapTodos, getStablePools, init_env, Pool, StablePool, SwapOptions } from "@ref-finance/ref-sdk";

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
    

    console.log("bestRoute:",swapTodos)
    console.log("amountOut:",amountOut.toNumber())

}
main()