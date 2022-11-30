import { ethers } from 'ethers';
import { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';
import { GLD_MAP } from '../providers/quickswap/util/token-provider';
import { getBridgeFee } from '../util/mosFee';

interface Liquidity {
    totalLiquidity: string;
}

async function testUrl() {
    let params = gql`
    {
        token(id: "0x9f722b2cb30093f766221fd0d37964949ed66918") {
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

async function test2() {
    let provider =  new ethers.providers.JsonRpcProvider('http://18.142.54.137:7445', 212);
    let data = await getBridgeFee(GLD_MAP,'97','100',provider)
    console.log(data)
}

test2()