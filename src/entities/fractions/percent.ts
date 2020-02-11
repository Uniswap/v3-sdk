import { Rounding } from '../../types'
import { _100 } from '../../constants'
import { Fraction } from './fraction'

const _100Percent = new Fraction(_100)

export class Percent extends Fraction {
  public toSignificant(significantDigits: number = 5, format?: object, rounding?: Rounding): string {
    return this.multiply(_100Percent).toSignificant(significantDigits, format, rounding)
  }

  public toFixed(decimalPlaces: number = 2, format?: object, rounding?: Rounding): string {
    return this.multiply(_100Percent).toSignificant(decimalPlaces, format, rounding)
  }
}
