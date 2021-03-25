import JSBI from 'jsbi'
import { ONE } from '../constants'
import { TickMath } from './tickMath'

describe('TickMath', () => {
  describe('#MIN_TICK', () => {
    it('equals correct value', () => {
      expect(TickMath.MIN_TICK).toEqual(-887272)
    })
  })
  describe('#MAX_TICK', () => {
    it('equals correct value', () => {
      expect(TickMath.MAX_TICK).toEqual(887272)
    })
  })
  describe('#getSqrtRatioAtTick', () => {
    it('returns the correct value for min tick', () => {
      expect(TickMath.getSqrtRatioAtTick(TickMath.MIN_TICK)).toEqual(TickMath.MIN_SQRT_RATIO)
    })
    it('returns the correct value for max tick', () => {
      expect(TickMath.getSqrtRatioAtTick(TickMath.MAX_TICK)).toEqual(TickMath.MAX_SQRT_RATIO)
    })
  })
  describe('#getTickAtSqrtRatio', () => {
    it('returns the correct value for sqrt ratio at min tick', () => {
      expect(TickMath.getTickAtSqrtRatio(TickMath.MIN_SQRT_RATIO)).toEqual(TickMath.MIN_TICK)
    })
    it('returns the correct value for sqrt ratio at max tick', () => {
      expect(TickMath.getTickAtSqrtRatio(JSBI.subtract(TickMath.MAX_SQRT_RATIO, ONE))).toEqual(TickMath.MAX_TICK - 1)
    })
  })
})
