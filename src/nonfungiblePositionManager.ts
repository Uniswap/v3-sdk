import {
  BigintIsh,
  ChainId,
  currencyEquals,
  ETHER,
  Percent,
  Token,
  CurrencyAmount,
  validateAndParseAddress,
  WETH9
} from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { Position } from './entities/position'
import { ONE, ZERO } from './internalConstants'
import { MethodParameters, toHex } from './utils/calldata'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { PermitOptions, SelfPermit } from './selfPermit'
import { ADDRESS_ZERO } from './constants'

const MaxUint128 = toHex(JSBI.subtract(JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128)), JSBI.BigInt(1)))

export interface MintSpecificOptions {
  /**
   * The account that should receive the minted NFT.
   */
  recipient: string

  /**
   * Creates pool if not initialized before mint.
   */
  createPool?: boolean
}

export interface IncreaseSpecificOptions {
  /**
   * Indicates the ID of the position to increase liquidity for.
   */
  tokenId: BigintIsh
}

/**
 * Options for producing the calldata to add liquidity.
 */
export interface CommonAddLiquidityOptions {
  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: BigintIsh

  /**
   * Whether to spend ether. If true, one of the pool tokens must be WETH, by default false
   */
  useEther?: boolean

  /**
   * The optional permit parameters for spending token0
   */
  token0Permit?: PermitOptions

  /**
   * The optional permit parameters for spending token1
   */
  token1Permit?: PermitOptions
}

export type MintOptions = CommonAddLiquidityOptions & MintSpecificOptions
export type IncreaseOptions = CommonAddLiquidityOptions & IncreaseSpecificOptions

export type AddLiquidityOptions = MintOptions | IncreaseOptions

// type guard
function isMint(options: AddLiquidityOptions): options is MintOptions {
  return Object.keys(options).some(k => k === 'recipient')
}

export interface CollectOptions {
  /**
   * Indicates the ID of the position to collect for.
   */
  tokenId: BigintIsh

  /**
   * Expected value of tokensOwed0, including as-of-yet-unaccounted-for fees/liquidity value to be burned
   */
  expectedCurrencyOwed0: CurrencyAmount

  /**
   * Expected value of tokensOwed1, including as-of-yet-unaccounted-for fees/liquidity value to be burned
   */
  expectedCurrencyOwed1: CurrencyAmount

  /**
   * The account that should receive the tokens.
   */
  recipient: string
}

export interface NFTPermitOptions {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  deadline: BigintIsh
  spender: string
}

/**
 * Options for producing the calldata to exit a position.
 */
export interface RemoveLiquidityOptions {
  /**
   * The ID of the token to exit
   */
  tokenId: BigintIsh

  /**
   * The percentage of position liquidity to exit.
   */
  liquidityPercentage: Percent

  /**
   * How much the pool price is allowed to move.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: BigintIsh

  /**
   * Whether the NFT should be burned if the entire position is being exited, by default false.
   */
  burnToken?: boolean

  /**
   * The optional permit of the token ID being exited, in case the exit transaction is being sent by an account that does not own the NFT
   */
  permit?: NFTPermitOptions

  /**
   * Parameters to be passed on to collect
   */
  collectOptions: Omit<CollectOptions, 'tokenId'>
}

export abstract class NonfungiblePositionManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Cannot be constructed.
   */
  private constructor() {
    super()
  }

  public static addCallParameters(position: Position, options: AddLiquidityOptions): MethodParameters {
    invariant(JSBI.greaterThan(position.liquidity, ZERO), 'ZERO_LIQUIDITY')

    const calldatas: string[] = []

    // get amounts
    const { amount0: amount0Desired, amount1: amount1Desired } = position.mintAmounts

    // adjust for slippage
    const minimumAmounts = position.mintAmountsWithSlippage(options.slippageTolerance)
    const amount0Min = toHex(minimumAmounts.amount0)
    const amount1Min = toHex(minimumAmounts.amount1)

    const deadline = toHex(options.deadline)

    // create pool if needed
    if (isMint(options) && options.createPool) {
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('createAndInitializePoolIfNecessary', [
          position.pool.token0.address,
          position.pool.token1.address,
          position.pool.fee,
          toHex(position.pool.sqrtRatioX96)
        ])
      )
    }

    // permits if necessary
    if (options.token0Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token0, options.token0Permit))
    }
    if (options.token1Permit) {
      calldatas.push(NonfungiblePositionManager.encodePermit(position.pool.token1, options.token1Permit))
    }

    // mint
    if (isMint(options)) {
      const recipient: string = validateAndParseAddress(options.recipient)

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
            deadline
          }
        ])
      )
    } else {
      // increase
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('increaseLiquidity', [
          {
            tokenId: toHex(options.tokenId),
            amount0Desired: toHex(amount0Desired),
            amount1Desired: toHex(amount1Desired),
            amount0Min,
            amount1Min,
            deadline
          }
        ])
      )
    }

    let value: string = toHex(0)

    if (options.useEther) {
      const weth = WETH9[position.pool.chainId as ChainId]
      invariant(weth && (position.pool.token0.equals(weth) || position.pool.token1.equals(weth)), 'NO_WETH')

      const wethValue = position.pool.token0.equals(weth) ? amount0Desired : amount1Desired

      // we only need to refund if we're actually sending ETH
      if (JSBI.greaterThan(wethValue, ZERO)) {
        calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('refundETH'))
      }

      value = toHex(wethValue)
    }

    return {
      calldata:
        calldatas.length === 1
          ? calldatas[0]
          : NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  private static encodeCollect(options: CollectOptions): string[] {
    const calldatas: string[] = []

    const tokenId = toHex(options.tokenId)

    const involvesETH =
      currencyEquals(options.expectedCurrencyOwed0.currency, ETHER) ||
      currencyEquals(options.expectedCurrencyOwed1.currency, ETHER)

    const recipient = validateAndParseAddress(options.recipient)

    // collect
    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('collect', [
        {
          tokenId,
          recipient: involvesETH ? ADDRESS_ZERO : recipient,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128
        }
      ])
    )

    if (involvesETH) {
      const ethAmount = currencyEquals(options.expectedCurrencyOwed0.currency, ETHER)
        ? options.expectedCurrencyOwed0.raw
        : options.expectedCurrencyOwed1.raw
      const token = currencyEquals(options.expectedCurrencyOwed0.currency, ETHER)
        ? (options.expectedCurrencyOwed1.currency as Token)
        : (options.expectedCurrencyOwed0.currency as Token)
      const tokenAmount = currencyEquals(options.expectedCurrencyOwed0.currency, ETHER)
        ? options.expectedCurrencyOwed1.raw
        : options.expectedCurrencyOwed0.raw

      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('unwrapWETH9', [toHex(ethAmount), recipient])
      )
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('sweepToken', [
          token.address,
          toHex(tokenAmount),
          recipient
        ])
      )
    }

    return calldatas
  }

  public static collectCallParameters(options: CollectOptions): MethodParameters {
    const calldatas: string[] = NonfungiblePositionManager.encodeCollect(options)

    return {
      calldata:
        calldatas.length === 1
          ? calldatas[0]
          : NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toHex(0)
    }
  }

  /**
   * Produces the calldata for completely or partially exiting a position
   * @param position the position to exit
   * @param options additional information necessary for generating the calldata
   */
  public static removeCallParameters(position: Position, options: RemoveLiquidityOptions): MethodParameters {
    const calldatas: string[] = []

    const deadline = toHex(options.deadline)
    const tokenId = toHex(options.tokenId)

    // construct a partial position with a percentage of liquidity
    const partialPosition = new Position({
      pool: position.pool,
      liquidity: options.liquidityPercentage.multiply(position.liquidity).quotient,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper
    })
    invariant(JSBI.greaterThan(partialPosition.liquidity, ZERO), 'ZERO_LIQUIDITY')

    // slippage-adjusted underlying amounts
    const { amount0: amount0Min, amount1: amount1Min } = partialPosition.burnAmountsWithSlippage(
      options.slippageTolerance
    )

    if (options.permit) {
      calldatas.push(
        NonfungiblePositionManager.INTERFACE.encodeFunctionData('permit', [
          validateAndParseAddress(options.permit.spender),
          tokenId,
          toHex(options.permit.deadline),
          options.permit.v,
          options.permit.r,
          options.permit.s
        ])
      )
    }

    // remove liquidity
    calldatas.push(
      NonfungiblePositionManager.INTERFACE.encodeFunctionData('decreaseLiquidity', [
        {
          tokenId,
          liquidity: toHex(partialPosition.liquidity),
          amount0Min: toHex(amount0Min),
          amount1Min: toHex(amount1Min),
          deadline
        }
      ])
    )

    const { expectedCurrencyOwed0, expectedCurrencyOwed1, ...rest } = options.collectOptions
    calldatas.push(
      ...NonfungiblePositionManager.encodeCollect({
        tokenId: options.tokenId,
        // add the underlying value to the expected currency already owed
        expectedCurrencyOwed0: expectedCurrencyOwed0.add(
          currencyEquals(expectedCurrencyOwed0.currency, ETHER)
            ? CurrencyAmount.ether(amount0Min)
            : new CurrencyAmount(expectedCurrencyOwed0.currency as Token, amount0Min)
        ),
        expectedCurrencyOwed1: expectedCurrencyOwed1.add(
          currencyEquals(expectedCurrencyOwed1.currency, ETHER)
            ? CurrencyAmount.ether(amount1Min)
            : new CurrencyAmount(expectedCurrencyOwed1.currency as Token, amount1Min)
        ),
        ...rest
      })
    )

    if (options.liquidityPercentage.equalTo(ONE)) {
      if (options.burnToken) {
        calldatas.push(NonfungiblePositionManager.INTERFACE.encodeFunctionData('burn', [tokenId]))
      }
    } else {
      invariant(options.burnToken !== true, 'CANNOT_BURN')
    }

    return {
      calldata: NonfungiblePositionManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toHex(0)
    }
  }
}
