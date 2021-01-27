import { validateSolidityTypeInstance } from '../utils/validateSolidityTypeInstance'
import { ONE, SolidityType, THREE, TWO, ZERO } from '../constants'

// mocks the on-chain sqrt function
export function sqrt(y: bigint): bigint {
  validateSolidityTypeInstance(y, SolidityType.uint256)
  let z: bigint = ZERO
  let x: bigint
  if (y > THREE) {
    z = y
    x = y / TWO + ONE
    while (x < z) {
      z = x
      x = (y / x + x) / TWO
    }
  } else if (y !== ZERO) {
    z = ONE
  }
  return z
}
