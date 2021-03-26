import JSBI from 'jsbi'
import { BigintIsh } from '@uniswap/sdk-core'
import { sqrt } from './sqrt'

// returns the sqrt price as a 64x96
export function encodeSqrtRatioX96(amount1: BigintIsh, amount0: BigintIsh): JSBI {
  const numerator = JSBI.leftShift(JSBI.BigInt(amount1), JSBI.BigInt(192))
  const denominator = JSBI.BigInt(amount0)
  const ratioX192 = JSBI.divide(numerator, denominator)
  return sqrt(ratioX192)
}
