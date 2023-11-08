import { Interface, defaultAbiCoder} from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { Provider } from '@ethersproject/abstract-provider'
import { BigintIsh, Currency, CurrencyAmount, TradeType, CHAIN_TO_ADDRESSES_MAP, SUPPORTED_CHAINS, SupportedChainsType, ChainId } from '@uniswap/sdk-core'
import { encodeRouteToPath, MethodParameters, toHex } from './utils'
import IQuoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import IQuoterV2 from '@uniswap/swap-router-contracts/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'
import { Route } from './entities'
import invariant from 'tiny-invariant'
import { FeeAmount } from './constants'

/**
 * Optional arguments to send to the quoter.
 */
export interface QuoteOptions {
  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * The optional quoter interface to use
   */
  useQuoterV2?: boolean
}

interface BaseQuoteParams {
  fee: FeeAmount
  sqrtPriceLimitX96: string
  tokenIn: string
  tokenOut: string
}

const quoterV2Addresses: Record<SupportedChainsType, string> = {
  [ChainId.MAINNET]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.OPTIMISM]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.ARBITRUM_ONE]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.POLYGON]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.POLYGON_MUMBAI]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.GOERLI]: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  [ChainId.CELO]: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8",
  [ChainId.CELO_ALFAJORES]: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8",
  [ChainId.BNB]: "0x78D78E420Da98ad378D7799bE8f4AF69033EB077",
  [ChainId.OPTIMISM_GOERLI]: "0x9569CbA925c8ca2248772A9A4976A516743A246F",
  [ChainId.ARBITRUM_GOERLI]: "0x1dd92b83591781D0C6d98d07391eea4b9a6008FA",
  [ChainId.SEPOLIA]: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
  [ChainId.AVALANCHE]: "0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F",
  [ChainId.BASE]: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
  [ChainId.BASE_GOERLI]: "0xedf539058e28E5937dAef3f69cEd0b25fbE66Ae9"
}

/**
 * Represents the Uniswap V3 QuoterV1 and QuoterV2 contract.
 */
export abstract class SwapQuoter {
  public static V1INTERFACE: Interface = new Interface(IQuoter.abi)
  public static V2INTERFACE: Interface = new Interface(IQuoterV2.abi)

  /**
   * Produces the on-chain method name of the appropriate function within QuoterV2,
   * and the relevant hex encoded parameters.
   * @template TInput The input token, either Ether or an ERC-20
   * @template TOutput The output token, either Ether or an ERC-20
   * @param route The swap route, a list of pools through which a swap can occur
   * @param amount The amount of the quote, either an amount in, or an amount out
   * @param tradeType The trade type, either exact input or exact output
   * @param options The optional params including price limit and Quoter contract switch
   * @returns The formatted calldata
   */
  public static quoteCallParameters<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>,
    tradeType: TradeType,
    options: QuoteOptions = {}
  ): MethodParameters {
    const singleHop = route.pools.length === 1
    const quoteAmount: string = toHex(amount.quotient)
    let calldata: string
    const swapInterface: Interface = options.useQuoterV2 ? this.V2INTERFACE : this.V1INTERFACE

    if (singleHop) {
      const baseQuoteParams: BaseQuoteParams = {
        tokenIn: route.tokenPath[0].address,
        tokenOut: route.tokenPath[1].address,
        fee: route.pools[0].fee,
        sqrtPriceLimitX96: toHex(options?.sqrtPriceLimitX96 ?? 0),
      }

      const v2QuoteParams = {
        ...baseQuoteParams,
        ...(tradeType == TradeType.EXACT_INPUT ? { amountIn: quoteAmount } : { amount: quoteAmount }),
      }

      const v1QuoteParams = [
        baseQuoteParams.tokenIn,
        baseQuoteParams.tokenOut,
        baseQuoteParams.fee,
        quoteAmount,
        baseQuoteParams.sqrtPriceLimitX96,
      ]

      const tradeTypeFunctionName =
        tradeType === TradeType.EXACT_INPUT ? 'quoteExactInputSingle' : 'quoteExactOutputSingle'
      calldata = swapInterface.encodeFunctionData(
        tradeTypeFunctionName,
        options.useQuoterV2 ? [v2QuoteParams] : v1QuoteParams
      )
    } else {
      invariant(options?.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')
      const path: string = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)
      const tradeTypeFunctionName = tradeType === TradeType.EXACT_INPUT ? 'quoteExactInput' : 'quoteExactOutput'
      calldata = swapInterface.encodeFunctionData(tradeTypeFunctionName, [path, quoteAmount])
    }
    return {
      calldata,
      value: toHex(0),
    }
  }

  /**
   * Utility function to directly return a quote without the need to handle calldata from the user.
   * Uses quoteCallParameters internally. Always uses QuoterV2.
   * @template TInput The input token, either Ether or an ERC-20
   * @template TOutput The output token, either Ether or an ERC-20
   * @param route The swap route, a list of pools through which a swap can occur
   * @param amount The amount of the quote, either an amount in, or an amount out
   * @param tradeType The trade type, either exact input or exact output
   * @returns The decoded result of the Quoter call
   */
  public static async callQuoter<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amount: CurrencyAmount<TInput | TOutput>,
    tradeType: TradeType,
    provider: Provider
  ): Promise<CurrencyAmount<TInput | TOutput>> {
    const chainId = amount.currency.chainId
    const chain = SUPPORTED_CHAINS[chainId]

    invariant(chain !== undefined, 'Unsupported Chain')

    const contractAddresses = CHAIN_TO_ADDRESSES_MAP[chain]
    // TODO: Add QuoterV2 here when the issue in the sdk-core is resolved.
    const quoterV2Address = quoterV2Addresses[chain]

    invariant(contractAddresses)

    const methodParameters = this.quoteCallParameters(
      route, 
      amount, 
      tradeType,
      {
        useQuoterV2: true
      }
    )
    const quoteCallReturnValue = await provider.call({
      to: quoterV2Address,
      data: methodParameters.calldata
    })

    const decodedEthersValue: BigNumber = defaultAbiCoder.decode(['uint256'], quoteCallReturnValue)[0]
    const bigintQuoterValue = decodedEthersValue.toBigInt()

    invariant(typeof bigintQuoterValue === "bigint" , 'Could not decode quoter response')

    if (tradeType === TradeType.EXACT_INPUT) {
      const outputCurrency = route.output
      return CurrencyAmount.fromRawAmount(outputCurrency, bigintQuoterValue)
    } else {
      const inputCurrency = route.input
      return CurrencyAmount.fromRawAmount(inputCurrency, bigintQuoterValue)
    }
  }
}
