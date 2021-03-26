import { BigintIsh, MaxUint256, Percent, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { MAX_TICK, MIN_TICK } from '../constants'
import { maxLiquidityForAmounts } from '../utils/maxLiquidityForAmounts'
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

  public constructor({ pool, liquidity, tickLower, tickUpper }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, 'TICK_ORDER')
    invariant(tickLower >= MIN_TICK && tickLower % pool.tickSpacing === 0, 'TICK_LOWER')
    invariant(tickUpper <= MAX_TICK && tickUpper % pool.tickSpacing === 0, 'TICK_UPPER')

    this.pool = pool
    this.tickLower = tickLower
    this.tickUpper = tickUpper
    this.liquidity = JSBI.BigInt(liquidity)
  }

  /**
   * Returns the amount of token0 that this position represents
   */
  public get amount0(): TokenAmount {
    throw new Error('todo')
  }
  /**
   * Returns the amount of token1 that this position represents
   */
  public get amount1(): TokenAmount {
    throw new Error('todo')
  }

  /**
   * Compute the maximum amount of token0 that should be spent to produce the amount of liquidity in this position, given
   * some tolerance of price movement
   */
  public maxAmount0(_slippageTolerance: Percent): TokenAmount {
    throw new Error('todo')
  }

  /**
   * Compute the maximum amount of token1 that should be spent to produce the amount of liquidity in this position, given
   * some tolerance of price movement
   */
  public maxAmount1(_slippageTolerance: Percent): TokenAmount {
    throw new Error('todo')
  }

  /**
   * Returns a number representing the amount of capital required to produce this position relative to amount of capital
   * required for a V2 position
   */
  public get capitalEfficiency(): number {
    throw new Error('todo')
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
