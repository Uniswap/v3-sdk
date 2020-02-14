import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { TradeType } from '../constants'
import { Exchange } from './exchange'
import { Route } from './route'
import { Fraction, TokenAmount } from './fractions'
import { Price } from './fractions/price'
import { Percent } from './fractions/percent'

function getSlippage(inputAmount: TokenAmount, midPrice: Price, outputAmount: TokenAmount): Percent {
  const exactQuote = midPrice.raw.multiply(inputAmount.raw)
  // calculate (outputAmount - exactQuote) / exactQuote
  const exactDifference = new Fraction(
    JSBI.subtract(JSBI.multiply(outputAmount.raw, exactQuote.denominator), exactQuote.numerator),
    exactQuote.denominator
  )
  const slippage = exactDifference.multiply(exactQuote.invert())
  return new Percent(slippage.numerator, slippage.denominator)
}

function getPercentChange(referenceRate: Price, newRate: Price): Percent {
  // calculate (newRate - referenceRate) / referenceRate
  const difference = new Fraction(
    JSBI.subtract(
      JSBI.multiply(newRate.adjusted.numerator, referenceRate.adjusted.denominator),
      JSBI.multiply(referenceRate.adjusted.numerator, newRate.adjusted.denominator)
    ),
    JSBI.multiply(referenceRate.adjusted.denominator, newRate.adjusted.denominator)
  )
  const percentChange = difference.multiply(referenceRate.adjusted.invert())
  return new Percent(percentChange.numerator, percentChange.denominator)
}

export class Trade {
  public readonly route: Route
  public readonly tradeType: TradeType
  public readonly inputAmount: TokenAmount
  public readonly outputAmount: TokenAmount
  public readonly executionPrice: Price
  public readonly nextMidPrice: Price
  public readonly slippage: Percent
  public readonly midPricePercentChange: Percent

  constructor(route: Route, amount: TokenAmount, tradeType: TradeType) {
    invariant(amount.token.equals(tradeType === TradeType.EXACT_INPUT ? route.input : route.output), 'TOKEN')
    const firstExchange = route.exchanges[tradeType === TradeType.EXACT_INPUT ? 0 : route.exchanges.length - 1]
    // ensure that the amount is strictly less that the exchange's balance
    invariant(JSBI.lessThan(amount.raw, firstExchange.reserveOf(amount.token).raw), 'RESERVE')
    const amounts: TokenAmount[] = new Array(route.path.length)
    const nextExchanges: Exchange[] = new Array(route.exchanges.length)
    if (tradeType === TradeType.EXACT_INPUT) {
      amounts[0] = amount
      for (let i = 0; i < route.path.length - 1; i++) {
        const exchange = route.exchanges[i]
        const [outputAmount, nextExchange] = exchange.getOutputAmount(amounts[i])
        amounts[i + 1] = outputAmount
        nextExchanges[i] = nextExchange
      }
    } else {
      amounts[amounts.length - 1] = amount
      for (let i = route.path.length - 1; i > 0; i--) {
        const exchange = route.exchanges[i - 1]
        const [inputAmount, nextExchange] = exchange.getInputAmount(amounts[i])
        amounts[i - 1] = inputAmount
        nextExchanges[i - 1] = nextExchange
      }
    }

    this.route = route
    this.tradeType = tradeType
    const inputAmount = amounts[0]
    const outputAmount = amounts[amounts.length - 1]
    this.inputAmount = inputAmount
    this.outputAmount = outputAmount
    this.executionPrice = new Price(route.input, route.output, inputAmount.raw, outputAmount.raw)
    const nextMidPrice = Price.fromRoute(new Route(nextExchanges, route.input))
    this.nextMidPrice = nextMidPrice
    this.slippage = getSlippage(inputAmount, route.midPrice, outputAmount)
    this.midPricePercentChange = getPercentChange(route.midPrice, nextMidPrice)
  }
}
