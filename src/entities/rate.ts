import invariant from 'tiny-invariant'

import { TEN } from '../constants'
import { Fraction, BigintIsh } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { formatSignificant, formatFixed } from '../utils/formatOutputs'
import { Route } from './route'

export class Rate {
  public readonly rate: Fraction

  constructor(rate: Fraction) {
    this.rate = rate
  }

  public formatSignificant(significantDigits = 6, invert = false, ...rest: any[]): string {
    const fraction = (invert ? this.rate.slice().reverse() : this.rate) as Fraction
    return formatSignificant(fraction, significantDigits, ...rest)
  }

  public formatFixed(decimalPlaces = 6, invert = false, ...rest: any[]): string {
    const fraction = (invert ? this.rate.slice().reverse() : this.rate) as Fraction
    return formatFixed(fraction, decimalPlaces, ...rest)
  }
}

export class Price extends Rate {
  public readonly scalar: Fraction // used to convert back to balances

  static fromRoute(route: Route): Price {
    const rates: Fraction[] = route.exchanges.map((exchange, i) => {
      const input = route.path[i]
      const baseIndex = input.address === exchange.pair[0].address ? 0 : 1
      const quoteIndex = input.address === exchange.pair[0].address ? 1 : 0

      return [
        exchange.balances[quoteIndex] * TEN ** BigInt(exchange.pair[baseIndex].decimals),
        exchange.balances[baseIndex] * TEN ** BigInt(exchange.pair[quoteIndex].decimals)
      ]
    })
    const rate: Fraction = [
      rates.map(rate => rate[0]).reduce((accumulator, currentValue) => accumulator * currentValue, BigInt(1)),
      rates.map(rate => rate[1]).reduce((accumulator, currentValue) => accumulator * currentValue, BigInt(1))
    ]
    const scalar: Fraction = [TEN ** BigInt(route.output.decimals), TEN ** BigInt(route.input.decimals)]
    return new Price(rate, scalar)
  }

  constructor(rate: Fraction, scalar: Fraction) {
    super(rate)
    this.scalar = scalar
  }

  public quote(amount: BigintIsh, invert = false): bigint {
    const amountParsed = parseBigintIsh(amount)
    invariant(amountParsed > 0, `${amountParsed} isn't positive.`)
    const [numeratorRate, denominatorRate] = invert ? this.rate.slice().reverse() : this.rate
    const [numeratorScalar, denominatorScalar] = invert
      ? (this.scalar as Fraction).slice().reverse()
      : (this.scalar as Fraction)

    return (amountParsed * numeratorRate * numeratorScalar) / (denominatorRate * denominatorScalar)
  }
}

export class Percent extends Rate {
  public formatSignificant(significantDigits = 6, ...rest: any[]): string {
    return formatSignificant([this.rate[0] * BigInt(100), this.rate[1]], significantDigits, ...rest)
  }

  public formatFixed(decimalPlaces = 6, ...rest: any[]): string {
    return formatFixed([this.rate[0] * BigInt(100), this.rate[1]], decimalPlaces, ...rest)
  }

  public formatSignificantRaw(...args: any[]) {
    return super.formatSignificant(...args)
  }

  public formatFixedRaw(...args: any[]) {
    return super.formatFixed(...args)
  }
}
