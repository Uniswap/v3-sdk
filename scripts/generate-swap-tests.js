const fs = require('fs')
const commander = require('commander')
const ethers = require('ethers')
const erc20Abi = require('./abis/erc20.json')
const fetchTicksAbi = require('./abis/fetch-ticks.json')
const v3PoolAbi = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json').abi
const quoterAbi = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json').abi

commander
  .version('1.0.0', '-v, --version')
  .usage('[OPTIONS]...')
  .requiredOption('-P, --provider <value>', 'A provider to fetch data from. HTTP/S only.')
  .requiredOption('-p, --pool <value>', 'Pool to fetch data from. Comma separate to generate for multiple.')
  .requiredOption(
    '-n, --number <value>',
    'Number of tests to generate per pool. Will generate an extra 10% of failing swaps.'
  )
  .option('-r, --reversed', 'Sets zeroForOne to false (e.g.: swaps into the opposite direction).')
  .parse(process.argv)

const { provider: providerUrl, pool: poolAddresses, number, reversed } = commander.opts()

const provider = new ethers.providers.JsonRpcProvider(providerUrl)
const fetchTicks = new ethers.Contract('0x3ea366bE8DA9888a41293Cf5aa6a3f863Ebc06C5', fetchTicksAbi, provider)
const quoter = new ethers.Contract('0x61fFE014bA17989E743c5F6cB21bF9697530B21e', quoterAbi, provider)

function multiply(_a, _b) {
  const toInt = (e) => {
    let eArray = e.split('.')
    let pair = []
    pair['int'] = BigInt(eArray[0] + (eArray[1] ? eArray[1] : ''))
    pair['dec'] = eArray[1] ? eArray[1].length : 0
    return pair
  }
  const [a, b] = [toInt(_a), toInt(_b)]

  const getMultiplier = (e) => 10n ** BigInt(e)

  let multiplier = getMultiplier(a['dec']) * getMultiplier(b['dec'])
  let ab
  if (a['int'] > b['int'] && a['int'].toString().length > multiplier.toString().length) {
    ab = (a['int'] / multiplier) * b['int']
  } else if (b['int'] > a['int'] && b['int'].toString().length > multiplier.toString().length) {
    ab = (b['int'] / multiplier) * a['int']
  } else if (b['int'].toString().length + a['int'].toString().length > multiplier.toString().length) {
    ab = (a['int'] * b['int']) / multiplier
  } else {
    return 0n
  }
  return ab
}

async function fetchTicksRPC(poolAddress, blockNumber) {
  const ticksRaw = await fetchTicks.getPoolData(poolAddress, 200n.toString(10), { blockTag: blockNumber })
  const ticks = ticksRaw.allTicks
    .flat()
    .map((el) => {
      return { index: el[0], liquidityNet: el[1], liquidityGross: el[2] }
    })
    .sort((left, right) => {
      return left.index - right.index
    })
    .map((el) => {
      return {
        index: el.index,
        liquidityNet: el.liquidityNet.toString(),
        liquidityGross: el.liquidityGross.toString(),
      }
    })

  return ticks
}

async function fetchTicksDiamond(diamondProvider, poolAddress, blockNumber) {
  const response = await diamondProvider.send('cush_poolInitializedTicksInRange', [
    poolAddress,
    -887272,
    887272,
    blockNumber,
  ])

  return response
    .map((el) => {
      return {
        index: el.index,
        liquidityNet: ethers.BigNumber.from(el.liquidity_net).fromTwos(256).toString(),
        liquidityGross: ethers.BigNumber.from(el.liquidity_gross).fromTwos(256).toString(),
      }
    })
    .sort((left, right) => {
      return left.index - right.index
    })
}

const asyncFunc = async (poolAddress) => {
  // Do everything on this blockNumber. -50 to reduce likelihood of reorgs during the generation process.
  const blockNumber = (await provider.getBlockNumber()) - 50

  const pool = new ethers.Contract(poolAddress, v3PoolAbi, provider)

  const { chainId } = await provider.getNetwork()

  // Diamond API if available
  let diamondProviderPath
  switch (chainId) {
    case 1:
      diamondProviderPath = '/ethereum'
      break
    case 5:
      diamondProviderPath = '/goerli'
      break
    case 137:
      diamondProviderPath = '/polygon'
      break
    case 42161:
      diamondProviderPath = '/arbitrum'
      break
    case 10:
      diamondProviderPath = '/optimism'
      break
    default:
      console.log(
        `[WARN] Chain with id ${chainId} not supported by Diamond API. Fallback to less accurate and slower RPC fetching.`
      )
      diamondProviderPath = undefined
      break
  }
  /**
   * @type {ethers.providers.JsonRpcProvider | undefined}
   */
  let diamondProvider
  if (diamondProviderPath) {
    diamondProvider = new ethers.providers.JsonRpcProvider(`https://cush.gfx.xyz${diamondProviderPath}`)
  }

  const [token0Address, token1Address] = await Promise.all([pool.token0(), pool.token1()])
  const [token0, token1] = [
    new ethers.Contract(token0Address, erc20Abi, provider),
    new ethers.Contract(token1Address, erc20Abi, provider),
  ]
  const [token0Symbol, token1Symbol] = await Promise.all([token0.symbol(), token1.symbol()])
  const [token0Decimals, token1Decimals] = await Promise.all([token0.decimals(), token1.decimals()])

  const [token0Balance, token1Balance] = await Promise.all([
    token0.balanceOf(poolAddress, { blockTag: blockNumber }),
    token1.balanceOf(poolAddress, { blockTag: blockNumber }),
  ])

  const fee = await pool.fee()
  const liquidity = await pool.liquidity()
  const slot0 = await pool.slot0({ blockTag: blockNumber })

  let ticks
  if (diamondProvider) {
    ticks = await fetchTicksDiamond(diamondProvider, poolAddress, blockNumber)
  } else {
    ticks = await fetchTicksRPC(poolAddress, blockNumber)
  }

  console.log(
    `Generating ${number} test cases for ${token0Symbol} (${token0Decimals} decimals) - ${token1Symbol} (${token1Decimals} decimals) on pool with fee ${fee}`
  )
  console.log(`${token0Symbol} balance: ${token0Balance.toString()}`)
  console.log(`${token1Symbol} balance: ${token1Balance.toString()}`)

  const generatedTests = []

  // Exact Input: 50%
  for (let i = 0; i < parseInt(number) / 2; i++) {
    const randomInput = multiply(`${Math.random()}`, (!!reversed ? token1Balance : token0Balance).toString())

    const { amountOut } = await quoter.callStatic.quoteExactInputSingle(
      {
        tokenIn: !!reversed ? token1Address : token0Address,
        tokenOut: !!reversed ? token0Address : token1Address,
        amountIn: randomInput.toString(10),
        fee: fee,
        sqrtPriceLimitX96: (!!reversed
          ? BigInt('1461446703485210103287273052203988822378723970342') - 1n
          : BigInt('4295128739') + 1n
        ).toString(10),
      },
      { blockTag: blockNumber }
    )

    generatedTests.push({
      amountSpecified: randomInput.toString(10),
      exactInput: true,
      expectedAmountCalculated: amountOut.toString(),
    })
  }

  // Exact Output: 50%
  for (let i = 0; i < parseInt(number) / 2; i++) {
    const randomOutput = multiply(`${Math.random()}`, (!!reversed ? token0Balance : token1Balance).toString())

    const { amountIn } = await quoter.callStatic.quoteExactOutputSingle(
      {
        tokenIn: !!reversed ? token1Address : token0Address,
        tokenOut: !!reversed ? token0Address : token1Address,
        amount: randomOutput.toString(10),
        fee: fee,
        sqrtPriceLimitX96: (!!reversed
          ? BigInt('1461446703485210103287273052203988822378723970342') - 1n
          : BigInt('4295128739') + 1n
        ).toString(10),
      },
      { blockTag: blockNumber }
    )

    generatedTests.push({
      amountSpecified: randomOutput.toString(10),
      exactInput: false,
      expectedAmountCalculated: amountIn.toString(),
    })
  }

  // Generate test and push to out dir
  const testsJson = {
    poolName: `${token0Symbol} - ${token1Symbol} ${fee}${!!reversed ? ' - reversed' : ''}`,
    tokenA: {
      chainId: chainId,
      address: !!reversed ? token1Address : token0Address,
      decimals: !!reversed ? token1Decimals : token0Decimals,
    },
    tokenB: {
      chainId: chainId,
      address: !!reversed ? token0Address : token1Address,
      decimals: !!reversed ? token0Decimals : token1Decimals,
    },
    fee: fee,
    liquidity: liquidity.toString(),
    sqrtRatioX96: slot0.sqrtPriceX96.toString(),
    tickCurrent: slot0.tick,
    ticks: ticks,
    tests: generatedTests,
  }

  const outDir = `${__dirname}/out/`
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const fileName = `${poolAddress}${!!reversed ? '-reversed' : ''}.json`

  fs.writeFileSync(`${outDir}/${fileName}`, JSON.stringify(testsJson, null, 2))
}

for (const poolAddress of poolAddresses.split(',')) {
  asyncFunc(poolAddress)
}
