import { BigintIsh, ChainId, Fraction, Percent, validateAndParseAddress, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters, toHex } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { PermitOptions, SelfPermit } from './selfPermit'

const MaxUint128Hex = toHex(JSBI.subtract(JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128)), JSBI.BigInt(1)))

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

export abstract class NonfungiblePositionManager extends SelfPermit {
  public static ADDRESS: string = NONFUNGIBLE_POSITION_MANAGER_ADDRESS
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Cannot be constructed.
   */
  private constructor() {
    super()
  }

  public static mintCallParameters(position: Position, options: MintOptions): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'LIQUIDITY')

    const recipient: string = validateAndParseAddress(options.recipient)

    const calldatas: string[] = []

    const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

    // we adjust the amounts, not the price of the pool, because the user likely does not want to add the other asset
    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = toHex(ONE_LESS_TOLERANCE.multiply(amount0Desired).quotient)
    const amount1Min = toHex(ONE_LESS_TOLERANCE.multiply(amount1Desired).quotient)

    // create pool if needed
    if (options.createPool) {
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('createAndInitializePoolIfNecessary', [
          position.pool.token0.address,
          position.pool.token1.address,
          position.pool.fee,
          toHex(position.pool.sqrtRatioX96)
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
          amount0Desired: toHex(amount0Desired),
          amount1Desired: toHex(amount1Desired),
          amount0Min,
          amount1Min,
          recipient,
          deadline: toHex(options.deadline)
        }
      ])
    )

    let value: string = toHex(0)

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token1.equals(weth), 'NO_WETH')

      value = toHex(position.pool.token0.equals(weth) ? amount0Desired : amount1Desired)

      calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('refundETH'))
    }

    if (calldatas.length === 1) {
      return {
        calldata: calldatas[0],
        value
      }
    }

    return {
      calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  public static increaseLiquidityCallParameters(
    position: Position,
    options: IncreaseLiquidityOptions
  ): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'LIQUIDITY')

    const calldatas: string[] = []

    const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

    // TODO: these calculations may not be exactly right
    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = toHex(ONE_LESS_TOLERANCE.multiply(amount0Desired).quotient)
    const amount1Min = toHex(ONE_LESS_TOLERANCE.multiply(amount1Desired).quotient)

    // permits if possible
    if (options.token0Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

    // increase the liquidity
    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('increaseLiquidity', [
        {
          tokenId: toHex(options.tokenId),
          amount0Desired: toHex(amount0Desired),
          amount1Desired: toHex(amount1Desired),
          amount0Min,
          amount1Min,
          deadline: toHex(options.deadline)
        }
      ])
    )

    let value: string = toHex(0)

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token1.equals(weth), 'NO_WETH')

      value = toHex(position.pool.token0.equals(weth) ? amount0Desired : amount1Desired)

      calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('refundETH'))
    }

    if (calldatas.length === 1) {
      return {
        calldata: calldatas[0],
        value
      }
    }

    return {
      calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
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

    const recipient: string = validateAndParseAddress(options.recipient)

    if (options.receiveEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant((weth && position.pool.token0.equals(weth)) || position.pool.token1.equals(weth), 'NO_WETH')
      throw new Error('todo')
    }

    const calldatas: string[] = []

    const liquidity: JSBI =
      options.liquidityPercentage?.multiply(position.liquidity)?.quotient ?? JSBI.BigInt(position.liquidity)

    const ONE_LESS_TOLERANCE = new Fraction(ONE).subtract(options.slippageTolerance)
    const amount0Min = toHex(ONE_LESS_TOLERANCE.multiply(position.amount0.raw).quotient)
    const amount1Min = toHex(ONE_LESS_TOLERANCE.multiply(position.amount1.raw).quotient)

    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('decreaseLiquidity', [
        {
          tokenId: toHex(options.tokenId),
          liquidity: toHex(liquidity),
          amount0Min,
          amount1Min,
          deadline: toHex(options.deadline)
        }
      ])
    )

    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('collect', [
        {
          tokenId: toHex(options.tokenId),
          recipient,
          amount0Max: MaxUint128Hex,
          amount1Max: MaxUint128Hex
        }
      ])
    )

    if (options.burnToken !== false && (options.liquidityPercentage?.equalTo(ONE) ?? true))
      calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('burn', [options.tokenId]))

    return {
      calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toHex(0)
    }
  }
}
