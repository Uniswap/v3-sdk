import { BigintIsh, MaxUint256, Price, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'
import { maxLiquidityForAmounts } from '../utils/maxLiquidityForAmounts'
import { tickToPrice } from '../utils/priceTickConversions'
import { SqrtPriceMath } from '../utils/sqrtPriceMath'
import { TickMath } from '../utils/tickMath'
import { Pool } from './pool'

interface PositionConstructorArgs {
  pool: Pool
  tickLower: number
  tickUpper: number
  liquidity: BigintIsh
}

/**
 * Represents a position on a Uniswap V3 Pool
 */
export class Position {
  public readonly pool: Pool
  public readonly tickLower: number
  public readonly tickUpper: number
  public readonly liquidity: JSBI

  // cached resuts for the getters
  private _token0Amount: TokenAmount | null = null
  private _token1Amount: TokenAmount | null = null
  private _mintAmounts: Readonly<{ amount0: JSBI; amount1: JSBI }> | null = null

  /**
   * Constructs a position for a given pool with the given liquidity
   * @param pool for which pool the liquidity is assigned
   * @param liquidity the amount of liquidity that is in the position
   * @param tickLower the lower tick of the position
   * @param tickUpper the upper tick of the position
   */
  public constructor({ pool, liquidity, tickLower, tickUpper }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, 'TICK_ORDER')
    invariant(tickLower >= TickMath.MIN_TICK && tickLower % pool.tickSpacing === 0, 'TICK_LOWER')
    invariant(tickUpper <= TickMath.MAX_TICK && tickUpper % pool.tickSpacing === 0, 'TICK_UPPER')

    this.pool = pool
    this.tickLower = tickLower
    this.tickUpper = tickUpper
    this.liquidity = JSBI.BigInt(liquidity)
  }

  /**
   * Returns the price of token0 at the lower tick
   */
  public get token0PriceLower(): Price {
    return tickToPrice(this.pool.token0, this.pool.token1, this.tickLower)
  }

  /**
   * Returns the price of token0 at the upper tick
   */
  public get token0PriceUpper(): Price {
    return tickToPrice(this.pool.token0, this.pool.token1, this.tickUpper)
  }

  /**
   * Returns the amount of token0 that this position's liquidity could be burned for at the current pool price
   */
  public get amount0(): TokenAmount {
    if (this._token0Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token0Amount = new TokenAmount(
          this.pool.token0,
          SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            false
          )
        )
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token0Amount = new TokenAmount(
          this.pool.token0,
          SqrtPriceMath.getAmount0Delta(
            this.pool.sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            false
          )
        )
      } else {
        this._token0Amount = new TokenAmount(this.pool.token0, ZERO)
      }
    }
    return this._token0Amount
  }

  /**
   * Returns the amount of token1 that this position's liquidity could be burned for at the current pool price
   */
  public get amount1(): TokenAmount {
    if (this._token1Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token1Amount = new TokenAmount(this.pool.token1, ZERO)
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token1Amount = new TokenAmount(
          this.pool.token1,
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            this.pool.sqrtRatioX96,
            this.liquidity,
            false
          )
        )
      } else {
        this._token1Amount = new TokenAmount(
          this.pool.token1,
          SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            false
          )
        )
      }
    }
    return this._token1Amount
  }

  /**
   * Returns the minimum amount that must be sent in order to mint the amount of liquidity held by the position at
   * the current price for the pool
   */
  public get mintAmounts(): Readonly<{ amount0: JSBI; amount1: JSBI }> {
    if (this._mintAmounts === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        return {
          amount0: SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          ),
          amount1: ZERO
        }
      } else if (this.pool.tickCurrent < this.tickUpper) {
        return {
          amount0: SqrtPriceMath.getAmount0Delta(
            this.pool.sqrtRatioX96,
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          ),
          amount1: SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            this.pool.sqrtRatioX96,
            this.liquidity,
            true
          )
        }
      } else {
        return {
          amount0: ZERO,
          amount1: SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(this.tickLower),
            TickMath.getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          )
        }
      }
    }
    return this._mintAmounts
  }

  /**
   * Computes the maximum amount of liquidity received for a given amount of token0, token1,
   * and the prices at the tick boundaries.
   * @param pool the pool for which the position should be created
   * @param tickLower the lower tick of the position
   * @param tickUpper the upper tick of the position
   * @param amount0 token0 amount
   * @param amount1 token1 amount
   */
  public static fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0,
    amount1
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
    amount1: BigintIsh
  }) {
    const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower)
    const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper)
    return new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: maxLiquidityForAmounts(pool.sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1)
    })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token0, assuming an unlimited amount of token1
   * @param pool the pool for which the position is created
   * @param tickLower the lower tick
   * @param tickUpper the upper tick
   * @param amount0 the desired amount of token0
   */
  public static fromAmount0({
    pool,
    tickLower,
    tickUpper,
    amount0
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
  }) {
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0, amount1: MaxUint256 })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token1, assuming an unlimited amount of token0
   * @param pool the pool for which the position is created
   * @param tickLower the lower tick
   * @param tickUpper the upper tick
   * @param amount1 the desired amount of token1
   */
  public static fromAmount1({
    pool,
    tickLower,
    tickUpper,
    amount1
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount1: BigintIsh
  }) {
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0: MaxUint256, amount1 })
  }
}
