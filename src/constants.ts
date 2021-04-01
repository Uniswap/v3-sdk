import { TickMath } from './utils'

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

export function MIN_TICK(tickSpacing: number) {
  return Math.ceil(TickMath.MIN_TICK / tickSpacing) * tickSpacing
}

export function MAX_TICK(tickSpacing: number) {
  return Math.floor(TickMath.MAX_TICK / tickSpacing) * tickSpacing
}
