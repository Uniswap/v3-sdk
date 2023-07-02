import { BigintIsh } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { Q96_BIGINT } from '../internalConstants'
import { bigIntFromBigintIsh } from './bigintIsh'

/**
 * Returns an imprecise maximum amount of liquidity received for a given amount of token 0.
 * This function is available to accommodate LiquidityAmounts#getLiquidityForAmount0 in the v3 periphery,
 * which could be more precise by at least 32 bits by dividing by Q64 instead of Q96 in the intermediate step,
 * and shifting the subtracted ratio left by 32 bits. This imprecise calculation will likely be replaced in a future
 * v3 router contract.
 * @param sqrtRatioAX96 The price at the lower boundary
 * @param sqrtRatioBX96 The price at the upper boundary
 * @param amount0 The token0 amount
 * @returns liquidity for amount0, imprecise
 */
function maxLiquidityForAmount0Imprecise<T extends bigint | JSBI>(
  _sqrtRatioAX96: T,
  _sqrtRatioBX96: T,
  _amount0: BigintIsh
): T {
  let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
  let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
  const amount0 = bigIntFromBigintIsh(_amount0)

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  const intermediate = (sqrtRatioAX96 * sqrtRatioBX96) / Q96_BIGINT

  const returnValue = (amount0 * intermediate) / (sqrtRatioBX96 - sqrtRatioAX96)

  if (typeof _sqrtRatioAX96 === 'bigint') {
    return returnValue as T
  } else {
    return JSBI.BigInt(returnValue.toString(10)) as T
  }
}

/**
 * Returns a precise maximum amount of liquidity received for a given amount of token 0 by dividing by Q64 instead of Q96 in the intermediate step,
 * and shifting the subtracted ratio left by 32 bits.
 * @param sqrtRatioAX96 The price at the lower boundary
 * @param sqrtRatioBX96 The price at the upper boundary
 * @param amount0 The token0 amount
 * @returns liquidity for amount0, precise
 */
function maxLiquidityForAmount0Precise<T extends bigint | JSBI>(
  _sqrtRatioAX96: T,
  _sqrtRatioBX96: T,
  _amount0: BigintIsh
): T {
  let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
  let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
  const amount0 = bigIntFromBigintIsh(_amount0)

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const numerator = amount0 * sqrtRatioAX96 * sqrtRatioBX96
  const denominator = Q96_BIGINT * (sqrtRatioBX96 - sqrtRatioAX96)

  const returnValue = numerator / denominator

  if (typeof _sqrtRatioAX96 === 'bigint') {
    return returnValue as T
  } else {
    return JSBI.BigInt(returnValue.toString(10)) as T
  }
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token1
 * @param sqrtRatioAX96 The price at the lower tick boundary
 * @param sqrtRatioBX96 The price at the upper tick boundary
 * @param amount1 The token1 amount
 * @returns liquidity for amount1
 */
function maxLiquidityForAmount1<T extends bigint | JSBI>(_sqrtRatioAX96: T, _sqrtRatioBX96: T, _amount1: BigintIsh): T {
  let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
  let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
  const amount1 = bigIntFromBigintIsh(_amount1)

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  const returnValue = (amount1 * Q96_BIGINT) / (sqrtRatioBX96 - sqrtRatioAX96)

  if (typeof _sqrtRatioAX96 === 'bigint') {
    return returnValue as T
  } else {
    return JSBI.BigInt(returnValue.toString(10)) as T
  }
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token0, token1,
 * and the prices at the tick boundaries.
 * @param sqrtRatioCurrentX96 the current price
 * @param sqrtRatioAX96 price at lower boundary
 * @param sqrtRatioBX96 price at upper boundary
 * @param amount0 token0 amount
 * @param amount1 token1 amount
 * @param useFullPrecision if false, liquidity will be maximized according to what the router can calculate,
 * not what core can theoretically support
 */
export function maxLiquidityForAmounts<T extends bigint | JSBI>(
  _sqrtRatioCurrentX96: T,
  _sqrtRatioAX96: T,
  _sqrtRatioBX96: T,
  _amount0: BigintIsh,
  _amount1: BigintIsh,
  useFullPrecision: boolean
): T {
  const sqrtRatioCurrentX96 = bigIntFromBigintIsh(_sqrtRatioCurrentX96)
  let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
  let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
  const amount0 = bigIntFromBigintIsh(_amount0)
  const amount1 = bigIntFromBigintIsh(_amount1)

  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const maxLiquidityForAmount0 = useFullPrecision ? maxLiquidityForAmount0Precise : maxLiquidityForAmount0Imprecise

  let returnValue: bigint
  if (sqrtRatioCurrentX96 <= sqrtRatioAX96) {
    returnValue = maxLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  } else if (sqrtRatioCurrentX96 < sqrtRatioBX96) {
    const liquidity0 = maxLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0)
    const liquidity1 = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1)
    returnValue = liquidity0 < liquidity1 ? liquidity0 : liquidity1
  } else {
    returnValue = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
  }

  if (typeof _sqrtRatioCurrentX96 === 'bigint') {
    return returnValue as T
  } else {
    return JSBI.BigInt(returnValue.toString(10)) as T
  }
}
