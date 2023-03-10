import { BigNumber } from 'ethers';
import { ChainId } from '../../../..';

//l2 execution fee on optimism is roughly the same as mainnet
export const BASE_SWAP_COST = (id: ChainId): BigNumber => {
  switch (id) {
    case ChainId.MAINNET:
    case ChainId.ROPSTEN:
    case ChainId.RINKEBY:
    case ChainId.GÖRLI:
    case ChainId.OPTIMISM:
    case ChainId.OPTIMISTIC_KOVAN:
    case ChainId.KOVAN:
      return BigNumber.from(2000);
    case ChainId.ARBITRUM_ONE:
    case ChainId.ARBITRUM_RINKEBY:
      return BigNumber.from(5000);
    case ChainId.POLYGON:
    case ChainId.POLYGON_MUMBAI:
      return BigNumber.from(2000);
    case ChainId.BSC:
      return BigNumber.from(2000);
    case ChainId.BSC_TEST:
      return BigNumber.from(2000);
    case ChainId.NEAR:
      return BigNumber.from(2000);
    case ChainId.MAP:
      return BigNumber.from(2000);
    default:
      console.log(
        'chainId ',
        id,
        " isn't setting COST_PER_INIT_TICK, default COST_PER_INIT_TICK is 31000"
      );
      return BigNumber.from(2000);
  }
};

export const COST_PER_INIT_TICK = (id: ChainId): BigNumber => {
  switch (id) {
    case ChainId.MAINNET:
    case ChainId.ROPSTEN:
    case ChainId.RINKEBY:
    case ChainId.GÖRLI:
    case ChainId.KOVAN:
      return BigNumber.from(31000);
    case ChainId.OPTIMISM:
    case ChainId.OPTIMISTIC_KOVAN:
      return BigNumber.from(31000);
    case ChainId.ARBITRUM_ONE:
    case ChainId.ARBITRUM_RINKEBY:
      return BigNumber.from(31000);
    case ChainId.POLYGON:
    case ChainId.POLYGON_MUMBAI:
      return BigNumber.from(31000);
    case ChainId.BSC:
      return BigNumber.from(31000);
    case ChainId.BSC_TEST:
      return BigNumber.from(31000);
    case ChainId.NEAR:
      return BigNumber.from(31000);
    case ChainId.MAP:
      return BigNumber.from(31000);
    default:
      console.log(
        'chainId ',
        id,
        " isn't setting COST_PER_INIT_TICK, default COST_PER_INIT_TICK is 31000"
      );
      return BigNumber.from(31000);
  }
};

export const COST_PER_HOP = (id: ChainId): BigNumber => {
  switch (id) {
    case ChainId.MAINNET:
    case ChainId.ROPSTEN:
    case ChainId.RINKEBY:
    case ChainId.GÖRLI:
    case ChainId.KOVAN:
    case ChainId.OPTIMISM:
    case ChainId.OPTIMISTIC_KOVAN:
      return BigNumber.from(80000);
    case ChainId.ARBITRUM_ONE:
    case ChainId.ARBITRUM_RINKEBY:
      return BigNumber.from(80000);
    case ChainId.POLYGON:
    case ChainId.POLYGON_MUMBAI:
      return BigNumber.from(80000);
    case ChainId.BSC:
      return BigNumber.from(80000);
    case ChainId.BSC_TEST:
      return BigNumber.from(80000);
    case ChainId.NEAR:
      return BigNumber.from(80000);
    case ChainId.MAP:
      return BigNumber.from(80000);
    default:
      console.log(
        'chainId ',
        id,
        " isn't setting COST_PER_HOP, default COST_PER_HOP is 80000"
      );
      return BigNumber.from(80000);
  }
};
