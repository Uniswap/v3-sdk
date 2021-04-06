import { Percent } from '@uniswap/sdk-core'
import { Position } from './entities/position'
import { MethodParameters } from './utils/calldata'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface MintOptions {
  /**
   * How much the pool price is allowed to move.
   */
  allowedSlippage: Percent

  /**
   * The account that should receive the minted NFT.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number
}

export abstract class NonfungiblePositionManager {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mintCallParameters(position: Position, _options: MintOptions): MethodParameters {
    throw new Error('todo')
  }
}
