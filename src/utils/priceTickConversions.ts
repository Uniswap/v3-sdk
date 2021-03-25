import { Price, Token } from '@uniswap/sdk-core'
import Decimal from 'decimal.js-light'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { Q192 } from '../internalConstants'
import { TickMath } from './tickMath'

/**
 * Returns a price object corresponding to the input tick and the base/quote token
 * Inputs must be tokens because the address order is used to interpret the price represented by the tick
 * @param baseToken the base token of the price
 * @param quoteToken the quote token of the price
 * @param tick the tick for which to return the price
 */
export function tickToPrice(baseToken: Token, quoteToken: Token, tick: number): Price {
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick)

  const ratioX192 = JSBI.multiply(sqrtRatioX96, sqrtRatioX96)

  return baseToken.sortsBefore(quoteToken)
    ? new Price(baseToken, quoteToken, Q192, ratioX192)
    : new Price(baseToken, quoteToken, ratioX192, Q192)
}

/**
 * Returns the first tick for which the given price is greater than or equal to the tick price
 * @param price for which to return the closest tick that represents a price less than or equal to the input price,
 * i.e. the price of the returned tick is less than or equal to the input price
 */
export function priceToClosestTick(price: Price): number {
  invariant(price.baseCurrency instanceof Token && price.quoteCurrency instanceof Token, 'TOKENS')

  const ratioDecimal = price.baseCurrency.sortsBefore(price.quoteCurrency)
    ? new Decimal(price.raw.numerator.toString()).dividedBy(price.raw.denominator.toString())
    : new Decimal(price.raw.denominator.toString()).dividedBy(price.raw.numerator.toString())
  const sqrtRatio = ratioDecimal.sqrt()

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

  let tick = TickMath.getTickAtSqrtRatio(sqrtRatioX96)
  if (!tickToPrice(price.baseCurrency, price.quoteCurrency, tick + 1).greaterThan(price)) tick++
  return tick
}
