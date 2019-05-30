import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'

import { _0, MAX_UINT8, MAX_UINT256 } from '../constants'
import { BigNumberish } from '../types'

// check(s) that number(s) is(are) uint8(s)
function ensureUInt8(number: number): void {
  if (!Number.isInteger(number) || number < 0 || number > MAX_UINT8) {
    throw Error(`Passed number '${number}' is not a valid uint8.`)
  }
}

export function ensureAllUInt8(numbers: number[]): void {
  numbers.forEach(ensureUInt8)
}

// check(s) that BigNumber(s) is(are) uint256(s)
function ensureUInt256(bigNumber: BigNumber): void {
  if (!bigNumber.isInteger() || bigNumber.isLessThan(_0) || bigNumber.isGreaterThan(MAX_UINT256)) {
    throw Error(`Passed BigNumber '${bigNumber}' is not a valid uint256.`)
  }
}

export function ensureAllUInt256(bigNumbers: BigNumber[]): void {
  bigNumbers.forEach(ensureUInt256)
}

// check that number is valid decimals places/significant digits
export function ensureBoundedInteger(number: number, bounds: number | number[]): void {
  const [minimum, maximum]: [number, number] = typeof bounds === 'number' ? [0, bounds] : [bounds[0], bounds[1]]

  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw Error(`Passed number '${number}' is not an integer between '${minimum}' and '${maximum}', inclusive.`)
  }
}

export function normalizeAddress(address: string): string {
  try {
    return ethers.utils.getAddress(address.toLowerCase())
  } catch {
    throw Error(`Passed address '${address}' is not valid.`)
  }
}

export function normalizeBigNumberish(bigNumberish: BigNumberish): BigNumber {
  try {
    const bigNumber = BigNumber.isBigNumber(bigNumberish) ? bigNumberish : new BigNumber(bigNumberish.toString())
    if (!bigNumber.isFinite()) {
      throw Error(`Passed BigNumberish '${bigNumberish}' of type '${typeof bigNumberish}' is not finite.`)
    }
    return bigNumber
  } catch (error) {
    throw Error(`Passed BigNumberish '${bigNumberish}' of type '${typeof bigNumberish}' is invalid. Error: '${error}'.`)
  }
}
