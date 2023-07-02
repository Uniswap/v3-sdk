import JSBI from 'jsbi'
import { FeeAmount } from '../constants'
import { FullMath } from './fullMath'
import { SqrtPriceMath } from './sqrtPriceMath'
import { bigIntFromBigintIsh } from './bigintIsh'

const MAX_FEE = 10n ** 6n

export abstract class SwapMath {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static computeSwapStep<T extends bigint | JSBI>(
    _sqrtRatioCurrentX96: T,
    _sqrtRatioTargetX96: T,
    _liquidity: T,
    _amountRemaining: T,
    feePips: FeeAmount
  ): [T, T, T, T] {
    const sqrtRatioCurrentX96 = bigIntFromBigintIsh(_sqrtRatioCurrentX96)
    const sqrtRatioTargetX96 = bigIntFromBigintIsh(_sqrtRatioTargetX96)
    const liquidity = bigIntFromBigintIsh(_liquidity)
    const amountRemaining = bigIntFromBigintIsh(_amountRemaining)

    const returnValues: Partial<{
      sqrtRatioNextX96: bigint
      amountIn: bigint
      amountOut: bigint
      feeAmount: bigint
    }> = {}

    const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96
    const exactIn = amountRemaining >= 0n

    if (exactIn) {
      const amountRemainingLessFee = (amountRemaining * (MAX_FEE - BigInt(feePips))) / MAX_FEE
      returnValues.amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
        : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true)
      if (amountRemainingLessFee >= returnValues.amountIn!) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne
        )
      }
    } else {
      returnValues.amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
        : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false)
      if (amountRemaining * -1n >= returnValues.amountOut!) {
        returnValues.sqrtRatioNextX96 = sqrtRatioTargetX96
      } else {
        returnValues.sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemaining * -1n,
          zeroForOne
        )
      }
    }

    const max = sqrtRatioTargetX96 === returnValues.sqrtRatioNextX96

    if (zeroForOne) {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount0Delta(returnValues.sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true)
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount1Delta(returnValues.sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false)
    } else {
      returnValues.amountIn =
        max && exactIn
          ? returnValues.amountIn
          : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, returnValues.sqrtRatioNextX96, liquidity, true)
      returnValues.amountOut =
        max && !exactIn
          ? returnValues.amountOut
          : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, returnValues.sqrtRatioNextX96, liquidity, false)
    }

    if (!exactIn && returnValues.amountOut! > amountRemaining * -1n) {
      returnValues.amountOut = amountRemaining * -1n
    }

    if (exactIn && returnValues.sqrtRatioNextX96 !== sqrtRatioTargetX96) {
      // we didn't reach the target, so take the remainder of the maximum input as fee
      returnValues.feeAmount = amountRemaining - returnValues.amountIn!
    } else {
      returnValues.feeAmount = FullMath.mulDivRoundingUp(
        returnValues.amountIn!,
        BigInt(feePips),
        MAX_FEE - BigInt(feePips)
      )
    }

    if (typeof _sqrtRatioCurrentX96 === 'bigint') {
      return [
        returnValues.sqrtRatioNextX96! as T,
        returnValues.amountIn! as T,
        returnValues.amountOut! as T,
        returnValues.feeAmount! as T,
      ]
    } else {
      return [
        JSBI.BigInt(returnValues.sqrtRatioNextX96!.toString(10)) as T,
        JSBI.BigInt(returnValues.amountIn!.toString(10)) as T,
        JSBI.BigInt(returnValues.amountOut!.toString(10)) as T,
        JSBI.BigInt(returnValues.feeAmount!.toString(10)) as T,
      ]
    }
  }
}
