import { Decimal } from 'decimal.js-light'
import JSBI from 'jsbi'
import { BigintIsh } from '@uniswap/sdk-core'

// returns the sqrt price as a 64x96
export function encodeSqrtRatioX96(reserve0: BigintIsh, reserve1: BigintIsh): JSBI {
  const ratio = new Decimal(reserve0.toString()).dividedBy(reserve1.toString()).sqrt()

  // hacky way to avoid exponential notation without modifying a global configuration
  const toExpPosBefore = Decimal.toExpPos
  Decimal.toExpPos = 9_999_999

  const sqrtRatioX96 = JSBI.BigInt(
    ratio
      .mul(new Decimal(2).pow(96))
      .toInteger()
      .toString()
  )

  Decimal.toExpPos = toExpPosBefore

  return sqrtRatioX96
}
