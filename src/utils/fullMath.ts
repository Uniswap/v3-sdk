import JSBI from 'jsbi'
import { bigIntFromBigintIsh } from './bigintIsh'

export abstract class FullMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static mulDivRoundingUp<T extends bigint | JSBI>(_a: T, _b: T, _denominator: T): T {
    const a = bigIntFromBigintIsh(_a)
    const b = bigIntFromBigintIsh(_b)
    const denominator = bigIntFromBigintIsh(_denominator)

    const product = a * b
    let result = product / denominator
    if (product % denominator !== 0n) {
      result = result + 1n
    }

    if (typeof _a === 'bigint') {
      return result as T
    } else {
      return JSBI.BigInt(result.toString(10)) as T
    }
  }
}
