import { Interface } from '@ethersproject/abi'
import { Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'
import { Route } from './entities'

export abstract class SwapQuoter {
  public static INTERFACE: Interface = new Interface(abi)

  public static quoteSwap<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>,
    tradeType: TradeType
  ): MethodParameters {
    const singleHop = route.pools.length === 2
    const quoteAmount: string = toHex(amount.quotient)
    let formattedCalldata: string

    if (singleHop) {
      if (tradeType === TradeType.EXACT_INPUT) {
        const exactInputSingleParams = {
          tokenIn: route.tokenPath[0].address,
          tokenOut: route.tokenPath[1].address,
          fee: route.pools[0].fee,
          amountIn: quoteAmount
        }

        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactInputSingle`, [exactInputSingleParams])
      } else {
        const exactOutputSingleParams = {
          tokenIn: route.tokenPath[0].address,
          tokenOut: route.tokenPath[1].address,
          fee: route.pools[0].fee,
          amountOut: quoteAmount
        }

        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactOutputSingle`, [exactOutputSingleParams])
      }
    } else {
      const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)

      if (tradeType === TradeType.EXACT_INPUT) {
        const exactInputParams = {
          path: path,
          amountIn: quoteAmount
        }

        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactInput', [exactInputParams])
      } else {
        const exactOutputParams = {
          path: path,
          amountOut: quoteAmount
        }

        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactOutput', [exactOutputParams])
      }
    }
    return {
      calldata: formattedCalldata,
      value: toHex(0)
    }
  }
}
