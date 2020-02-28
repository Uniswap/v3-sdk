import JSBI from 'jsbi'

// exports for external consumption
export enum ChainId {
  MAINNET = 1,
  ROPSTEN = 3,
  RINKEBY = 4,
  GÖRLI = 5,
  KOVAN = 42
}

export const FACTORY_ADDRESS = {
  [ChainId.MAINNET]: '',
  [ChainId.ROPSTEN]: '',
  [ChainId.RINKEBY]: '0xF231A51299c872040C002f3E1918D806F951Efcb',
  [ChainId.GÖRLI]: '',
  [ChainId.KOVAN]: ''
}

export const INIT_CODE_HASH = '0x762dbd0ad132fda0dfcfbc963d8f43f78fc3e23b604fc4c34f61c2ca7b3e1b36'

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)
export const THREE = JSBI.BigInt(3)
export const FIVE = JSBI.BigInt(5)
export const TEN = JSBI.BigInt(10)
export const _100 = JSBI.BigInt(100)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
export const MINIMUM_LIQUIDITY = _1000

export enum SolidityType {
  uint8 = 'uint8',
  uint256 = 'uint256'
}

export const SOLIDITY_TYPE_MAXIMA = {
  [SolidityType.uint8]: JSBI.BigInt('0xff'),
  [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
