import {
  ChainId,
  Currency,
  CurrencyAmount,
  currencyEquals,
  ETHER,
  Fraction,
  Percent,
  Price,
  sortedInsert,
  Token,
  TokenAmount,
  TradeType,
  WETH9
} from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { ONE, ZERO } from '../internalConstants'
import { Pool } from './pool'
import { Route } from './route'

// extension of the input output comparator that also considers other dimensions of the trade in ranking them
export function tradeComparator(a: Trade, b: Trade) {
  // must have same input and output token for comparison
  invariant(currencyEquals(a.inputAmount.currency, b.inputAmount.currency), 'INPUT_CURRENCY')
  invariant(currencyEquals(a.outputAmount.currency, b.outputAmount.currency), 'OUTPUT_CURRENCY')
  if (a.outputAmount.equalTo(b.outputAmount)) {
    if (a.inputAmount.equalTo(b.inputAmount)) {
      // consider the number of hops since each hop costs gas
      return a.route.tokenPath.length - b.route.tokenPath.length
    }
    // trade A requires less input than trade B, so A should come first
    if (a.inputAmount.lessThan(b.inputAmount)) {
      return -1
    } else {
      return 1
    }
  } else {
    // tradeA has less output than trade B, so should come second
    if (a.outputAmount.lessThan(b.outputAmount)) {
      return 1
    } else {
      return -1
    }
  }
}

export interface BestTradeOptions {
  // how many results to return
  maxNumResults?: number
  // the maximum number of hops a trade should contain
  maxHops?: number
}

/**
 * Given a currency amount and a chain ID, returns the equivalent representation as the token amount.
 * In other words, if the currency is ETHER, returns the WETH9 token amount for the given chain. Otherwise, returns
 * the input currency amount.
 */
function wrappedAmount(currencyAmount: CurrencyAmount, chainId: ChainId): TokenAmount {
  if (currencyAmount instanceof TokenAmount) return currencyAmount
  if (currencyAmount.currency === ETHER) return new TokenAmount(WETH9[chainId], currencyAmount.raw)
  invariant(false, 'CURRENCY')
}

function wrappedCurrency(currency: Currency, chainId: ChainId): Token {
  if (currency instanceof Token) return currency
  if (currency === ETHER) return WETH9[chainId]
  invariant(false, 'CURRENCY')
}

/**
 * Represents a trade executed against a list of pools.
 * Does not account for slippage, i.e. trades that front run this trade and move the price.
 */
export class Trade {
  /**
   * The route of the trade, i.e. which pools the trade goes through.
   */
  public readonly route: Route
  /**
   * The type of the trade, either exact in or exact out.
   */
  public readonly tradeType: TradeType
  /**
   * The input amount for the trade assuming no slippage.
   */
  public readonly inputAmount: CurrencyAmount
  /**
   * The output amount for the trade assuming no slippage.
   */
  public readonly outputAmount: CurrencyAmount

  /**
   * The cached result of the computed execution price
   * @private
   */
  private _executionPrice: Price | undefined
  /**
   * The price expressed in terms of output amount/input amount.
   */
  public get executionPrice(): Price {
    return (
      this._executionPrice ??
      (this._executionPrice = new Price(
        this.inputAmount.currency,
        this.outputAmount.currency,
        this.inputAmount.raw,
        this.outputAmount.raw
      ))
    )
  }

  /**
   * Constructs an exact in trade with the given amount in and route
   * @param route route of the exact in trade
   * @param amountIn the amount being passed in
   */
  public static async exactIn(route: Route, amountIn: CurrencyAmount): Promise<Trade> {
    return Trade.fromRoute(route, amountIn, TradeType.EXACT_INPUT)
  }

  /**
   * Constructs an exact out trade with the given amount out and route
   * @param route route of the exact out trade
   * @param amountOut the amount returned by the trade
   */
  public static async exactOut(route: Route, amountOut: CurrencyAmount): Promise<Trade> {
    return Trade.fromRoute(route, amountOut, TradeType.EXACT_OUTPUT)
  }

  /**
   * Constructs a trade by simulating swaps through the given route
   * @param route route to swap through
   * @param amount the amount specified, either input or output, depending on tradeType
   * @param tradeType whether the trade is an exact input or exact output swap
   */
  public static async fromRoute(route: Route, amount: CurrencyAmount, tradeType: TradeType): Promise<Trade> {
    const amounts: TokenAmount[] = new Array(route.tokenPath.length)
    if (tradeType === TradeType.EXACT_INPUT) {
      invariant(currencyEquals(amount.currency, route.input), 'INPUT')
      amounts[0] = wrappedAmount(amount, route.chainId)
      for (let i = 0; i < route.tokenPath.length - 1; i++) {
        const pool = route.pools[i]
        const [outputAmount] = await pool.getOutputAmount(amounts[i])
        amounts[i + 1] = outputAmount
      }
    } else {
      invariant(currencyEquals(amount.currency, route.output), 'OUTPUT')
      amounts[amounts.length - 1] = wrappedAmount(amount, route.chainId)
      for (let i = route.tokenPath.length - 1; i > 0; i--) {
        const pool = route.pools[i - 1]
        const [inputAmount] = await pool.getInputAmount(amounts[i])
        amounts[i - 1] = inputAmount
      }
    }

    const inputAmount =
      tradeType === TradeType.EXACT_INPUT
        ? amount
        : route.input === ETHER
        ? CurrencyAmount.ether(amounts[0].raw)
        : amounts[0]
    const outputAmount =
      tradeType === TradeType.EXACT_OUTPUT
        ? amount
        : route.output === ETHER
        ? CurrencyAmount.ether(amounts[amounts.length - 1].raw)
        : amounts[amounts.length - 1]
    return new Trade({
      route,
      tradeType,
      inputAmount,
      outputAmount
    })
  }

  /**
   * Creates a trade without computing the result of swapping through the route. Useful when you have simulated the trade
   * elsewhere and do not have any tick data
   * @param constructorArguments the arguments passed to the trade constructor
   */
  public static createUncheckedTrade(constructorArguments: {
    route: Route
    inputAmount: CurrencyAmount
    outputAmount: CurrencyAmount
    tradeType: TradeType
  }): Trade {
    return new Trade(constructorArguments)
  }

  /**
   * Construct a trade by passing in the pre-computed property values
   * @param route the route through which the trade occurs
   * @param inputAmount the amount of input paid in the trade
   * @param outputAmount the amount of output received in the trade
   * @param tradeType the type of trade, exact input or exact output
   */
  private constructor({
    route,
    inputAmount,
    outputAmount,
    tradeType
  }: {
    route: Route
    inputAmount: CurrencyAmount
    outputAmount: CurrencyAmount
    tradeType: TradeType
  }) {
    invariant(currencyEquals(inputAmount.currency, route.input), 'INPUT_CURRENCY_MATCH')
    invariant(currencyEquals(outputAmount.currency, route.output), 'OUTPUT_CURRENCY_MATCH')
    this.route = route
    this.inputAmount = inputAmount
    this.outputAmount = outputAmount
    this.tradeType = tradeType
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance tolerance of unfavorable slippage from the execution price of this trade
   */
  public minimumAmountOut(slippageTolerance: Percent): CurrencyAmount {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return this.outputAmount
    } else {
      const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(slippageTolerance)
        .invert()
        .multiply(this.outputAmount.raw).quotient
      return this.outputAmount instanceof TokenAmount
        ? new TokenAmount(this.outputAmount.token, slippageAdjustedAmountOut)
        : CurrencyAmount.ether(slippageAdjustedAmountOut)
    }
  }

  /**
   * Get the maximum amount in that can be spent via this trade for the given slippage tolerance
   * @param slippageTolerance tolerance of unfavorable slippage from the execution price of this trade
   */
  public maximumAmountIn(slippageTolerance: Percent): CurrencyAmount {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return this.inputAmount
    } else {
      const slippageAdjustedAmountIn = new Fraction(ONE).add(slippageTolerance).multiply(this.inputAmount.raw).quotient
      return this.inputAmount instanceof TokenAmount
        ? new TokenAmount(this.inputAmount.token, slippageAdjustedAmountIn)
        : CurrencyAmount.ether(slippageAdjustedAmountIn)
    }
  }

  /**
   * Return the execution price after accounting for slippage tolerance
   * @param slippageTolerance the allowed tolerated slippage
   */
  public worstExecutionPrice(slippageTolerance: Percent): Price {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).raw,
      this.minimumAmountOut(slippageTolerance).raw
    )
  }

  /**
   * Given a list of pools, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
   * amount to an output token, making at most `maxHops` hops.
   * Note this does not consider aggregation, as routes are linear. It's possible a better route exists by splitting
   * the amount in among multiple routes.
   * @param pools the pools to consider in finding the best trade
   * @param currencyAmountIn exact amount of input currency to spend
   * @param currencyOut the desired currency out
   * @param maxNumResults maximum number of results to return
   * @param maxHops maximum number of hops a returned trade can make, e.g. 1 hop goes through a single pool
   * @param currentPools used in recursion; the current list of pools
   * @param originalAmountIn used in recursion; the original value of the currencyAmountIn parameter
   * @param bestTrades used in recursion; the current list of best trades
   */
  public static async bestTradeExactIn(
    pools: Pool[],
    currencyAmountIn: CurrencyAmount,
    currencyOut: Currency,
    { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
    // used in recursion.
    currentPools: Pool[] = [],
    originalAmountIn: CurrencyAmount = currencyAmountIn,
    bestTrades: Trade[] = []
  ): Promise<Trade[]> {
    invariant(pools.length > 0, 'POOLS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(originalAmountIn === currencyAmountIn || currentPools.length > 0, 'INVALID_RECURSION')
    const chainId: ChainId | undefined =
      currencyAmountIn instanceof TokenAmount
        ? currencyAmountIn.token.chainId
        : currencyOut instanceof Token
        ? currencyOut.chainId
        : undefined
    invariant(chainId !== undefined, 'CHAIN_ID')

    const amountIn = wrappedAmount(currencyAmountIn, chainId)
    const tokenOut = wrappedCurrency(currencyOut, chainId)
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]
      // pool irrelevant
      if (!pool.token0.equals(amountIn.token) && !pool.token1.equals(amountIn.token)) continue

      let amountOut: TokenAmount
      try {
        ;[amountOut] = await pool.getOutputAmount(amountIn)
      } catch (error) {
        // input too low
        if (error.isInsufficientInputAmountError) {
          continue
        }
        throw error
      }
      // we have arrived at the output token, so this is the final trade of one of the paths
      if (amountOut.token.equals(tokenOut)) {
        sortedInsert(
          bestTrades,
          await Trade.fromRoute(
            new Route([...currentPools, pool], originalAmountIn.currency, currencyOut),
            originalAmountIn,
            TradeType.EXACT_INPUT
          ),
          maxNumResults,
          tradeComparator
        )
      } else if (maxHops > 1 && pools.length > 1) {
        const poolsExcludingThisPool = pools.slice(0, i).concat(pools.slice(i + 1, pools.length))

        // otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
        await Trade.bestTradeExactIn(
          poolsExcludingThisPool,
          amountOut,
          currencyOut,
          {
            maxNumResults,
            maxHops: maxHops - 1
          },
          [...currentPools, pool],
          originalAmountIn,
          bestTrades
        )
      }
    }

    return bestTrades
  }

  /**
   * similar to the above method but instead targets a fixed output amount
   * given a list of pools, and a fixed amount out, returns the top `maxNumResults` trades that go from an input token
   * to an output token amount, making at most `maxHops` hops
   * note this does not consider aggregation, as routes are linear. it's possible a better route exists by splitting
   * the amount in among multiple routes.
   * @param pools the pools to consider in finding the best trade
   * @param currencyIn the currency to spend
   * @param currencyAmountOut the exact amount of currency out
   * @param maxNumResults maximum number of results to return
   * @param maxHops maximum number of hops a returned trade can make, e.g. 1 hop goes through a single pool
   * @param currentPools used in recursion; the current list of pools
   * @param originalAmountOut used in recursion; the original value of the currencyAmountOut parameter
   * @param bestTrades used in recursion; the current list of best trades
   */
  public static async bestTradeExactOut(
    pools: Pool[],
    currencyIn: Currency,
    currencyAmountOut: CurrencyAmount,
    { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
    // used in recursion.
    currentPools: Pool[] = [],
    originalAmountOut: CurrencyAmount = currencyAmountOut,
    bestTrades: Trade[] = []
  ): Promise<Trade[]> {
    invariant(pools.length > 0, 'POOLS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(originalAmountOut === currencyAmountOut || currentPools.length > 0, 'INVALID_RECURSION')
    const chainId: ChainId | undefined =
      currencyAmountOut instanceof TokenAmount
        ? currencyAmountOut.token.chainId
        : currencyIn instanceof Token
        ? currencyIn.chainId
        : undefined
    invariant(chainId !== undefined, 'CHAIN_ID')

    const amountOut = wrappedAmount(currencyAmountOut, chainId)
    const tokenIn = wrappedCurrency(currencyIn, chainId)
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]
      // pool irrelevant
      if (!pool.token0.equals(amountOut.token) && !pool.token1.equals(amountOut.token)) continue

      let amountIn: TokenAmount
      try {
        ;[amountIn] = await pool.getInputAmount(amountOut)
      } catch (error) {
        // not enough liquidity in this pool
        if (error.isInsufficientReservesError) {
          continue
        }
        throw error
      }
      // we have arrived at the input token, so this is the first trade of one of the paths
      if (amountIn.token.equals(tokenIn)) {
        sortedInsert(
          bestTrades,
          await Trade.fromRoute(
            new Route([pool, ...currentPools], currencyIn, originalAmountOut.currency),
            originalAmountOut,
            TradeType.EXACT_OUTPUT
          ),
          maxNumResults,
          tradeComparator
        )
      } else if (maxHops > 1 && pools.length > 1) {
        const poolsExcludingThisPool = pools.slice(0, i).concat(pools.slice(i + 1, pools.length))

        // otherwise, consider all the other paths that arrive at this token as long as we have not exceeded maxHops
        await Trade.bestTradeExactOut(
          poolsExcludingThisPool,
          currencyIn,
          amountIn,
          {
            maxNumResults,
            maxHops: maxHops - 1
          },
          [pool, ...currentPools],
          originalAmountOut,
          bestTrades
        )
      }
    }

    return bestTrades
  }
}
