import { ONE, THREE, TWO, ZERO } from '../constants'

// mocks the on-chain sqrt function
export function sqrt(y: bigint): bigint {
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
