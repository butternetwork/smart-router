
import { ethers } from 'ethers';
import { BMOS_BSCT, BUSD_BSCT, mUSDC_MAPT, PMOS_POLYGON_MUMBAI, PUSD_POLYGON_MUMBAI, USDC_NEAR, WBNB_BSCT } from '../providers';
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
  const provider = new ethers.providers.JsonRpcProvider(
    'https://testnet-rpc.maplabs.io'
  );

  console.log(await getBridgeFee(PUSD_POLYGON_MUMBAI, '97', '80', provider,'212'))
  console.log(await getBridgeFee(BUSD_BSCT, '80001', '80', provider,'212'))

}

//test1()
test2()