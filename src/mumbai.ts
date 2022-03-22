import { Wallet, Contract, providers, BigNumber } from "ethers";
import cTokenAbi from "./abis/BfErc20.json";
import compAbi from "./abis//BfComptroller.json";
import erc20Abi from "./abis/erc20.json";
import priceOracleAbi from "./abis/BfPriceOracle.json";
const provider = new providers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com"
);
// Just Test Account
const privateKey =
  "abdbe6420ebba257b82c2fa7272a8f02c05033d285576b5e8edd34316fae07af";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;


const comptrollerContractAddress = "0xADdC4b0d9A113D6295D95c9717D1b32b6b689FAE";
const comptrollerContract = new Contract(
  comptrollerContractAddress,
  compAbi,
  wallet
);
const priceOracleAddress = await comptrollerContract.oracle()
const priceOracle = new Contract(priceOracleAddress, priceOracleAbi, wallet);

const rewardTokenAddress = "0x153478A3898852B29C5adaA85a2619E8C6832917";
const allMarkets = [
  {
    symbol: "BTC",
    underlyingAddress: "0x9c4b3321B7150b231cAaA7c6Ba8C1cDc2BDb2F83",
    address: "0x153478A3898852B29C5adaA85a2619E8C6832917",
    decimals: 8,
    underlyingDecimals: 18,
    native: false,
  },
  {
    symbol: "MATIC",
    underlyingAddress: "",
    address: "0xf5c9Dbf75A3DB8e67F83B6F8F0aab70f3094A736",
    decimals: 8,
    underlyingDecimals: 18,
    native: true,
  },
];

/**
 * 奖励率 = 每秒产生的奖励价值 / 流通币价值
 * 贡献1刀流通币每秒能分发到多少价值的 Qi/AVAX
 *
 * rewardRatePerTimestamp =
 * (rewardSpeedPerTimestamp * rewardUSDPrice) / (totalSupply * underlyingTokenUSDPrice)
 *
 * totalSupply = getCash + totalBorrows - totalReserves
 * getCash: 合约中剩余的数量
 * totalBorrows: 借出的包含利息的数量
 * totalReserves: 准备金，市场中的储备
 * totalSupply: 市场中流通的 underlyingToken 数量
 */
const distributionAPY = async function () {
  console.log("Start calculate distribution APY");
  const { address, underlyingDecimals } = allMarkets[0];
  const cTokenContract = new Contract(address, cTokenAbi, wallet);

  const totalReserves =
    (await cTokenContract.callStatic.totalReserves()) /
    Math.pow(10, underlyingDecimals);
  const totalCash =
    (await cTokenContract.callStatic.getCash()) /
    Math.pow(10, underlyingDecimals);
  const totalBorrows =
    (await cTokenContract.callStatic.totalBorrows()) /
    Math.pow(10, underlyingDecimals);
  const totalSupply = totalCash + totalBorrows - totalReserves;

  // rewardType  0: BON, 1: MATIC
  const rewardSpeedPerTimestamp =
    await comptrollerContract.callStatic.rewardSpeeds(0, address);

  const underlyingTokenUSDPrice =
    (await priceOracle.callStatic.getUnderlyingPrice(address)) / 1e18;
  const rewardUSDPrice =
    (await priceOracle.callStatic.getUnderlyingPrice(rewardTokenAddress)) /
    1e18;

  const rewardSupplyRateTimestamp =
    (rewardSpeedPerTimestamp * rewardUSDPrice) /
    (totalSupply * underlyingTokenUSDPrice);

  const rewardBorrowRateTimestamp =
    (rewardSpeedPerTimestamp * rewardUSDPrice) /
    (totalBorrows * underlyingTokenUSDPrice);

  console.log(rewardSupplyRateTimestamp, rewardBorrowRateTimestamp);
  const distributionSupplyAPY = calculateAPY(rewardSupplyRateTimestamp);
  const distributionBorrowAPY = calculateAPY(rewardBorrowRateTimestamp);

  console.log("Distribution Supply APY: ", distributionSupplyAPY);
  console.log("Distribution Borrow APY: ", distributionBorrowAPY);
};

const supplyBorrowAPY = async () => {
  const { address } = allMarkets[0];
  // Supply APY: 供应年利率
  const cTokenContract = new Contract(address, cTokenAbi, wallet);
  const supplyRatePerBlock =
    await cTokenContract.callStatic.supplyRatePerBlock();
  const supplyAPY = calculateAPY(supplyRatePerBlock);
  console.log("supply APY:", supplyAPY);

  // Borrow APY：借贷年利率
  const borrowRatePerBlock =
    await cTokenContract.callStatic.supplyRatePerBlock();
  const borrowAPY = calculateAPY(borrowRatePerBlock);
  console.log("borrow APY:", borrowAPY);
};

const summary = async function () {
  // Collateral Factor
  // 质押因子，每种货币有独立的质押因子，借款限额 = 质押价值 * 质押因子，
  // e.g. 如果用户提供 100 DAI作为抵押，而DAI的质押因子为75%，那么用户最多可以借入价值 75 DAI的资产。
  const collateralFactors = await Promise.all(
    allMarkets.map(async ({ symbol, address }) => {
      let { 1: collateralFactor } =
        await comptrollerContract.callStatic.markets(address);
      return [symbol, collateralFactor / 1e18];
    })
  );
  const collateralFactorMap = Object.fromEntries(collateralFactors);
  const collateralFactor = collateralFactorMap["BTC"] * 100; // Convert to percent
  console.log("BTC Collateral Factor:", collateralFactor);

  // Collateralized Asset
  // 质押资产
  const collaterals = await comptrollerContract.getAssetsIn(wallet.address);
  const collateralAssets = allMarkets.filter(({ address }) =>
    collaterals.includes(address)
  );
  console.log(
    "Collateralized Assets: ",
    collateralAssets.map(({ symbol }) => symbol)
  );

  // underlyingTokenPrice
  const underlyingTokenPrices = await Promise.all(
    allMarkets.map(async ({ symbol, address, underlyingDecimals }) => {
      let underlyingPriceInUSD = 0;
      try {
        underlyingPriceInUSD =
        (await priceOracle.callStatic.getUnderlyingPrice(address)) /
        Math.pow(10, 36 - underlyingDecimals);
      } catch {
        console.log(symbol, address)
      }
      return [symbol, underlyingPriceInUSD];

    })
  );
  const underlyingTokenPriceMap = Object.fromEntries(underlyingTokenPrices);
  console.log("underlyingTokenPriceMap:", underlyingTokenPriceMap);

  // supplyBalance
  const supplyBalances = await Promise.all(
    allMarkets.map(
      async ({ symbol, address, decimals, underlyingDecimals }) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        const [_error, tokenBalanceRaw, _borrowBalance, exchangeRateRaw] =
          await cToken.getAccountSnapshot(myWalletAddress);
        const exchangeRateDecimals = 18 + underlyingDecimals - decimals;
        const exchangeRate =
          exchangeRateRaw / Math.pow(10, exchangeRateDecimals);
        const tokenBalance = tokenBalanceRaw / Math.pow(10, decimals);
        const supplyBalance = tokenBalance * exchangeRate;

        return [symbol, supplyBalance];
      }
    )
  );
  const supplyBalanceMap = Object.fromEntries(supplyBalances);
  console.log("supplyBalanceMap:", supplyBalanceMap);

  // borrowBalance
  const borrowBalances = await Promise.all(
    allMarkets.map(async ({ symbol, address, underlyingDecimals }) => {
      const cToken = new Contract(address, cTokenAbi, wallet);
      const [_error, _tokenBalance, borrowBalance, _exchangeRate] =
        await cToken.getAccountSnapshot(myWalletAddress);
      return [symbol, borrowBalance / Math.pow(10, underlyingDecimals)];
    })
  );
  const borrowBalanceMap = Object.fromEntries(borrowBalances);
  console.log("borrowBalanceMap:", borrowBalanceMap);

  // Total Collateral
  // 质押资产总额: Sum(collateralBalance * USDPrice)
  const totalCollateral = (
    await Promise.all(
      collateralAssets.map(async ({ symbol }: any) => {
        const underlyingPriceInUSD = underlyingTokenPriceMap[symbol];
        const supplyBalance = supplyBalanceMap[symbol];
        return underlyingPriceInUSD * supplyBalance;
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Collateral:", totalCollateral);

  // Borrow Limit
  // 总借款限额：各币种借款限额总和 = 已借 + 剩余
  // Borrow Limit = Total Borrowed + liquidity
  // Sum(collateralTokenAmount * collateralTokenUSDPrice * collateralFactor)
  const borrowLimit = (
    await Promise.all(
      collateralAssets.map(async ({ symbol }: any) => {
        const price = underlyingTokenPriceMap[symbol];
        const supplyBalance = supplyBalanceMap[symbol];
        const collateralFactor = collateralFactorMap[symbol];
        return price * collateralFactor * supplyBalance;
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Borrowed Limit:", borrowLimit);

  // Total Borrowed
  // 已借额度
  // Sum(underlyingTokenBorrowAmount * underlyingTokenUSDPrice)
  const totalBorrowed = (
    await Promise.all(
      allMarkets.map(async ({ symbol }: any) => {
        const price = underlyingTokenPriceMap[symbol];
        const borrowBalance = borrowBalanceMap[symbol];
        return price * borrowBalance;
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Borrowed:", totalBorrowed);

  // 剩余借款额度 USD
  const liquidity = await comptrollerContract.callStatic.getAccountLiquidity(
    wallet.getAddress()
  );
  const currentLiquidity = +liquidity[1] / 1e18;
  console.log("Liquidity:", currentLiquidity);

  // Borrow Limit Used
  // 额度使用率
  // Total Borrowed / Borrow Limit
  console.log(
    "Borrow Limit Used:",
    Math.min(borrowLimit === 0 ? 0 : (totalBorrowed / borrowLimit) * 100, 100)
  );

  // Health
  // 健康度
  // Borrow Limit / Total Borrowed
  console.log("Health:", calculateHealth(borrowLimit, totalBorrowed));

  // Total Supplied
  // 供给资产总额
  // Sum(suppliedTokenAmount * suppliedTokenUSDPrice)
  const totalSupplied = (
    await Promise.all(
      allMarkets.map(async ({ symbol }: any) => {
        const price = underlyingTokenPriceMap[symbol];
        const supplyBalance = supplyBalanceMap[symbol];
        return price * supplyBalance;
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Supplied:", totalSupplied);
};

const collateral = async function () {
  const cToken = allMarkets[0];
  const { address, symbol } = cToken;

  // Whether use as collateral
  const collaterals = await comptrollerContract.getAssetsIn(
    wallet.getAddress()
  );
  console.log(collaterals);
  if (!collaterals.includes(address)) {
    // Use as Collateral
    const enterMarkets = await comptrollerContract.enterMarkets([address]);
    await enterMarkets.wait(1);
    console.log(`Use b${symbol} as Collateral`);
  } else {
    console.log(`b${symbol} already used as Collateral`);
  }
};

const revokeCollateral = async function () {
  // Revoke xxx as Collateral
  const cToken = allMarkets[0];
  const { address, symbol } = cToken;
  const cTokenContractAddress = address;
  const assetName = symbol;

  // revoke Collateral
  const exitMarkets = await comptrollerContract.exitMarket(
    cTokenContractAddress
  );
  await exitMarkets.wait(1);
  console.log(`Revoke b${assetName} as Collateral`);
  console.log(await comptrollerContract.getAssetsIn(wallet.getAddress()));
};

const supply = async function () {
  let cToken = allMarkets[0];
  const { address, symbol, underlyingAddress, underlyingDecimals } = cToken;
  // isApproved
  const cTokenContractAddress = address;
  const assetName = symbol;
  const underlyingContractAddress = underlyingAddress;
  const underlyingContract = new Contract(
    underlyingContractAddress,
    erc20Abi,
    wallet
  );
  const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);
  const inputToSupply = "100";
  const underlyingToSupply = BigNumber.from(
    (+inputToSupply * Math.pow(10, underlyingDecimals)).toString()
  );

  console.log(`Now attempting to supply ${underlyingToSupply} ${symbol}...`);

  if (!cToken.native) {
    // Approve To Supply
    const allowance = await underlyingContract.callStatic.allowance(
      await wallet.getAddress(),
      cTokenContractAddress
    );

    if (underlyingToSupply.gt(allowance)) {
      const approve = await underlyingContract.approve(
        cTokenContractAddress,
        underlyingToSupply.toString()
      );
      await approve.wait(1);
      console.log("Approved");
    } else {
      console.log("Supply is enabled");
    }
  }

  // Supply
  // Mint cTokens by supplying underlying tokens to the Compound Protocol
  const tx = await cTokenContract.mint(underlyingToSupply.toString());
  await tx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
  console.log(`b${assetName} "Mint" operation successful.`, "\n");

  // Supply underlyingToken Balance
  const bal = await cTokenContract.callStatic.balanceOfUnderlying(
    myWalletAddress
  );
  const balanceOfUnderlying = +bal / Math.pow(10, underlyingDecimals);
  console.log(
    `${assetName} supplied to the Bonfire Protocol:`,
    balanceOfUnderlying,
    "\n"
  );

  // Wallet cToken Balance
  let cTokenBalance =
    +(await cTokenContract.callStatic.balanceOf(myWalletAddress)) / 1e8;
  console.log(`My wallet's b${assetName} Token Balance:`, cTokenBalance);

  // Wallet underlyingToken Balance
  const underlyingBalance = await underlyingContract.callStatic.balanceOf(
    myWalletAddress
  );
  const underlyingBalanceNumber =
    +underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(
    `My wallet's ${assetName} Token Balance:`,
    underlyingBalanceNumber,
    "\n"
  );
};

const withdraw = async () => {
  const { address, symbol, underlyingAddress, underlyingDecimals } =
    allMarkets[0];
  const underlyingContract = new Contract(underlyingAddress, erc20Abi, wallet);
  const cTokenContract = new Contract(address, cTokenAbi, wallet);

  const bal = await cTokenContract.callStatic.balanceOfUnderlying(
    myWalletAddress
  );
  const balanceOfUnderlying = +bal / Math.pow(10, underlyingDecimals);
  console.log(
    `${symbol} supplied to the Compound Protocol:`,
    balanceOfUnderlying,
    "\n"
  );

  // Withdraw
  const inputToWithdraw = "0.05";
  if (+inputToWithdraw > balanceOfUnderlying) {
    console.log("Insufficient Liquidity");
  }
  console.log(`Redeeming the b${symbol} for ${symbol}...`);
  let underlyingAmount = +inputToWithdraw * Math.pow(10, underlyingDecimals);
  const withdrawTx = await cTokenContract.redeemUnderlying(
    underlyingAmount.toString()
  );
  await withdrawTx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
  const underlyingBalance = await underlyingContract.callStatic.balanceOf(
    myWalletAddress
  );
  const underlyingBalanceNumber =
    +underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(
    `My wallet's ${symbol} Token Balance:`,
    underlyingBalanceNumber,
    "\n"
  );
};

const borrow = async () => {
  const { address, symbol, underlyingDecimals } = allMarkets[0];
  const cTokenContract = new Contract(address, cTokenAbi, wallet);

  const underlyingToBorrow = 0.1;
  console.log(`Now attempting to borrow ${underlyingToBorrow} ${symbol}...`);
  const scaledUpBorrowAmount = (
    underlyingToBorrow * Math.pow(10, underlyingDecimals)
  ).toString();
  const trx = await cTokenContract.borrow(scaledUpBorrowAmount);
  await trx.wait(1);
};

const repay = async () => {
  const { address, symbol, underlyingDecimals } = allMarkets[0];
  const cTokenContract = new Contract(address, cTokenAbi, wallet);

  const underlyingToBorrow = 0.1;
  console.log(`Now attempting to borrow ${underlyingToBorrow} ${symbol}...`);
  const scaledUpBorrowAmount = (
    underlyingToBorrow * Math.pow(10, underlyingDecimals)
  ).toString();
  const trx = await cTokenContract.borrow(scaledUpBorrowAmount);
  await trx.wait(1);
};

const main = async () => {
  try {
    // await distributionAPY();
    await summary();
    // await supply();
    // await collateral();
    // await revokeCollateral();
    // await withdraw();
  } catch (error) {
    console.log(error);
  }
};

export default main;

function calculateAPY(ratePerBlock: number) {
  const ethMantissa = 1e18;
  const blocksPerDay = 6570; // 13.15 seconds per block
  const daysPerYear = 365;

  return (
    (Math.pow((ratePerBlock / ethMantissa) * blocksPerDay + 1, daysPerYear) -
      1) *
    100
  );
}

function calculateHealth(liquidity: number, totalBorrowed: number) {
  return totalBorrowed === 0
    ? 100
    : Math.min(liquidity / totalBorrowed, 100);
}
