// exports for external consumption
export type BigintIsh = number | bigint | string

export enum ChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
  GÖRLI = 5,
  KOVAN = 42
}

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP
}

export const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

// todo: replace with v3 init code hash
export const INIT_CODE_HASH = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'

export const MINIMUM_LIQUIDITY = BigInt(1000)

// exports for internal consumption
export const ZERO = BigInt(0)
export const ONE = BigInt(1)
export const TWO = BigInt(2)
export const THREE = BigInt(3)
export const FIVE = BigInt(5)
export const TEN = BigInt(10)
export const _100 = BigInt(100)
export const _997 = BigInt(997)
export const _1000 = BigInt(1000)

export enum SolidityType {
  uint8 = 'uint8',
  uint256 = 'uint256'
}

export const SOLIDITY_TYPE_MAXIMA = {
  [SolidityType.uint8]: BigInt('0xff'),
  [SolidityType.uint256]: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
