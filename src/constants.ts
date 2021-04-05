// todo: replace with v3 factory address
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

// todo: replace with v3 swap router
export const SWAP_ROUTER_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const POOL_INIT_CODE_HASH = '0xa8180af292c6986c74fa300a542e049db8a89221e2452e431c3d8103b610c568'

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000
}

/**
 * The default factory tick spacings by fee amount.
 */
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200
}
