import { Price, Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import TickMath from './tickMath'

const SQUARED_PRICE_DENOMINATOR = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(192))

/**
 * Inputs must be tokens because we use address order to determine which value is the numerator and which the denominator
 * for the sqrt ratio returned by TickMath
 * @param baseToken the base token of the price
 * @param quoteToken the quote token of the price
 * @param tick the tick for which to return the price
 */
export function tickToPrice(baseToken: Token, quoteToken: Token, tick: number): Price {
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick)

  const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96)

  return baseToken.sortsBefore(quoteToken)
    ? new Price(baseToken, quoteToken, SQUARED_PRICE_DENOMINATOR, ratioX192)
    : new Price(baseToken, quoteToken, ratioX192, SQUARED_PRICE_DENOMINATOR)
}
