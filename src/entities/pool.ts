import { babylonianSqrt, BigintIsh, ChainId, Price, Token, TokenAmount } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { pack, keccak256 } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'

import { FACTORY_ADDRESS, INIT_CODE_HASH, MINIMUM_LIQUIDITY, ZERO, ONE, _997, _1000 } from '../constants'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'

export class Pool {
  public readonly liquidityToken: Token
  private readonly tokenAmounts: [TokenAmount, TokenAmount]

  public static getAddress(tokenA: Token, tokenB: Token): string {
    const tokens = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

    return getCreate2Address(
      FACTORY_ADDRESS,
      keccak256(['bytes'], [pack(['address', 'address'], [tokens[0].address, tokens[1].address])]),
      INIT_CODE_HASH
    )
  }

  public constructor(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount) {
    const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    this.liquidityToken = new Token(
      tokenAmounts[0].token.chainId,
      Pool.getAddress(tokenAmounts[0].token, tokenAmounts[1].token),
      18,
      'UNI-V2',
      'Uniswap V2'
    )
    this.tokenAmounts = tokenAmounts as [TokenAmount, TokenAmount]
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
    return new Price(this.token0, this.token1, this.tokenAmounts[0].raw, this.tokenAmounts[1].raw)
  }

  /**
   * Returns the current mid price of the pool in terms of token1, i.e. the ratio of reserve0 to reserve1
   */
  public get token1Price(): Price {
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
  public get chainId(): ChainId {
    return this.token0.chainId
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
    if (this.reserve0.raw === ZERO || this.reserve1.raw === ZERO) {
      throw new InsufficientReservesError()
    }
    const inputReserve = this.reserveOf(inputAmount.token)
    const outputReserve = this.reserveOf(inputAmount.token.equals(this.token0) ? this.token1 : this.token0)
    const inputAmountWithFee = inputAmount.raw * _997
    const numerator = inputAmountWithFee * outputReserve.raw
    const denominator = inputReserve.raw * _1000 + inputAmountWithFee
    const outputAmount = new TokenAmount(
      inputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      numerator / denominator
    )
    if (outputAmount.raw === ZERO) {
      throw new InsufficientInputAmountError()
    }
    return [outputAmount, new Pool(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }

  public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Pool] {
    invariant(this.involvesToken(outputAmount.token), 'TOKEN')
    if (
      this.reserve0.raw === ZERO ||
      this.reserve1.raw === ZERO ||
      outputAmount.raw >= this.reserveOf(outputAmount.token).raw
    ) {
      throw new InsufficientReservesError()
    }

    const outputReserve = this.reserveOf(outputAmount.token)
    const inputReserve = this.reserveOf(outputAmount.token.equals(this.token0) ? this.token1 : this.token0)
    const numerator = inputReserve.raw * outputAmount.raw * _1000
    const denominator = (outputReserve.raw - outputAmount.raw) * _997
    const inputAmount = new TokenAmount(
      outputAmount.token.equals(this.token0) ? this.token1 : this.token0,
      numerator / denominator + ONE
    )
    return [inputAmount, new Pool(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }

  public getLiquidityMinted(
    totalSupply: TokenAmount,
    tokenAmountA: TokenAmount,
    tokenAmountB: TokenAmount
  ): TokenAmount {
    invariant(totalSupply.token.equals(this.liquidityToken), 'LIQUIDITY')
    const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')

    let liquidity: bigint
    if (totalSupply.raw === ZERO) {
      liquidity = babylonianSqrt(tokenAmounts[0].raw * tokenAmounts[1].raw) - MINIMUM_LIQUIDITY
    } else {
      const amount0 = (tokenAmounts[0].raw * totalSupply.raw) / this.reserve0.raw
      const amount1 = (tokenAmounts[1].raw * totalSupply.raw) / this.reserve1.raw
      liquidity = amount0 <= amount1 ? amount0 : amount1
    }
    if (liquidity <= ZERO) {
      throw new InsufficientInputAmountError()
    }
    return new TokenAmount(this.liquidityToken, liquidity)
  }

  public getLiquidityValue(
    token: Token,
    totalSupply: TokenAmount,
    liquidity: TokenAmount,
    _: boolean = false,
    __?: BigintIsh
  ): TokenAmount {
    invariant(this.involvesToken(token), 'TOKEN')
    invariant(totalSupply.token.equals(this.liquidityToken), 'TOTAL_SUPPLY')
    invariant(liquidity.token.equals(this.liquidityToken), 'LIQUIDITY')
    invariant(liquidity.raw <= totalSupply.raw, 'LIQUIDITY')
    invariant(false, 'todo')
  }
}
