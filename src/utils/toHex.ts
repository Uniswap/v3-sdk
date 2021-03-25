import { CurrencyAmount } from '@uniswap/sdk-core'

export function toHex(currencyAmount: CurrencyAmount) {
  return `0x${currencyAmount.raw.toString(16)}`
}

export const ZERO_HEX = '0x0'
