import { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';


interface Liquidity {
    totalLiquidity: string;
}

export async function getUsdcLiquidity(address:string) {
    let params = gql`
    {
        token(id: ${address}) {
            totalLiquidity
        }
    }
    `
    let client: GraphQLClient = new GraphQLClient("https://makalu-graph.maplabs.io/subgraphs/name/map/hiveswap2");
    let usdc_liquidity = '0'
    await client.request<{
        token: Liquidity;
    }>(params).then((res)=>{
        usdc_liquidity = res.token.totalLiquidity
    });
    return usdc_liquidity
}

