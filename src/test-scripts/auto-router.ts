import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { Protocol } from '@uniswap/router-sdk';
import { Pool } from '@uniswap/v3-sdk';
import { BigNumber, ethers } from 'ethers';
import {
  USDC,
  USDT,
} from '../providers/quickswap/util/token-provider';
import { SwapRoute } from '../routers';
import { _getExchangeMultipleArgs } from '../routers/alpha-router/functions/get-curve-best-router';
import { getBestRoute } from '../routers/barter-router';
import { routeAmountToString, ROUTER_INDEX } from '../util';
import { TradeType } from '../util/constants';
import { BarterProtocol } from '../util/protocol';
import abi from './routerabi.json';
import ERC20_ABI from './tokenabi.json';

const chainId = 1;

const rpcUrl =
  'http://54.255.196.147:9003';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337);

const wallet = new ethers.Wallet(
  'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
);
const signer = wallet.connect(provider);
const routerContract = new ethers.Contract(
  '0xB7ca895F81F20e05A5eb11B05Cbaab3DAe5e23cd',
  abi,
  signer
);
const slippage = 3; // thousandth
const protocols = [
  BarterProtocol.UNI_V2,
  BarterProtocol.UNI_V3,
  //BarterProtocol.QUICKSWAP,
  //BarterProtocol.SUSHISWAP,
  //BarterProtocol.PANCAKESWAP,
  BarterProtocol.CURVE,
];

const amount = '10'
const tokenIn = USDT;
const tokenOut = USDC;
const abiCoder = new ethers.utils.AbiCoder();

async function main() {
  const start = Date.now();
  const swapRoute = await getBestRoute(
    chainId,
    provider,
    protocols,
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

  if (swapRoute == null) {
    return;
  }
  let total = 0
  let sum = 0;
  let a = 0
  let b = 0
  for (let route of swapRoute.route) {
    console.log(`${routeAmountToString(route)} = ${route.quote.toExact()})}`);
    console.log(route.quoteAdjustedForGas.toFixed(2));
    total += Number(route.output.toExact())
    sum += parseFloat(route.quote.toExact());
    a += parseFloat(route.gasCostInUSD.toExact());
    b += parseFloat(route.gasEstimate.toString());
  }
  console.log(a,b)
  console.log('total get: ', total);
  console.log('excluding fee: ', sum);
  console.log('time: ', Date.now() - start);

  const token = new ethers.Contract(
    tokenIn.address,
    ERC20_ABI,
    signer
  );
  await token.approve(routerContract.address, amount, {
    gasLimit: 3500000,
    gasPrice: 70057219557,
  })
  //console.log(await doSwap(swapRoute));

}

async function doSwap(swapRoute: SwapRoute): Promise<TransactionReceipt> {
  const [amountInArr, amountOutMinArr, pathArr, routerIndexArr, crv_Route, crv_Swap_Params] =
    assembleSwapRequest(swapRoute);

  const params = {
    amountInArr: amountInArr,
    amountOutMinArr: amountOutMinArr,
    pathArr: pathArr,
    // routerArr,
    to: wallet.address,
    deadLine: ethers.constants.MaxUint256,
    input_Out_addre: [tokenIn.address, tokenOut.address],
    routerIndex: routerIndexArr,
    crv_Route: crv_Route,
    crv_Swap_Params: crv_Swap_Params,
    crv_expected: 1,
  };

  const swapTx = await routerContract.multiSwap(params, {
    gasLimit: 3500000,
    gasPrice: 70057219557,
  });

  return swapTx.wait();
}
/**
 * assemble swap request to call barterRouter's multiSwap method.
 * @param swapRoute route from router.route()
 * @returns TBD
 */
export function assembleSwapRequest(swapRoute: SwapRoute) {
  let amountInArr: BigNumber[] = [];
  let amountOutMinArr: BigNumber[] = [];
  let pathArr: string[] = [];
  let routerIndexArray: BigNumber[] = [];
  let crv_route: string[][] = []
  crv_route[0] = [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000"
  ]
  crv_route[1] = [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000"
  ]
  let crv_swap_params: number[][] = []
  crv_swap_params[0] = [0, 0, 0]
  crv_swap_params[1] = [0, 0, 0]
  crv_swap_params[2] = [0, 0, 0]
  crv_swap_params[3] = [0, 0, 0]
  for (let route of swapRoute.route) {
    amountInArr.push(
      ethers.utils.parseUnits(route.amount.toExact(), tokenIn.decimals)
    );
    amountOutMinArr.push(
      ethers.utils
        .parseUnits(route.quote.toExact(), tokenOut.decimals)
        .mul(1000 - slippage)
        .div(1000)
    );
    if (route.protocol != Protocol.V3 && route.protocol != BarterProtocol.CURVE) {
      let path: string[] = [];
      route.tokenPath.forEach((token) => path.push(token.address));
      pathArr.push(abiCoder.encode(['address[]'], [path]));
      routerIndexArray.push(ROUTER_INDEX[route.platform]);
    } else if (route.protocol == Protocol.V3) {
      let typeArr: string[] = [];
      let valueArr: any[] = [];
      const pools: Pool[] = route.route.pools;
      //console.log('tokenPath', route.route.tokenPath);
      for (let i = 0; i < pools.length; i++) {
        let pool: Pool = pools[i]!;
        if (i == 0) {
          typeArr = typeArr.concat(['address', 'uint24', 'address']);
          valueArr = valueArr.concat([
            route.route.tokenPath[i]?.address,
            pool.fee,
            route.route.tokenPath[i + 1]?.address,
          ]);
        } else {
          typeArr = typeArr.concat(['uint24', 'address']);
          valueArr = valueArr.concat([
            pool.fee,
            route.route.tokenPath[i * 2]?.address,
          ]);
        }
      }
      routerIndexArray.push(ROUTER_INDEX[route.platform]);
      //console.log('type', typeArr);
      //console.log('value', valueArr);

      pathArr.push(ethers.utils.solidityPack(typeArr, valueArr));
    } else if (route.protocol == BarterProtocol.CURVE) {
      let path: string[] = [];
      route.tokenPath.forEach((token) => path.push(token.address));
      pathArr.push(abiCoder.encode(['address[]'], [path]));
      routerIndexArray.push(ROUTER_INDEX[route.platform]);

      let args = _getExchangeMultipleArgs(tokenIn.address, route.route)
      console.log("_getExchangeMultipleArgs", args._factorySwapAddresses, args._route, args._swapParams)

      for (let i = 0; i < args._factorySwapAddresses.length; i++) {
        crv_route[0][i] = args._factorySwapAddresses[i]!
      }
      for (let i = 0; i < args._route.length; i++) {
        crv_route[1][i] = args._route[i]!
      }

      crv_swap_params[0][0] = args._swapParams[0]![0]!
      crv_swap_params[0][1] = args._swapParams[0]![1]!
      crv_swap_params[0][2] = args._swapParams[0]![2]!

      crv_swap_params[1][0] = args._swapParams[1]![0]!
      crv_swap_params[1][1] = args._swapParams[1]![1]!
      crv_swap_params[1][2] = args._swapParams[1]![2]!

      crv_swap_params[2][0] = args._swapParams[2]![0]!
      crv_swap_params[2][1] = args._swapParams[2]![1]!
      crv_swap_params[2][2] = args._swapParams[2]![2]!

      crv_swap_params[3][0] = args._swapParams[3]![0]!
      crv_swap_params[3][1] = args._swapParams[3]![1]!
      crv_swap_params[3][2] = args._swapParams[3]![2]!
    }
  }
  return [amountInArr, amountOutMinArr, pathArr, routerIndexArray, crv_route, crv_swap_params];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
