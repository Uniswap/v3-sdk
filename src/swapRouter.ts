import { Interface } from '@ethersproject/abi'
import { Signer } from '@ethersproject/abstract-signer'
import { TransactionResponse } from '@ethersproject/providers'
import { BigintIsh, Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress, SUPPORTED_CHAINS, SupportedChainsType, ChainId } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { BestTradeOptions, Trade } from './entities/trade'
import { ADDRESS_ZERO } from './constants'
import { PermitOptions, SelfPermit } from './selfPermit'
import { approveTokenTransfer, encodeRouteToPath, getAllowance } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import ISwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { Multicall } from './multicall'
import { FeeOptions, Payments } from './payments'
import { Pool } from './entities/pool'
import { Route } from './entities/route'
import { SwapQuoter } from './quoter'
import { fetchTickDataForAllPoolsInRoute } from './utils/fetchTicksForRoute'

/**
 * Options for producing the arguments to send calls to the router.
 */
export interface SwapOptions {
  /**
   * How much the execution price is allowed to move unfavorably from the trade execution price.
   */
  slippageTolerance: Percent

  /**
   * The account that should receive the output.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: BigintIsh

  /**
   * The optional permit parameters for spending the input.
   */
  inputTokenPermit?: PermitOptions

  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * Optional information for taking a fee on output.
   */
  fee?: FeeOptions
}

const swapRouterAddresses: Record<SupportedChainsType, string | undefined> = {
  [ChainId.MAINNET]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.OPTIMISM]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.ARBITRUM_ONE]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.POLYGON]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.POLYGON_MUMBAI]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.GOERLI]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.CELO]: "0x5615CDAb10dc425a742d643d949a7F474C01abc4",
  [ChainId.CELO_ALFAJORES]: "0x5615CDAb10dc425a742d643d949a7F474C01abc4",
  [ChainId.BNB]: "0x83c346ba3d4Bf36b308705e24Fad80999401854b",
  [ChainId.OPTIMISM_GOERLI]: undefined,
  [ChainId.ARBITRUM_GOERLI]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  [ChainId.SEPOLIA]: undefined,
  [ChainId.AVALANCHE]: undefined,
  [ChainId.BASE]: undefined,
  [ChainId.BASE_GOERLI]: undefined
}

/**
 * Represents the Uniswap V3 SwapRouter, and has static methods for helping execute trades.
 */
export abstract class SwapRouter {
  public static INTERFACE: Interface = new Interface(ISwapRouter.abi)

  /**
   * Cannot be constructed.
   */
  private constructor() { }

  /**
   * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
   * @param trade to produce call parameters for
   * @param options options for the call parameters
   */
  public static swapCallParameters(
    trades: Trade<Currency, Currency, TradeType> | Trade<Currency, Currency, TradeType>[],
    options: SwapOptions
  ): MethodParameters {
    if (!Array.isArray(trades)) {
      trades = [trades]
    }

    const sampleTrade = trades[0]
    const tokenIn = sampleTrade.inputAmount.currency.wrapped
    const tokenOut = sampleTrade.outputAmount.currency.wrapped

    // All trades should have the same starting and ending token.
    invariant(
      trades.every((trade) => trade.inputAmount.currency.wrapped.equals(tokenIn)),
      'TOKEN_IN_DIFF'
    )
    invariant(
      trades.every((trade) => trade.outputAmount.currency.wrapped.equals(tokenOut)),
      'TOKEN_OUT_DIFF'
    )

    const calldatas: string[] = []

    const ZERO_IN: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].inputAmount.currency, 0)
    const ZERO_OUT: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].outputAmount.currency, 0)

    const totalAmountOut: CurrencyAmount<Currency> = trades.reduce(
      (sum, trade) => sum.add(trade.minimumAmountOut(options.slippageTolerance)),
      ZERO_OUT
    )

    // flag for whether a refund needs to happen
    const mustRefund = sampleTrade.inputAmount.currency.isNative && sampleTrade.tradeType === TradeType.EXACT_OUTPUT
    const inputIsNative = sampleTrade.inputAmount.currency.isNative
    // flags for whether funds should be send first to the router
    const outputIsNative = sampleTrade.outputAmount.currency.isNative
    const routerMustCustody = outputIsNative || !!options.fee

    const totalValue: CurrencyAmount<Currency> = inputIsNative
      ? trades.reduce((sum, trade) => sum.add(trade.maximumAmountIn(options.slippageTolerance)), ZERO_IN)
      : ZERO_IN

    // encode permit if necessary
    if (options.inputTokenPermit) {
      invariant(sampleTrade.inputAmount.currency.isToken, 'NON_TOKEN_PERMIT')
      calldatas.push(SelfPermit.encodePermit(sampleTrade.inputAmount.currency, options.inputTokenPermit))
    }

    const recipient: string = validateAndParseAddress(options.recipient)
    const deadline = toHex(options.deadline)

    for (const trade of trades) {
      for (const { route, inputAmount, outputAmount } of trade.swaps) {
        const amountIn: string = toHex(trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient)
        const amountOut: string = toHex(trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient)

        // flag for whether the trade is single hop or not
        const singleHop = route.pools.length === 1

        if (singleHop) {
          if (trade.tradeType === TradeType.EXACT_INPUT) {
            const exactInputSingleParams = {
              tokenIn: route.tokenPath[0].address,
              tokenOut: route.tokenPath[1].address,
              fee: route.pools[0].fee,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountIn,
              amountOutMinimum: amountOut,
              sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0),
            }

            calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactInputSingle', [exactInputSingleParams]))
          } else {
            const exactOutputSingleParams = {
              tokenIn: route.tokenPath[0].address,
              tokenOut: route.tokenPath[1].address,
              fee: route.pools[0].fee,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountOut,
              amountInMaximum: amountIn,
              sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0),
            }

            calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactOutputSingle', [exactOutputSingleParams]))
          }
        } else {
          invariant(options.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')

          const path: string = encodeRouteToPath(route, trade.tradeType === TradeType.EXACT_OUTPUT)

          if (trade.tradeType === TradeType.EXACT_INPUT) {
            const exactInputParams = {
              path,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountIn,
              amountOutMinimum: amountOut,
            }

            calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactInput', [exactInputParams]))
          } else {
            const exactOutputParams = {
              path,
              recipient: routerMustCustody ? ADDRESS_ZERO : recipient,
              deadline,
              amountOut,
              amountInMaximum: amountIn,
            }

            calldatas.push(SwapRouter.INTERFACE.encodeFunctionData('exactOutput', [exactOutputParams]))
          }
        }
      }
    }

    // unwrap
    if (routerMustCustody) {
      if (!!options.fee) {
        if (outputIsNative) {
          calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient, options.fee))
        } else {
          calldatas.push(
            Payments.encodeSweepToken(
              sampleTrade.outputAmount.currency.wrapped,
              totalAmountOut.quotient,
              recipient,
              options.fee
            )
          )
        }
      } else {
        calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient))
      }
    }

    // refund
    if (mustRefund) {
      calldatas.push(Payments.encodeRefundETH())
    }

    return {
      calldata: Multicall.encodeMulticall(calldatas),
      value: toHex(totalValue.quotient),
    }
  }

  /**
   * Utility function that creates calldata for Trades with swapCallParameters and directly calls the function using a given Signer.
   * @param trades to produce call parameters for
   * @param options for the call parameters
   * @param signer with provider capabilities to sign the transaction
   */
  public static async executeTrade(
    trades: Trade<Currency, Currency, TradeType> | Trade<Currency, Currency, TradeType>[],
    options: SwapOptions | undefined,
    signer: Signer
  ): Promise<TransactionResponse> {

    if (options === undefined) {
      options = {
        slippageTolerance: new Percent(50, 10_000),
        deadline: Math.floor(Date.now() / 1000) + 60 * 5, // 5 minutes from the current Unix time
        recipient: await signer.getAddress(),
      }
    }

    const methodParameters = this.swapCallParameters(trades, options)

    if (!Array.isArray(trades)) {
      trades = [trades]
    }
    const firstTrade = trades[0]
    const tokenIn = firstTrade.inputAmount.currency.wrapped

    const chainId = tokenIn.chainId
    const chain = SUPPORTED_CHAINS[chainId]

    invariant(chain !== undefined, 'Unsupported Chain')

    const routerAddress = swapRouterAddresses[chain]

    invariant(routerAddress !== undefined, 'Router not deployed on requested Chain')

    const signerAddress = await signer.getAddress()
    const inputIsNative = firstTrade.inputAmount.currency.isNative

    if (inputIsNative === false && !options.inputTokenPermit) {
      const provider = signer.provider

      invariant(provider !== undefined, 'No provider')

      const allowance = await getAllowance(
        routerAddress,
        tokenIn.address,
        signerAddress,
        provider
      )
      const maxAmountIn = BigInt(firstTrade.inputAmount.toExact()) * firstTrade.inputAmount._decimalScale

      if (allowance < maxAmountIn) {
        await approveTokenTransfer(
          routerAddress,
          tokenIn.address,
          maxAmountIn,
          signer
        )
      }
    }

    const tx = {
      data: methodParameters.calldata,
      to: routerAddress,
      value: methodParameters.value,
      from: signerAddress
    }

    return signer.sendTransaction(tx)
  }

  /**
   * Executes a swap on a Pool. Creates a Route and uses swapUsingRoutes internally. 
   * Fetches the input or output amount from the SwapQuoter.
   * @template TInput The input token, either Ether or an ERC-20
   * @template TOutput The output token, either Ether or an ERC-20
   * @param pool to execute the swap on.
   * @param amount The Input amount for EXACT_IN trades, the Output amount for EXACT_OUT trades
   * @param tradeType of the swap, either EXACT_IN or EXACT_OUT
   * @param swapOptions Optional SwapOptions that define deadline, recipient and slippage of the trade
   * @param signer with provider capabilities to sign the transaction
   */
  public static async executeQuotedSwapOnPool<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType>(
      pool: Pool,
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
      tradeType: TradeType,
      swapOptions: SwapOptions | undefined,
      signer: Signer
    ): Promise<TransactionResponse> {
    const secondCurrency = amount.currency.equals(pool.token0) ? pool.token1 : pool.token0

    invariant((
      secondCurrency.equals(pool.token0) && amount.currency.equals(pool.token1)
    ) || (
        secondCurrency.equals(pool.token1) && amount.currency.equals(pool.token0)
      ), 'CurrencyAmount not matching Pool')

    const { inputToken, outputToken } = tradeType === TradeType.EXACT_INPUT ?
      { inputToken: amount.currency, outputToken: secondCurrency } :
      { inputToken: secondCurrency, outputToken: amount.currency }

    const tradeRoute = new Route(
      [pool],
      inputToken,
      outputToken
    )
    return this.executeQuotedSwapFromRoute(tradeRoute, amount, tradeType, swapOptions, signer)
  }

  /**
   * Executes trades along a route. Uses the SwapQuoter to quote the amounts.
   * @template TInput The input token, either Ether or an ERC-20
   * @template TOutput The output token, either Ether or an ERC-20
   * @param route along which the trade is created
   * @param amount The Input amount for EXACT_IN trades, the Output amount for EXACT_OUT trades
   * @param tradeType of the swap, either EXACT_IN or EXACT_OUT
   * @param swapOptions Optional SwapOptions that define deadline, recipient and slippage of the trade
   * @param signer with provider capabilities to sign the transaction
   */
  public static async executeQuotedSwapFromRoute<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType>(
      route: Route<TInput, TOutput>,
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
      tradeType: TradeType,
      swapOptions: SwapOptions | undefined,
      signer: Signer
    ): Promise<TransactionResponse> {

    let inputAmount: CurrencyAmount<TInput>
    let outputAmount: CurrencyAmount<TOutput>

    let provider = signer.provider

    invariant(provider !== undefined, 'Signer needs to have a provider')

    if (tradeType === TradeType.EXACT_INPUT) {
      inputAmount = amount as CurrencyAmount<TInput>
      outputAmount = await SwapQuoter.callQuoter(route, amount, tradeType, provider) as CurrencyAmount<TOutput>
    } else {
      outputAmount = amount as CurrencyAmount<TOutput>
      inputAmount = await SwapQuoter.callQuoter(route, amount, tradeType, provider) as CurrencyAmount<TInput>
    }

    let trade = Trade.createUncheckedTrade({ route, inputAmount, outputAmount, tradeType })

    return this.executeTrade(trade, swapOptions, signer)
  }

  /**
   * Given a list of Pools, and an amount in or out, finds the best trade containing the pools and 
   * executes the trade directly.
   * @param pools over which the trade can be made
   * @param amount The Input amount for EXACT_IN trades, the Output amount for EXACT_OUT trades
   * @param currencyIn for EXACT_OUT trades
   * @param currencyOut for EXACT_IN trades
   * @param tradeType of the Trade, EXACT_IN or EXACT_OUT
   * @param bestTradeOptions Optional, defines the max number of trades used and max pools (hops) per route
   * @param swapOptions Optional Swap Options for the trade execution
   * @param signer with provider capabilities to sign the transaction
   */
  public static async executeBestSimulatedSwapOnPools<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType>(
      pools: Pool[],
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
      currencyIn: TTradeType extends TradeType.EXACT_INPUT ? undefined | TInput : TInput,
      currencyOut: TTradeType extends TradeType.EXACT_OUTPUT ? undefined | TOutput : TOutput,
      tradeType: TradeType,
      bestTradeOptions: BestTradeOptions | undefined,
      swapOptions: SwapOptions | undefined,
      signer: Signer
    ): Promise<TransactionResponse> {
    if (bestTradeOptions === undefined) bestTradeOptions = { maxNumResults: 3, maxHops: 3 }

    const provider = signer.provider

    invariant(provider !== undefined, 'Signer is not connected to a network.')
    // TODO: Ensure the blocknumber is consistent between these calls
    let promises = []
    for (let pool of pools) {
      promises.push(pool.initializeTicks())
    }
    await Promise.all(promises)

    let trades: Trade<TInput, TOutput, TradeType.EXACT_INPUT>[] | Trade<TInput, TOutput, TradeType.EXACT_OUTPUT>[]
    if (tradeType === TradeType.EXACT_INPUT) {
      trades = await Trade.bestTradeExactIn(pools, amount as CurrencyAmount<TInput>, currencyOut as TOutput, bestTradeOptions)
    } else {
      trades = await Trade.bestTradeExactOut(pools, currencyIn as TInput, amount as CurrencyAmount<TOutput>)
    }

    invariant(trades.length > 0, 'Could not find a trade route on given Pools')

    return this.executeTrade(trades[0], swapOptions, signer)
  }

  /**
   * Creates a Trade from a Route and executes it using a given Signer.
   * @param route The Route through which the trade is made
   * @param amount The input amount for EXACT_IN trades, the output amount for EXACT_OUT trades
   * @param tradeType TradeType, EXACT_IN or EXACT_OUT
   * @param swapOptions Optional Swap Options for the trade execution
   * @param signer with provider capabilities to sign the Transaction
   */
  public static async executeSimulatedSwapFromRoute<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType>(
      route: Route<TInput, TOutput>,
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
      tradeType: TradeType,
      swapOptions: SwapOptions | undefined,
      signer: Signer
    ): Promise<TransactionResponse> {
    const provider = signer.provider

    invariant(provider !== undefined, 'Signer has no network connection')

    await fetchTickDataForAllPoolsInRoute(route, provider)

    let trade = await Trade.fromRoute(route, amount, tradeType)

    return this.executeTrade(trade, swapOptions, signer)
  }
}
