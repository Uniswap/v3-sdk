import { Tick } from './tick'
import { TickList } from './tickList'
import { MAX_TICK, MIN_TICK } from '../constants'

describe('TickMap', () => {
  let highTick: Tick
  let lowTick: Tick
  let midTick: Tick
  let listDefault: TickList
  beforeEach(() => {
    lowTick = new Tick({
      feeGrowthOutside0X128: 2,
      feeGrowthOutside1X128: 3,
      index: MIN_TICK + 1,
      liquidityNet: 0,
      liquidityGross: 0
    })
    midTick = new Tick({
      feeGrowthOutside0X128: 2,
      feeGrowthOutside1X128: 3,
      index: 0,
      liquidityNet: 0,
      liquidityGross: 0
    })
    highTick = new Tick({
      feeGrowthOutside0X128: 4,
      feeGrowthOutside1X128: 1,
      index: MAX_TICK - 1,
      liquidityNet: 0,
      liquidityGross: 0
    })

    listDefault = new TickList({ ticks: [lowTick, midTick, highTick] })
  })
  describe('constructor', () => {
    it('should sort the initial ticks', () => {
      const result = new TickList({ ticks: [highTick, lowTick, midTick] })
      expect(result.head?.value.index).toEqual(MAX_TICK - 1)
      expect(result.tail?.value.index).toEqual(MIN_TICK + 1)
    })
  })
  describe('insert', () => {
    it('should sort new lower ticks to tail', () => {
      const t = {
        feeGrowthOutside0X128: 0,
        feeGrowthOutside1X128: 0,
        index: MIN_TICK,
        liquidityNet: 0,
        liquidityGross: 0
      }
      expect(listDefault.tail?.value.index).toEqual(MIN_TICK + 1)
      listDefault.insert(new Tick(t))
      expect(listDefault.tail?.value.index).toEqual(MIN_TICK)
    })
    it('should sort new higher ticks to head', () => {
      const t = {
        feeGrowthOutside0X128: 0,
        feeGrowthOutside1X128: 0,
        index: MAX_TICK,
        liquidityNet: 0,
        liquidityGross: 0
      }
      expect(listDefault.head?.value.index).toEqual(MAX_TICK - 1)
      listDefault.insert(new Tick(t))
      expect(listDefault.head?.value.index).toEqual(MAX_TICK)
    })
    it('should set a new tick to both head and tail if there are no other ticks', () => {
      const result = new TickList({ ticks: [] })
      const t = {
        feeGrowthOutside0X128: 0,
        feeGrowthOutside1X128: 0,
        index: MAX_TICK,
        liquidityNet: 0,
        liquidityGross: 0
      }
      result.insert(new Tick(t))
      expect(result.head?.value.index).toEqual(MAX_TICK)
    })
    it('should be able to insert a tick in the middle', () => {
      const result = new TickList({ ticks: [lowTick, highTick] })
      expect(result.head?.left?.value.index).toEqual(lowTick.index)
      expect(result.tail?.right?.value.index).toEqual(highTick.index)
      expect(result.values.length).toBe(2)
    })
  })
  describe('dequeue', () => {
    it('should remove the last item and leave an empty set', () => {
      listDefault.dequeue()
      listDefault.dequeue()
      listDefault.dequeue()
      expect(listDefault.tail).toBeUndefined()
      expect(listDefault.head).toBeUndefined()
      expect(listDefault.values.length).toBe(0)
    })
    it('should remove the first item and return it', () => {
      expect(listDefault.head?.value.index).toBe(MAX_TICK - 1)
      const result = listDefault.dequeue()
      expect(result).toBeDefined()
      expect((result as Tick).index).toEqual(MAX_TICK - 1)
      expect(listDefault.head?.value.index).toBe(0)
    })
  })
  describe('pop', () => {
    it('should remove the last item and return it', () => {
      expect(listDefault.tail?.value.index).toBe(MIN_TICK + 1)
      const result = listDefault.pop()
      expect(result).toBeDefined()
      expect((result as Tick).index).toEqual(MIN_TICK + 1)
      expect(listDefault.tail?.value.index).toBe(0)
    })
    it('should remove all items and leave an empty set', () => {
      listDefault.pop()
      listDefault.pop()
      listDefault.pop()
      expect(listDefault.tail).toBeUndefined()
      expect(listDefault.head).toBeUndefined()
      expect(listDefault.values.length).toBe(0)
    })
  })
  describe('values', () => {
    it('should list ticks from least to greatest', () => {
      const initialTicks = listDefault.values.map(tick => tick.index)
      expect(listDefault.values.map(tick => tick.index)).toEqual(initialTicks)

      listDefault.insert(
        new Tick({
          feeGrowthOutside0X128: 0,
          feeGrowthOutside1X128: 0,
          index: MAX_TICK,
          liquidityNet: 0,
          liquidityGross: 0
        })
      )
      const result = listDefault.values.map(tick => tick.index)
      expect(result).toEqual([lowTick.index, midTick.index, highTick.index, MAX_TICK])
    })
  })
})
