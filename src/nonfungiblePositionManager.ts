import { BigintIsh, ChainId, Fraction, Percent, Token, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'

export interface StandardPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  amount: BigintIsh
  deadline: number
}

export interface AllowedPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  nonce: BigintIsh
  expiry: number
}

export type PermitOptions = StandardPermitArguments | AllowedPermitArguments

/**
 * Options for producing the calldata to mint a position.
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

  /**
   * The optional permit parameters for spending token0
   */
  token0Permit?: PermitOptions

  /**
   * The optional permit parameters for spending token1
   */
  token1Permit?: PermitOptions

  /**
   * Create pool if not initialized before mint
   */
  createPool?: boolean
}

export interface NFTPermitOptions {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  tokenId: BigintIsh
  deadline: number
  spender: string
}

export interface IncreaseLiquidityOptions {
  /**
   * The ID of the position to increase liquidity for
   */
  tokenId: BigintIsh

  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number

  /**
   * Whether to spend ether. If true, one of the pool tokens must be WETH
   */
  useEther: boolean

  /**
   * The optional permit parameters for spending token0
   */
  token0Permit?: PermitOptions

  /**
   * The optional permit parameters for spending token1
   */
  token1Permit?: PermitOptions
}

/**
 * Options for producing the calldata to exit a position.
 */
export interface ExitOptions {
  /**
   * The ID of the token to exit
   */
  tokenId: BigintIsh

  /**
   * The percentage of position liquidity to exit. Optional--if not specified, exit the entire position
   */
  liquidityPercentage?: Percent

  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * The account that should receive the tokens.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number

  /**
   * Whether to receive ether. If true, one of the pool tokens must be WETH
   */
  receiveEther: boolean

  /**
   * The optional permit of the token ID being exited, in case the exit transaction is being sent by an account that does not own the NFT
   */
  permit?: NFTPermitOptions

  /**
   * Whether the NFT should be burned after exiting the entire position, by default true
   */
  burnToken?: boolean
}

export abstract class NonfungiblePositionManager {
  public static ADDRESS: string = NONFUNGIBLE_POSITION_MANAGER_ADDRESS
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Cannot be constructed.
   */
  private constructor() {}

  private static encodePermit(token: Token, options: PermitOptions) {
    return 'nonce' in options
      ? NonfungiblePositionManager.INTERFACE.encodeFunctionData('selfPermitAllowed', [
          token.address,
          options.nonce,
          options.expiry,
          options.v,
          options.r,
          options.s
        ])
      : NonfungiblePositionManager.INTERFACE.encodeFunctionData('selfPermit', [
          token.address,
          options.amount.toString(),
          options.deadline,
          options.v,
          options.r,
          options.s
        ])
  }

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

    // create pool if needed
    if (options.createPool) {
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('createAndInitializePoolIfNecessary', [
          position.pool.token0.address,
          position.pool.token1.address,
          position.pool.fee,
          position.pool.sqrtRatioX96.toString()
        ])
      )
    }

    // permits if possible
    if (options.token0Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

    // mint
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

    let value: string = '0x0'

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token0.equals(weth), 'NO_WETH')

      value = position.pool.token0.equals(weth)
        ? `0x${position.amount0.raw.toString(16)}`
        : `0x${position.amount1.raw.toString(16)}`
    }

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

  public static increaseLiquidityCallParameters(
    position: Position,
    options: IncreaseLiquidityOptions
  ): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'LIQUIDITY')

    const calldatas: string[] = []

    // TODO: we always add 1 instead of computing the exact amount which isn't always the amount0/amount1 plus one
    const amount0Desired = `0x${JSBI.add(position.amount0.raw, ONE).toString(16)}`
    const amount1Desired = `0x${JSBI.add(position.amount1.raw, ONE).toString(16)}`
    // TODO: these calculations may not be exactly right
    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount0.raw).quotient.toString(16)}`
    const amount1Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount1.raw).quotient.toString(16)}`

    // permits if possible
    if (options.token0Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

    // mint
    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('increaseLiquidity', [
        {
          tokenId: options.tokenId,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          deadline: options.deadline
        }
      ])
    )

    let value: string = '0x0'

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token0.equals(weth), 'NO_WETH')

      value = position.pool.token0.equals(weth)
        ? `0x${position.amount0.raw.toString(16)}`
        : `0x${position.amount1.raw.toString(16)}`
    }

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

  /**
   * Produces the calldata for completely or partially exiting a position
   * @param position the position to exit
   * @param options additional information necessary for generating the calldata
   */
  public static exitCallParameters(position: Position, options: ExitOptions): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'LIQUIDITY')
    invariant(JSBI.greaterThan(JSBI.BigInt(options.tokenId), ZERO), 'TOKEN_ID')
    if (options.burnToken === false) invariant(!options.liquidityPercentage?.equalTo(ONE), 'BURN_AMOUNT_KEEP')

    if (options.receiveEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token0.equals(weth), 'NO_WETH')
      throw new Error('todo')
    }

    const calldatas: string[] = []

    const liquidity: JSBI =
      options.liquidityPercentage?.multiply(position.liquidity)?.quotient ?? JSBI.BigInt(position.liquidity)

    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount0.raw).quotient.toString(16)}`
    const amount1Min = `0x${ONE_LESS_TOLERANCE.multiply(position.amount1.raw).quotient.toString(16)}`

    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('decreaseLiquidity', [
        {
          tokenId: options.tokenId,
          liquidity: `0x${liquidity.toString(16)}`,
          amount0Min,
          amount1Min,
          deadline: options.deadline
        }
      ])
    )

    const MaxUint128Hex = `0x${JSBI.subtract(
      JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128)),
      JSBI.BigInt(1)
    ).toString(16)}`

    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('collect', [
        {
          tokenId: options.tokenId,
          recipient: options.recipient,
          amount0Max: MaxUint128Hex,
          amount1Max: MaxUint128Hex
        }
      ])
    )

    if (options.burnToken !== false && (options.liquidityPercentage?.equalTo(ONE) ?? true))
      calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('burn', [options.tokenId]))

    return {
      calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: '0x0'
    }
  }
}
