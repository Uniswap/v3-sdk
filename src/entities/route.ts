import invariant from 'tiny-invariant'

import { Token } from './token'
import { Exchange } from './exchange'
import { Price } from './rate'

export class Route {
  public readonly exchanges: Exchange[]
  public readonly path: Token[]
  public readonly midPrice: Price

  static validate(exchanges: Exchange[], input: Token): Token[] {
    // validate components of a Route
    invariant(exchanges.length > 0, `${exchanges} does not consist of at least 1 exchange.`)

    // validate conditions that must be true of a Route
    const chainIds = exchanges.flatMap(exchange => exchange.pair.map(token => token.chainId))
    chainIds.forEach((chainId, _, array) => invariant(chainId === array[0], `${chainIds} are not all equal.`))
    const path = [input]
    exchanges.forEach((exchange, i) => {
      const currentInput = path[i]
      const addresses = exchange.pair.map(token => token.address)
      invariant(addresses.includes(currentInput.address), `${addresses} does not contain ${input.address}.`)
      const output = currentInput.address === addresses[0] ? exchange.pair[1] : exchange.pair[0]
      path.push(output)
    })
    invariant(path.length === new Set(path).size, `${path} contains duplicate addresses.`)
    return path
  }

  constructor(exchanges: Exchange[], input: Token) {
    const path = Route.validate(exchanges, input)

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
