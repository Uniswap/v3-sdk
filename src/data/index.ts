import { ethers } from 'ethers'

import {
  ChainIdOrProvider,
  isChainId,
  isLowLevelProvider,
  Token,
  TokenReservesNormalized,
  _ChainIdAndProvider
} from '../types'
import { ETH, SUPPORTED_CHAIN_ID, FACTORY_ABI, FACTORY_ADDRESS, _CHAIN_ID_NAME, _ERC20_ABI } from '../constants'
import { normalizeBigNumberish, normalizeAddress, getEthToken } from '../_utils'

function getContract(address: string, ABI: string, provider: ethers.providers.Provider): ethers.Contract {
  return new ethers.Contract(address, ABI, provider)
}

async function getChainIdAndProvider(chainIdOrProvider: ChainIdOrProvider): Promise<_ChainIdAndProvider> {
  // if a chainId is provided, get a default provider for it
  if (isChainId(chainIdOrProvider)) {
    return {
      chainId: chainIdOrProvider,
      provider: ethers.getDefaultProvider(_CHAIN_ID_NAME[chainIdOrProvider])
    }
  }
  // if a provider is provided, fetch the chainId from it
  else {
    const provider: ethers.providers.Provider = isLowLevelProvider(chainIdOrProvider)
      ? new ethers.providers.Web3Provider(chainIdOrProvider)
      : chainIdOrProvider
    const { chainId }: ethers.utils.Network = await provider.getNetwork()

    if (!(chainId in SUPPORTED_CHAIN_ID)) {
      throw Error(`chainId ${chainId} is not valid.`)
    }

    return {
      chainId,
      provider
    }
  }
}

async function getToken(tokenAddress: string, chainIdAndProvider: _ChainIdAndProvider): Promise<Token> {
  if (tokenAddress === ETH) {
    return getEthToken(chainIdAndProvider.chainId)
  } else {
    const ERC20Contract: ethers.Contract = getContract(tokenAddress, _ERC20_ABI, chainIdAndProvider.provider)
    const decimals: number = await ERC20Contract.decimals()

    return {
      chainId: chainIdAndProvider.chainId,
      address: ERC20Contract.address,
      decimals
    }
  }
}

export async function getTokenReserves(
  tokenAddress: string,
  chainIdOrProvider: ChainIdOrProvider = 1
): Promise<TokenReservesNormalized> {
  // validate input arguments
  const normalizedTokenAddress: string = normalizeAddress(tokenAddress)
  const chainIdAndProvider: _ChainIdAndProvider = await getChainIdAndProvider(chainIdOrProvider)

  // fetch tokens (async)
  const ethTokenPromise: Promise<Token> = getToken(ETH, chainIdAndProvider)
  const tokenPromise: Promise<Token> = getToken(normalizedTokenAddress, chainIdAndProvider)

  // get contracts
  const factoryContract: ethers.Contract = getContract(
    FACTORY_ADDRESS[chainIdAndProvider.chainId],
    FACTORY_ABI,
    chainIdAndProvider.provider
  )
  const tokenContract: ethers.Contract = getContract(normalizedTokenAddress, _ERC20_ABI, chainIdAndProvider.provider)

  // fetch exchange adddress (blocking async)
  const exchangeAddress: string = await factoryContract.getExchange(normalizedTokenAddress)

  // fetch exchange token and eth/token balances (async)
  const exchangeTokenPromise: Promise<Token> = getToken(exchangeAddress, chainIdAndProvider)
  const ethBalancePromise: Promise<ethers.utils.BigNumber> = chainIdAndProvider.provider.getBalance(exchangeAddress)
  const tokenBalancePromise: Promise<ethers.utils.BigNumber> = tokenContract.balanceOf(exchangeAddress)

  const [ethToken, token, exchangeToken, ethBalance, tokenBalance]: [
    Token,
    Token,
    Token,
    ethers.utils.BigNumber,
    ethers.utils.BigNumber
  ] = await Promise.all([ethTokenPromise, tokenPromise, exchangeTokenPromise, ethBalancePromise, tokenBalancePromise])

  const ethReserve = { token: ethToken, amount: normalizeBigNumberish(ethBalance) }
  const tokenReserve = { token, amount: normalizeBigNumberish(tokenBalance) }

  return { token, exchange: exchangeToken, ethReserve, tokenReserve }
}
