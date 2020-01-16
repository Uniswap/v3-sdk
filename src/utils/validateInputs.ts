import invariant from 'tiny-invariant'
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
  [SolidityType.uint8]: BigInt(2 ** 8 - 1),
  [SolidityType.uint256]: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
}
export function validateSolidityTypeInstance(value: bigint, solidityType: SolidityType) {
  invariant(value >= ZERO, `${value.toString()} is negative.`)
  invariant(value <= SolidityTypeMaxima[solidityType], `${value.toString()} is too large.`)
}
