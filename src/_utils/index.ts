import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'

import { BigNumberish } from '../types'
import { _0, _MAX_UINT8, _MAX_UINT256 } from '../constants'

function ensureUInt8(number: number): void {
  if (!Number.isInteger(number) || number < 0 || number > _MAX_UINT8) {
    throw Error(`Passed number '${number}' is not a valid uint8.`)
  }
}

export function ensureAllUInt8(numbers: number[]): void {
  numbers.forEach(ensureUInt8)
}

function ensureUInt256(bigNumber: BigNumber): void {
  if (!bigNumber.isInteger() || bigNumber.isLessThan(_0) || bigNumber.isGreaterThan(_MAX_UINT256)) {
    throw Error(`Passed bigNumber '${bigNumber}' is not a valid uint256.`)
  }
}

export function ensureAllUInt256(bigNumbers: BigNumber[]): void {
  bigNumbers.forEach(ensureUInt256)
}

export function ensureBoundedInteger(number: number, bounds: number | number[]): void {
  const [minimum, maximum]: [number, number] = typeof bounds === 'number' ? [0, bounds] : [bounds[0], bounds[1]]

  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw Error(`Passed number '${number}' is not an integer between '${minimum}' and '${maximum}' (inclusive).`)
  }
}

export function normalizeBigNumberish(bigNumberish: BigNumberish): BigNumber {
  const bigNumber: BigNumber = BigNumber.isBigNumber(bigNumberish)
    ? bigNumberish
    : new BigNumber(bigNumberish.toString())

  if (!bigNumber.isFinite()) {
    throw Error(`Passed bigNumberish '${bigNumberish}' of type '${typeof bigNumberish}' is not valid.`)
  }

  return bigNumber
}

export function normalizeAddress(address: string): string {
  return ethers.utils.getAddress(address.toLowerCase())
}
