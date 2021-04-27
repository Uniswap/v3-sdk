import { BigintIsh, Token } from '@uniswap/sdk-core'
import { Interface } from '@ethersproject/abi'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISelfPermit.sol/ISelfPermit.json'
import { toHex } from './utils'

interface StandardPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  amount: BigintIsh
  deadline: BigintIsh
}

interface AllowedPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  nonce: BigintIsh
  expiry: BigintIsh
}

export type PermitOptions = StandardPermitArguments | AllowedPermitArguments

// type guard
function isAllowedPermit(permitOptions: PermitOptions): permitOptions is AllowedPermitArguments {
  return Object.keys(permitOptions).some(k => k === 'nonce')
}

export abstract class SelfPermit {
  public static INTERFACE: Interface = new Interface(abi)

  protected constructor() {}

  public static encodePermit(token: Token, options: PermitOptions) {
    return isAllowedPermit(options)
      ? SelfPermit.INTERFACE.encodeFunctionData('selfPermitAllowed', [
          token.address,
          toHex(options.nonce),
          toHex(options.expiry),
          options.v,
          options.r,
          options.s
        ])
      : SelfPermit.INTERFACE.encodeFunctionData('selfPermit', [
          token.address,
          toHex(options.amount),
          toHex(options.deadline),
          options.v,
          options.r,
          options.s
        ])
  }
}
