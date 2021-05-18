import { BigintIsh } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { Q96 } from '../internalConstants'

function maxLiquidityForAmount0Imprecise(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, amount0: BigintIsh): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  const intermediate = JSBI.divide(JSBI.multiply(sqrtRatioAX96, sqrtRatioBX96), Q96)
  return JSBI.divide(JSBI.multiply(JSBI.BigInt(amount0), intermediate), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
}

function maxLiquidityForAmount0Precise(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, amount0: BigintIsh): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const numerator = JSBI.multiply(JSBI.multiply(JSBI.BigInt(amount0), sqrtRatioAX96), sqrtRatioBX96)
  const denominator = JSBI.multiply(Q96, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))

  return JSBI.divide(numerator, denominator)
}

function maxLiquidityForAmount1(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, amount1: BigintIsh): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  return JSBI.divide(JSBI.multiply(JSBI.BigInt(amount1), Q96), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
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
export function maxLiquidityForAmounts(
  sqrtRatioCurrentX96: JSBI,
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: BigintIsh,
  amount1: BigintIsh,
  useFullPrecision: boolean
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const maxLiquidityForAmount0 = useFullPrecision ? maxLiquidityForAmount0Precise : maxLiquidityForAmount0Imprecise

  if (JSBI.lessThanOrEqual(sqrtRatioCurrentX96, sqrtRatioAX96)) {
    return maxLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  } else if (JSBI.lessThan(sqrtRatioCurrentX96, sqrtRatioBX96)) {
    const liquidity0 = maxLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0)
    const liquidity1 = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1)
    return JSBI.lessThan(liquidity0, liquidity1) ? liquidity0 : liquidity1
  } else {
    return maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
  }
}
