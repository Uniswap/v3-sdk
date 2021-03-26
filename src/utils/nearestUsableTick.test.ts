import { MAX_TICK, MIN_TICK } from '../constants'
import { nearestUsableTick } from './nearestUsableTick'

describe('#nearestUsableTick', () => {
  it('throws if tickSpacing is 0', () => {
    expect(() => nearestUsableTick(1, 0)).toThrow('TICK_SPACING')
  })

  it('throws if tickSpacing is negative', () => {
    expect(() => nearestUsableTick(1, -5)).toThrow('TICK_SPACING')
  })

  it('throws if either is non-integer', () => {
    expect(() => nearestUsableTick(1.5, 1)).toThrow('INTEGERS')
    expect(() => nearestUsableTick(1, 1.5)).toThrow('INTEGERS')
  })

  it('throws if tick is greater than MAX_TICK', () => {
    expect(() => nearestUsableTick(MAX_TICK + 1, 1)).toThrow('TICK_BOUND')
    expect(() => nearestUsableTick(MIN_TICK - 1, 1)).toThrow('TICK_BOUND')
  })

  it('rounds at positive half', () => {
    expect(nearestUsableTick(5, 10)).toEqual(10)
  })

  it('rounds down below positive half', () => {
    expect(nearestUsableTick(4, 10)).toEqual(0)
  })

  it('rounds up for negative half', () => {
    expect(nearestUsableTick(-5, 10)).toEqual(-0)
  })

  it('rounds up for negative half', () => {
    expect(nearestUsableTick(-6, 10)).toEqual(-10)
  })

  it('cannot round past MIN_TICK', () => {
    expect(nearestUsableTick(MIN_TICK, MAX_TICK / 2 + 100)).toEqual(-(MAX_TICK / 2 + 100))
  })

  it('cannot round past MAX_TICK', () => {
    expect(nearestUsableTick(MAX_TICK, MAX_TICK / 2 + 100)).toEqual(MAX_TICK / 2 + 100)
  })
})
