import { BigNumber } from '@ethersproject/bignumber';

import { ethers, utils } from 'ethers';
import {
  BMOS_BSCT,
  BUSD_BSCT,
  mUSDC_MAPT,
  PMOS_POLYGON_MUMBAI,
  PUSD_POLYGON_MUMBAI,
  USDC_MAINNET,
  USDC_NEAR,
  USDC_NEART,
  WBNB_BSCT,
  WETH_MAINNET,
  WMATIC_POLYGON_MUMBAI,
} from '../providers';
import { _getUsdRate } from '../routers/alpha-router/functions/get-curve-best-router';
import { ChainId, CurrencyAmount } from '../util';
import { getBridgeFee, getTargetToken, getTokenCandidates, getVaultBalance } from '../util/mos';
import { Token } from '../util/token';

async function testVaultBalance() {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://testnet-rpc.maplabs.io'
  );
  const vaultBalance1 = await getVaultBalance(ChainId.BSC_TEST.toString(), BUSD_BSCT, ChainId.POLYGON_MUMBAI.toString(), provider,'212');
  const vaultBalance2 = await getVaultBalance('1313161555', USDC_NEART, ChainId.POLYGON_MUMBAI.toString(), provider,'212');
  const vaultBalance3 = await getVaultBalance('212',mUSDC_MAPT,ChainId.POLYGON_MUMBAI.toString(),provider,'212')

  const vaultBalance4 = await getVaultBalance(ChainId.POLYGON_MUMBAI.toString(), PUSD_POLYGON_MUMBAI, ChainId.BSC_TEST.toString(), provider,'212');
  const vaultBalance5 = await getVaultBalance('1313161555', USDC_NEART, ChainId.BSC_TEST.toString(), provider,'212');
  const vaultBalance6 = await getVaultBalance('212',mUSDC_MAPT,ChainId.BSC_TEST.toString(),provider,'212')

  const vaultBalance7 = await getVaultBalance(ChainId.BSC_TEST.toString(), BUSD_BSCT, '1313161555', provider,'212');
  const vaultBalance8 = await getVaultBalance(ChainId.POLYGON_MUMBAI.toString(), PUSD_POLYGON_MUMBAI, '1313161555', provider,'212');
  const vaultBalance9 = await getVaultBalance('212',mUSDC_MAPT,'1313161555',provider,'212')


  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance1.balance,18));
  console.log('==============================v1=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance2.balance,18));
  console.log('==============================v2=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance3.balance,18));
  console.log('==============================v3=============================')

  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance4.balance,18));
  console.log('==============================v4=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance5.balance,18));
  console.log('==============================v5=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance6.balance,18));
  console.log('==============================v6=============================')

  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance7.balance,6));
  console.log('==============================v7=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance8.balance,6));
  console.log('==============================v8=============================')
  console.log('vaultBalance', ethers.utils.formatUnits(vaultBalance9.balance,6));
  console.log('==============================v9=============================')

}

// testVaultBalance()


async function testBridgeFee() {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://testnet-rpc.maplabs.io'
  );
  const amount = '999'

  // console.log("polygon -> near")
  // let a = await getBridgeFee(PUSD_POLYGON_MUMBAI, '1313161555', amount, provider,'212')
  // console.log("amount",a.amount)
  // console.log('============')
  // console.log()

  // console.log("near -> polygon")
  // let b = await getBridgeFee(USDC_NEART, '80001', amount, provider,'212')
  // console.log("amount",b.amount)
  // console.log('============')
  // console.log()

  // console.log("polygon -> bsc")
  // let c = await getBridgeFee(PUSD_POLYGON_MUMBAI, '97', amount, provider,'212')
  // console.log("amount",c.amount)
  // console.log('============')
  // console.log()

  console.log("polygon -> bsc")
  let d = await getBridgeFee(WMATIC_POLYGON_MUMBAI, '97', '384168054947166493092', provider,'212')
  console.log("amount",d.amount)
  console.log('============')
  console.log()
}

//testBridgeFee()

async function testTokenCandidates(){
    let tokens 
    // tokens = await getTokenCandidates('56','137','22776')
    // console.log('TokenCandidates',tokens)
    // tokens = await getTokenCandidates('137','1313161554','22776')
    // console.log('TokenCandidates',tokens)
    tokens = await getTokenCandidates('137','1313161554','22776')
    console.log('TokenCandidates',tokens)
    // tokens = await getTokenCandidates('22776','1','22776')
    // console.log('TokenCandidates',tokens)
}

//testTokenCandidates()

async function testTargetToken(){
    let token = await getTargetToken(BUSD_BSCT,'80001','22776')
    console.log('TargetToken',token)
}

//testTargetToken()

let amount = 1265787038602503559606.403079210870707395
let decimals = 6
let BN = ethers.utils
console.log('amount',amount)
console.log('toFixed',amount.toFixed(decimals + 1))
console.log('toFixed slice',amount.toFixed(decimals + 1).slice(0, -1))