import JSBI from 'jsbi'

// todo: replace with v3 factory address
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

// todo: replace with v3 swap router
export const SWAP_ROUTER_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const INIT_CODE_HASH = '0x56cf930c850ce212aa057e794ef994327f2cb22ca6f87b126cc538e797b9541c'

// exports for internal consumption
export const NEGATIVE_ONE = JSBI.BigInt(-1)
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

export const MIN_TICK = -887272
export const MAX_TICK = -MIN_TICK

export const getMinTick = (tickSpacing: number) => Math.ceil(MIN_TICK / tickSpacing) * tickSpacing
export const getMaxTick = (tickSpacing: number) => Math.floor(MAX_TICK / tickSpacing) * tickSpacing
