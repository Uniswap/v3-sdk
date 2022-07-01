import { Interface } from '@ethersproject/abi'
import { BigintIsh, Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import { encodeRouteToPath, MethodParameters, toHex } from './utils'
import IQuoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import IQuoterV2 from '@uniswap/swap-router-contracts/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'
import { Route } from './entities'
import invariant from 'tiny-invariant'

/**
 * Optional arguments to send to the quoter.
 */
export interface QuoteOptions {
  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * The optional quoter interface to use
   */
  useQuoterV2?: boolean
}

/**
 * Represents the Uniswap V3 QuoterV1 contract with a method for returning the formatted
 * calldata needed to call the quoter contract.
 */
export abstract class SwapQuoter {
  public static INTERFACE: Interface = new Interface(IQuoter.abi)

  /**
   * Produces the on-chain method name of the appropriate function within QuoterV2,
   * and the relevant hex encoded parameters.
   * @template TInput The input token, either Ether or an ERC-20
   * @template TOutput The output token, either Ether or an ERC-20
   * @param route The swap route, a list of pools through which a swap can occur
   * @param amount The amount of the quote, either an amount in, or an amount out
   * @param tradeType The trade type, either exact input or exact output
   * @param options The optional params including price limit and Quoter contract switch
   * @returns The formatted calldata
   */
  public static quoteCallParameters<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>,
    tradeType: TradeType,
    options: QuoteOptions = {}
  ): MethodParameters {
    const singleHop = route.pools.length === 1
    const quoteAmount: string = toHex(amount.quotient)
    let calldata: string

    if (singleHop) {
      if (tradeType === TradeType.EXACT_INPUT) {
        if (options.useQuoterV2) {
          const quoteExactInputSingleParams = {
            tokenIn: route.tokenPath[0].address,
            tokenOut: route.tokenPath[1].address,
            amountIn: quoteAmount,
            fee: route.pools[0].fee,
            sqrtPriceLimitX96: toHex(options?.sqrtPriceLimitX96 ?? 0)
          }
          const swap = new Interface(IQuoterV2.abi)
          calldata = swap.encodeFunctionData(`quoteExactInputSingle`, [quoteExactInputSingleParams])
        } else {
          calldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactInputSingle`, [
            route.tokenPath[0].address,
            route.tokenPath[1].address,
            route.pools[0].fee,
            quoteAmount,
            toHex(options?.sqrtPriceLimitX96 ?? 0)
          ])
        }
      } else {
        if (options.useQuoterV2) {
          const quoteExactOutputSingleParams = {
            tokenIn: route.tokenPath[0].address,
            tokenOut: route.tokenPath[1].address,
            amount: quoteAmount,
            fee: route.pools[0].fee,
            sqrtPriceLimitX96: toHex(options?.sqrtPriceLimitX96 ?? 0)
          }
          const swap = new Interface(IQuoterV2.abi)
          calldata = swap.encodeFunctionData(`quoteExactOutputSingle`, [quoteExactOutputSingleParams])
        } else {
          calldata = SwapQuoter.INTERFACE.encodeFunctionData(`quoteExactOutputSingle`, [
            route.tokenPath[0].address,
            route.tokenPath[1].address,
            route.pools[0].fee,
            quoteAmount,
            toHex(options?.sqrtPriceLimitX96 ?? 0)
          ])
        }
      }
    } else {
      invariant(options?.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')
      const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)

      if (tradeType === TradeType.EXACT_INPUT) {
        calldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactInput', [path, quoteAmount])
      } else {
        calldata = SwapQuoter.INTERFACE.encodeFunctionData('quoteExactOutput', [path, quoteAmount])
      }
    }
    return {
      calldata,
      value: toHex(0)
    }
  }
}
