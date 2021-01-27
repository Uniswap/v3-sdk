import JSBI from 'jsbi'

export default abstract class TickMath {
  static getRatioAtTick(tick: number): JSBI {
    return JSBI.BigInt(tick)
  }
  static getTickAtRatio(ratio: JSBI): number {
    return JSBI.toNumber(ratio)
  }
}
