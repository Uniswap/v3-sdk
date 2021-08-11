import { Interface } from '@ethersproject/abi'
import { BigintIsh, Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'
import { Trade } from './entities/trade'
import { ADDRESS_ZERO } from './constants'
import { PermitOptions, SelfPermit } from './selfPermit'
import { encodeRouteToPath } from './utils'
import { MethodParameters, toHex } from './utils/calldata'
import { abi } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'


export interface FeeOptions {
    /**
     * The percent of the output that will be taken as a fee.
     */
    fee: Percent
  
    /**
     * The recipient of the fee.
     */
    recipient: string
  }


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

  export abstract class SwapQuoter {
    public static INTERFACE: Interface = new Interface(abi)


    public 



  }