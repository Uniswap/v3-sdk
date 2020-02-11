import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'
import { Contract } from '@ethersproject/contracts'

import { ChainId, SolidityType } from '../constants'
import ERC20 from '../abis/ERC20.json'
import { validateAndParseAddress, validateSolidityTypeInstance } from '../utils'

const CACHE: { [chainId: number]: { [address: string]: number } } = {
  1: {
    '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A': 9 // DGD
  }
}

export class Token {
  public readonly chainId: ChainId
  public readonly address: string
  public readonly decimals: number
  public readonly symbol?: string
  public readonly name?: string

  static async fetchData(
    chainId: ChainId,
    address: string,
    provider = getDefaultProvider(getNetwork(chainId)),
    symbol?: string,
    name?: string
  ): Promise<Token> {
    const parsedDecimals =
      typeof CACHE?.[chainId]?.[address] === 'number'
        ? CACHE[chainId][address]
        : await new Contract(address, ERC20, provider).decimals().then((decimals: number): number => {
            CACHE[chainId][address] = decimals
            return decimals
          })
    return new Token(chainId, address, parsedDecimals, symbol, name)
  }

  constructor(chainId: ChainId, address: string, decimals: number, symbol?: string, name?: string) {
    validateSolidityTypeInstance(JSBI.BigInt(decimals), SolidityType.uint8)

    this.chainId = chainId
    this.address = validateAndParseAddress(address)
    this.decimals = decimals
    if (typeof symbol === 'string') this.symbol = symbol
    if (typeof name === 'string') this.name = name
  }

  public equals(other: Token): boolean {
    const equal = this.chainId === other.chainId && this.address === other.address
    if (equal) invariant(this.decimals === other.decimals, 'DECIMALS')
    return equal
  }
}

export const WETH = {
  [ChainId.MAINNET]: new Token(
    ChainId.MAINNET,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.ROPSTEN]: new Token(
    ChainId.ROPSTEN,
    '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.RINKEBY]: new Token(
    ChainId.RINKEBY,
    '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    18,
    'WETH',
    'Wrapped Ether'
  ),
  [ChainId.GÖRLI]: new Token(ChainId.GÖRLI, '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', 18, 'WETH', 'Wrapped Ether'),
  [ChainId.KOVAN]: new Token(ChainId.KOVAN, '0xd0A1E359811322d97991E03f863a0C30C2cF029C', 18, 'WETH', 'Wrapped Ether')
}
