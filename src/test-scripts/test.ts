import { ethers } from 'ethers';
import { USDC_NEAR } from '../providers';
import { _getUsdRate } from '../routers/alpha-router/functions/get-curve-best-router';
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
  let data = await getBridgeFee(MAP_TEST_MOST, '97', '100', provider);
  console.log('test2', data);
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
// test2()
