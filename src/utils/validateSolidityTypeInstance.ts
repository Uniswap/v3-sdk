import invariant from 'tiny-invariant'
import { SOLIDITY_TYPE_MAXIMA, SolidityType, ZERO } from '../constants'

export function validateSolidityTypeInstance(value: bigint, solidityType: SolidityType): void {
  invariant(value >= ZERO, `${value} is not a ${solidityType}.`)
  invariant(value <= SOLIDITY_TYPE_MAXIMA[solidityType], `${value} is not a ${solidityType}.`)
}
