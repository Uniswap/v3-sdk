import { Interface } from '@ethersproject/abi'
import { BigintIsh, Currency, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'
import { Route } from './entities'

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

export interface QuoteOptions {
  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * Optional information for taking a fee on output.
   */
  fee?: FeeOptions
}

export abstract class SwapQuoter {
  public static INTERFACE: Interface = new Interface(abi)

  public static quoteSwap<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>, //this is wrong? needs to be able to be casted to hex
    tradeType: TTradeType
  ): MethodParameters {
    const singleHop = route.pools.length === 2

    if (singleHop) {
      if (tradeType === TradeType.EXACT_INPUT) {
        const exactInputSingleParams = {
          tokenIn: route.tokenPath[0].address,
          tokenOut: route.tokenPath[1].address,
          fee: route.pools[0].fee,
          amountIn: amount // needs #toHex
        }
        return {
          calldata: SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactInputSingle`, [exactInputSingleParams]),
          value: toHex(0)
        }
      } else {
        const exactOutputSingleParams = {
          tokenIn: route.tokenPath[0].address,
          tokenOut: route.tokenPath[1].address,
          fee: route.pools[0].fee,
          amountOut: amount
        }
        return {
          calldata: SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactOutputSingle`, [exactOutputSingleParams]),
          value: toHex(0)
        }
      }
    } else {
      const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)

      if (tradeType === TradeType.EXACT_INPUT) {
        const exactInputParams = {
          path: path,
          amountIn: amount
        }
        return {
          calldata: SwapQuoter.INTERFACE.encodeFunctionData('quoteExactInput', [exactInputParams]),
          value: toHex(0)
        }
      } else {
        const exactOutputParams = {
          path: path,
          amountOut: amount
        }
        return {
          calldata: SwapQuoter.INTERFACE.encodeFunctionData('quoteExactOutput', [exactOutputParams]),
          value: toHex(0)
        }
      }
    }
  }
}
