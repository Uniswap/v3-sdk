import invariant from 'tiny-invariant'

import { Token } from './token'
import { Pair } from './pair'
import { Price } from './fractions/price'

export class Route {
  public readonly pairs: Pair[]
  public readonly path: Token[]
  public readonly midPrice: Price

  constructor(pairs: Pair[], input: Token) {
    invariant(pairs.length > 0, 'PAIRS')
    invariant(
      pairs.map(pair => pair.token0.chainId === pairs[0].token0.chainId).every(x => x),
      'CHAIN_IDS'
    )
    const path = [input]
    for (const [i, pair] of pairs.entries()) {
      const currentInput = path[i]
      invariant(currentInput.equals(pair.token0) || currentInput.equals(pair.token1), 'PATH')
      const output = currentInput.equals(pair.token0) ? pair.token1 : pair.token0
      path.push(output)
    }
    invariant(path.length === new Set(path).size, 'PATH')

    this.pairs = pairs
    this.path = path
    this.midPrice = Price.fromRoute(this)
  }

  get input(): Token {
    return this.path[0]
  }

  get output(): Token {
    return this.path[this.path.length - 1]
  }
}
