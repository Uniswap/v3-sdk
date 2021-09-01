import { Interface } from '@ethersproject/abi'
import { Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { Route } from './entities'

/**
 * Represents the Uniswap V3 QuoterV1 contract with a method for returning the formatted
 * calldata needed to call the quoter contract.
 */
export abstract class SwapQuoter {
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * Produces the on-chain method name of the appropriate function within QuoterV2,
   * and the relevant hex encoded parameters.
   * @template TInput The input token
   * @template TOutput The output token
   * @param route The swap route
   * @param amount The amount of the quote, either an amount in, or an amount out
   * @param tradeType The trade type, either exact input, or exact output.
   * @returns the formatted calldata
   */
  public static quoteCallParameters<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>,
    tradeType: TradeType
  ): MethodParameters {
    const singleHop = route.pools.length === 1
    const quoteAmount: string = toHex(amount.quotient)
    let formattedCalldata: string

    if (singleHop) {
      if (tradeType === TradeType.EXACT_INPUT) {
        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactInputSingle`, [
          route.tokenPath[0].address,
          route.tokenPath[1].address,
          route.pools[0].fee,
          quoteAmount,
          toHex(0)
        ])
      } else {
        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactOutputSingle`, [
          route.tokenPath[0].address,
          route.tokenPath[1].address,
          route.pools[0].fee,
          quoteAmount,
          toHex(0)
        ])
      }
    } else {
      const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)

      if (tradeType === TradeType.EXACT_INPUT) {
        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactInput', [path, quoteAmount])
      } else {
        formattedCalldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactOutput', [path, quoteAmount])
      }
    }
    return {
      calldata: formattedCalldata,
      value: toHex(0)
    }
  }
}
