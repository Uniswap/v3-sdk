import { Interface } from '@ethersproject/abi'
import { BigintIsh, Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { Trade } from './entities/trade'
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
    routes: Route<TInput, TOutput> | Route<TInput, TOutput>[],
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): MethodParameters {
    if (!Array.isArray(routes)) {
      routes = [routes]
    }
    const calldatas: string[] = []

    for (const route of routes) {
      const singleHop = routes.length === 1

      if (singleHop) {
        if (tradeType === TradeType.EXACT_INPUT) {
          const exactInputSingleParams = {
            tokenIn: route.tokenPath[0].address,
            tokenOut: route.tokenPath[1].address,
            fee: route.pools[0].fee,
            amountIn: amount
          }
          calldatas.push(SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactInputSingle`, [exactInputSingleParams]))
        } else {
          const exactOutputSingleParams = {
            tokenIn: route.tokenPath[0].address,
            tokenOut: route.tokenPath[1].address,
            fee: route.pools[0].fee,
            amountOut: amount
          }
          calldatas.push(SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactOutputSingle`, [exactOutputSingleParams]))
        }
      } else {
        const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)

        if (tradeType === TradeType.EXACT_INPUT) {
          const exactInputParams = {
            path: path,
            amountIn: amount
          }
          calldatas.push(SwapQuoter.INTERFACE.encodeFunctionData('quoteExactInput', [exactInputParams]))
        } else {
          const exactOutputParams = {
            path: path,
            amountOut: amount
          }
          calldatas.push(SwapQuoter.INTERFACE.encodeFunctionData('quoteExactOutput', [exactOutputParams]))
        }
      }
    }

    return {
      calldata: calldatas[0],
      value: toHex(amount)
    }
  }
}
