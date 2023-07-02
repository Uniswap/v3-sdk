import JSBI from 'jsbi'
import { BigintIsh, sqrt } from '@uniswap/sdk-core'
import { bigIntFromBigintIsh } from './bigintIsh'

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0
 * @param amount1 The numerator amount i.e., the amount of token1
 * @param amount0 The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio
 */
export function encodeSqrtRatioX96BigInt(amount1: BigintIsh, amount0: BigintIsh): bigint {
  const numerator = bigIntFromBigintIsh(amount1) << 192n
  const denominator = bigIntFromBigintIsh(amount0)
  const ratioX192 = numerator / denominator

  return sqrt(ratioX192)
}

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0
 * @param amount1 The numerator amount i.e., the amount of token1
 * @param amount0 The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio
 */
export function encodeSqrtRatioX96(amount1: BigintIsh, amount0: BigintIsh): JSBI {
  return JSBI.BigInt(encodeSqrtRatioX96BigInt(amount1, amount0).toString(10))
}
