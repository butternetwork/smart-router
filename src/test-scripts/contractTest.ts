import { BigNumber, ethers } from 'ethers';
import abi from './routerabi.json';
import ERC20_ABI from './tokenabi.json';

const chainId = 31337
const rpcUrl = //'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  'http://54.255.196.147:9003';
const provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
const wallet = new ethers.Wallet(
  'e6a69dea3269974b57d09e0c07eede551a399ce50e7dd0be1ca7183994f94edb'
);
const contractAddr = "0xbe18A1B61ceaF59aEB6A9bC81AB4FB87D56Ba167"
const signer = wallet.connect(provider);
const routerContract = new ethers.Contract(
  contractAddr,
  abi,
  signer
);

const tokenContract = new ethers.Contract(
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  ERC20_ABI,
  signer
);

async function main() {
    //query the account's balance
    provider.getBalance(wallet.address).then((balance) => {
        const balanceInEth = ethers.utils.formatEther(balance)
        console.log(`chainId:${chainId} balance: ${balanceInEth} ETH`)
       })

    //let ok1:BigNumber = await tokenContract.balanceOf(wallet.address)
    //let ok2 = await tokenContract.approve(wallet.address,1,{gasLimit:5100000,gasPrice: 700572195})
    let ok3:BigNumber = await tokenContract.allowance(wallet.address,wallet.address,{
      gasLimit: 3500000,
      gasPrice: 700572195,
    })    
    //let ok4:BigNumber = await tokenContract.transferFrom(wallet.address,"0xeC3E016916BA9F10762e33e03E8556409d096FB4",1)  
    //let ok5:BigNumber = await tokenContract.balanceOf("0xeC3E016916BA9F10762e33e03E8556409d096FB4")  
   console.log("ok",ok3.toNumber())

    /*
    let crv_route:string[][] = []
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
    
    let crv_swap_params:number[][] = []
    crv_swap_params[0] = [0,0,0]
    crv_swap_params[1] = [0,0,0]
    crv_swap_params[2] = [0,0,0]
    crv_swap_params[3] = [0,0,0]

    const params = {
        amountInArr:[BigNumber.from("0xe4e1c0")],  
        amountOutMinArr:[BigNumber.from("0x25e520")],
        pathArr:['0xdac17f958d2ee523a2206206994597c13d831ec7000064a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'],
        to:"0xd66B7b86c5f72E21CcEea8BF3A013528542846E5", 
        deadLine:ethers.constants.MaxUint256, 
        input_Out_addre:["0xdac17f958d2ee523a2206206994597c13d831ec7","0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
        routerIndex:[BigNumber.from(0)],
        crv_Route:crv_route,
        crv_Swap_Params:crv_swap_params,
        crv_expected:1,
    }
   
    const swapTx = await routerContract.multiSwap(params, {
        gasLimit: 3500000,
        gasPrice: 700572195,
      });

    console.log("params",swapTx.wait())
    */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
