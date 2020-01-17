// exports for external consumption
export enum ChainId {
  RINKEBY = 4
}

export const WETH = {
  [ChainId.RINKEBY]: {
    chainId: ChainId.RINKEBY,
    address: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    decimals: 18
  }
}

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

// exports for internal consumption
export const ZERO = BigInt(0)
export const ONE = BigInt(1)
export const TEN = BigInt(10)
export const _100 = BigInt(100)
export const _997 = BigInt(997)
export const _1000 = BigInt(1000)

export enum SolidityType {
  uint8,
  uint256
}
