import { MaxUint256 } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

const ZERO = JSBI.BigInt(0)
const TWO = JSBI.BigInt(2)
const ONE = JSBI.BigInt(1)
const POWERS_OF_2 = [128, 64, 32, 16, 8, 4, 2, 1].map((pow: number): [number, JSBI] => [
    pow,
    JSBI.subtract(JSBI.exponentiate(TWO, JSBI.BigInt(pow)), ONE)
])

export function leastSignificantBit(x: JSBI): number {
    invariant(JSBI.greaterThan(x, ZERO), 'ZERO')
    invariant(JSBI.lessThanOrEqual(x, MaxUint256), 'MAX')

    let lsb: number = 255
    for (const [power, min] of POWERS_OF_2) {
        if (JSBI.greaterThan(JSBI.bitwiseAnd(min, x), ZERO)) {
            lsb -= power
        } else {
            x = JSBI.signedRightShift(x, JSBI.BigInt(power))
        }
    }
    return lsb
}