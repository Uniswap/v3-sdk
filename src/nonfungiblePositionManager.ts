import { ChainId, Percent, WETH9 } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { MethodParameters } from './utils/calldata'
import { defaultAbiCoder } from '@ethersproject/abi'

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
}
