import JSBI from 'jsbi'
import { bigIntFromBigintIsh } from './bigintIsh'

interface FeeGrowthOutside<T extends bigint | JSBI> {
  feeGrowthOutside0X128: T
  feeGrowthOutside1X128: T
}

const Q256 = 2n ** 256n

export function subIn256<T extends bigint | JSBI>(_x: T, _y: T): T {
  const x = bigIntFromBigintIsh(_x)
  const y = bigIntFromBigintIsh(_y)

  const difference = x - y

  let returnValue: bigint
  if (difference < 0n) {
    returnValue = Q256 + difference
  } else {
    returnValue = difference
  }

  if (typeof _x === 'bigint') {
    return returnValue as T
  } else {
    return JSBI.BigInt(returnValue.toString(10)) as T
  }
}

export abstract class TickLibrary {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static getFeeGrowthInside<T extends bigint | JSBI>(
    _feeGrowthOutsideLower: FeeGrowthOutside<T>,
    _feeGrowthOutsideUpper: FeeGrowthOutside<T>,
    tickLower: number,
    tickUpper: number,
    tickCurrent: number,
    _feeGrowthGlobal0X128: T,
    _feeGrowthGlobal1X128: T
  ): [T, T] {
    const feeGrowthOutsideLower: FeeGrowthOutside<bigint> = {
      feeGrowthOutside0X128: BigInt(_feeGrowthOutsideLower.feeGrowthOutside0X128.toString(10)),
      feeGrowthOutside1X128: BigInt(_feeGrowthOutsideLower.feeGrowthOutside1X128.toString(10)),
    }
    const feeGrowthOutsideUpper: FeeGrowthOutside<bigint> = {
      feeGrowthOutside0X128: BigInt(_feeGrowthOutsideUpper.feeGrowthOutside0X128.toString(10)),
      feeGrowthOutside1X128: BigInt(_feeGrowthOutsideUpper.feeGrowthOutside1X128.toString(10)),
    }
    const feeGrowthGlobal0X128 = bigIntFromBigintIsh(_feeGrowthGlobal0X128)
    const feeGrowthGlobal1X128 = bigIntFromBigintIsh(_feeGrowthGlobal1X128)

    let feeGrowthBelow0X128: bigint
    let feeGrowthBelow1X128: bigint
    if (tickCurrent >= tickLower) {
      feeGrowthBelow0X128 = feeGrowthOutsideLower.feeGrowthOutside0X128
      feeGrowthBelow1X128 = feeGrowthOutsideLower.feeGrowthOutside1X128
    } else {
      feeGrowthBelow0X128 = subIn256(feeGrowthGlobal0X128, feeGrowthOutsideLower.feeGrowthOutside0X128)
      feeGrowthBelow1X128 = subIn256(feeGrowthGlobal1X128, feeGrowthOutsideLower.feeGrowthOutside1X128)
    }

    let feeGrowthAbove0X128: bigint
    let feeGrowthAbove1X128: bigint
    if (tickCurrent < tickUpper) {
      feeGrowthAbove0X128 = feeGrowthOutsideUpper.feeGrowthOutside0X128
      feeGrowthAbove1X128 = feeGrowthOutsideUpper.feeGrowthOutside1X128
    } else {
      feeGrowthAbove0X128 = subIn256(feeGrowthGlobal0X128, feeGrowthOutsideUpper.feeGrowthOutside0X128)
      feeGrowthAbove1X128 = subIn256(feeGrowthGlobal1X128, feeGrowthOutsideUpper.feeGrowthOutside1X128)
    }

    const returnValue = [
      subIn256(subIn256(feeGrowthGlobal0X128, feeGrowthBelow0X128), feeGrowthAbove0X128),
      subIn256(subIn256(feeGrowthGlobal1X128, feeGrowthBelow1X128), feeGrowthAbove1X128),
    ]

    if (typeof _feeGrowthOutsideLower === 'bigint') {
      return returnValue as [T, T]
    } else {
      return [JSBI.BigInt(returnValue[0].toString(10)) as T, JSBI.BigInt(returnValue[1].toString(10)) as T]
    }
  }
}
