import JSBI from 'jsbi'
import { ONE } from './internalConstants'

// todo: replace with v3 factory address
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

// todo: replace with v3 swap router
export const SWAP_ROUTER_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const POOL_INIT_CODE_HASH = '0x01d4d358e07707f4db84b6a7527455b06f95ee89b5d059b4a1298ada7b6c7d67'

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

export const MIN_SQRT_RATIO = JSBI.add(JSBI.BigInt('4295128739'), ONE)
export const MAX_SQRT_RATIO = JSBI.subtract(JSBI.BigInt('1461446703485210103287273052203988822378723970342'), ONE)
