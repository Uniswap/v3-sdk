import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { ZERO, ONE, _997, _1000, SolidityType, TradeType } from '../constants'
import { BigintIsh } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { validateSolidityTypeInstance } from '../utils/validateInputs'
import { Exchange } from './exchange'
import { Route } from './route'
import { Fraction, Price, Percent } from './fractions'

function getOutputAmount(inputAmount: JSBI, inputReserve: JSBI, outputReserve: JSBI): JSBI {
  invariant(JSBI.greaterThan(inputAmount, ZERO), `${inputAmount} is not positive.`)
  invariant(JSBI.greaterThan(inputReserve, ZERO), `${inputReserve} is not positive.`)
  invariant(JSBI.greaterThan(outputReserve, ZERO), `${outputReserve} is not positive.`)
  const inputAmountWithFee = JSBI.multiply(inputAmount, _997)
  const numerator = JSBI.multiply(inputAmountWithFee, outputReserve)
  const denominator = JSBI.add(JSBI.multiply(inputReserve, _1000), inputAmountWithFee)
  return JSBI.divide(numerator, denominator)
}

function getInputAmount(outputAmount: JSBI, inputReserve: JSBI, outputReserve: JSBI): JSBI {
  invariant(JSBI.greaterThan(outputAmount, ZERO), `${outputAmount} is not positive.`)
  invariant(JSBI.greaterThan(inputReserve, ZERO), `${inputReserve} is not positive.`)
  invariant(JSBI.greaterThan(outputReserve, ZERO), `${outputReserve} is not positive.`)
  const numerator = JSBI.multiply(JSBI.multiply(inputReserve, outputAmount), _1000)
  const denominator = JSBI.multiply(JSBI.subtract(outputReserve, outputAmount), _997)
  return JSBI.add(JSBI.divide(numerator, denominator), ONE)
}

function getSlippage(inputAmount: JSBI, midPrice: Price, outputAmount: JSBI): Percent {
  const exactQuote = midPrice.price.multiply(midPrice.scalar).multiply(new Fraction(inputAmount))
  const normalizedNumerator = new Fraction(
    JSBI.subtract(JSBI.multiply(outputAmount, exactQuote.denominator), exactQuote.numerator),
    exactQuote.denominator
  )
  const invertedDenominator = exactQuote.invert()
  return new Percent(normalizedNumerator.multiply(invertedDenominator))
}

function getPercentChange(referenceRate: Price, newRate: Price): Percent {
  const normalizedNumerator = new Fraction(
    JSBI.subtract(
      JSBI.multiply(newRate.price.numerator, referenceRate.price.denominator),
      JSBI.multiply(referenceRate.price.numerator, newRate.price.denominator)
    ),
    JSBI.multiply(referenceRate.price.denominator, newRate.price.denominator)
  )
  const invertedDenominator = referenceRate.price.invert()
  return new Percent(normalizedNumerator.multiply(invertedDenominator))
}

export class Trade {
  public readonly route: Route
  public readonly inputAmount: JSBI
  public readonly outputAmount: JSBI
  public readonly tradeType: TradeType
  public readonly executionPrice: Price
  public readonly nextMidPrice: Price
  public readonly slippage: Percent
  public readonly midPricePercentChange: Percent

  static validate(amount: JSBI) {
    validateSolidityTypeInstance(amount, SolidityType.uint256)
  }

  constructor(route: Route, amount: BigintIsh, tradeType: TradeType) {
    const amountParsed = parseBigintIsh(amount)
    Trade.validate(amountParsed)

    const amounts: JSBI[] = new Array(route.exchanges.length + 1)
    const nextExchanges: Exchange[] = new Array(route.exchanges.length)
    if (tradeType === TradeType.EXACT_INPUT) {
      amounts[0] = amountParsed
      route.exchanges.forEach((exchange, i) => {
        const input = route.path[i]
        const inputIndex = input.address === exchange.pair[0].address ? 0 : 1
        const outputIndex = input.address === exchange.pair[0].address ? 1 : 0
        const inputAmount = amounts[i]
        const outputAmount = getOutputAmount(inputAmount, exchange.balances[inputIndex], exchange.balances[outputIndex])
        amounts[i + 1] = outputAmount
        const nextExchange = new Exchange(
          [exchange.pair[inputIndex], exchange.pair[outputIndex]],
          [
            JSBI.add(exchange.balances[inputIndex], inputAmount),
            JSBI.subtract(exchange.balances[outputIndex], outputAmount)
          ]
        )
        nextExchanges[i] = nextExchange
      })
    } else if (tradeType === TradeType.EXACT_OUTPUT) {
      amounts[amounts.length - 1] = amountParsed
      route.exchanges
        .slice()
        .reverse()
        .forEach((exchange, i) => {
          const inverseIndex = route.exchanges.length - 1 - i
          const input = route.path[inverseIndex]
          const inputIndex = input.address === exchange.pair[0].address ? 0 : 1
          const outputIndex = input.address === exchange.pair[0].address ? 1 : 0
          const outputAmount = amounts[inverseIndex + 1]
          const inputAmount = getInputAmount(
            outputAmount,
            exchange.balances[inputIndex],
            exchange.balances[outputIndex]
          )
          amounts[inverseIndex] = inputAmount
          const nextExchange = new Exchange(
            [exchange.pair[inputIndex], exchange.pair[outputIndex]],
            [
              JSBI.add(exchange.balances[inputIndex], inputAmount),
              JSBI.subtract(exchange.balances[outputIndex], outputAmount)
            ]
          )
          nextExchanges[inverseIndex] = nextExchange
        })
    }
    this.route = route
    const inputAmount = amounts[0]
    const outputAmount = amounts[amounts.length - 1]
    this.inputAmount = inputAmount
    this.outputAmount = outputAmount
    this.tradeType = tradeType
    this.executionPrice = new Price(
      new Fraction(outputAmount, inputAmount).multiply(route.midPrice.scalar.invert()),
      route.midPrice.scalar
    )
    const nextMidPrice = Price.fromRoute(new Route(nextExchanges, route.input))
    this.nextMidPrice = nextMidPrice
    this.slippage = getSlippage(inputAmount, route.midPrice, outputAmount)
    this.midPricePercentChange = getPercentChange(route.midPrice, nextMidPrice)
  }
}
