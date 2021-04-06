import { TickMath } from '../utils'
import { Tick } from './tick'
import { TickList } from './tickList'

describe('TickMap', () => {
  let highTick: Tick
  let lowTick: Tick
  let midTick: Tick

  beforeEach(() => {
    lowTick = new Tick({
      index: TickMath.MIN_TICK + 1,
      liquidityNet: 10,
      liquidityGross: 10
    })
    midTick = new Tick({
      index: 0,
      liquidityNet: -5,
      liquidityGross: 5
    })
    highTick = new Tick({
      index: TickMath.MAX_TICK - 1,
      liquidityNet: -5,
      liquidityGross: 5
    })
  })

  describe('constructor', () => {
    it('errors for incomplete lists', () => {
      expect(() => {
        new TickList([lowTick])
      }).toThrow('ZERO_NET')
    })

    it('should sort the initial ticks', () => {
      const unsorted = [highTick, lowTick, midTick]

      const result = new TickList(unsorted)
      expect(result.ticks).toEqual([lowTick, midTick, highTick])
      expect(unsorted).toEqual([highTick, lowTick, midTick]) // ensure passed list isn't sorted
    })
  })

  it('#isBelowSmallest', () => {
    const result = new TickList([lowTick, midTick, highTick])
    expect(result.isBelowSmallest(TickMath.MIN_TICK)).toBe(true)
    expect(result.isBelowSmallest(TickMath.MIN_TICK + 1)).toBe(false)
  })

  it('#isAtOrAboveLargest', () => {
    const result = new TickList([lowTick, midTick, highTick])
    expect(result.isAtOrAboveLargest(TickMath.MAX_TICK - 2)).toBe(false)
    expect(result.isAtOrAboveLargest(TickMath.MAX_TICK - 1)).toBe(true)
  })

  describe('#nextInitializedTick', () => {
    let result: TickList

    beforeEach(() => {
      result = new TickList([lowTick, midTick, highTick])
    })

    it('low - lte = true', () => {
      expect(() => {
        result.nextInitializedTick(TickMath.MIN_TICK, true)
      }).toThrow('BELOW_SMALLEST')

      expect(result.nextInitializedTick(TickMath.MIN_TICK + 1, true)).toEqual(lowTick)
      expect(result.nextInitializedTick(TickMath.MIN_TICK + 2, true)).toEqual(lowTick)
    })

    it('low - lte = false', () => {
      expect(result.nextInitializedTick(TickMath.MIN_TICK, false)).toEqual(lowTick)
      expect(result.nextInitializedTick(TickMath.MIN_TICK + 1, false)).toEqual(midTick)
    })

    it('mid - lte = true', () => {
      expect(result.nextInitializedTick(0, true)).toEqual(midTick)
      expect(result.nextInitializedTick(1, true)).toEqual(midTick)
    })

    it('mid - lte = false', () => {
      expect(result.nextInitializedTick(-1, false)).toEqual(midTick)
      expect(result.nextInitializedTick(0 + 1, false)).toEqual(highTick)
    })

    it('high - lte = true', () => {
      expect(result.nextInitializedTick(TickMath.MAX_TICK - 1, true)).toEqual(highTick)
      expect(result.nextInitializedTick(TickMath.MAX_TICK, true)).toEqual(highTick)
    })

    it('high - lte = false', () => {
      expect(() => {
        result.nextInitializedTick(TickMath.MAX_TICK - 1, false)
      }).toThrow('AT_OR_ABOVE_LARGEST')

      expect(result.nextInitializedTick(TickMath.MAX_TICK - 2, false)).toEqual(highTick)
      expect(result.nextInitializedTick(TickMath.MAX_TICK - 3, false)).toEqual(highTick)
    })
  })

  describe('#nextInitializedTickWithinOneWord', () => {
    let result: TickList

    beforeEach(() => {
      result = new TickList([lowTick, midTick, highTick])
    })

    it('words around 0, lte = true', () => {
      expect(result.nextInitializedTickWithinOneWord(-257, true)).toEqual([-512, false])
      expect(result.nextInitializedTickWithinOneWord(-256, true)).toEqual([-256, false])
      expect(result.nextInitializedTickWithinOneWord(-1, true)).toEqual([-256, false])
      expect(result.nextInitializedTickWithinOneWord(0, true)).toEqual([0, true])
      expect(result.nextInitializedTickWithinOneWord(1, true)).toEqual([0, true])
      expect(result.nextInitializedTickWithinOneWord(255, true)).toEqual([0, true])
      expect(result.nextInitializedTickWithinOneWord(256, true)).toEqual([256, false])
      expect(result.nextInitializedTickWithinOneWord(257, true)).toEqual([256, false])
    })

    it('words around 0, lte = false', () => {
      expect(result.nextInitializedTickWithinOneWord(-258, false)).toEqual([-257, false])
      expect(result.nextInitializedTickWithinOneWord(-257, false)).toEqual([-1, false])
      expect(result.nextInitializedTickWithinOneWord(-256, false)).toEqual([-1, false])
      expect(result.nextInitializedTickWithinOneWord(-2, false)).toEqual([-1, false])
      expect(result.nextInitializedTickWithinOneWord(-1, false)).toEqual([0, true])
      expect(result.nextInitializedTickWithinOneWord(0, false)).toEqual([255, false])
      expect(result.nextInitializedTickWithinOneWord(1, false)).toEqual([255, false])
      expect(result.nextInitializedTickWithinOneWord(254, false)).toEqual([255, false])
      expect(result.nextInitializedTickWithinOneWord(255, false)).toEqual([511, false])
      expect(result.nextInitializedTickWithinOneWord(256, false)).toEqual([511, false])
    })
  })
})
