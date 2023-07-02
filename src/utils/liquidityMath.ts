import JSBI from 'jsbi'
import { bigIntFromBigintIsh } from './bigintIsh'

export abstract class LiquidityMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static addDelta<T extends bigint | JSBI>(_x: T, _y: T): T {
    const x = bigIntFromBigintIsh(_x)
    const y = bigIntFromBigintIsh(_y)

    let returnValue: bigint
    if (y < 0n) {
      returnValue = x - y * -1n
    } else {
      returnValue = x + y
    }

    if (typeof _x === 'bigint') {
      return returnValue as T
    } else {
      return JSBI.BigInt(returnValue.toString(10)) as T
    }
  }
}
