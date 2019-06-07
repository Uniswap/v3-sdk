import BigNumber from 'bignumber.js'

import { Token } from '../types'
import ERC20 from './abis/ERC20.json'
import FACTORY from './abis/FACTORY.json'

//// constants for internal and external use
export const ETH = 'ETH'

export enum SUPPORTED_CHAIN_ID {
  Mainnet = 1,
  Ropsten = 3,
  Rinkeby = 4,
  Kovan = 42
}

export const FACTORY_ADDRESS: { [key: number]: string } = {
  [SUPPORTED_CHAIN_ID.Mainnet]: '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95',
  [SUPPORTED_CHAIN_ID.Ropsten]: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
  [SUPPORTED_CHAIN_ID.Rinkeby]: '0xf5D915570BC477f9B8D6C0E980aA81757A3AaC36',
  [SUPPORTED_CHAIN_ID.Kovan]: '0xD3E51Ef092B2845f10401a0159B2B96e8B6c3D30'
}

export enum TRADE_TYPE {
  TOKEN_TO_ETH = 'TOKEN_TO_ETH',
  ETH_TO_TOKEN = 'ETH_TO_TOKEN',
  TOKEN_TO_TOKEN = 'TOKEN_TO_TOKEN'
}

export enum TRADE_EXACT {
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT'
}

export enum FIXED_UNDERFLOW_BEHAVIOR {
  ZERO = 'ZERO',
  LESS_THAN = 'LESS_THAN',
  ONE_DIGIT = 'ONE_DIGIT'
}

//// constants for internal use
export const MAX_DECIMAL_PLACES = 18
export const ROUNDING_MODE = BigNumber.ROUND_HALF_UP
BigNumber.set({ DECIMAL_PLACES: MAX_DECIMAL_PLACES, ROUNDING_MODE })

export const _0: BigNumber = new BigNumber('0')
export const _1: BigNumber = new BigNumber('1')
export const _10: BigNumber = new BigNumber('10')
export const _997: BigNumber = new BigNumber('997')
export const _1000: BigNumber = new BigNumber('1000')
export const _10000: BigNumber = new BigNumber('10000')
export const MAX_UINT8: number = 2 ** 8 - 1
export const MAX_UINT256: BigNumber = new BigNumber('2').exponentiatedBy(new BigNumber('256')).minus(_1)

export function ETH_TOKEN(chainId?: number): Token {
  return {
    ...(chainId ? { chainId } : {}),
    address: ETH,
    decimals: 18
  }
}

export const CHAIN_ID_NAME: { [key: number]: string } = {
  [SUPPORTED_CHAIN_ID.Mainnet]: 'homestead',
  [SUPPORTED_CHAIN_ID.Ropsten]: 'ropsten',
  [SUPPORTED_CHAIN_ID.Rinkeby]: 'rinkeby',
  [SUPPORTED_CHAIN_ID.Kovan]: 'kovan'
}

export const ERC20_ABI: string = JSON.stringify(ERC20)
export const FACTORY_ABI: string = JSON.stringify(FACTORY)
