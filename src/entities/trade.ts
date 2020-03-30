import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { TradeType } from '../constants'
import { Pair } from './pair'
import { Route } from './route'
import { Fraction, TokenAmount } from './fractions'
import { Price } from './fractions/price'
import { Percent } from './fractions/percent'

function getSlippage(midPrice: Price, inputAmount: TokenAmount, outputAmount: TokenAmount): Percent {
  const exactQuote = midPrice.raw.multiply(inputAmount.raw)
  // calculate (exactQuote - outputAmount) / exactQuote
  const exactDifference = new Fraction(
    JSBI.subtract(exactQuote.numerator, JSBI.multiply(outputAmount.raw, exactQuote.denominator)),
    exactQuote.denominator
  )
  const slippage = exactDifference.multiply(exactQuote.invert())
  return new Percent(slippage.numerator, slippage.denominator)
}

export class Trade {
  public readonly route: Route
  public readonly tradeType: TradeType
  public readonly inputAmount: TokenAmount
  public readonly outputAmount: TokenAmount
  public readonly executionPrice: Price
  public readonly nextMidPrice: Price
  public readonly slippage: Percent

  constructor(route: Route, amount: TokenAmount, tradeType: TradeType) {
    invariant(amount.token.equals(tradeType === TradeType.EXACT_INPUT ? route.input : route.output), 'TOKEN')
    const amounts: TokenAmount[] = new Array(route.path.length)
    const nextPairs: Pair[] = new Array(route.pairs.length)
    if (tradeType === TradeType.EXACT_INPUT) {
      amounts[0] = amount
      for (let i = 0; i < route.path.length - 1; i++) {
        const pair = route.pairs[i]
        const [outputAmount, nextPair] = pair.getOutputAmount(amounts[i])
        amounts[i + 1] = outputAmount
        nextPairs[i] = nextPair
      }
    } else {
      amounts[amounts.length - 1] = amount
      for (let i = route.path.length - 1; i > 0; i--) {
        const pair = route.pairs[i - 1]
        const [inputAmount, nextPair] = pair.getInputAmount(amounts[i])
        amounts[i - 1] = inputAmount
        nextPairs[i - 1] = nextPair
      }
    }

    this.route = route
    this.tradeType = tradeType
    const inputAmount = amounts[0]
    const outputAmount = amounts[amounts.length - 1]
    this.inputAmount = inputAmount
    this.outputAmount = outputAmount
    this.executionPrice = new Price(route.input, route.output, inputAmount.raw, outputAmount.raw)
    const nextMidPrice = Price.fromRoute(new Route(nextPairs, route.input))
    this.nextMidPrice = nextMidPrice
    this.slippage = getSlippage(route.midPrice, inputAmount, outputAmount)
  }
}
