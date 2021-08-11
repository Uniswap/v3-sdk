import { Interface } from '@ethersproject/abi'
import { BigintIsh, Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { Trade } from './entities/trade'
import { ADDRESS_ZERO } from './constants'
import { PermitOptions, SelfPermit } from './selfPermit'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'

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


  public static quoteCallParameters(
    trades: Trade<Currency, Currency, TradeType> | Trade<Currency, Currency, TradeType>[],
    options: QuoteOptions
  ): MethodParameters {
    if (!Array.isArray(trades)) {
      trades = [trades]
    }

    const sampleTrade = trades[0]
    const tokenIn = sampleTrade.inputAmount.currency.wrapped
    const tokenOut = sampleTrade.outputAmount.currency.wrapped
    
   // All trades should have the same starting and ending token.
    invariant(
        trades.every(trade => trade.inputAmount.currency.wrapped.equals(tokenIn)),
        'TOKEN_IN_DIFF'
      )
      invariant(
        trades.every(trade => trade.outputAmount.currency.wrapped.equals(tokenOut)),
        'TOKEN_OUT_DIFF'
      )

       const calldatas: string[] = []

       const ZERO_IN: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].inputAmount.currency, 0)
       const ZERO_OUT: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].outputAmount.currency, 0)

      //  const totalAmountOut: CurrencyAmount<Currency> = trades.reduce(
      //    (sum, trade) => sum.add(trade.minimumAmountOut(options.slippageTolerance)),
      //    ZERO_OUT
      //  )
       

       for (const trade of trades) {
         for (const { route, inputAmount, outputAmount } of trade.swaps) {
          
          // flag for whether the trade is single hop or not  
          const singleHop = route.pools.length === 1

          if (singleHop) {
            if (trade.tradeType === TradeType.EXACT_INPUT) {
              const exactInputSingleParams = {
              tokenIn: route.tokenPath[0].address,
              tokenOut: route.tokenPath[1].address,
              fee: route.pools[0].fee,
              amountIn: inputAmount,
              sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0)
              }

              calldatas.push(SwapQuoter.INTERFACE,encodeFunctionData('quoteExactInputSingle', [exactInputSingleParams]))
            } else {
              const exactOutputSingleParams = {
                tokenIn: route.tokenPath[0].address,
                tokenOut: route.tokenPath[1].address,
                fee: route.pools[0].fee,
                amountOut: outputAmount,
                sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0)
              }
              calldatas.push(SwapQuoter.INTERFACE,encodeFunctionData('quoteExactOutputSingle', [exactInputSingleParams]))
            }
          }
         }
       }
       return {
        calldata:
          calldatas.length === 1 ? calldatas[0] : SwapQuoter.INTERFACE.encodeFunctionData('multicall', [calldatas]),
        value: toHex(totalValue.quotient)
      }
  }
}
