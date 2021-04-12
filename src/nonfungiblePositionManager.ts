import { BigintIsh, ChainId, ETHER, Fraction, Percent, Price, Token, WETH9 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { FeeAmount, NONFUNGIBLE_POSITION_MANAGER_ADDRESS } from './constants'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters } from './utils/calldata'
import { defaultAbiCoder } from '@ethersproject/abi'
import { priceToClosestTick, TickMath } from './utils'
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

  /**
   * The optional permit parameters for spending token0
   */
  token0Permit?: PermitOptions

  /**
   * The optional permit parameters for spending token1
   */
  token1Permit?: PermitOptions
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

    if (options.token0Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

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
