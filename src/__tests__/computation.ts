import { BigNumberish, TokenReserves, MarketDetails, OptionalReserves, TradeDetails } from '../types'
import { TRADE_EXACT } from '../constants'
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

const DAIReserves: TokenReserves = constructTokenReserves(18, '4039700561005906883487', '1094055210563660633471343')
const USDCReserves: TokenReserves = constructTokenReserves(6, '1076592291503763426634', '292657693901')

function testMarketRates(
  inputTokenReserves: OptionalReserves,
  outputTokenReserves: OptionalReserves,
  expectedMarketRate: string,
  expectedMarketRateInverted: string
): void {
  test('normal', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(inputTokenReserves, outputTokenReserves)
    expect(marketDetails.marketRate.rate.toFixed(18)).toBe(expectedMarketRate)
    expect(marketDetails.marketRate.rateInverted.toFixed(18)).toBe(expectedMarketRateInverted)
  })

  test('inverted', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(outputTokenReserves, inputTokenReserves)
    expect(marketDetails.marketRate.rate.toFixed(18)).toBe(expectedMarketRateInverted)
    expect(marketDetails.marketRate.rateInverted.toFixed(18)).toBe(expectedMarketRate)
  })
}

describe('getMarketDetails', (): void => {
  describe('DAI', (): void => {
    const expectedMarketRate = '270.825818409480102284'
    const expectedMarketRateInverted = '0.003692410147130181'
    testMarketRates(undefined, DAIReserves, expectedMarketRate, expectedMarketRateInverted)
  })

  describe('USDC', (): void => {
    const expectedMarketRate = '0.003678674143683891'
    const expectedMarketRateInverted = '271.837069808684359442'
    testMarketRates(USDCReserves, undefined, expectedMarketRate, expectedMarketRateInverted)
  })

  describe('DAI and USDC', (): void => {
    const expectedMarketRate = '1.003733954927721392'
    const expectedMarketRateInverted = '0.996279935624983143'

    testMarketRates(DAIReserves, USDCReserves, expectedMarketRate, expectedMarketRateInverted)
  })
})

function testTradeDetails(
  tradeExact: TRADE_EXACT,
  tradeAmount: BigNumberish,
  marketDetails: MarketDetails,
  expectedInputValue: string,
  expectedOutputValue: string,
  expectedExecutionRate: string,
  expectedExecutionRateInverted: string,
  expectedMarketRateSlippage: string,
  expectedExecutionRateSlippage: string
): void {
  test('test trade', (): void => {
    const tradeDetails: TradeDetails = getTradeDetails(tradeExact, tradeAmount, marketDetails)

    expect(tradeDetails.inputAmount.amount.toFixed(0)).toBe(expectedInputValue)
    expect(tradeDetails.outputAmount.amount.toFixed(0)).toBe(expectedOutputValue)

    expect(tradeDetails.executionRate.rate.toFixed(18)).toBe(expectedExecutionRate)
    expect(tradeDetails.executionRate.rateInverted.toFixed(18)).toBe(expectedExecutionRateInverted)

    expect(tradeDetails.marketRateSlippage.toFixed(18)).toBe(expectedMarketRateSlippage)
    expect(tradeDetails.executionRateSlippage.toFixed(18)).toBe(expectedExecutionRateSlippage)
  })
}

describe('getTradeDetails', (): void => {
  describe('ETH for DAI exact output', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(undefined, DAIReserves)

    const expectedInputValue = '370385925334764803'
    const expectedOutputValue = '100000000000000000000'
    const expectedExecutionRate = '269.988660907180258319'
    const expectedExecutionRateInverted = '0.003703859253347648'
    const expectedMarketRateSlippage = '1.830727602963479922'
    const expectedExecutionRateSlippage = '30.911288562381013644'

    testTradeDetails(
      TRADE_EXACT.OUTPUT,
      expectedOutputValue,
      marketDetails,
      expectedInputValue,
      expectedOutputValue,
      expectedExecutionRate,
      expectedExecutionRateInverted,
      expectedMarketRateSlippage,
      expectedExecutionRateSlippage
    )
  })

  describe('DAI for ETH exact output', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(DAIReserves, undefined)

    const expectedInputValue = '271708000072010674989'
    const expectedOutputValue = '1000000000000000000'
    const expectedExecutionRate = '0.003680421628126409'
    const expectedExecutionRateInverted = '271.708000072010674989'
    const expectedMarketRateSlippage = '4.957694170529155578'
    const expectedExecutionRateSlippage = '32.468004707141566275'

    testTradeDetails(
      TRADE_EXACT.OUTPUT,
      expectedOutputValue,
      marketDetails,
      expectedInputValue,
      expectedOutputValue,
      expectedExecutionRate,
      expectedExecutionRateInverted,
      expectedMarketRateSlippage,
      expectedExecutionRateSlippage
    )
  })

  describe('DAI for USDC exact input', (): void => {
    const marketDetails: MarketDetails = getMarketDetails(DAIReserves, USDCReserves)

    const expectedInputValue = '1000000000000000000'
    const expectedOutputValue = '997716'
    const expectedExecutionRate = '0.997716000000000000'
    const expectedExecutionRateInverted = '1.002289228598118102'
    const expectedMarketRateSlippage = '0.086538655703617094'
    const expectedExecutionRateSlippage = '59.955677479843185050'

    testTradeDetails(
      TRADE_EXACT.INPUT,
      expectedInputValue,
      marketDetails,
      expectedInputValue,
      expectedOutputValue,
      expectedExecutionRate,
      expectedExecutionRateInverted,
      expectedMarketRateSlippage,
      expectedExecutionRateSlippage
    )
  })
})
