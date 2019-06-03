import { ethers } from 'ethers'

import { ETH, CHAIN_ID_NAME, ERC20_ABI, FACTORY_ADDRESS, FACTORY_ABI } from './constants'
import { ChainIdOrProvider, ChainIdAndProvider, Token, TokenReserves } from './types'
import { normalizeAddress, normalizeBigNumberish } from './utils'

// abstraction to get contracts
function _getContract(address: string, ABI: string, provider: ethers.providers.BaseProvider): ethers.Contract {
  return new ethers.Contract(normalizeAddress(address), ABI, provider)
}

// abstraction to get the chain id + provider
async function _getChainIdAndProvider(chainIdOrProvider: ChainIdOrProvider): Promise<ChainIdAndProvider> {
  // if a chainId is provided, get a default provider for it
  if (typeof chainIdOrProvider === 'number') {
    return {
      chainId: chainIdOrProvider,
      provider: ethers.getDefaultProvider(CHAIN_ID_NAME[chainIdOrProvider])
    }
  }
  // if a provider is provided, fetch the chainId from it
  else {
    const { chainId }: { chainId: number } = await chainIdOrProvider.getNetwork()
    return {
      chainId,
      provider: chainIdOrProvider
    }
  }
}

// abstraction to get token
async function _getToken(tokenAddress: string, chainIdAndProvider: ChainIdAndProvider): Promise<Token> {
  if (tokenAddress === ETH) {
    return {
      chainId: chainIdAndProvider.chainId,
      address: ETH,
      decimals: 18
    }
  } else {
    const ERC20Contract: ethers.Contract = _getContract(tokenAddress, ERC20_ABI, chainIdAndProvider.provider)
    const decimals: number = await ERC20Contract.decimals()
    return {
      chainId: chainIdAndProvider.chainId,
      address: tokenAddress,
      decimals
    }
  }
}

// external function to get token reserves
export async function getTokenReserves(
  tokenAddress: string,
  chainIdOrProvider: ChainIdOrProvider = 1
): Promise<TokenReserves> {
  const chainIdAndProvider: ChainIdAndProvider = await _getChainIdAndProvider(chainIdOrProvider)

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
