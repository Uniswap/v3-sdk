import JSBI from 'jsbi'

import { SolidityType } from '../constants'
import { validateChainId, validateAddress, validateSolidityTypeInstance } from '../utils/validateInputs'

export class Token {
  public readonly chainId: number
  public readonly address: string
  public readonly decimals: number

  static validate(chainId: number, address: string, decimals: number) {
    validateChainId(chainId)
    validateAddress(address)
    validateSolidityTypeInstance(JSBI.BigInt(decimals), SolidityType.uint8)
  }

  constructor(chainId: number, address: string, decimals: number) {
    Token.validate(chainId, address, decimals)

    this.chainId = chainId
    this.address = address
    this.decimals = decimals
  }
}
