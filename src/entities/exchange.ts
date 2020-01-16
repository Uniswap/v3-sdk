import invariant from 'tiny-invariant'

import { SolidityType } from '../constants'
import { BigintIsh } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { validateSolidityTypeInstance } from '../utils/validateInputs'
import { Token } from './token'

export class Exchange {
  public readonly pair: [Token, Token]
  public readonly balances: [bigint, bigint]

  static validate(pair: [Token, Token], balances: [bigint, bigint]) {
    // validate components of an Exchange
    balances.forEach(balance => validateSolidityTypeInstance(balance, SolidityType.uint256))

    // validate conditions that must be true of an Exchange
    const chainIds = pair.map(token => token.chainId)
    invariant(chainIds[0] === chainIds[1], `${chainIds} are not equal.`)
    const addresses = pair.map(token => token.address)
    invariant(addresses[0] < addresses[1], `${addresses} are not ordered.`)
  }

  constructor(pair: [Token, Token], balances: [BigintIsh, BigintIsh]) {
    const balancesParsed = balances.map(balance => parseBigintIsh(balance))
    const inOrder = pair[0].address < pair[1].address
    const orderedPair = (inOrder ? pair : pair.slice().reverse()) as [Token, Token]
    const orderedBalances = (inOrder ? balancesParsed : balancesParsed.slice().reverse()) as [bigint, bigint]
    Exchange.validate(orderedPair, orderedBalances)

    this.pair = orderedPair
    this.balances = orderedBalances
  }
}
