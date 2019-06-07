import { BigNumberish, ChainIdOrProvider, TokenReservesNormalized, MarketDetails, TradeDetails } from '../types'

import { TRADE_TYPE, TRADE_EXACT, ETH } from '../constants'
import { getTokenReserves } from '../data'
import { getMarketDetails, getTradeDetails } from '../computation'

export async function getTrade(
  inputTokenAddress: string,
  outputTokenAddress: string,
  tradeType: TRADE_TYPE,
  tradeExact: TRADE_EXACT,
  tradeAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReservesInput: TokenReservesNormalized | null =
    inputTokenAddress === ETH ? null : await getTokenReserves(inputTokenAddress, chainIdOrProvider)
  const tokenReservesOutput: TokenReservesNormalized | null =
    outputTokenAddress === ETH ? null : await getTokenReserves(outputTokenAddress, chainIdOrProvider)

  const marketDetails: MarketDetails = getMarketDetails(tradeType, tokenReservesInput, tokenReservesOutput)

  return getTradeDetails(tradeExact, tradeAmount, marketDetails)
}
