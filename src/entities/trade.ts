import invariant from 'tiny-invariant'

import { _997, _1000, SolidityType, TradeType } from '../constants'
import { BigintIsh, Fraction } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { validateSolidityTypeInstance } from '../utils/validateInputs'
import { Exchange } from './exchange'
import { Route } from './route'
import { Price, Percent } from './rate'

function getOutputAmount(inputAmount: bigint, inputReserve: bigint, outputReserve: bigint): bigint {
  invariant(inputAmount > 0, `${inputAmount} is not positive.`)
  invariant(inputReserve > 0, `${inputReserve} is not positive.`)
  invariant(outputReserve > 0, `${outputReserve} is not positive.`)
  const inputAmountWithFee = inputAmount * _997
  const numerator = inputAmountWithFee * outputReserve
  const denominator = inputReserve * _1000 + inputAmountWithFee
  return numerator / denominator
}

function getInputAmount(outputAmount: bigint, inputReserve: bigint, outputReserve: bigint): bigint {
  invariant(outputAmount > 0, `${outputAmount} is not positive.`)
  invariant(inputReserve > 0, `${inputReserve} is not positive.`)
  invariant(outputReserve > 0, `${outputReserve} is not positive.`)
  const numerator = inputReserve * outputAmount * _1000
  const denominator = (outputReserve - outputAmount) * _997
  return numerator / denominator + BigInt(1)
}

function getSlippage(inputAmount: bigint, midPrice: Price, outputAmount: bigint): Percent {
  const exactQuote: Fraction = [
    inputAmount * midPrice.rate[0] * midPrice.scalar[0],
    midPrice.rate[1] * midPrice.scalar[1]
  ]
  const normalizedNumerator: Fraction = [outputAmount * exactQuote[1] - exactQuote[0], exactQuote[1]]
  const invertedDenominator = exactQuote.slice().reverse() as Fraction
  return new Percent([normalizedNumerator[0] * invertedDenominator[0], normalizedNumerator[1] * invertedDenominator[1]])
}

function getPercentChange(referenceRate: Price, newRate: Price): Percent {
  const normalizedNumerator: Fraction = [
    newRate.rate[0] * referenceRate.rate[1] - referenceRate.rate[0] * newRate.rate[1],
    referenceRate.rate[1] * newRate.rate[1]
  ]
  const invertedDenominator = referenceRate.rate.slice().reverse() as Fraction
  return new Percent([normalizedNumerator[0] * invertedDenominator[0], normalizedNumerator[1] * invertedDenominator[1]])
}

export class Trade {
  public readonly route: Route
  public readonly inputAmount: bigint
  public readonly outputAmount: bigint
  public readonly tradeType: TradeType
  public readonly executionPrice: Price
  public readonly nextMidPrice: Price
  public readonly slippage: Percent
  public readonly midPricePercentChange: Percent

  static validate(amount: bigint) {
    validateSolidityTypeInstance(amount, SolidityType.uint256)
  }

  constructor(route: Route, amount: BigintIsh, tradeType: TradeType) {
    const amountParsed = parseBigintIsh(amount)
    Trade.validate(amountParsed)

    const amounts: bigint[] = new Array(route.exchanges.length + 1)
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
          [exchange.balances[inputIndex] + inputAmount, exchange.balances[outputIndex] - outputAmount]
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
            [exchange.balances[inputIndex] + inputAmount, exchange.balances[outputIndex] - outputAmount]
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
    const executionPrice = new Price(
      [outputAmount * route.midPrice.scalar[1], inputAmount * route.midPrice.scalar[0]],
      route.midPrice.scalar
    )
    this.executionPrice = executionPrice
    this.slippage = getSlippage(inputAmount, route.midPrice, outputAmount)
    const nextMidPrice = Price.fromRoute(new Route(nextExchanges, route.input))
    this.nextMidPrice = nextMidPrice
    this.midPricePercentChange = getPercentChange(route.midPrice, nextMidPrice)
  }
}
