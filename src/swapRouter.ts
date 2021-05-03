import { Interface } from '@ethersproject/abi'
import { BigintIsh, currencyEquals, ETHER, Percent, Token, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { Trade } from './entities/trade'
import { ADDRESS_ZERO } from './constants'
import { PermitOptions, SelfPermit } from './selfPermit'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'

export interface FeeOptions {
  /**
   * The percent of the output that will be taken as a fee.
   */
  fee: Percent

  /**
   * The recipient of the fee.
   */
  recipient: string
}

/**
 * Options for producing the arguments to send calls to the router.
 */
export interface SwapOptions {
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
  deadline: BigintIsh

  /**
   * The optional permit parameters for spending the input.
   */
  inputTokenPermit?: PermitOptions

  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * Optional information for taking a fee on output.
   */
  fee?: FeeOptions
}

/**
 * Represents the Uniswap V2 SwapRouter, and has static methods for helping execute trades.
 */
export abstract class SwapRouter extends SelfPermit {
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
  public static swapCallParameters(trade: Trade, options: SwapOptions): MethodParameters {
    const calldatas: string[] = []

    // encode permit if necessary
    if (options.inputTokenPermit) {
      invariant(trade.inputAmount.currency instanceof Token, 'NON_TOKEN_PERMIT')
      calldatas.push(SwapRouter.encodePermit(trade.inputAmount.currency, options.inputTokenPermit))
    }

    const recipient: string = validateAndParseAddress(options.recipient)

    const deadline = toHex(options.deadline)

    const amountIn: string = toHex(trade.maximumAmountIn(options.slippageTolerance).raw)
    const amountOut: string = toHex(trade.minimumAmountOut(options.slippageTolerance).raw)
    const value: string = currencyEquals(trade.inputAmount.currency, ETHER) ? amountIn : toHex(0)

    // flag for whether the trade is single hop or not
    const singleHop = trade.route.pools.length === 1

    // flag for whether a refund needs to happen
    const mustRefund = currencyEquals(trade.inputAmount.currency, ETHER) && trade.tradeType === TradeType.EXACT_OUTPUT

    // flags for whether funds should be send first to the router
    const outputIsETHER = currencyEquals(trade.outputAmount.currency, ETHER)
    const routerMustCustody = outputIsETHER || !!options.fee

    if (singleHop) {
      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputSingleParams = {
          tokenIn: trade.route.tokenPath[0].address,
          tokenOut: trade.route.tokenPath[1].address,
          fee: trade.route.pools[0].fee,
          recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
          deadline,
          amountIn,
          amountOutMinimum: amountOut,
          sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0)
        }

        calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactInputSingle', [exactInputSingleParams]))
      } else {
        const exactOutputSingleParams = {
          tokenIn: trade.route.tokenPath[0].address,
          tokenOut: trade.route.tokenPath[1].address,
          fee: trade.route.pools[0].fee,
          recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
          deadline,
          amountOut,
          amountInMaximum: amountIn,
          sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0)
        }

        calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactOutputSingle', [exactOutputSingleParams]))
      }
    } else {
      invariant(options.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')

      const path: string = encodeRouteToPath(trade.route, trade.tradeType === TradeType.EXACT_OUTPUT)

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputParams = {
          path,
          recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
          deadline,
          amountIn,
          amountOutMinimum: amountOut
        }

        calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactInput', [exactInputParams]))
      } else {
        const exactOutputParams = {
          path,
          recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
          deadline,
          amountOut,
          amountInMaximum: amountIn
        }

        calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactOutput', [exactOutputParams]))
      }
    }

    // refund
    if (mustRefund) {
      calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('refundETH'))
    }

    // unwrap
    if (routerMustCustody) {
      if (!!options.fee) {
        const feeRecipient: string = validateAndParseAddress(options.fee.recipient)
        const fee = toHex(options.fee.fee.multiply(10_000).quotient)

        if (outputIsETHER) {
          calldatas.push(
            SwapRouter.INTERFACE.encodeFunctionData('unwrapWETH9WithFee', [amountOut, recipient, fee, feeRecipient])
          )
        } else {
          calldatas.push(
            SwapRouter.INTERFACE.encodeFunctionData('sweepTokenWithFee', [
              trade.route.tokenPath[trade.route.tokenPath.length - 1].address,
              amountOut,
              recipient,
              fee,
              feeRecipient
            ])
          )
        }
      } else {
        calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('unwrapWETH9', [amountOut, recipient]))
      }
    }

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : SwapRouter.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }
}
