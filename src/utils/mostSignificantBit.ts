import { MaxUint256BigInt } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { bigIntFromBigintIsh } from './bigintIsh'

const POWERS_OF_2 = [128, 64, 32, 16, 8, 4, 2, 1].map((pow: number): [number, bigint] => [pow, 2n ** BigInt(pow)])

export function mostSignificantBit(_x: bigint | JSBI): number {
  let x = bigIntFromBigintIsh(_x)

  invariant(x > 0n, 'ZERO')
  invariant(x <= MaxUint256BigInt, 'MAX')

  let msb: number = 0
  for (const [power, min] of POWERS_OF_2) {
    if (x >= min) {
      x = x >> BigInt(power)
      msb += power
    }
  }
  return msb
}
