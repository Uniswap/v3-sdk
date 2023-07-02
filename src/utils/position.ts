import JSBI from 'jsbi'
import { subIn256 } from './tickLibrary'
import { bigIntFromBigintIsh } from './bigintIsh'

const Q128 = 2n ** 128n

export abstract class PositionLibrary {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  // replicates the portions of Position#update required to compute unaccounted fees
  public static getTokensOwed<T extends bigint | JSBI>(
    _feeGrowthInside0LastX128: T,
    _feeGrowthInside1LastX128: T,
    _liquidity: T,
    _feeGrowthInside0X128: T,
    _feeGrowthInside1X128: T
  ): [T, T] {
    const feeGrowthInside0LastX128 = bigIntFromBigintIsh(_feeGrowthInside0LastX128)
    const feeGrowthInside1LastX128 = bigIntFromBigintIsh(_feeGrowthInside1LastX128)
    const liquidity = bigIntFromBigintIsh(_liquidity)
    const feeGrowthInside0X128 = bigIntFromBigintIsh(_feeGrowthInside0X128)
    const feeGrowthInside1X128 = bigIntFromBigintIsh(_feeGrowthInside1X128)

    const tokensOwed0 = (subIn256(feeGrowthInside0X128, feeGrowthInside0LastX128) * liquidity) / Q128

    const tokensOwed1 = (subIn256(feeGrowthInside1X128, feeGrowthInside1LastX128) * liquidity) / Q128

    if (typeof _feeGrowthInside0LastX128 === 'bigint') {
      return [tokensOwed0 as T, tokensOwed1 as T]
    } else {
      return [JSBI.BigInt(tokensOwed0.toString(10)) as T, JSBI.BigInt(tokensOwed1.toString(10)) as T]
    }
  }
}
