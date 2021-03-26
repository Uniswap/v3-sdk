import { MaxUint256 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { encodeSqrtRatioX96 } from './encodeSqrtRatioX96'
import { maxLiquidityForAmounts } from './maxLiquidityForAmounts'

describe('#maxLiquidityForAmounts', () => {
  describe('price inside', () => {
    it('100 token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(1, 1),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          '200'
        )
      ).toEqual(JSBI.BigInt(2148))
    })

    it('100 token0, max token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(1, 1),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          MaxUint256
        )
      ).toEqual(JSBI.BigInt(2148))
    })

    it('max token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(1, 1),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          MaxUint256,
          '200'
        )
      ).toEqual(JSBI.BigInt(4297))
    })
  })

  describe('price below', () => {
    it('100 token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(99, 110),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          '200'
        )
      ).toEqual(JSBI.BigInt(1048))
    })

    it('100 token0, max token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(99, 110),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          MaxUint256
        )
      ).toEqual(JSBI.BigInt(1048))
    })

    it('max token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(99, 110),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          MaxUint256,
          '200'
        )
      ).toEqual(JSBI.BigInt('1214437677402050007333267793366384996834277066342008356984830732785970831971444'))
    })
  })

  describe('price above', () => {
    it('100 token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(111, 100),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          '200'
        )
      ).toEqual(JSBI.BigInt(2097))
    })

    it('100 token0, max token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(111, 100),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          '100',
          MaxUint256
        )
      ).toEqual(JSBI.BigInt('1214437677402050007479718646173999853567847189792746294814310060494544602578281'))
    })

    it('max token0, 200 token1', () => {
      expect(
        maxLiquidityForAmounts(
          encodeSqrtRatioX96(111, 100),
          encodeSqrtRatioX96(100, 110),
          encodeSqrtRatioX96(110, 100),
          MaxUint256,
          '200'
        )
      ).toEqual(JSBI.BigInt(2097))
    })
  })
})
