import { defaultAbiCoder } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'
import { BigintIsh, ChainId, Price, Token, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, FeeAmount, INIT_CODE_HASH } from '../constants'
import { getLiquidityForAmounts } from '../utils/getLiquidityForAmounts'
import { TickList } from './tickList'

export const computePoolAddress = ({
  factoryAddress,
  tokenA,
  tokenB,
  fee
}: {
  factoryAddress: string
  tokenA: Token
  tokenB: Token
  fee: FeeAmount
}): string => {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks
  return getCreate2Address(
    factoryAddress,
    keccak256(
      ['bytes'],
      [defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0.address, token1.address, fee])]
    ),
    INIT_CODE_HASH
  )
}

export class Pool {
  private readonly tokenAmounts: [TokenAmount, TokenAmount]
  private readonly fee: FeeAmount
  private readonly sqrtPriceX96: JSBI
  private readonly liquidity: JSBI
  private readonly ticks: TickList

  public static getAddress(tokenA: Token, tokenB: Token, fee: FeeAmount): string {
    return computePoolAddress({ factoryAddress: FACTORY_ADDRESS, fee, tokenA, tokenB })
  }

  public constructor(
    tokenAmountA: TokenAmount,
    tokenAmountB: TokenAmount,
    fee: FeeAmount,
    sqrtPriceX96: BigintIsh,
    inRangeLiquidity: BigintIsh,
    initializedTicks: TickList
  ) {
    invariant(Number.isInteger(fee), 'Fees can only be integer (uint24) values.')
    invariant(Boolean(initializedTicks?.head), 'Must have at least one initialized tick.')
    const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    this.tokenAmounts = tokenAmounts as [TokenAmount, TokenAmount]
    this.fee = fee
    this.sqrtPriceX96 = JSBI.BigInt(sqrtPriceX96)
    this.ticks = initializedTicks
    this.liquidity = JSBI.BigInt(inRangeLiquidity)
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pool in terms of token0, i.e. the ratio of reserve1 to reserve0
   */
  public get token0Price(): Price {
    invariant(this.sqrtPriceX96, 'todo')
    return new Price(this.token0, this.token1, this.tokenAmounts[0].raw, this.tokenAmounts[1].raw)
  }

  /**
   * Returns the current mid price of the pool in terms of token1, i.e. the ratio of reserve0 to reserve1
   */
  public get token1Price(): Price {
    invariant(this.sqrtPriceX96, 'todo')
    return new Price(this.token1, this.token0, this.tokenAmounts[1].raw, this.tokenAmounts[0].raw)
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

  public get feeLevel(): FeeAmount {
    return this.fee
  }

  public get inRangeLiquidity(): BigintIsh {
    return this.liquidity.toString()
  }

  public get tickList(): TickList {
    return this.ticks
  }

  public get token0(): Token {
    return this.tokenAmounts[0].token
  }

  public get token1(): Token {
    return this.tokenAmounts[1].token
  }

  public get reserve0(): TokenAmount {
    return this.tokenAmounts[0]
  }

  public get reserve1(): TokenAmount {
    return this.tokenAmounts[1]
  }
  public reserveOf(token: Token): TokenAmount {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.reserve0 : this.reserve1
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
    return getLiquidityForAmounts(this.sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1)
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
    invariant(false, 'todo')
  }
}
