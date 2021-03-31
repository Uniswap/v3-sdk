import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'
import { Tick } from './tick'

export class TickList {
  public readonly ticks: Tick[]

  constructor(ticks: Tick[], tickSpacing: number = 1) {
    invariant(ticks.length >= 2, 'TICKS')

    // ensure ticks are spaced appropriately
    invariant(ticks.every(({ index }) => index % tickSpacing === 0))

    // ensure tick liquidity deltas sum to 0
    invariant(
      JSBI.equal(
        ticks.reduce((accumulator, { liquidityNet }) => JSBI.add(accumulator, liquidityNet), ZERO),
        ZERO
      ),
      'ZERO_NET'
    )

    // sort ticks
    this.ticks = ticks.slice().sort(({ index: a }, { index: b }) => (a < b ? -1 : 1))
  }

  public isBelowSmallest(tick: number): boolean {
    return tick < this.ticks[0].index
  }

  public isAtOrAboveLargest(tick: number): boolean {
    return tick >= this.ticks[this.ticks.length - 1].index
  }

  private binarySearch(tick: number): number {
    invariant(!this.isBelowSmallest(tick), 'BELOW_SMALLEST')
    invariant(!this.isAtOrAboveLargest(tick), 'AT_OR_ABOVE_LARGEST')

    let l = 0
    let r = this.ticks.length - 1
    let i
    while (true) {
      i = Math.floor((l + r) / 2)

      if (this.ticks[i].index <= tick && this.ticks[i + 1].index > tick) {
        return i
      }

      if (this.ticks[i].index < tick) {
        l = i + 1
      } else {
        r = i - 1
      }
    }
  }

  public nextInitializedTick(tick: number, lte: boolean): Tick {
    if (lte) {
      invariant(!this.isBelowSmallest(tick), 'BELOW_SMALLEST')
      if (this.isAtOrAboveLargest(tick)) {
        return this.ticks[this.ticks.length - 1]
      }
      const index = this.binarySearch(tick)
      return this.ticks[index]
    } else {
      invariant(!this.isAtOrAboveLargest(tick), 'AT_OR_ABOVE_LARGEST')
      if (this.isBelowSmallest(tick)) {
        return this.ticks[0]
      }
      const index = this.binarySearch(tick)
      return this.ticks[index + 1]
    }
  }
}
