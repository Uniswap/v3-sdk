import { Currency, Fraction, Percent, Price, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { ONE, ZERO } from '../internalConstants'
import { Pool } from './pool'
import { Trade } from './trade'

/**
 * Represents an aggregated trade consisting of a number of trades each with the same start and end currency.
 *
 * Each trade must have its own set of pools. Pools can not be re-used across trades.
 *
 * Does not account for slippage, i.e., changes in price environment that can occur between
 * the time the trade is submitted and when it is executed.
 * @template TInput The input token, either Ether or an ERC-20
 * @template TOutput The output token, either Ether or an ERC-20
 * @template TTradeType The trade type, either exact input or exact output
 */
export class AggregatedTrade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  /**
   * The trade making up the aggregation.
   */
  public readonly trades: Trade<TInput, TOutput, TTradeType>[]
  /**
   * The type of the trade, either exact in or exact out.
   */
  public readonly tradeType: TTradeType
  /**
   * The input amount for the trade assuming no slippage.
   */
  public readonly inputAmount: CurrencyAmount<TInput>
  /**
   * The output amount for the trade assuming no slippage.
   */
  public readonly outputAmount: CurrencyAmount<TOutput>

  /**
   * The cached result of the computed execution price
   * @private
   */
  private _executionPrice: Price<TInput, TOutput> | undefined

  /**
   * The price expressed in terms of output amount/input amount.
   */
  public get executionPrice(): Price<TInput, TOutput> {
    return (
      this._executionPrice ??
      (this._executionPrice = new Price(
        this.inputAmount.currency,
        this.outputAmount.currency,
        this.inputAmount.quotient,
        this.outputAmount.quotient
      ))
    )
  }

  /**
   * The cached result of the price impact computation
   * @private
   */
  private _priceImpact: Percent | undefined

  /**
   * Returns the percent difference between the route's mid price and the price impact
   */
  public get priceImpact(): Percent {
    if (this._priceImpact) {
      return this._priceImpact
    }

    let spotOutputAmount = CurrencyAmount.fromRawAmount(this.outputAmount.currency, 0)
    for (const { route, inputAmount } of this.trades) {
      const midPrice = route.midPrice
      spotOutputAmount = spotOutputAmount.add(midPrice.quote(inputAmount))
    }

    const priceImpact = spotOutputAmount.subtract(this.outputAmount).divide(spotOutputAmount)
    this._priceImpact = new Percent(priceImpact.numerator, priceImpact.denominator)

    return this._priceImpact
  }

  public static async fromTrades<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    trades: Trade<TInput, TOutput, TTradeType>[],
    tradeType: TTradeType
  ): Promise<AggregatedTrade<TInput, TOutput, TTradeType>> {
    const sampleTrade = trades[0]
    invariant(
      trades.every(({ inputAmount: tradeInputAmount }) =>
        sampleTrade.inputAmount.currency.equals(tradeInputAmount.currency)
      ),
      'INPUT_CURRENCY_MATCH'
    )
    invariant(
      trades.every(({ outputAmount: tradeOutputAmount }) =>
        sampleTrade.outputAmount.currency.equals(tradeOutputAmount.currency)
      ),
      'OUTPUT_CURRENCY_MATCH'
    )

    const totalInputFromTrades = trades
      .map(({ inputAmount }) => inputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(sampleTrade.inputAmount.currency, 0))

    const totalOutputFromTrades = trades
      .map(({ outputAmount }) => outputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(sampleTrade.outputAmount.currency, 0))

    return new AggregatedTrade({
      trades,
      inputAmount: totalInputFromTrades,
      outputAmount: totalOutputFromTrades,
      tradeType: tradeType
    })
  }

  /**
   * Construct a trade by passing in the pre-computed property values
   * @param route The route through which the trade occurs
   * @param inputAmount The amount of input paid in the trade
   * @param outputAmount The amount of output received in the trade
   * @param tradeType The type of trade, exact input or exact output
   */
  constructor({
    trades,
    inputAmount,
    outputAmount,
    tradeType
  }: {
    trades: Trade<TInput, TOutput, TTradeType>[]
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
    tradeType: TTradeType
  }) {
    invariant(
      trades.every(({ inputAmount: tradeInputAmount }) => inputAmount.currency.equals(tradeInputAmount.currency)),
      'INPUT_CURRENCY_MATCH'
    )
    invariant(
      trades.every(({ outputAmount: tradeOutputAmount }) => outputAmount.currency.equals(tradeOutputAmount.currency)),
      'OUTPUT_CURRENCY_MATCH'
    )
    invariant(
      trades.every(({ tradeType: subTradeType }) => subTradeType == tradeType),
      'TRADE_TYPE_MATCH'
    )

    const totalInputFromTrades = trades
      .map(({ inputAmount }) => inputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(inputAmount.currency, 0))

    invariant(totalInputFromTrades.equalTo(inputAmount), 'TOTAL_INPUT')

    const totalOutputFromTrades = trades
      .map(({ outputAmount }) => outputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(outputAmount.currency, 0))

    invariant(totalOutputFromTrades.equalTo(outputAmount), 'TOTAL_OUTPUT')

    const numPools = trades.map(({ route }) => route.pools.length).reduce((total, cur) => total + cur, 0)
    const poolAddressSet = new Set<string>()
    for (const { route } of trades) {
      for (const pool of route.pools) {
        poolAddressSet.add(Pool.getAddress(pool.token0, pool.token1, pool.fee))
      }
    }

    invariant(numPools == poolAddressSet.size, 'POOLS_DUPLICATED')

    this.trades = trades
    this.inputAmount = inputAmount
    this.outputAmount = outputAmount
    this.tradeType = tradeType
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount out
   */
  public minimumAmountOut(slippageTolerance: Percent): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return this.outputAmount
    } else {
      const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(slippageTolerance)
        .invert()
        .multiply(this.outputAmount.quotient).quotient
      return CurrencyAmount.fromRawAmount(this.outputAmount.currency, slippageAdjustedAmountOut)
    }
  }

  /**
   * Get the maximum amount in that can be spent via this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount in
   */
  public maximumAmountIn(slippageTolerance: Percent): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return this.inputAmount
    } else {
      const slippageAdjustedAmountIn = new Fraction(ONE).add(slippageTolerance).multiply(this.inputAmount.quotient)
        .quotient
      return CurrencyAmount.fromRawAmount(this.inputAmount.currency, slippageAdjustedAmountIn)
    }
  }

  /**
   * Return the execution price after accounting for slippage tolerance
   * @param slippageTolerance the allowed tolerated slippage
   * @returns The execution price
   */
  public worstExecutionPrice(slippageTolerance: Percent): Price<TInput, TOutput> {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).quotient,
      this.minimumAmountOut(slippageTolerance).quotient
    )
  }
}
