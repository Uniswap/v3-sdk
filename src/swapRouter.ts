import { Interface } from '@ethersproject/abi'
import { BigintIsh, currencyEquals, ETHER, Percent, Token, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { SWAP_ROUTER_ADDRESS } from './constants'
import { Trade } from './entities/trade'
import { PermitOptions, SelfPermit } from './selfPermit'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface TradeOptions {
  /**
   * How much the execution price is allowed to move unfavorably from the trade execution price.
   */
  slippageTolerance: Percent

  /**
   * The account that should receive the output.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number

  /**
   * The optional permit parameters for spending the input.
   */
  inputTokenPermit?: PermitOptions

  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  // TODO remove after launch
  swapRouterAddressOverride: string
}

/**
 * Represents the Uniswap V2 SwapRouter, and has static methods for helping execute trades.
 */
export abstract class SwapRouter extends SelfPermit {
  public static ADDRESS: string = SWAP_ROUTER_ADDRESS
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Cannot be constructed.
   */
  private constructor() {
    super()
  }

  /**
   * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
   * @param trade to produce call parameters for
   * @param options options for the call parameters
   */
  public static swapCallParameters(trade: Trade, options: TradeOptions): MethodParameters {
    const calldatas: string[] = []

    // encode permit if necessary
    if (options.inputTokenPermit) {
      calldatas.push(SwapRouter.encodePermit(trade.inputAmount.currency as Token, options.inputTokenPermit))
    }

    const recipient: string = validateAndParseAddress(options.recipient)
    const deadline = toHex(options.deadline)

    const amountIn: string = toHex(trade.maximumAmountIn(options.slippageTolerance).raw)
    const amountOut: string = toHex(trade.minimumAmountOut(options.slippageTolerance).raw)

    const singleHop = trade.route.pools.length === 1

    const value = currencyEquals(trade.inputAmount.currency, ETHER) ? amountIn : toHex(0)
    const mustRefund = currencyEquals(trade.inputAmount.currency, ETHER) && trade.tradeType === TradeType.EXACT_OUTPUT
    const mustUnwrap = currencyEquals(trade.outputAmount.currency, ETHER)

    if (singleHop) {
      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputSingleParams = {
          tokenIn: trade.route.tokenPath[0].address,
          tokenOut: trade.route.tokenPath[1].address,
          fee: trade.route.pools[0].fee,
          recipient: mustUnwrap ? options.swapRouterAddressOverride : recipient,
          deadline,
          amountIn,
          amountOutMinimum: amountOut,
          sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 === undefined ? 0 : options.sqrtPriceLimitX96)
        }

        const calldata = SwapRouter.INTERFACE.encodeFunctionData('exactInputSingle', [exactInputSingleParams])

        calldatas.push(calldata)
      } else {
        const exactOutputSingleParams = {
          tokenIn: trade.route.tokenPath[0].address,
          tokenOut: trade.route.tokenPath[1].address,
          fee: trade.route.pools[0].fee,
          recipient: mustUnwrap ? options.swapRouterAddressOverride : recipient,
          deadline,
          amountOut,
          amountInMaximum: amountIn,
          sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 === undefined ? 0 : options.sqrtPriceLimitX96)
        }

        const calldata = SwapRouter.INTERFACE.encodeFunctionData('exactOutputSingle', [exactOutputSingleParams])

        calldatas.push(calldata)
      }
    } else {
      invariant(options.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')
      const path: string = encodeRouteToPath(trade.route, trade.tradeType === TradeType.EXACT_OUTPUT)

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputParams = {
          path,
          recipient: mustUnwrap ? options.swapRouterAddressOverride : recipient,
          deadline,
          amountIn,
          amountOutMinimum: amountOut
        }

        const calldata = SwapRouter.INTERFACE.encodeFunctionData('exactInput', [exactInputParams])

        calldatas.push(calldata)
      } else {
        const exactOutputParams = {
          path,
          recipient: mustUnwrap ? options.swapRouterAddressOverride : recipient,
          deadline,
          amountOut,
          amountInMaximum: amountIn
        }

        const calldata = SwapRouter.INTERFACE.encodeFunctionData('exactOutput', [exactOutputParams])

        calldatas.push(calldata)
      }
    }

    // refund
    if (mustRefund) {
      calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('refundETH'))
    }

    // unwrap
    if (mustUnwrap) {
      calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('unwrapWETH9', [amountOut, recipient]))
    }

    // we don't need multicall
    if (calldatas.length === 1) {
      return {
        calldata: calldatas[0],
        value
      }
    }

    return {
      calldata: SwapRouter.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }
}
