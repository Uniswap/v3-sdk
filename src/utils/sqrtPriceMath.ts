import { MaxUint256BigInt } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { Q96_BIGINT } from '../internalConstants'
import { FullMath } from './fullMath'
import { bigIntFromBigintIsh } from './bigintIsh'

const MaxUint160 = 2n ** 160n - 1n

function multiplyIn256BigInt(x: bigint, y: bigint): bigint {
  return (x * y) & MaxUint256BigInt
}

function addIn256BigInt(x: bigint, y: bigint): bigint {
  return (x + y) & MaxUint256BigInt
}

export abstract class SqrtPriceMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static getAmount0Delta<T extends bigint | JSBI>(
    _sqrtRatioAX96: T,
    _sqrtRatioBX96: T,
    _liquidity: T,
    roundUp: boolean
  ): T {
    let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
    let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
    const liquidity = bigIntFromBigintIsh(_liquidity)

    if (sqrtRatioAX96 > sqrtRatioBX96) {
      ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
    }

    const numerator1 = liquidity << 96n
    const numerator2 = sqrtRatioBX96 - sqrtRatioAX96

    let returnValue: bigint
    if (roundUp) {
      returnValue = FullMath.mulDivRoundingUp(
        FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
        1n,
        sqrtRatioAX96
      )
    } else {
      returnValue = (numerator1 * numerator2) / sqrtRatioBX96 / sqrtRatioAX96
    }

    if (typeof _sqrtRatioAX96 === 'bigint') {
      return returnValue as T
    } else {
      return JSBI.BigInt(returnValue.toString(10)) as T
    }
  }

  public static getAmount1Delta<T extends bigint | JSBI>(
    _sqrtRatioAX96: T,
    _sqrtRatioBX96: T,
    _liquidity: T,
    roundUp: boolean
  ): T {
    let sqrtRatioAX96 = bigIntFromBigintIsh(_sqrtRatioAX96)
    let sqrtRatioBX96 = bigIntFromBigintIsh(_sqrtRatioBX96)
    const liquidity = bigIntFromBigintIsh(_liquidity)

    if (sqrtRatioAX96 > sqrtRatioBX96) {
      ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
    }

    let returnValue: bigint
    if (roundUp) {
      returnValue = FullMath.mulDivRoundingUp(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96_BIGINT)
    } else {
      returnValue = (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96_BIGINT
    }

    if (typeof _sqrtRatioAX96 === 'bigint') {
      return returnValue as T
    } else {
      return JSBI.BigInt(returnValue.toString(10)) as T
    }
  }

  public static getNextSqrtPriceFromInput<T extends bigint | JSBI>(
    _sqrtPX96: T,
    _liquidity: T,
    _amountIn: T,
    zeroForOne: boolean
  ): T {
    const sqrtPX96: bigint = bigIntFromBigintIsh(_sqrtPX96)
    const liquidity: bigint = bigIntFromBigintIsh(_liquidity)
    const amountIn: bigint = bigIntFromBigintIsh(_amountIn)

    invariant(sqrtPX96 > 0n)
    invariant(liquidity > 0n)

    const returnValue = zeroForOne
      ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
      : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true)

    if (typeof _sqrtPX96 === 'bigint') {
      return returnValue as T
    } else {
      return JSBI.BigInt(returnValue.toString(10)) as T
    }
  }

  public static getNextSqrtPriceFromOutput<T extends bigint | JSBI>(
    _sqrtPX96: T,
    _liquidity: T,
    _amountOut: T,
    zeroForOne: boolean
  ): T {
    const sqrtPX96: bigint = bigIntFromBigintIsh(_sqrtPX96)
    const liquidity: bigint = bigIntFromBigintIsh(_liquidity)
    const amountOut: bigint = bigIntFromBigintIsh(_amountOut)

    invariant(sqrtPX96 > 0n)
    invariant(liquidity > 0n)

    const returnValue = zeroForOne
      ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
      : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false)

    if (typeof _sqrtPX96 === 'bigint') {
      return returnValue as T
    } else {
      return JSBI.BigInt(returnValue.toString(10)) as T
    }
  }

  private static getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (amount === 0n) return sqrtPX96
    const numerator1 = liquidity << 96n

    if (add) {
      let product = multiplyIn256BigInt(amount, sqrtPX96)
      if (product / amount === sqrtPX96) {
        const denominator = addIn256BigInt(numerator1, product)
        if (denominator >= numerator1) {
          return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator)
        }
      }

      return FullMath.mulDivRoundingUp(numerator1, 1n, numerator1 / sqrtPX96 + amount)
    } else {
      let product = multiplyIn256BigInt(amount, sqrtPX96)

      invariant(product / amount === sqrtPX96)
      invariant(numerator1 > product)
      const denominator = numerator1 - product
      return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator)
    }
  }

  private static getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPX96: bigint,
    liquidity: bigint,
    amount: bigint,
    add: boolean
  ): bigint {
    if (add) {
      const quotient = amount <= MaxUint160 ? (amount << 96n) / liquidity : (amount * Q96_BIGINT) / liquidity

      return sqrtPX96 + quotient
    } else {
      const quotient = FullMath.mulDivRoundingUp(amount, Q96_BIGINT, liquidity)

      invariant(sqrtPX96 > quotient)
      return sqrtPX96 - quotient
    }
  }
}
