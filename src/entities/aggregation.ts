import { Trade } from './trade'
import invariant from 'tiny-invariant'
import { Price, TokenAmount } from './fractions'
import { TradeType } from '../constants'

/**
 * An aggregation is a group of trades that share an input and output token.
 * Aggregations are useful to produce the best route when multiple routes exist between an input and output token.
 */
export class Aggregation {
  public readonly trades: Trade[]
  public readonly tradeType: TradeType
  public readonly inputAmount: TokenAmount
  public readonly outputAmount: TokenAmount
  public readonly executionPrice: Price

  public constructor(trades: Trade[]) {
    invariant(trades.length > 0, 'TRADES_LENGTH')
    const [first, ...others] = trades
    invariant(
      trades.every(trade => trade.inputAmount.token.equals(first.inputAmount.token)),
      'TRADES_INPUT_TOKEN'
    )
    invariant(
      trades.every(trade => trade.outputAmount.token.equals(first.outputAmount.token)),
      'TRADES_OUTPUT_TOKEN'
    )
    invariant(
      trades.every(trade => trade.tradeType === first.tradeType),
      'TRADES_TRADE_TYPE'
    )
    this.trades = trades
    this.tradeType = first.tradeType
    this.inputAmount = others.reduce(
      (amount: TokenAmount, current: Trade) => amount.add(current.inputAmount),
      first.inputAmount
    )
    this.outputAmount = others.reduce(
      (amount: TokenAmount, current: Trade) => amount.add(current.outputAmount),
      first.outputAmount
    )
    this.executionPrice = new Price(
      this.inputAmount.token,
      this.outputAmount.token,
      this.inputAmount.raw,
      this.outputAmount.raw
    )
  }
}
