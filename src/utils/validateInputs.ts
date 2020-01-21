import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { getAddress } from '@ethersproject/address'

import { ZERO, ChainId, SolidityType } from '../constants'

export function validateChainId(chainId: number) {
  invariant(!!ChainId[chainId], `${chainId} is not a supported chainId.`)
}

export function validateAddress(address: string) {
  try {
    if (address !== getAddress(address)) {
      throw Error('Address is not properly checksummed.')
    }
  } catch (error) {
    invariant(false, `${address} is an invalid address. ${error}`)
  }
}

const SolidityTypeMaxima = {
  [SolidityType.uint8]: JSBI.BigInt(2 ** 8 - 1),
  [SolidityType.uint256]: JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
export function validateSolidityTypeInstance(value: JSBI, solidityType: SolidityType) {
  invariant(JSBI.greaterThanOrEqual(value, ZERO), `${value} is negative.`)
  invariant(JSBI.lessThanOrEqual(value, SolidityTypeMaxima[solidityType]), `${value} is too large.`)
}
