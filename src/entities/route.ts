import invariant from 'tiny-invariant'

import { Token } from './token'
import { Exchange } from './exchange'
import { Price } from './fractions/price'

export class Route {
  public readonly exchanges: Exchange[]
  public readonly path: Token[]
  public readonly midPrice: Price

  constructor(exchanges: Exchange[], input: Token) {
    invariant(exchanges.length > 0, 'EXCHANGES')
    invariant(
      exchanges.map(exchange => exchange.token0.chainId === exchanges[0].token0.chainId).every(x => x),
      'CHAIN_IDS'
    )
    const path = [input]
    for (const [i, exchange] of exchanges.entries()) {
      const currentInput = path[i]
      invariant(currentInput.equals(exchange.token0) || currentInput.equals(exchange.token1), 'PATH')
      const output = currentInput.equals(exchange.token0) ? exchange.token1 : exchange.token0
      path.push(output)
    }
    invariant(path.length === new Set(path).size, 'PATH')

    this.exchanges = exchanges
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
