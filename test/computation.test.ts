import { ChainId, WETH as _WETH, TradeType, Token, Exchange, Route, Trade } from '../src'

const ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000002'
]
const CHAIN_ID = ChainId.RINKEBY
const WETH = _WETH[ChainId.RINKEBY]

function getTokens(n: number, decimals: number | number[]) {
  return ADDRESSES.slice(0, n).map(
    (address, i) => new Token(CHAIN_ID, address, typeof decimals === 'number' ? decimals : decimals[i])
  )
}

function decimalize(amount: number, decimal: number): bigint {
  return BigInt(amount) * BigInt(10) ** BigInt(decimal)
}

describe('entities', () => {
  ;[
    [0, 0, 0],
    [0, 9, 18],
    [18, 18, 18]
  ].forEach(decimals => {
    describe(`decimals: ${decimals}`, () => {
      let tokens: Token[]
      it('Token', () => {
        tokens = getTokens(3, decimals)
        tokens.forEach((token, i) => {
          expect(token.chainId).toEqual(CHAIN_ID)
          expect(token.address).toEqual(ADDRESSES[i])
          expect(token.decimals).toEqual(decimals[i])
        })
      })

      let exchanges: Exchange[]
      it('Exchange', () => {
        const pairs: [Token, Token][] = [
          [tokens[0], tokens[1]],
          [tokens[1], tokens[2]],
          [tokens[2], WETH]
        ]
        const balances: [bigint, bigint][] = [
          [decimalize(1, pairs[0][0].decimals), decimalize(1, pairs[0][1].decimals)],
          [decimalize(1, pairs[1][0].decimals), decimalize(1, pairs[1][1].decimals)],
          [decimalize(1, pairs[2][0].decimals), decimalize(1234, pairs[2][1].decimals)]
        ]
        exchanges = [
          new Exchange(pairs[0], balances[0]),
          new Exchange(pairs[1], balances[1]),
          new Exchange(pairs[2], balances[2])
        ]
      })

      let route: Route
      it('Route', () => {
        route = new Route(exchanges, tokens[0])
        expect(route.path).toEqual(tokens.concat([WETH]))
        expect(route.input).toEqual(tokens[0])
        expect(route.output).toEqual(WETH)
      })

      it('Rate via Route.marketRate', () => {
        expect(route.midPrice.quote(decimalize(1, route.input.decimals))).toEqual(
          decimalize(1234, route.output.decimals)
        )
        expect(route.midPrice.invert().quote(decimalize(1234, route.output.decimals))).toEqual(
          decimalize(1, route.input.decimals)
        )

        expect(route.midPrice.formatSignificant(1)).toEqual('1000')
        expect(route.midPrice.formatSignificant(2)).toEqual('1200')
        expect(route.midPrice.formatSignificant(3)).toEqual('1230')
        expect(route.midPrice.formatSignificant(4)).toEqual('1234')
        expect(route.midPrice.formatSignificant(5)).toEqual('1234')
        expect(route.midPrice.formatSignificant(4, { groupSeparator: ',' })).toEqual('1,234')
        expect(route.midPrice.invert().formatSignificant(1)).toEqual('0.0008')
        expect(route.midPrice.invert().formatSignificant(2)).toEqual('0.00081')
        expect(route.midPrice.invert().formatSignificant(3)).toEqual('0.00081')
        expect(route.midPrice.invert().formatSignificant(4)).toEqual('0.0008104')
        expect(route.midPrice.invert().formatSignificant(4, undefined, 1)).toEqual('0.0008103')
        expect(route.midPrice.invert().formatSignificant(5)).toEqual('0.00081037')

        expect(route.midPrice.formatFixed(0)).toEqual('1234')
        expect(route.midPrice.formatFixed(1)).toEqual('1234.0')
        expect(route.midPrice.formatFixed(2)).toEqual('1234.00')
        expect(route.midPrice.formatFixed(2, { groupSeparator: ',' })).toEqual('1,234.00')
        expect(route.midPrice.invert().formatFixed(0)).toEqual('0')
        expect(route.midPrice.invert().formatFixed(1)).toEqual('0.0')
        expect(route.midPrice.invert().formatFixed(4)).toEqual('0.0008')
        expect(route.midPrice.invert().formatFixed(5)).toEqual('0.00081')
        expect(route.midPrice.invert().formatFixed(6)).toEqual('0.000810')
        expect(route.midPrice.invert().formatFixed(7)).toEqual('0.0008104')
        expect(route.midPrice.invert().formatFixed(7, undefined, 0)).toEqual('0.0008103')
        expect(route.midPrice.invert().formatFixed(8)).toEqual('0.00081037')
      })

      describe('Trade', () => {
        it('TradeType.EXACT_INPUT', () => {
          const exchanges = [
            new Exchange([tokens[1], WETH], [decimalize(5, tokens[1].decimals), decimalize(10, WETH.decimals)])
          ]
          const route = new Route(exchanges, tokens[1])
          const inputAmount = decimalize(1, tokens[1].decimals)
          const trade = new Trade(route, inputAmount, TradeType.EXACT_INPUT)
          expect(trade.inputAmount).toEqual(inputAmount)
          expect(trade.outputAmount).toEqual(BigInt('1662497915624478906'))

          expect(trade.executionPrice.formatSignificant(18)).toEqual('1.66249791562447891')
          expect(trade.executionPrice.invert().formatSignificant(18)).toEqual('0.601504513540621866')
          expect(trade.executionPrice.quote(inputAmount)).toEqual(trade.outputAmount)
          expect(trade.executionPrice.invert().quote(trade.outputAmount)).toEqual(inputAmount)

          expect(trade.nextMidPrice.formatSignificant(18)).toEqual('1.38958368072925352')
          expect(trade.nextMidPrice.invert().formatSignificant(18)).toEqual('0.71964')

          expect(trade.slippage.formatSignificant(18)).toEqual('-16.8751042187760547')

          expect(trade.midPricePercentChange.formatSignificant(18)).toEqual('-30.5208159635373242')
        })

        it('TradeType.EXACT_OUTPUT', () => {
          const exchanges = [
            new Exchange([tokens[1], WETH], [decimalize(5, tokens[1].decimals), decimalize(10, WETH.decimals)])
          ]
          const route = new Route(exchanges, tokens[1])
          const outputAmount = BigInt('1662497915624478906')
          const trade = new Trade(route, outputAmount, TradeType.EXACT_OUTPUT)
          expect(trade.inputAmount).toEqual(decimalize(1, tokens[1].decimals))
          expect(trade.outputAmount).toEqual(outputAmount)

          // TODO think about inverse execution price?
          expect(trade.executionPrice.formatSignificant(18)).toEqual('1.66249791562447891')
          expect(trade.executionPrice.invert().formatSignificant(18)).toEqual('0.601504513540621866')
          expect(trade.executionPrice.quote(trade.inputAmount)).toEqual(outputAmount)
          expect(trade.executionPrice.invert().quote(outputAmount)).toEqual(trade.inputAmount)

          expect(trade.nextMidPrice.formatSignificant(18)).toEqual('1.38958368072925352')
          expect(trade.nextMidPrice.invert().formatSignificant(18)).toEqual('0.71964')

          expect(trade.slippage.formatSignificant(18)).toEqual('-16.8751042187760547')

          expect(trade.midPricePercentChange.formatSignificant(18)).toEqual('-30.5208159635373242')
        })

        it('minimum TradeType.EXACT_INPUT', () => {
          if ([9, 18].includes(tokens[1].decimals)) {
            const exchanges = [
              new Exchange(
                [tokens[1], WETH],
                [
                  decimalize(1, tokens[1].decimals),
                  decimalize(10, WETH.decimals) +
                    (tokens[1].decimals === 9 ? BigInt('30090280812437312') : BigInt('30090270812437322'))
                ]
              )
            ]
            const route = new Route(exchanges, tokens[1])
            const trade = new Trade(route, '1', TradeType.EXACT_INPUT)

            expect(trade.slippage.formatSignificant(18)).toEqual(
              tokens[1].decimals === 9 ? '-0.300000099400899902' : '-0.3000000000000001'
            )
          }
        })
      })
    })
  })
})
