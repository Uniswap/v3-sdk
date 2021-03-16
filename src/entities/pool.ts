import { defaultAbiCoder } from '@ethersproject/abi'
import { getCreate2Address } from '@ethersproject/address'
import { keccak256 } from '@ethersproject/solidity'
import { BigintIsh, ChainId, Token, TokenAmount } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import {
  FACTORY_ADDRESS,
  FeeAmount,
  INIT_CODE_HASH,
  getMinTick,
  getMaxTick,
  NEGATIVE_ONE,
  ZERO,
  ONE
} from '../constants'

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

interface PopulatedTick {
  tick: number
  liquidityNet: BigintIsh
  liquidityGross: BigintIsh
}

type PopulatedTicks = PopulatedTick[]

export class Pool {
  private readonly tokens: [Token, Token]
  public readonly fee: FeeAmount
  public readonly sqrtPriceX96: JSBI
  private readonly tick: number
  public readonly liquidity: JSBI
  private readonly populatedTicks: PopulatedTicks

  public static getAddress(tokenA: Token, tokenB: Token, fee: FeeAmount): string {
    return computePoolAddress({ factoryAddress: FACTORY_ADDRESS, fee, tokenA, tokenB })
  }

  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    tickSpacing: number,
    sqrtPriceX96: BigintIsh,
    tick: number,
    liquidity: BigintIsh,
    populatedTicks?: PopulatedTicks
  ) {
    invariant(Number.isInteger(fee), 'Fees can only be integer (uint24) values.')
    invariant(Number.isInteger(fee), 'Fees can only be integer (uint24) values.')
    invariant(Number.isInteger(tick), 'Ticks can only be integer (int24) values.')

    const tokens = (tokenA.sortsBefore(tokenB) // does safety checks
      ? [tokenA, tokenB]
      : [tokenB, tokenA]) as [Token, Token]

    // if populatedTicks was not provided, assume all liquidity is max range
    populatedTicks = populatedTicks ?? [
      { tick: getMinTick(tickSpacing), liquidityNet: liquidity, liquidityGross: liquidity },
      { tick: getMaxTick(tickSpacing), liquidityNet: -JSBI.BigInt(liquidity), liquidityGross: liquidity }
    ]
    // ensure that net liquidityNet is 0
    const liquidityNetNet = populatedTicks.reduce(
      (accumulator, current) => JSBI.add(accumulator, JSBI.BigInt(current.liquidityNet)),
      ZERO
    )
    invariant(JSBI.equal(liquidityNetNet, ZERO), 'Net liquidity is not 0.')

    this.tokens = tokens
    this.fee = fee
    this.sqrtPriceX96 = JSBI.BigInt(sqrtPriceX96)
    this.tick = tick
    this.liquidity = JSBI.BigInt(liquidity)
    this.populatedTicks =
      populatedTicks
        ?.slice()
        ?.reverse()
        ?.sort((a, b) => (a.tick < b.tick ? -1 : 1)) ?? []
  }

  public liquidityAtTick(tick: number) {
    invariant(Number.isInteger(tick), 'Ticks can only be integer (int24) values.')

    let liquidity = this.liquidity
    // get the largest populated tick index at or below the current tick
    // this only works because the list is sorted in ascending order
    let tickIndex = this.populatedTicks.filter(({ tick }) => tick <= this.tick).length - 1

    const rightToLeft = tick <= this.tick

    while (rightToLeft ? this.populatedTicks[tickIndex].tick > tick : this.populatedTicks[tickIndex + 1].tick < tick) {
      const delta = JSBI.BigInt(
        rightToLeft ? this.populatedTicks[tickIndex].liquidityNet : this.populatedTicks[tickIndex + 1].liquidityNet
      )
      liquidity = JSBI.add(liquidity, JSBI.multiply(delta, rightToLeft ? NEGATIVE_ONE : ONE))
      rightToLeft ? tickIndex-- : tickIndex++
    }

    return liquidity
  }

  public get token0(): Token {
    return this.tokens[0]
  }

  public get token1(): Token {
    return this.tokens[1]
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  public get reserve0(): TokenAmount {
    throw new Error('remove')
  }

  public get reserve1(): TokenAmount {
    throw new Error('remove')
  }

  // /**
  //  * Returns the current mid price of the pool in terms of token0, i.e. the ratio of reserve1 to reserve0
  //  */
  // public get token0Price(): Price {
  //   invariant(this.sqrtPriceX96, 'todo')
  //   return new Price(this.token0, this.token1, this.tokenAmounts[0].raw, this.tokenAmounts[1].raw)
  // }

  // /**
  //  * Returns the current mid price of the pool in terms of token1, i.e. the ratio of reserve0 to reserve1
  //  */
  // public get token1Price(): Price {
  //   invariant(this.sqrtPriceX96, 'todo')
  //   return new Price(this.token1, this.token0, this.tokenAmounts[1].raw, this.tokenAmounts[0].raw)
  // }

  // /**
  //  * Return the price of the given token in terms of the other token in the pool.
  //  * @param token token to return price of
  //  */
  // public priceOf(token: Token): Price {
  //   invariant(this.involvesToken(token), 'TOKEN')
  //   return token.equals(this.token0) ? this.token0Price : this.token1Price
  // }

  /**
   * Returns the chain ID of the tokens in the pool.
   */
  public get chainId(): ChainId | number {
    return this.token0.chainId
  }

  // public get tickList(): TickList {
  //   return this.ticks
  // }

  public getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Pool] {
    invariant(this.involvesToken(inputAmount.token), 'TOKEN')
    throw new Error('todo')
  }

  public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Pool] {
    invariant(this.involvesToken(outputAmount.token), 'TOKEN')
    throw new Error('todo')
  }

  public getLiquidityMinted(
    _totalSupply: TokenAmount,
    _tokenAmountA: TokenAmount,
    _tokenAmountB: TokenAmount
  ): TokenAmount {
    throw new Error('todo')
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
