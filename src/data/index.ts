import { ethers } from 'ethers'

import { ETH, ETH_TOKEN, CHAIN_ID_NAME, ERC20_ABI, FACTORY_ADDRESS, FACTORY_ABI } from '../constants'
import { ChainIdOrProvider, isChainId, _ChainIdAndProvider, Token, TokenReservesNormalized } from '../types'
import { normalizeAddress, normalizeBigNumberish } from '../_utils'

// get contract object with address, ABI, and provider
function _getContract(address: string, ABI: string, provider: ethers.providers.BaseProvider): ethers.Contract {
  return new ethers.Contract(normalizeAddress(address), ABI, provider)
}

// get chain id and provider with either a chain id or a provider
async function _getChainIdAndProvider(chainIdOrProvider: ChainIdOrProvider): Promise<_ChainIdAndProvider> {
  // if a chainId is provided, get a default provider for it
  if (isChainId(chainIdOrProvider)) {
    return {
      chainId: chainIdOrProvider,
      provider: ethers.getDefaultProvider(CHAIN_ID_NAME[chainIdOrProvider])
    }
  }
  // if a provider is provided, fetch the chainId from it
  else {
    const { chainId }: ethers.utils.Network = await chainIdOrProvider.getNetwork()
    return {
      chainId,
      provider: chainIdOrProvider
    }
  }
}

// get token data from an address and chain id/provider
async function _getToken(tokenAddress: string, chainIdAndProvider: _ChainIdAndProvider): Promise<Token> {
  if (tokenAddress === ETH) {
    return ETH_TOKEN(chainIdAndProvider.chainId)
  } else {
    const ERC20Contract: ethers.Contract = _getContract(tokenAddress, ERC20_ABI, chainIdAndProvider.provider)
    const decimals: number = await ERC20Contract.decimals()
    return {
      chainId: chainIdAndProvider.chainId,
      address: ERC20Contract.address,
      decimals
    }
  }
}

// external function to get token reserves
export async function getTokenReserves(
  tokenAddress: string,
  chainIdOrProvider: ChainIdOrProvider = 1
): Promise<TokenReservesNormalized> {
  const chainIdAndProvider: _ChainIdAndProvider = await _getChainIdAndProvider(chainIdOrProvider)

  // fetch tokens
  const ethTokenPromise: Promise<Token> = _getToken(ETH, chainIdAndProvider)
  const tokenPromise: Promise<Token> = _getToken(tokenAddress, chainIdAndProvider)

  // get contracts
  const factoryContract: ethers.Contract = _getContract(
    FACTORY_ADDRESS[chainIdAndProvider.chainId],
    FACTORY_ABI,
    chainIdAndProvider.provider
  )
  const tokenContract: ethers.Contract = _getContract(tokenAddress, ERC20_ABI, chainIdAndProvider.provider)

  const exchangeAddress: string = await factoryContract.getExchange(tokenContract.address)

  const exchangeTokenPromise: Promise<Token> = _getToken(exchangeAddress, chainIdAndProvider)
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
