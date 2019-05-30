import BigNumber from 'bignumber.js'

import { BigNumberish, TokenReserves } from '../types'
import { TRADE_TYPE } from '../constants'
import { getMarketRate } from '../computation'

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
  inputTokenReserves: TokenReserves | null,
  outputTokenReserves: TokenReserves | null,
  tradeType: TRADE_TYPE,
  expectedMarketRate: string,
  expectedMarketRateInverted: string
): void {
  describe('regular', (): void => {
    test('not inverted', (): void => {
      const marketRate: BigNumber = getMarketRate(inputTokenReserves, outputTokenReserves, tradeType, false)
      expect(marketRate.toFixed(18)).toBe(expectedMarketRate)
    })

    test('inverted', (): void => {
      const marketRateInverted: BigNumber = getMarketRate(inputTokenReserves, outputTokenReserves, tradeType, true)
      expect(marketRateInverted.toFixed(18)).toBe(expectedMarketRateInverted)
    })
  })

  describe('manually inverted', (): void => {
    const tradeTypeInverted =
      tradeType === TRADE_TYPE.TOKEN_TO_TOKEN
        ? TRADE_TYPE.TOKEN_TO_TOKEN
        : tradeType === TRADE_TYPE.ETH_TO_TOKEN
        ? TRADE_TYPE.TOKEN_TO_ETH
        : TRADE_TYPE.ETH_TO_TOKEN

    test('not inverted', (): void => {
      const manuallyInvertedMarketRate: BigNumber = getMarketRate(
        outputTokenReserves,
        inputTokenReserves,
        tradeTypeInverted,
        false
      )

      expect(manuallyInvertedMarketRate.toFixed(18)).toBe(expectedMarketRateInverted)
    })

    test('inverted', (): void => {
      const manuallyInvertedInvertedMarketRate: BigNumber = getMarketRate(
        outputTokenReserves,
        inputTokenReserves,
        tradeTypeInverted,
        true
      )

      expect(manuallyInvertedInvertedMarketRate.toFixed(18)).toBe(expectedMarketRate)
    })
  })
}

describe('getMarketRate', (): void => {
  describe('dummy ETH/DAI and DAI/ETH', (): void => {
    const tokenReserves: TokenReserves = constructTokenReserves(
      18,
      '4039700561005906883487',
      '1094055210563660633471343'
    )
    const expectedMarketRate = '0.003692410147130181'
    const expectedMarketRateInverted = '270.825818409480102284'

    testMarketRates(null, tokenReserves, TRADE_TYPE.ETH_TO_TOKEN, expectedMarketRate, expectedMarketRateInverted)
    testMarketRates(tokenReserves, null, TRADE_TYPE.TOKEN_TO_ETH, expectedMarketRateInverted, expectedMarketRate)
  })

  describe('dummy ETH/USDC and USDC/ETH', (): void => {
    const tokenReserves: TokenReserves = constructTokenReserves(6, '1076592291503763426634', '292657693901')
    const expectedMarketRate = '0.003678674143683891'
    const expectedMarketRateInverted = '271.837069808684359442'

    testMarketRates(null, tokenReserves, TRADE_TYPE.ETH_TO_TOKEN, expectedMarketRate, expectedMarketRateInverted)
    testMarketRates(tokenReserves, null, TRADE_TYPE.TOKEN_TO_ETH, expectedMarketRateInverted, expectedMarketRate)
  })

  describe('dummy DAI/USDC and USDC/DAI', (): void => {
    const DAITokenReserves: TokenReserves = constructTokenReserves(
      18,
      '4039700561005906883487',
      '1094055210563660633471343'
    )
    const USDCTokenReserves: TokenReserves = constructTokenReserves(6, '1076592291503763426634', '292657693901')
    const expectedMarketRate = '0.996279935624983178'
    const expectedMarketRateInverted = '1.003733954927721499'

    testMarketRates(
      DAITokenReserves,
      USDCTokenReserves,
      TRADE_TYPE.TOKEN_TO_TOKEN,
      expectedMarketRate,
      expectedMarketRateInverted
    )

    testMarketRates(
      USDCTokenReserves,
      DAITokenReserves,
      TRADE_TYPE.TOKEN_TO_TOKEN,
      expectedMarketRateInverted,
      expectedMarketRate
    )
  })
})
