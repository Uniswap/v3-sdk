import { BigintIsh, ChainId, Price, Token, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, FeeAmount, TICK_SPACINGS } from '../constants'
import { NEGATIVE_ONE, ONE, Q192, ZERO } from '../internalConstants'
import { computePoolAddress } from '../utils/computePoolAddress'
import { LiquidityMath } from '../utils/liquidityMath'
import { SwapMath } from '../utils/swapMath'
import { TickMath } from '../utils/tickMath'
import { Tick, TickConstructorArgs } from './tick'
import { NoTickDataProvider, TickDataProvider } from './tickDataProvider'
import { TickListDataProvider } from './tickListDataProvider'

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

/**
 * By default, pools will not allow operations that require ticks.
 */
const NO_TICK_DATA_PROVIDER_DEFAULT = new NoTickDataProvider()

/**
 * Represents a V3 pool
 */
export class Pool {
  public readonly token0: Token
  public readonly token1: Token
  public readonly fee: FeeAmount
  public readonly sqrtRatioX96: JSBI
  public readonly liquidity: JSBI
  public readonly tickCurrent: number
  public readonly tickDataProvider: TickDataProvider

  private _token0Price?: Price
  private _token1Price?: Price

  public static getAddress(tokenA: Token, tokenB: Token, fee: FeeAmount): string {
    return computePoolAddress({ factoryAddress: FACTORY_ADDRESS, fee, tokenA, tokenB })
  }

  /**
   * Construct a pool
   * @param tokenA one of the tokens in the pool
   * @param tokenB the other token in the pool
   * @param fee the fee in hundredths of a bips of the input amount of every swap that is collected by the pool
   * @param sqrtRatioX96 the sqrt of the current ratio of amounts of token1 to token0
   * @param liquidity the current value of in range liquidity
   * @param tickCurrent the current tick of the pool
   * @param ticks the current state of the pool ticks or a data provider that can return tick data
   */
  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    ticks: TickDataProvider | (Tick | TickConstructorArgs)[] = NO_TICK_DATA_PROVIDER_DEFAULT
  ) {
    invariant(Number.isInteger(fee) && fee < 1_000_000, 'FEE')

    const tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent)
    const nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent + 1)
    invariant(
      JSBI.greaterThanOrEqual(JSBI.BigInt(sqrtRatioX96), tickCurrentSqrtRatioX96) &&
        JSBI.lessThanOrEqual(JSBI.BigInt(sqrtRatioX96), nextTickSqrtRatioX96),
      'PRICE_BOUNDS'
    )
    // always create a copy of the list since we want the pool's tick list to be immutable
    ;[this.token0, this.token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    this.fee = fee
    this.sqrtRatioX96 = JSBI.BigInt(sqrtRatioX96)
    this.liquidity = JSBI.BigInt(liquidity)
    this.tickCurrent = tickCurrent
    this.tickDataProvider = Array.isArray(ticks) ? new TickListDataProvider(ticks, TICK_SPACINGS[fee]) : ticks
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pool in terms of token0, i.e. the ratio of token1 over token0
   */
  public get token0Price(): Price {
    return (
      this._token0Price ??
      (this._token0Price = new Price(
        this.token0,
        this.token1,
        Q192,
        JSBI.multiply(this.sqrtRatioX96, this.sqrtRatioX96)
      ))
    )
  }

  /**
   * Returns the current mid price of the pool in terms of token1, i.e. the ratio of token0 over token1
   */
  public get token1Price(): Price {
    return (
      this._token1Price ??
      (this._token1Price = new Price(
        this.token1,
        this.token0,
        JSBI.multiply(this.sqrtRatioX96, this.sqrtRatioX96),
        Q192
      ))
    )
  }

  /**
   * Return the price of the given token in terms of the other token in the pool.
   * @param token token to return price of
   */
  public priceOf(token: Token): Price {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.token0Price : this.token1Price
  }

  /**
   * Returns the chain ID of the tokens in the pool.
   */
  public get chainId(): ChainId | number {
    return this.token0.chainId
  }

  /**
   * Given an input amount of a token, return the computed output amount and a pool with state updated after the trade
   * @param inputAmount the input amount for which to quote the output amount
   */
  public async getOutputAmount(inputAmount: TokenAmount): Promise<[TokenAmount, Pool]> {
    invariant(this.involvesToken(inputAmount.token), 'TOKEN')

    const zeroForOne = inputAmount.token.equals(this.token0)

    const { amountCalculated: outputAmount, sqrtRatioX96, liquidity, tickCurrent } = await this.swap(
      zeroForOne,
      inputAmount.raw
    )
    const outputToken = zeroForOne ? this.token1 : this.token0
    return [
      new TokenAmount(outputToken, JSBI.multiply(outputAmount, NEGATIVE_ONE)),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider)
    ]
  }

  /**
   * Given a desired output amount of a token, return the computed input amount and a pool with state updated after the trade
   * @param outputAmount the output amount for which to quote the input amount
   */
  public async getInputAmount(outputAmount: TokenAmount): Promise<[TokenAmount, Pool]> {
    invariant(this.involvesToken(outputAmount.token), 'TOKEN')

    const zeroForOne = outputAmount.token.equals(this.token1)

    const { amountCalculated: inputAmount, sqrtRatioX96, liquidity, tickCurrent } = await this.swap(
      zeroForOne,
      JSBI.multiply(outputAmount.raw, NEGATIVE_ONE)
    )
    const inputToken = zeroForOne ? this.token0 : this.token1
    return [
      new TokenAmount(inputToken, inputAmount),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider)
    ]
  }

  private async swap(
    zeroForOne: boolean,
    amountSpecified: JSBI,
    sqrtPriceLimitX96?: JSBI
  ): Promise<{ amountCalculated: JSBI; sqrtRatioX96: JSBI; liquidity: JSBI; tickCurrent: number }> {
    if (!sqrtPriceLimitX96)
      sqrtPriceLimitX96 = zeroForOne
        ? JSBI.add(TickMath.MIN_SQRT_RATIO, ONE)
        : JSBI.subtract(TickMath.MAX_SQRT_RATIO, ONE)

    if (zeroForOne) {
      invariant(JSBI.greaterThan(sqrtPriceLimitX96, TickMath.MIN_SQRT_RATIO), 'RATIO_MIN')
      invariant(JSBI.lessThan(sqrtPriceLimitX96, this.sqrtRatioX96), 'RATIO_CURRENT')
    } else {
      invariant(JSBI.lessThan(sqrtPriceLimitX96, TickMath.MAX_SQRT_RATIO), 'RATIO_MAX')
      invariant(JSBI.greaterThan(sqrtPriceLimitX96, this.sqrtRatioX96), 'RATIO_CURRENT')
    }

    const exactInput = JSBI.greaterThanOrEqual(amountSpecified, ZERO)

    // keep track of swap state
    const state = {
      amountSpecifiedRemaining: amountSpecified,
      amountCalculated: ZERO,
      sqrtPriceX96: this.sqrtRatioX96,
      tick: this.tickCurrent,
      liquidity: this.liquidity
    }

    // start swap while loop
    while (JSBI.notEqual(state.amountSpecifiedRemaining, ZERO) && state.sqrtPriceX96 != sqrtPriceLimitX96) {
      let step: Partial<StepComputations> = {}
      step.sqrtPriceStartX96 = state.sqrtPriceX96

      // because each iteration of the while loop rounds, we can't optimize this code (relative to the smart contract)
      // by simply traversing to the next available tick, we instead need to exactly replicate
      // tickBitmap.nextInitializedTickWithinOneWord
      ;[step.tickNext, step.initialized] = await this.tickDataProvider.nextInitializedTickWithinOneWord(
        state.tick,
        zeroForOne,
        this.tickSpacing
      )

      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK
      }

      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext)
      ;[state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] = SwapMath.computeSwapStep(
        state.sqrtPriceX96,
        (zeroForOne
        ? JSBI.lessThan(step.sqrtPriceNextX96, sqrtPriceLimitX96)
        : JSBI.greaterThan(step.sqrtPriceNextX96, sqrtPriceLimitX96))
          ? sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        this.fee
      )

      if (exactInput) {
        state.amountSpecifiedRemaining = JSBI.subtract(
          state.amountSpecifiedRemaining,
          JSBI.add(step.amountIn, step.feeAmount)
        )
        state.amountCalculated = JSBI.subtract(state.amountCalculated, step.amountOut)
      } else {
        state.amountSpecifiedRemaining = JSBI.add(state.amountSpecifiedRemaining, step.amountOut)
        state.amountCalculated = JSBI.add(state.amountCalculated, JSBI.add(step.amountIn, step.feeAmount))
      }

      // TODO
      if (JSBI.equal(state.sqrtPriceX96, step.sqrtPriceNextX96)) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          let liquidityNet = JSBI.BigInt((await this.tickDataProvider.getTick(step.tickNext)).liquidityNet)
          // if we're moving leftward, we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (zeroForOne) liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)

          state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet)
        }

        state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96)
      }
    }

    return {
      amountCalculated: state.amountCalculated,
      sqrtRatioX96: state.sqrtPriceX96,
      liquidity: state.liquidity,
      tickCurrent: state.tick
    }
  }

  public get tickSpacing(): number {
    return TICK_SPACINGS[this.fee]
  }
}
