import { ETHER, Percent } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { SWAP_ROUTER_ADDRESS } from './constants'
import { Trade } from './entities/trade'
import { MethodParameters } from './utils/calldata'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface TradeOptions {
  /**
   * How much the execution price is allowed to move unfavorably from the trade execution price.
   */
  slippageTolerance: Percent

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: number

  /**
   * The account that should receive the output of the swap.
   */
  recipient: string
}

/**
 * Represents the Uniswap V2 SwapRouter, and has static methods for helping execute trades.
 */
export abstract class SwapRouter {
  public static ADDRESS: string = SWAP_ROUTER_ADDRESS

  /**
   * Cannot be constructed.
   */
  private constructor() {}
  /**
   * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
   * @param trade to produce call parameters for
   * @param _options options for the call parameters
   */
  public static swapCallParameters(trade: Trade, _options: TradeOptions): MethodParameters {
    const etherIn = trade.inputAmount.currency === ETHER
    const etherOut = trade.outputAmount.currency === ETHER
    // the router does not support both ether in and out
    invariant(!(etherIn && etherOut), 'ETHER_IN_OUT')
    //
    // const to: string = validateAndParseAddress(options.recipient)
    // const amountIn: string = toHex(trade.maximumAmountIn(options.slippageTolerance))
    // const amountOut: string = toHex(trade.minimumAmountOut(options.slippageTolerance))
    // const path: string[] = trade.route.tokenPath.map(token => token.address)
    // const deadline = `0x${options.deadline.toString(16)}`
    //
    // let methodName: string
    // let args: (string | string[])[]
    // let value: string
    // switch (trade.tradeType) {
    //   case TradeType.EXACT_INPUT:
    //     if (etherIn) {
    //       methodName = 'swapExactETHForTokensSupportingFeeOnTransferTokens'
    //       // (uint amountOutMin, address[] calldata path, address to, uint deadline)
    //       args = [amountOut, path, to, deadline]
    //       value = amountIn
    //     } else if (etherOut) {
    //       methodName = 'swapExactTokensForETHSupportingFeeOnTransferTokens'
    //       // (uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
    //       args = [amountIn, amountOut, path, to, deadline]
    //       value = ZERO_HEX
    //     } else {
    //       methodName = 'swapExactTokensForTokens'
    //       // (uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
    //       args = [amountIn, amountOut, path, to, deadline]
    //       value = ZERO_HEX
    //     }
    //     break
    //   case TradeType.EXACT_OUTPUT:
    //     if (etherIn) {
    //       methodName = 'swapETHForExactTokens'
    //       // (uint amountOut, address[] calldata path, address to, uint deadline)
    //       args = [amountOut, path, to, deadline]
    //       value = amountIn
    //     } else if (etherOut) {
    //       methodName = 'swapTokensForExactETH'
    //       // (uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
    //       args = [amountOut, amountIn, path, to, deadline]
    //       value = ZERO_HEX
    //     } else {
    //       methodName = 'swapTokensForExactTokens'
    //       // (uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
    //       args = [amountOut, amountIn, path, to, deadline]
    //       value = ZERO_HEX
    //     }
    //     break
    //   default:
    //     throw new Error('invalid trade type')
    // }

    throw new Error('todo')
  }
}
