import JSBI from 'jsbi'

// todo: replace with v3 factory address
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'

export const INIT_CODE_HASH = '0xd4f1a40e4bf7e60d35149863dcd741cd4bb1f6b8e723b3140eca4a488aec8a51'

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)

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
