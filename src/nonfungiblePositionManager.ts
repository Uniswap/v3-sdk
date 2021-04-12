import { ChainId, ETHER, Percent, Price, Token, WETH9 } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { FeeAmount, NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { MethodParameters } from './utils/calldata'
import { defaultAbiCoder } from '@ethersproject/abi'
import { priceToClosestTick, TickMath } from './utils'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface MintOptions {
  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * The account that should receive the minted NFT.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number

  /**
   * Whether to spend ether. If true, one of the pool tokens must be WETH
   */
  useEther: boolean
}

export abstract class NonfungiblePositionManager {
  public static ADDRESS: string = NONFUNGIBLE_POSITION_MANAGER_ADDRESS

  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mintCallParameters(position: Position, options: MintOptions): MethodParameters {
    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token0.equals(weth), 'NO_WETH')
    }

    defaultAbiCoder.encode(['bytes4'], [])
    throw new Error('todo')
  }

  /**
   *
   * @param chainId
   * @param startingPrice
   * @param feeAmount
   */
  public static createCallParameters(chainId: ChainId, startingPrice: Price, feeAmount: FeeAmount): MethodParameters {
    // get sqrt price
    const currentTick = priceToClosestTick(startingPrice)
    const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(currentTick)

    const tokenA: Token | undefined =
      startingPrice.baseCurrency === ETHER
        ? WETH9[chainId]
        : startingPrice.baseCurrency instanceof Token
        ? startingPrice.baseCurrency
        : undefined

    const tokenB: Token | undefined =
      startingPrice.baseCurrency === ETHER
        ? WETH9[chainId]
        : startingPrice.quoteCurrency instanceof Token
        ? startingPrice.quoteCurrency
        : undefined

    invariant(!!tokenA && !!tokenB, 'TOKENS')

    const calldata = defaultAbiCoder.encode(
      ['bytes4'],
      [tokenA.address, tokenB.address, feeAmount, sqrtRatioX96.toString()]
    )

    return {
      calldata,
      value: '0x0000000000000000000000000000000000000000000000000000000000000000'
    }
  }
}
