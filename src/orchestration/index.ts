import {
  BigNumberish,
  ChainIdOrProvider,
  TokenReservesNormalized,
  OptionalReserves,
  MarketDetails,
  TradeDetails
} from '../types'
import { TRADE_EXACT } from '../constants'
import { getTokenReserves } from '../data'
import { getMarketDetails, getTradeDetails } from '../computation'

//// eth for tokens
export function tradeExactEthForTokensWithData(reserves: OptionalReserves, ethAmount: BigNumberish): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(undefined, reserves)
  return getTradeDetails(TRADE_EXACT.INPUT, ethAmount, marketDetails)
}

export async function tradeExactEthForTokens(
  tokenAddress: string,
  ethAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReserves: TokenReservesNormalized = await getTokenReserves(tokenAddress, chainIdOrProvider)
  return tradeExactEthForTokensWithData(tokenReserves, ethAmount)
}

export function tradeEthForExactTokensWithData(reserves: OptionalReserves, tokenAmount: BigNumberish): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(undefined, reserves)
  return getTradeDetails(TRADE_EXACT.OUTPUT, tokenAmount, marketDetails)
}

export async function tradeEthForExactTokens(
  tokenAddress: string,
  tokenAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReserves: TokenReservesNormalized = await getTokenReserves(tokenAddress, chainIdOrProvider)
  return tradeEthForExactTokensWithData(tokenReserves, tokenAmount)
}

//// tokens to eth
export function tradeExactTokensForEthWithData(reserves: OptionalReserves, tokenAmount: BigNumberish): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(reserves, undefined)
  return getTradeDetails(TRADE_EXACT.INPUT, tokenAmount, marketDetails)
}

export async function tradeExactTokensForEth(
  tokenAddress: string,
  tokenAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReserves: TokenReservesNormalized = await getTokenReserves(tokenAddress, chainIdOrProvider)
  return tradeExactTokensForEthWithData(tokenReserves, tokenAmount)
}

export function tradeTokensForExactEthWithData(reserves: OptionalReserves, ethAmount: BigNumberish): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(reserves, undefined)
  return getTradeDetails(TRADE_EXACT.OUTPUT, ethAmount, marketDetails)
}

export async function tradeTokensForExactEth(
  tokenAddress: string,
  ethAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReserves: TokenReservesNormalized = await getTokenReserves(tokenAddress, chainIdOrProvider)
  return tradeTokensForExactEthWithData(tokenReserves, ethAmount)
}

//// tokens for tokens
export function tradeExactTokensForTokensWithData(
  reservesInput: OptionalReserves,
  reservesOutput: OptionalReserves,
  tokenAmount: BigNumberish
): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(reservesInput, reservesOutput)
  return getTradeDetails(TRADE_EXACT.INPUT, tokenAmount, marketDetails)
}

export async function tradeExactTokensForTokens(
  tokenAddressInput: string,
  tokenAddressOutput: string,
  tokenAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReservesInput: TokenReservesNormalized = await getTokenReserves(tokenAddressInput, chainIdOrProvider)
  const tokenReservesOutput: TokenReservesNormalized = await getTokenReserves(tokenAddressOutput, chainIdOrProvider)
  return tradeExactTokensForTokensWithData(tokenReservesInput, tokenReservesOutput, tokenAmount)
}

export function tradeTokensForExactTokensWithData(
  reservesInput: OptionalReserves,
  reservesOutput: OptionalReserves,
  tokenAmount: BigNumberish
): TradeDetails {
  const marketDetails: MarketDetails = getMarketDetails(reservesInput, reservesOutput)
  return getTradeDetails(TRADE_EXACT.OUTPUT, tokenAmount, marketDetails)
}

export async function tradeTokensForExactTokens(
  tokenAddressInput: string,
  tokenAddressOutput: string,
  tokenAmount: BigNumberish,
  chainIdOrProvider?: ChainIdOrProvider
): Promise<TradeDetails> {
  const tokenReservesInput: TokenReservesNormalized = await getTokenReserves(tokenAddressInput, chainIdOrProvider)
  const tokenReservesOutput: TokenReservesNormalized = await getTokenReserves(tokenAddressOutput, chainIdOrProvider)
  return tradeTokensForExactTokensWithData(tokenReservesInput, tokenReservesOutput, tokenAmount)
}
