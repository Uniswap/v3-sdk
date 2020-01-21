import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { SolidityType } from '../constants'
import { BigintIsh } from '../types'
import { parseBigintIsh } from '../utils/parseInputs'
import { validateSolidityTypeInstance } from '../utils/validateInputs'
import { Token } from './token'

export class Exchange {
  public readonly pair: [Token, Token]
  public readonly balances: [JSBI, JSBI]

  static validate(pair: [Token, Token], balances: [JSBI, JSBI]) {
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
    const orderedBalances = (inOrder ? balancesParsed : balancesParsed.slice().reverse()) as [JSBI, JSBI]
    Exchange.validate(orderedPair, orderedBalances)

    this.pair = orderedPair
    this.balances = orderedBalances
  }
}
