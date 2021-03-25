import { Percent, TokenAmount } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { Pool } from './entities/pool'
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

  /**
   * The desired amount of token0 to be spent.
   */
  amount0: TokenAmount

  /**
   * The desired amount of token1 to be spent.
   */
  amount1: TokenAmount

  /**
   * The lower tick of the minted position.
   */
  tickLower: number
  /**
   * The upper tick of the minted position.
   */
  tickUpper: number
}

export abstract class NonfungiblePositionManager {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mintCallParameters(_pool: Pool, _options: MintOptions): MethodParameters {
    invariant(false, 'NOT_IMPLEMENTED')
  }
}
