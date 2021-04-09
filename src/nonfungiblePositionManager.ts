import { ChainId, Fraction, Percent, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'

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
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mintCallParameters(position: Position, options: MintOptions): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'LIQUIDITY')

    const calldatas: string[] = []

    // TODO: we always add 1 instead of computing the exact amount which isn't always the amount0/amount1 plus one
    const amount0Desired = `0x${JSBI.add(position.amount0.raw, ONE).toString(16)}`
    const amount1Desired = `0x${JSBI.add(position.amount1.raw, ONE).toString(16)}`
    // TODO: these calculations may not be exactly right
    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount0.raw).quotient.toString(16)}`
    const amount1Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount1.raw).quotient.toString(16)}`

    let value: string = '0x0'

    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('mint', [
        {
          token0: position.pool.token0.address,
          token1: position.pool.token1.address,
          fee: position.pool.fee,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: options.recipient,
          deadline: options.deadline
        }
      ])
    )

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token0.equals(weth), 'NO_WETH')

      value = position.pool.token0.equals(weth)
        ? `0x${position.amount0.raw.toString(16)}`
        : `0x${position.amount1.raw.toString(16)}`
    }

    /// TODO: handle permit

    if (calldatas.length === 1) {
      return {
        calldata: calldatas[0],
        value
      }
    } else {
      return {
        calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
        value
      }
    }
  }
}
