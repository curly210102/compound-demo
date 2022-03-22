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

const priceOracleAddress = "0x7729279611991Bb4dBdeBF0cc7518428fddCa050";
const comptrollerContractAddress = "0xADdC4b0d9A113D6295D95c9717D1b32b6b689FAE";
const rewardTokenAddress = "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;
const priceOracle = new Contract(priceOracleAddress, priceOracleAbi, wallet);

const comptrollerContract = new Contract(
  comptrollerContractAddress,
  compAbi,
  wallet
);

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

  // rewardType  0: Qi, 1: Avax
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
  const { address } = allMarkets[0];

  // Collateral Factor
  // 质押因子，每种货币有独立的质押因子，借款限额 = 质押价值 * 质押因子，
  // e.g. 如果用户提供 100 DAI作为抵押，而DAI的质押因子为75%，那么用户最多可以借入价值 75 DAI的资产。
  let { 1: collateralFactor } = await comptrollerContract.callStatic.markets(
    address
  );
  collateralFactor = (collateralFactor / 1e18) * 100; // Convert to percent
  console.log("Collateral Factor:", collateralFactor);

  // Total Borrowed
  // 已借额度：各币种已借之和（包含利息）
  // Sum(underlyingTokenBorrowAmount * underlyingTokenUSDPrice)
  const totalBorrowed = (
    await Promise.all(
      allMarkets.map(async ({ address, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd =
          await priceOracle.callStatic.getUnderlyingPrice(address);
        underlyingPriceInUsd = underlyingPriceInUsd / 1e18; // getUnderlyingPrice provides price in USD with 18 decimal places
        const borrowBalance = await cToken.callStatic.borrowBalanceCurrent(
          myWalletAddress
        );
        return (
          underlyingPriceInUsd *
          (+borrowBalance / Math.pow(10, underlyingDecimals))
        );
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Borrowed:", totalBorrowed);

  // 账户流动性（liquidity）
  // 剩余额度
  const liquidity = await comptrollerContract.callStatic.getAccountLiquidity(
    wallet.getAddress()
  );
  const currentLiquidity = +liquidity[1] / Math.pow(10, 18);
  console.log("Liquidity:", currentLiquidity);

  // Borrow Limit
  // 总借款限额：各币种借款限额总和 = 已借 + 剩余
  // Borrow Limit = Total Borrowed + liquidity
  // Sum(collateralTokenAmount * collateralTokenUSDPrice * collateralFactor)
  const borrowLimit = totalBorrowed + currentLiquidity;
  console.log("Borrowed Limit:", borrowLimit);

  // Borrow Limit Used
  // 额度使用率
  // Total Borrowed / Borrow Limit
  console.log(
    "Borrow Limit Used:",
    borrowLimit === 0 ? 0 : (totalBorrowed / borrowLimit) * 100
  );

  // Health
  // 健康度
  // Borrow Limit / Total Borrowed
  console.log(
    "Health:",
    totalBorrowed === 0 ? 100 : borrowLimit / totalBorrowed
  );

  // Total Supplied
  // 供给资产总额
  // Sum(suppliedTokenAmount * suppliedTokenUSDPrice)
  const totalSupplied = (
    await Promise.all(
      allMarkets.map(async ({ address, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd =
          await priceOracle.callStatic.getUnderlyingPrice(address);
        underlyingPriceInUsd = underlyingPriceInUsd / 18; // getUnderlyingPrice provides price in USD with 18 decimal places
        const suppliedBalance = await cToken.callStatic.balanceOfUnderlying(
          myWalletAddress
        );
        return (
          underlyingPriceInUsd *
          (+suppliedBalance / Math.pow(10, underlyingDecimals))
        );
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Supplied:", totalSupplied);

  // Collateralized Assets
  // underlyingTokenBalance > 0
  const isCollateralize = async ({ address }: any) => {
    const cToken = new Contract(address, cTokenAbi, wallet);
    const underlyingBalance = await cToken.callStatic.balanceOfUnderlying(
      myWalletAddress
    );
    return underlyingBalance
  };
  const underlyingTokenBalances = (await Promise.all(allMarkets.map(isCollateralize)));
  const collateralAssets = underlyingTokenBalances.filter((balance) => balance.gt(0));
  console.log(
    "Collateralized Assets: ",
    collateralAssets.map(({ symbol }) => symbol)
  );

  // Total Collateral
  // 质押资产总额
  const totalCollateral = (
    await Promise.all(
      collateralAssets.map(async ({ address, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUSD =
          (await priceOracle.callStatic.getUnderlyingPrice(address)) / 1e18; // getUnderlyingPrice provides price in USD with 6 decimal places
        const underlyingBalance = await cToken.callStatic.balanceOfUnderlying(
          myWalletAddress
        );
        return (
          underlyingPriceInUSD *
          (+underlyingBalance / Math.pow(10, underlyingDecimals))
        );
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);
  console.log("Total Collateral:", totalCollateral);
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
    // await summary();
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
