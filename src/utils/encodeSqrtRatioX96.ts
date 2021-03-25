import { Decimal } from 'decimal.js-light'
import JSBI from 'jsbi'
import { BigintIsh } from '@uniswap/sdk-core'

// returns the sqrt price as a 64x96
export function encodeSqrtRatioX96(amount1: BigintIsh, amount0: BigintIsh): JSBI {
  const sqrtRatio = new Decimal(amount1.toString()).dividedBy(amount0.toString()).sqrt()

  // hacky way to avoid exponential notation without modifying a global configuration
  const toExpPosBefore = Decimal.toExpPos
  Decimal.toExpPos = 9_999_999

  const sqrtRatioX96 = JSBI.BigInt(
    sqrtRatio
      .mul(new Decimal(2).pow(96))
      .toInteger()
      .toString()
  )

  Decimal.toExpPos = toExpPosBefore

  return sqrtRatioX96
}
