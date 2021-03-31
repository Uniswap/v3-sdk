import { BigintIsh, ChainId, Price, Token, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, FeeAmount, MAX_SQRT_RATIO, MIN_SQRT_RATIO, TICK_SPACINGS } from '../constants'
import { Q192, NEGATIVE_ONE, ZERO } from '../internalConstants'
import { computePoolAddress } from '../utils/computePoolAddress'
import { TickMath } from '../utils/tickMath'
import { TickList } from './tickList'

interface StepComputations {
  sqrtPriceStartX96: JSBI
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

export class Pool {
  public readonly token0: Token
  public readonly token1: Token
  public readonly fee: FeeAmount
  public readonly sqrtRatioX96: JSBI
  public readonly liquidity: JSBI
  public readonly tickCurrent: number
  public readonly ticks: TickList

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
   * @param ticks the current state of the pool ticks
   */
  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    ticks: TickList
  ) {
    invariant(Number.isInteger(fee) && fee < 1_000_000, 'FEE')

    const tickCurrentSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent)
    const nextTickSqrtRatioX96 = TickMath.getSqrtRatioAtTick(tickCurrent + 1)
    invariant(
      JSBI.greaterThanOrEqual(JSBI.BigInt(sqrtRatioX96), tickCurrentSqrtRatioX96) &&
        JSBI.lessThanOrEqual(JSBI.BigInt(sqrtRatioX96), nextTickSqrtRatioX96),
      'PRICE_BOUNDS'
    )
    ;[this.token0, this.token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    this.fee = fee
    this.sqrtRatioX96 = JSBI.BigInt(sqrtRatioX96)
    this.liquidity = JSBI.BigInt(liquidity)
    this.tickCurrent = tickCurrent
    this.ticks = ticks
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

  public getOutputAmount(inputAmount: TokenAmount): TokenAmount {
    invariant(this.involvesToken(inputAmount.token), 'TOKEN')

    const zeroForOne = inputAmount.token.equals(this.token0)

    const outputAmount = this.swap(zeroForOne, inputAmount.raw)
    const outputToken = zeroForOne ? this.token1 : this.token0
    return new TokenAmount(outputToken, outputAmount)
  }

  public getInputAmount(outputAmount: TokenAmount): TokenAmount {
    invariant(this.involvesToken(outputAmount.token), 'TOKEN')

    const zeroForOne = outputAmount.token.equals(this.token1)

    const inputAmount = this.swap(zeroForOne, JSBI.multiply(outputAmount.raw, NEGATIVE_ONE))
    const outputToken = zeroForOne ? this.token1 : this.token0
    return new TokenAmount(outputToken, inputAmount)
  }

  private swap(zeroForOne: boolean, amountSpecified: JSBI, sqrtPriceLimitX96?: JSBI): JSBI {
    invariant(JSBI.notEqual(amountSpecified, ZERO), 'ZERO')

    if (!sqrtPriceLimitX96) sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO

    if (zeroForOne) {
      invariant(sqrtPriceLimitX96 >= MIN_SQRT_RATIO, 'RATIO_MIN')
      invariant(sqrtPriceLimitX96 < this.sqrtRatioX96, 'RATIO_CURRENT')
    } else {
      invariant(sqrtPriceLimitX96 <= MAX_SQRT_RATIO, 'RATIO_MAX')
      invariant(sqrtPriceLimitX96 > this.sqrtRatioX96, 'RATIO_CURRENT')
    }

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
      ;[step.tickNext, step.initialized] = this.ticks.nextInitializedTickWithinOneWord(state.tick, zeroForOne)
    }

    return ZERO
  }

  public get tickSpacing(): number {
    return TICK_SPACINGS[this.fee]
  }
}
