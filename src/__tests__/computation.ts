import BigNumber from 'bignumber.js'

import { BigNumberish, TokenReserves, MarketDetails, OptionalReserves, TradeDetails } from '../types'
import { TRADE_TYPE, TRADE_EXACT, _10 } from '../constants'
import { getMarketDetails, getTradeDetails } from '../computation'

function constructTokenReserves(
  decimals: number,
  ethReserveAmount: BigNumberish,
  tokenReserveAmount: BigNumberish
): TokenReserves {
  return {
    token: { decimals },
    ethReserve: { token: { decimals: 18 }, amount: ethReserveAmount },
    tokenReserve: { token: { decimals }, amount: tokenReserveAmount }
  }
}

function testMarketRates(
  tradeType: TRADE_TYPE,
  inputTokenReserves: OptionalReserves,
  outputTokenReserves: OptionalReserves,
  expectedMarketRate: string,
  expectedMarketRateInverted: string
): void {
  test('not inverted', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(tradeType, inputTokenReserves, outputTokenReserves)

    expect(marketDetails.marketRate.rate.toFixed(18)).toBe(expectedMarketRate)
    expect(marketDetails.marketRate.rateInverted.toFixed(18)).toBe(expectedMarketRateInverted)
  })

  test('manually inverted', (): void => {
    const tradeTypeInverted = tradeType === TRADE_TYPE.ETH_TO_TOKEN ? TRADE_TYPE.TOKEN_TO_ETH : TRADE_TYPE.ETH_TO_TOKEN

    const marketDetails: MarketDetails = getMarketDetails(
      tradeType === TRADE_TYPE.TOKEN_TO_TOKEN ? TRADE_TYPE.TOKEN_TO_TOKEN : tradeTypeInverted,
      outputTokenReserves,
      inputTokenReserves
    )

    expect(marketDetails.marketRate.rate.toFixed(18)).toBe(expectedMarketRateInverted)
    expect(marketDetails.marketRate.rateInverted.toFixed(18)).toBe(expectedMarketRate)
  })
}

describe('getMarketDetails', (): void => {
  describe('dummy ETH/DAI and DAI/ETH', (): void => {
    const tokenReserves: TokenReserves = constructTokenReserves(
      18,
      '4039700561005906883487',
      '1094055210563660633471343'
    )
    const expectedMarketRate = '270.825818409480102284'
    const expectedMarketRateInverted = '0.003692410147130181'

    testMarketRates(TRADE_TYPE.ETH_TO_TOKEN, null, tokenReserves, expectedMarketRate, expectedMarketRateInverted)
  })

  describe('dummy ETH/USDC and USDC/ETH', (): void => {
    const tokenReserves: TokenReserves = constructTokenReserves(6, '1076592291503763426634', '292657693901')
    const expectedMarketRate = '0.003678674143683891'
    const expectedMarketRateInverted = '271.837069808684359442'

    testMarketRates(TRADE_TYPE.TOKEN_TO_ETH, tokenReserves, null, expectedMarketRate, expectedMarketRateInverted)
  })

  describe('dummy DAI/USDC and USDC/DAI', (): void => {
    const DAITokenReserves: TokenReserves = constructTokenReserves(
      18,
      '4039700561005906883487',
      '1094055210563660633471343'
    )
    const USDCTokenReserves: TokenReserves = constructTokenReserves(6, '1076592291503763426634', '292657693901')
    const expectedMarketRate = '1.003733954927721392'
    const expectedMarketRateInverted = '0.996279935624983143'

    testMarketRates(
      TRADE_TYPE.TOKEN_TO_TOKEN,
      DAITokenReserves,
      USDCTokenReserves,
      expectedMarketRate,
      expectedMarketRateInverted
    )
  })
})

function testTradeDetails(
  tradeExact: TRADE_EXACT,
  tradeAmount: BigNumber,
  marketDetails: MarketDetails,
  expectedInputValue: string,
  expectedExecutionRate: string,
  expectedExecutionRateInverted: string,
  expectedMarketRateSlippage: string,
  expectedExecutionRateSlippage: string
): void {
  test('test trade', (): void => {
    const tradeDetails: TradeDetails = getTradeDetails(tradeExact, tradeAmount, marketDetails)

    expect(tradeDetails.inputAmount.amount.toFixed(0)).toBe(expectedInputValue)
    expect(tradeDetails.executionRate.rate.toFixed(18)).toBe(expectedExecutionRate)
    expect(tradeDetails.executionRate.rateInverted.toFixed(18)).toBe(expectedExecutionRateInverted)

    expect(tradeDetails.marketRateSlippage.toFixed(18)).toBe(expectedMarketRateSlippage)
    expect(tradeDetails.executionRateSlippage.toFixed(18)).toBe(expectedExecutionRateSlippage)
  })
}

describe('getTradeDetails', (): void => {
  describe('dummy ETH/DAI and DAI/ETH', (): void => {
    const tokenReserves: TokenReserves = constructTokenReserves(
      18,
      '4039700561005906883487',
      '1094055210563660633471343'
    )

    const expectedInputValue = '370385925334764803'
    const expectedExecutionRate = '269.988660907180258319'
    const expectedExecutionRateInverted = '0.003703859253347648'
    const expectedMarketRateSlippage = '1.830727602963479922'
    const expectedExecutionRateSlippage = '30.911288562381013644'

    const marketDetails: MarketDetails = getMarketDetails(TRADE_TYPE.ETH_TO_TOKEN, null, tokenReserves)
    testTradeDetails(
      TRADE_EXACT.OUTPUT,
      new BigNumber(100).multipliedBy(_10.exponentiatedBy(18)),
      marketDetails,
      expectedInputValue,
      expectedExecutionRate,
      expectedExecutionRateInverted,
      expectedMarketRateSlippage,
      expectedExecutionRateSlippage
    )
  })
})
