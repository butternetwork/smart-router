
import { ethers } from 'ethers';
import { BMOS_BSCT, BUSD_BSCT, mUSDC_MAP, PMOS_POLYGON_MUMBAI, PUSD_POLYGON_MUMBAI, USDC_NEAR, WBNB_BSCT } from '../providers';
import { _getUsdRate } from '../routers/alpha-router/functions/get-curve-best-router';
import { CurrencyAmount } from '../util';
import { getBridgeFee, getVaultBalance } from '../util/mos';
import { Token } from '../util/token';

const MAP_TEST_MOST = new Token(
  212,
  '0xc74bc33a95a62D90672aEFAf4bA784285903cf09',
  18,
  'MOST',
  'MOST Token'
);

const BSC_TEST_MOST = new Token(
  97,
  '0x688f3Ef5f728995a9DcB299DAEC849CA2E49ddE1',
  18,
  'MOST',
  'MOST Token'
);

async function test1() {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://testnet-rpc.maplabs.io'
  );
  const data = await getVaultBalance(212, MAP_TEST_MOST, 97, provider);
  console.log('test1', data);
}

async function test2() {
  let provider = new ethers.providers.JsonRpcProvider(
    'http://18.142.54.137:7445',
    212
  );

  console.log(await getBridgeFee(PUSD_POLYGON_MUMBAI, '97', '80', provider,'212'))
  console.log(await getBridgeFee(BUSD_BSCT, '80001', '80', provider,'212'))

}

async function test3() {
  let tokenOutPrice;
  try {
    tokenOutPrice = await _getUsdRate(USDC_NEAR.name!);
  } catch {
    throw 'fail to get token price';
  }
  console.log('test3', tokenOutPrice);
}

// test1()
test2()


function calculate (num1: number, num2: number, op: string):any {
  let a: number | string, b: number | string, len1: number, len2: number;
  try {
    len1 = num1.toString().split(".")[1]!.length;
  } catch (error) {
    len1 = 0;
  }
  try {
    len2 = num2.toString().split(".")[1]!.length;
  } catch (error) {
    len2 = 0;
  }
  a = num1.toString().split(".").join("");
  b = num2.toString().split(".").join("");
  let c = Math.pow(10, Math.abs(len1 - len2));
  len1 > len2 && (b = Number(b) * c);
  len1 < len2 && (a = Number(a) * c);
  let d = Math.pow(10, Math.max(len1, len2));
  if (op === "jia") return (Number(a) + Number(b)) / d;
  if (op === "jian") return (Number(a) - Number(b)) / d;
  if (op === "cheng") return (Number(a) * Number(b)) / Math.pow(10, Math.max(len1, len2) * 2);
  if (op === "chu") return Number(a) / Number(b);
};
//console.log(calculate(1.4560201015165, 0.00000000001015165, "jia"));