import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { Protocol } from '@uniswap/router-sdk';
import { Pool } from '@uniswap/v3-sdk';
import { BigNumber, ethers } from 'ethers';
import {
  USDC,
  USDT,
  USDC_BNB,
  USDT_BNB,
  WBNB_BNB,
  USDC_NEAR,
  WNEAR_NEAR,
  USDT_NEAR,
  GLD_MAP,
  KUN_MAP,
} from '../providers/quickswap/util/token-provider';
import { SwapRoute } from '../routers';
import { _getExchangeMultipleArgs } from '../routers/alpha-router/functions/get-curve-best-router';
import { getBestRoute } from '../routers/barter-router';
import { routeAmountToString, ROUTER_INDEX } from '../util';
import { TradeType } from '../util/constants';
import { BarterProtocol } from '../util/protocol';
import { Token } from '../util/token';
import eth_router_abi from './abi/eth-router.json';
import map_router_abi from './abi/map-router.json';
import ERC20_ABI from './abi/token.json';

const nearAPI = require("near-api-js");
const { keyStores, KeyPair, connect, Contract } = nearAPI;
const myKeyStore = new keyStores.InMemoryKeyStore();
const PRIVATE_KEY = "ed25519:3vBnF4KwPAVcoaGWHFPD3NtKQgfdacajE8YGJzUoc7C9fzbnCr84tvKKg3Kjd75JetQu7b8EejyMKqZSgsCwnucE";
const keyPair = KeyPair.fromString(PRIVATE_KEY);
const accountId = "ashbarty.testnet"

let rpcUrl: string
let provider: any
let wallet: any
let signer: any
let routerContract: any
let protocols: BarterProtocol[] = [];
let tokenIn: Token;
let tokenOut: Token;
let chainId =
  //1313161554; //near
  //212;        //map
  //1;          //eth
  56;           //bsc


const amount = '10'
const abiCoder = new ethers.utils.AbiCoder();
const slippage = 3; // thousandth

async function main() {
  let [total1,totalWithoutGas1,gasCostInUSD1] = await findBestRouter(56,WBNB_BNB,USDC_BNB,"10")
  let [total2,totalWithoutGas2,gasCostInUSD2] = await findBestRouter(1313161554,USDC_NEAR,WNEAR_NEAR,total1!.toString())
  console.log("final output:",total2)
  console.log("gasCostInUSD",gasCostInUSD1!+gasCostInUSD2!)
  console.log("outputWithoutGas:",totalWithoutGas2)
}
async function findBestRouter(chainId:number,tokenA: Token,tokenB: Token,amount:string){
  tokenIn = tokenA;
  tokenOut = tokenB;

  switch (chainId) {
    case 1: //fork_eth
      rpcUrl = 'http://54.255.196.147:9003'//"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      rpcUrl = 'http://54.255.196.147:9003'//"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      rpcUrl = 'http://54.255.196.147:9003'//"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
    rpcUrl = 'http://54.255.196.147:9003'//"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      rpcUrl = 'http://54.255.196.147:9003'//"https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"; 
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337);//forked net chianId
      wallet = new ethers.Wallet(
        'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0xAe9Ed85dE2670e3112590a2BB17b7283ddF44d9c', // wait to do
        eth_router_abi,
        signer
      );
  
      protocols = [
        BarterProtocol.UNI_V2,
        BarterProtocol.UNI_V3,
        BarterProtocol.SUSHISWAP,
        BarterProtocol.CURVE,
      ];
      break;
    case 56: //bsc
      // tokenIn = USDT_BNB;
      // tokenOut = USDC_BNB;;
      rpcUrl = 'https://bsc-dataseed1.defibit.io/'
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);//forked net chianId
      wallet = new ethers.Wallet(
        '939ae45116ea2d4ef9061f13534bc451e9f9835e94f191970f23aac0299d5f7a'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x3044BED7679b031CCbefEC054FdA9aD350D372B4', // wait to do
        eth_router_abi,
        signer
      );
  
      protocols = [
        BarterProtocol.PANCAKESWAP,
      ];
      break;
    case 212: //map
      // tokenIn = GLD_MAP;
      // tokenOut = KUN_MAP;
      rpcUrl = 'http://18.142.54.137:7445';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      wallet = new ethers.Wallet(
        "438e472724961ae8a56e2247bebe921dc4e3437eecb6e15f9277871dfdb69383"
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0x806e62028a4bab675dcf354ae190e8081b8a1137', // wait to do 
        map_router_abi,
        signer
      );
      protocols = [
        BarterProtocol.BARTER
      ];
      break;
    case 1313161554: //near
      // tokenIn = USDT_NEAR;
      // tokenOut = USDC_NEAR;
      protocols = [
        BarterProtocol.REF,
      ];
      break;
    default:
      tokenIn = USDT;
      tokenOut = USDC;
      rpcUrl = 'http://54.255.196.147:9003';
      provider = new ethers.providers.JsonRpcProvider(rpcUrl, 31337); //forked net chianId
      wallet = new ethers.Wallet(
        'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
      );
      signer = wallet.connect(provider);
      routerContract = new ethers.Contract(
        '0xB7ca895F81F20e05A5eb11B05Cbaab3DAe5e23cd', // wait to do
        eth_router_abi,
        signer
      );
  
      protocols = [
        BarterProtocol.UNI_V2,
        BarterProtocol.UNI_V3,
        BarterProtocol.SUSHISWAP,
        BarterProtocol.CURVE,
      ];
      break;
  }

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
    return [0,0,0];
  }
  let total = 0
  let sum = 0;
  let gasCostInUSD = 0
  let gasEstimate = 0

  if (chainId == 1313161554){
    let routerString = "ref "+amount+" = "+tokenA.symbol+" --> "
    for (let route of swapRoute.route) {
      for (let pool of route.poolAddresses){
        routerString = routerString+"poolId:"+pool+" --> "
      }
      total += Number(route.output.toExact())
      sum += parseFloat(route.quote.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
      gasEstimate += parseFloat(route.gasEstimate.toString());
      routerString = routerString+"--> "+tokenB.symbol+" = "+total.toString() 
      console.log(routerString)
    }
  }else{
    for (let route of swapRoute.route) {
      console.log(`${routeAmountToString(route)} = ${route.quote.toExact()})}`);
      total += Number(route.output.toExact())
      sum += parseFloat(route.quote.toExact());
      gasCostInUSD += parseFloat(route.gasCostInUSD.toExact());
      gasEstimate += parseFloat(route.gasEstimate.toString());
    }
  }

  // console.log("gasEstimate", gasEstimate)
  // console.log("gasCostInUSD", gasCostInUSD)
  // console.log('total get: ', total);
  // console.log('excluding fee: ', sum);
  // console.log('time: ', Date.now() - start);
  return [total,sum,gasCostInUSD]

  // const token = new ethers.Contract(
  //     tokenIn.address,
  //     ERC20_ABI,
  //     signer
  //   );
  // await token.approve(routerContract.address, amount)
  // console.log("check approve",await token.allowance(routerContract.address, amount))

  /*
  switch (chainId) {
    case 1: //fork_eth
      console.log(await doSwapOnEth(swapRoute));
      break
    case 56: //bsc
      console.log(await doSwapOnMap(swapRoute));
      break
    case 212: //map
      console.log(await doSwapOnMap(swapRoute));
      break
    case 1313161554: //near
      console.log("this's near, wait to do swap")
      await doSwapOnNear(swapRoute)
      break
    default:
      console.log(await doSwapOnEth(swapRoute));
      break
  }
  */
}

async function doSwapOnEth(swapRoute: SwapRoute): Promise<TransactionReceipt> {
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

async function doSwapOnMap(swapRoute: SwapRoute): Promise<TransactionReceipt> {
  const [amountInArr, amountOutMinArr] =
    assembleSwapRequest(swapRoute);

  if (!amountInArr && !amountOutMinArr) {
    throw ("fail in doing swap on Map")
  }
  if (amountInArr!.length != 1 || amountOutMinArr!.length != 1) {
    throw ("it's not corrected length for input")
  }
  const swapTx = await routerContract.swapExactTokensForTokens(
    amountInArr![0],
    amountOutMinArr![0],
    [tokenIn.address, tokenOut.address],
    wallet.address,
    ethers.constants.MaxUint256,
    {
      gasLimit: 8500000,
      gasPrice: 120 * Math.pow(10, 9),
    });

  return swapTx.wait();
}

async function doSwapOnNear(swapRoute: SwapRoute) {

  await myKeyStore.setKey("testnet", accountId, keyPair);
  const connectionConfig = {
    networkId: "testnet",
    keyStore: myKeyStore,
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
  };
  const nearConnection = await connect(connectionConfig);
  const account = await nearConnection.account(accountId);

  const contract = new Contract(
    account,
    "usdt.ashbarty.testnet",
    {
      viewMethods: ["ft_transfer_call"],
    }
  );

  const response = await contract.ft_transfer_call({ account_id: accountId, amount: amount, msg: ""}); //wait to do
  console.log(response);
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

      pathArr.push(ethers.utils.solidityPack(typeArr, valueArr));
    } else if (route.protocol == BarterProtocol.CURVE) {
      let path: string[] = [];
      route.tokenPath.forEach((token) => path.push(token.address));
      pathArr.push(abiCoder.encode(['address[]'], [path]));
      routerIndexArray.push(ROUTER_INDEX[route.platform]);

      let args = _getExchangeMultipleArgs(tokenIn.address, route.route)

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
