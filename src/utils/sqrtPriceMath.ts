import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'

// TODO
export abstract class SqrtPriceMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static getAmount0Delta(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI, roundUp: boolean): JSBI {
    return ZERO
  }

  public static getAmount1Delta(sqrtRatioAX96: JSBI, sqrtRatioBX96: JSBI, liquidity: JSBI, roundUp: boolean): JSBI {
    return ZERO
  }

  public static getNextSqrtPriceFromInput(sqrtPX96: JSBI, liquidity: JSBI, amountIn: JSBI, zeroForOne: boolean): JSBI {
    invariant(JSBI.greaterThan(sqrtPX96, ZERO))
    invariant(JSBI.greaterThan(liquidity, ZERO))
    return ZERO
  }

  public static getNextSqrtPriceFromOutput(
    sqrtPX96: JSBI,
    liquidity: JSBI,
    amountOut: JSBI,
    zeroForOne: boolean
  ): JSBI {
    invariant(JSBI.greaterThan(sqrtPX96, ZERO))
    invariant(JSBI.greaterThan(liquidity, ZERO))
    return ZERO
  }
}
