import { MaxUint256BigInt } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { mostSignificantBit } from './mostSignificantBit'
import { bigIntFromBigintIsh } from './bigintIsh'

function mulShift(val: bigint, mulBy: bigint): bigint {
  return (val * mulBy) >> 128n
}

const Q32 = 2n ** 32n

export abstract class TickMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  /**
   * The minimum tick that can be used on any pool.
   */
  public static MIN_TICK: number = -887272
  /**
   * The maximum tick that can be used on any pool.
   */
  public static MAX_TICK: number = -TickMath.MIN_TICK

  /**
   * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
   */
  public static MIN_SQRT_RATIO: JSBI = JSBI.BigInt('4295128739')
  /**
   * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
   */
  public static MIN_SQRT_RATIO_BIGINT: bigint = BigInt('4295128739')
  /**
   * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
   */
  public static MAX_SQRT_RATIO: JSBI = JSBI.BigInt('1461446703485210103287273052203988822378723970342')
  /**
   * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
   */
  public static MAX_SQRT_RATIO_BIGINT: bigint = BigInt('1461446703485210103287273052203988822378723970342')

  /**
   * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  public static getSqrtRatioAtTickBigInt(tick: number): bigint {
    invariant(tick >= TickMath.MIN_TICK && tick <= TickMath.MAX_TICK && Number.isInteger(tick), 'TICK')
    const absTick: number = tick < 0 ? tick * -1 : tick

    let ratio: bigint =
      (absTick & 0x1) != 0
        ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
        : BigInt('0x100000000000000000000000000000000')
    if ((absTick & 0x2) != 0) ratio = mulShift(ratio, BigInt('0xfff97272373d413259a46990580e213a'))
    if ((absTick & 0x4) != 0) ratio = mulShift(ratio, BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc'))
    if ((absTick & 0x8) != 0) ratio = mulShift(ratio, BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0'))
    if ((absTick & 0x10) != 0) ratio = mulShift(ratio, BigInt('0xffcb9843d60f6159c9db58835c926644'))
    if ((absTick & 0x20) != 0) ratio = mulShift(ratio, BigInt('0xff973b41fa98c081472e6896dfb254c0'))
    if ((absTick & 0x40) != 0) ratio = mulShift(ratio, BigInt('0xff2ea16466c96a3843ec78b326b52861'))
    if ((absTick & 0x80) != 0) ratio = mulShift(ratio, BigInt('0xfe5dee046a99a2a811c461f1969c3053'))
    if ((absTick & 0x100) != 0) ratio = mulShift(ratio, BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4'))
    if ((absTick & 0x200) != 0) ratio = mulShift(ratio, BigInt('0xf987a7253ac413176f2b074cf7815e54'))
    if ((absTick & 0x400) != 0) ratio = mulShift(ratio, BigInt('0xf3392b0822b70005940c7a398e4b70f3'))
    if ((absTick & 0x800) != 0) ratio = mulShift(ratio, BigInt('0xe7159475a2c29b7443b29c7fa6e889d9'))
    if ((absTick & 0x1000) != 0) ratio = mulShift(ratio, BigInt('0xd097f3bdfd2022b8845ad8f792aa5825'))
    if ((absTick & 0x2000) != 0) ratio = mulShift(ratio, BigInt('0xa9f746462d870fdf8a65dc1f90e061e5'))
    if ((absTick & 0x4000) != 0) ratio = mulShift(ratio, BigInt('0x70d869a156d2a1b890bb3df62baf32f7'))
    if ((absTick & 0x8000) != 0) ratio = mulShift(ratio, BigInt('0x31be135f97d08fd981231505542fcfa6'))
    if ((absTick & 0x10000) != 0) ratio = mulShift(ratio, BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9'))
    if ((absTick & 0x20000) != 0) ratio = mulShift(ratio, BigInt('0x5d6af8dedb81196699c329225ee604'))
    if ((absTick & 0x40000) != 0) ratio = mulShift(ratio, BigInt('0x2216e584f5fa1ea926041bedfe98'))
    if ((absTick & 0x80000) != 0) ratio = mulShift(ratio, BigInt('0x48a170391f7dc42444e8fa2'))

    if (tick > 0) ratio = MaxUint256BigInt / ratio

    // back to Q96
    return ratio % Q32 > 0n ? ratio / Q32 + 1n : ratio / Q32
  }

  /**
   * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001)^tick
   * @param tick the tick for which to compute the sqrt ratio
   */
  public static getSqrtRatioAtTick(tick: number): JSBI {
    return JSBI.BigInt(this.getSqrtRatioAtTickBigInt(tick).toString(10))
  }

  /**
   * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
   * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
   * @param sqrtRatioX96 the sqrt ratio as a Q64.96 for which to compute the tick
   */
  public static getTickAtSqrtRatio(_sqrtRatioX96: bigint | JSBI): number {
    const sqrtRatioX96: bigint = bigIntFromBigintIsh(_sqrtRatioX96)

    invariant(
      sqrtRatioX96 >= TickMath.MIN_SQRT_RATIO_BIGINT && sqrtRatioX96 < TickMath.MAX_SQRT_RATIO_BIGINT,
      'SQRT_RATIO'
    )

    const sqrtRatioX128 = sqrtRatioX96 << 32n

    const msb = BigInt(mostSignificantBit(sqrtRatioX128))

    let r: bigint
    if (msb >= 128n) {
      r = sqrtRatioX128 >> (msb - 127n)
    } else {
      r = sqrtRatioX128 << (127n - msb)
    }

    let log_2: bigint = (msb - 128n) << 64n

    for (let i = 0; i < 14; i++) {
      r = (r * r) >> 127n
      const f = r >> 128n
      log_2 = log_2 | (f << (63n - BigInt(i)))
      r = r >> f
    }

    const log_sqrt10001 = log_2 * BigInt('255738958999603826347141')

    const tickLow = Number((log_sqrt10001 - BigInt('3402992956809132418596140100660247210')) >> 128n)
    const tickHigh = Number((log_sqrt10001 + BigInt('291339464771989622907027621153398088495')) >> 128n)

    return tickLow === tickHigh
      ? tickLow
      : TickMath.getSqrtRatioAtTickBigInt(tickHigh) <= sqrtRatioX96
      ? tickHigh
      : tickLow
  }
}
