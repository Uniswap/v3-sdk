import JSBI from 'jsbi'
import { encodeSqrtRatioX96 } from './encodeSqrtRatioX96'
import { maxLiquidityForAmounts } from './maxLiquidityForAmounts'

describe('#maxLiquidityForAmounts', () => {
  it('amounts for price inside', () => {
    const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
    const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
    const liquidity = maxLiquidityForAmounts(encodeSqrtRatioX96(1, 1), sqrtPriceAX96, sqrtPriceBX96, '100', '200')
    expect(liquidity).toEqual(JSBI.BigInt(2148))
  })

  it('amounts for price below', () => {
    const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
    const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
    const liquidity = maxLiquidityForAmounts(encodeSqrtRatioX96(99, 110), sqrtPriceAX96, sqrtPriceBX96, '100', '200')
    expect(liquidity).toEqual(JSBI.BigInt(1048))
  })

  it('amounts for price above', () => {
    const sqrtPriceAX96 = encodeSqrtRatioX96(100, 110)
    const sqrtPriceBX96 = encodeSqrtRatioX96(110, 100)
    const liquidity = maxLiquidityForAmounts(encodeSqrtRatioX96(111, 100), sqrtPriceAX96, sqrtPriceBX96, '100', '200')
    expect(liquidity).toEqual(JSBI.BigInt(2097))
  })
})
