import { TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { Q96 } from '../internalConstants'

export function getLiquidityForAmount0(_sqrtRatioAX96: JSBI, _sqrtRatioBX96: JSBI, _amount0: TokenAmount): JSBI {
  if (JSBI.greaterThan(_sqrtRatioAX96, _sqrtRatioBX96)) {
    ;[_sqrtRatioAX96, _sqrtRatioBX96] = [_sqrtRatioBX96, _sqrtRatioAX96]
  }
  const intermediate = JSBI.divide(JSBI.multiply(_sqrtRatioAX96, _sqrtRatioBX96), Q96)
  return JSBI.divide(JSBI.multiply(_amount0.raw, intermediate), JSBI.subtract(_sqrtRatioBX96, _sqrtRatioAX96))
}

export function getLiquidityForAmount1(_sqrtRatioAX96: JSBI, _sqrtRatioBX96: JSBI, _amount1: TokenAmount): JSBI {
  if (JSBI.greaterThan(_sqrtRatioAX96, _sqrtRatioBX96)) {
    ;[_sqrtRatioAX96, _sqrtRatioBX96] = [_sqrtRatioBX96, _sqrtRatioAX96]
  }
  return JSBI.divide(JSBI.multiply(_amount1.raw, Q96), JSBI.subtract(_sqrtRatioBX96, _sqrtRatioAX96))
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token0, token1,
 * and the prices at the tick boundaries.
 * @param sqrtRatioCurrentX96 the current price
 * @param sqrtRatioAX96 price at lower boundary
 * @param sqrtRatioBX96 price at upper boundary
 * @param amount0 token0 amount
 * @param amount1 token1 amount
 */
export function getLiquidityForAmounts(
  sqrtRatioCurrentX96: JSBI,
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: TokenAmount,
  amount1: TokenAmount
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  if (JSBI.lessThan(sqrtRatioCurrentX96, sqrtRatioAX96)) {
    return getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  } else if (JSBI.lessThan(sqrtRatioCurrentX96, sqrtRatioBX96)) {
    const liquidity0 = getLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0)
    const liquidity1 = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1)
    return JSBI.lessThan(liquidity0, liquidity1) ? liquidity0 : liquidity1
  } else {
    return getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
  }
}
