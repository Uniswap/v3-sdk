import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'

import { SUPPORTED_CHAIN_ID, TRADE_TYPE, TRADE_EXACT, FIXED_UNDERFLOW_BEHAVIOR } from '../constants'

export type BigNumberish = BigNumber | ethers.utils.BigNumber | string | number

export type ChainIdOrProvider = SUPPORTED_CHAIN_ID | ethers.providers.BaseProvider

export interface ChainIdAndProvider {
  chainId: number
  provider: ethers.providers.BaseProvider
}

export interface Token {
  chainId?: SUPPORTED_CHAIN_ID
  address?: string
  decimals: number
}

export interface TokenAmount {
  token: Token
  amount: BigNumberish
}

export interface TokenReserves {
  token: Token
  exchange?: Token
  ethReserve: TokenAmount
  tokenReserve: TokenAmount
}
export type TokenReservesOptional = TokenReserves | null

export interface TradeDetails {
  tradeType: TRADE_TYPE
  tradeExact: TRADE_EXACT
  inputToken: Token
  outputToken: Token
  tradeAmount: string
  marketRate: string
  marketRateInverted: string
}

// formatting options
export type FlexibleFormat = boolean | BigNumber.Format

export interface FormatSignificantOptions {
  significantDigits: number
  forceIntegerSignificance: boolean
  format: FlexibleFormat
}
export interface FormatFixedOptions {
  decimalPlaces: number
  dropTrailingZeros: boolean
  underflowBehavior: FIXED_UNDERFLOW_BEHAVIOR
  format: FlexibleFormat
}
