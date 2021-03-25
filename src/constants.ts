import JSBI from 'jsbi'

// todo: replace with v3 factory address
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

// todo: replace with v3 swap router
export const SWAP_ROUTER_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const POOL_INIT_CODE_HASH = '0x01d4d358e07707f4db84b6a7527455b06f95ee89b5d059b4a1298ada7b6c7d67'

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)

// used in liquiditiy amount math
export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200
}

export const MAX_TICK = 887272
export const MIN_TICK = -1 * MAX_TICK

export const SQUARED_PRICE_DENOMINATOR = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192))
