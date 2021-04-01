import { Price, Token } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { nearestUsableTick } from './nearestUsableTick'
import { priceToClosestTick, tickToPrice } from './priceTickConversions'

/**
 * Given a price and a fee amount, return the price snapped to the nearest usable tick for the fee amount
 * @param price The price that is being snapped, e.g. a price input by the user
 * @param feeAmount The fee amount of the pool for which the tick price is intended to represent
 */
export function snapPrice(price: Price, feeAmount: FeeAmount): Price {
  invariant(price.baseCurrency instanceof Token && price.quoteCurrency instanceof Token, 'TOKENS')
  return tickToPrice(
    price.baseCurrency,
    price.quoteCurrency,
    nearestUsableTick(priceToClosestTick(price), TICK_SPACINGS[feeAmount])
  )
}
