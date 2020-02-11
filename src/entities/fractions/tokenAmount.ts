import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { BigintIsh, Rounding } from '../../types'
import { TEN, SolidityType } from '../../constants'
import { parseBigintIsh, validateSolidityTypeInstance } from '../../utils'
import { Token } from '../token'
import { Fraction } from './fraction'

export class TokenAmount extends Fraction {
  public readonly token: Token

  // amount _must be_ scaled in units of the token
  constructor(token: Token, amount: BigintIsh) {
    const parsedAmount = parseBigintIsh(amount)
    validateSolidityTypeInstance(parsedAmount, SolidityType.uint256)

    super(parsedAmount, JSBI.exponentiate(TEN, JSBI.BigInt(token.decimals)))
    this.token = token
  }

  public get raw(): JSBI {
    return this.numerator
  }

  public get adjusted(): Fraction {
    return this
  }

  public add(other: TokenAmount): TokenAmount {
    invariant(this.token.equals(other.token), 'TOKEN')
    return new TokenAmount(this.token, JSBI.add(this.raw, other.raw))
  }

  public subtract(other: TokenAmount): TokenAmount {
    invariant(this.token.equals(other.token), 'TOKEN')
    return new TokenAmount(this.token, JSBI.subtract(this.raw, other.raw))
  }

  public toSignificant(significantDigits: number, format?: object, rounding: Rounding = Rounding.ROUND_DOWN): string {
    return super.toSignificant(significantDigits, format, rounding, this.token.decimals)
  }

  public toFixed(
    decimalPlaces: number = this.token.decimals,
    format?: object,
    rounding: Rounding = Rounding.ROUND_DOWN
  ): string {
    invariant(decimalPlaces <= this.token.decimals, 'DECIMALS')
    return super.toFixed(decimalPlaces, format, rounding)
  }
}
