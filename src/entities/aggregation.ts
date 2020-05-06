import { BestTradeOptions, inputOutputComparator, Trade } from './trade'
import invariant from 'tiny-invariant'
import { Fraction, Price, TokenAmount } from './fractions'
import { ONE, TradeType, ZERO } from '../constants'
import { Pair } from './pair'
import { Route } from './route'
import { Token } from './token'
import JSBI from 'jsbi'
import { sortedInsert } from '../utils'
import { InsufficientInputAmountError } from '../errors'

interface BestAggregationOptions extends BestTradeOptions {
  // the accuracy of the best aggregation--lower values take longer to compute
  stepSize?: Fraction
  // the maximum number of trades in the produced aggregations
  maxNumTrades?: number
}

// the default value for stepSize
const DEFAULT_STEP_SIZE = new Fraction(JSBI.BigInt(1), JSBI.BigInt(4))

const ONE_HALF = new Fraction(JSBI.BigInt(1), JSBI.BigInt(2))

// given two aggregations, sorts them by their output amounts in decreasing order and then their input amounts in
// increasing order, so the best aggregation comes first
function aggregationComparator(a: Aggregation, b: Aggregation): number {
  invariant(a.tradeType === b.tradeType, 'TRADE_TYPE')
  return inputOutputComparator(a, b)
}

// returns the list of pairs after applying the amounts from the trade
function pairsAfterTrade(pairs: Pair[], trade: Trade): Pair[] {
  const copy = [...pairs]
  let amountIn = trade.inputAmount
  for (let i = 0; i < trade.route.pairs.length; i++) {
    const indexOfPair = copy.indexOf(trade.route.pairs[i])
    invariant(indexOfPair !== -1, 'PAIR_NOT_IN_LIST')
    let newPair
    ;[amountIn, newPair] = copy[indexOfPair].getOutputAmount(amountIn)
    copy[indexOfPair] = newPair
  }
  return copy
}

/**
 * An aggregation is a group of trades that share an input and output token.
 * Aggregations are useful to produce the best route when multiple routes exist between an input and output token.
 */
export class Aggregation {
  public readonly trades: Trade[]
  public readonly tradeType: TradeType
  public readonly inputAmount: TokenAmount
  public readonly outputAmount: TokenAmount
  public readonly executionPrice: Price

  public constructor(trades: Trade[]) {
    invariant(trades.length > 0, 'TRADES_LENGTH')
    const [first, ...others] = trades
    invariant(
      trades.every(trade => trade.inputAmount.token.equals(first.inputAmount.token)),
      'TRADES_INPUT_TOKEN'
    )
    invariant(
      trades.every(trade => trade.outputAmount.token.equals(first.outputAmount.token)),
      'TRADES_OUTPUT_TOKEN'
    )
    invariant(
      trades.every(trade => trade.tradeType === first.tradeType),
      'TRADES_TRADE_TYPE'
    )
    // sort them so we have deterministic order
    this.trades = [...trades].sort(inputOutputComparator)
    this.tradeType = first.tradeType
    this.inputAmount = others.reduce(
      (amount: TokenAmount, current: Trade) => amount.add(current.inputAmount),
      first.inputAmount
    )
    this.outputAmount = others.reduce(
      (amount: TokenAmount, current: Trade) => amount.add(current.outputAmount),
      first.outputAmount
    )
    this.executionPrice = new Price(
      this.inputAmount.token,
      this.outputAmount.token,
      this.inputAmount.raw,
      this.outputAmount.raw
    )
  }

  // given a list of pairs, return the aggregation that gives the best price for the amount of token in to the token out
  public static bestAggregationExactIn(
    pairs: Pair[],
    amountIn: TokenAmount,
    tokenOut: Token,
    { stepSize = DEFAULT_STEP_SIZE, maxNumResults = 3, maxHops = 3, maxNumTrades = 3 }: BestAggregationOptions = {},
    // used in recursion.
    currentTrades: Trade[] = [],
    bestAggregations: Aggregation[] = []
  ): Aggregation[] {
    invariant(pairs.length > 0, 'PAIRS')
    invariant(maxNumTrades > 0, 'MAX_NUM_TRADES') // 1 is equivalent to bestTradeExactIn
    invariant(maxHops > 0, 'MAX_HOPS')
    // if step size 1 is desired, use bestTrade
    invariant(stepSize.greaterThan(ZERO) && !stepSize.greaterThan(ONE_HALF), 'STEP_SIZE')
    // must evenly divide 1
    invariant(stepSize.invert().remainder.equalTo(ZERO), 'STEP_SIZE_EVENLY_DIVISIBLE')

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      // pair not relevant
      if (!pair.token0.equals(amountIn.token) && !pair.token1.equals(amountIn.token)) continue

      // if we can only make a single trade, we need to use the full input amount.
      const firstStepSize = maxNumTrades === 1 ? new Fraction(ONE) : stepSize

      for (let step = firstStepSize; !step.greaterThan(ONE); step = step.add(stepSize)) {
        const stepAmountIn = new TokenAmount(amountIn.token, step.multiply(amountIn.raw).quotient)
        let stepAmountOut: TokenAmount
        try {
          ;[stepAmountOut] = pair.getOutputAmount(stepAmountIn)
        } catch (error) {
          // this amount is too low to get anything from the pair, try the next step
          if (error instanceof InsufficientInputAmountError) {
            continue
          }
          throw error
        }

        // get the best trades starting from this amount for this pair
        let bestTradesStartingFromPair: Trade[] = []
        if (stepAmountOut.token === tokenOut) {
          // this hop terminates in the token out, consider the trade.
          bestTradesStartingFromPair = [
            new Trade(new Route([pair], stepAmountIn.token), stepAmountIn, TradeType.EXACT_INPUT)
          ]
        } else if (maxHops > 1 && pairs.length > 1) {
          bestTradesStartingFromPair = Trade.bestTradeExactIn(
            pairs.slice(0, i).concat(pairs.slice(i + 1, pairs.length)),
            stepAmountOut,
            tokenOut,
            { maxNumResults, maxHops: maxHops - 1 },
            [pair],
            stepAmountIn
          )
        }

        if (!step.equalTo(ONE)) {
          // these trades consume stepAmountIn of our input, so we consider them in combination with other aggregations
          bestTradesStartingFromPair.forEach(trade => {
            const afterPairs = pairsAfterTrade(pairs, trade)
            // combine with the best aggregation for the remaining amount
            Aggregation.bestAggregationExactIn(
              afterPairs.slice(0, i).concat(afterPairs.slice(i + 1, afterPairs.length)), // only consider pairs that aren't this one
              amountIn.subtract(stepAmountIn), // remainder of input to be spent
              tokenOut,
              { stepSize, maxNumResults, maxHops, maxNumTrades: maxNumTrades - 1 },
              [...currentTrades, trade],
              bestAggregations
            )
          })
        } else {
          // each of these trades consumes the full input amount, so we consider them on their own
          bestTradesStartingFromPair.forEach(trade => {
            sortedInsert(
              bestAggregations,
              new Aggregation([...currentTrades, trade]),
              maxNumResults,
              aggregationComparator
            )
          })
        }
      }
    }

    return bestAggregations
  }
}
