import invariant from 'tiny-invariant'

import { TradeType } from '../constants'
import { Pair } from './pair'
import { Route } from './route'
import { TokenAmount } from './fractions'
import { Price } from './fractions/price'
import { Percent } from './fractions/percent'
import { Token } from 'entities/token'

function getSlippage(midPrice: Price, inputAmount: TokenAmount, outputAmount: TokenAmount): Percent {
  const exactQuote = midPrice.raw.multiply(inputAmount.raw)
  // calculate slippage := (exactQuote - outputAmount) / exactQuote
  const slippage = exactQuote.subtract(outputAmount.raw).divide(exactQuote)
  return new Percent(slippage.numerator, slippage.denominator)
}

// comparator function that allows sorting trades by their output amounts, in decreasing order, and then input amounts
// in decreasing order. i.e. the best trades have the most outputs for the least inputs
function naturalTradeComparator(tradeA: Trade, tradeB: Trade): number {
  // trades must start and end in the same token for comparison
  invariant(tradeA.outputAmount.token.equals(tradeB.outputAmount.token), 'TRADE_SORT_OUTPUT_TOKEN')
  invariant(tradeA.inputAmount.token.equals(tradeB.inputAmount.token), 'TRADE_SORT_INPUT_TOKEN')
  if (tradeA.outputAmount.equalTo(tradeB.outputAmount)) {
    if (tradeA.inputAmount.equalTo(tradeB.inputAmount)) {
      return 0
    }
    // trade A requires less input than trade B, so A should come first
    if (tradeA.inputAmount.lessThan(tradeB.inputAmount)) {
      return -1
    } else {
      return 1
    }
  } else {
    // tradeA has less output than trade B, so should come second
    if (tradeA.outputAmount.lessThan(tradeB.outputAmount)) {
      return 1
    } else {
      return -1
    }
  }
}

// given an array of trades sorted by best rate, add a trade and then remove the worst trade
// TODO(moodysalem): because this array is always sorted, we can do a binary search to find where to insert the
//  additional trade and avoid a pop
function sortedInsert(trades: Trade[], add: Trade, maxSize: number): Trade | null {
  trades.push(add)
  trades.sort(naturalTradeComparator)
  if (trades.length > maxSize) {
    return trades.pop()!
  }
  return null
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
    this.nextMidPrice = Price.fromRoute(new Route(nextPairs, route.input))
    this.slippage = getSlippage(route.midPrice, inputAmount, outputAmount)
  }

  // given a list of pairs, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
  // amount to an output token, making at most `maxHops` hops
  // note this does not consider aggregation, as routes are linear. it's possible a better route exists by splitting
  // the amount in among multiple routes.
  static bestTradeExactIn(
    pairs: Pair[],
    amountIn: TokenAmount,
    tokenOut: Token,
    { maxNumResults = 3, maxHops = 3 }: { maxNumResults?: number; maxHops?: number } = {
      maxNumResults: 3,
      maxHops: 3
    },
    // these are only used in recursion.
    currentPairs: Pair[] = [],
    originalAmountIn: TokenAmount = amountIn,
    bestTrades: Trade[] = []
  ): Trade[] {
    invariant(pairs.length !== 0, 'PAIRS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(originalAmountIn === amountIn || currentPairs.length > 0, 'INVALID_RECURSION')

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      // pair irrelevant
      if (!pair.token0.equals(amountIn.token) && !pair.token1.equals(amountIn.token)) continue

      const [amountOut] = pair.getOutputAmount(amountIn)
      // we have arrived at the output token, so this is the final trade of one of the paths
      if (amountOut.token.equals(tokenOut)) {
        sortedInsert(
          bestTrades,
          new Trade(
            new Route([...currentPairs, pair], originalAmountIn.token),
            originalAmountIn,
            TradeType.EXACT_INPUT
          ),
          maxNumResults
        )
      } else if (maxHops > 1) {
        const pairsExcludingThisPair = pairs.slice(0, i).concat(pairs.slice(i + 1, pairs.length))

        // otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
        Trade.bestTradeExactIn(
          pairsExcludingThisPair,
          amountOut,
          tokenOut,
          {
            maxNumResults,
            maxHops: maxHops - 1
          },
          [...currentPairs, pair],
          originalAmountIn,
          bestTrades
        )
      }
    }

    return bestTrades
  }
}
