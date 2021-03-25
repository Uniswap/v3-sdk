import { BigintIsh, ChainId, Price, Token, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, FeeAmount } from '../constants'
import { Q192, ZERO } from '../internalConstants'
import { computePoolAddress } from '../utils/computePoolAddress'
import { getLiquidityForAmounts } from '../utils/getLiquidityForAmounts'
import { TickList } from './tickList'

export class Pool {
  public readonly token0: Token
  public readonly token1: Token
  public readonly fee: FeeAmount
  public readonly sqrtRatioX96: JSBI
  public readonly liquidity: JSBI
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
   * @param ticks the current state of the pool ticks
   */
  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    ticks: TickList
  ) {
    invariant(Number.isInteger(fee), 'Fees can only be integer (uint24) values.')
    invariant(
      Boolean(ticks?.head || JSBI.equal(JSBI.BigInt(liquidity), ZERO)),
      'Must have at least one initialized tick.'
    )
    ;[this.token0, this.token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    this.fee = fee
    this.sqrtRatioX96 = JSBI.BigInt(sqrtRatioX96)
    this.ticks = ticks
    this.liquidity = JSBI.BigInt(liquidity)
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

  public getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Pool] {
    invariant(this.involvesToken(inputAmount.token), 'TOKEN')
    throw new Error('todo')
  }

  public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Pool] {
    invariant(this.involvesToken(outputAmount.token), 'TOKEN')
    throw new Error('todo')
  }

  /**
   * Computes the maximum amount of liquidity received for a given amount of token0, token1,
   * and the prices at the tick boundaries.
   * @param sqrtRatioAX96 price at lower boundary
   * @param sqrtRatioBX96 price at upper boundary
   * @param amount0 token0 amount
   * @param amount1 token1 amount
   */
  public getLiquidityForAmounts(
    sqrtRatioAX96: JSBI,
    sqrtRatioBX96: JSBI,
    amount0: TokenAmount,
    amount1: TokenAmount
  ): JSBI {
    return getLiquidityForAmounts(this.sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1)
  }

  public getLiquidityValue(
    token: Token,
    totalSupply: TokenAmount,
    liquidity: TokenAmount,
    _: boolean = false,
    __?: BigintIsh
  ): TokenAmount {
    invariant(this.involvesToken(token), 'TOKEN')
    invariant(liquidity.raw <= totalSupply.raw, 'LIQUIDITY')
    throw new Error('todo')
  }
}
