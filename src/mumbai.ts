import { Wallet, Contract, providers, BigNumber } from "ethers";
import cTokenAbi from "./abis/BfErc20.json";
import compAbi from "./abis//BfComptroller.json";
import erc20Abi from "./abis/erc20.json";
import priceFeedAbi from "./abis/BfPriceOracle.json";
const provider = new providers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com"
);
// Just Test Account
const privateKey =
  "abdbe6420ebba257b82c2fa7272a8f02c05033d285576b5e8edd34316fae07af";

const priceFeedAddress = "0x7729279611991Bb4dBdeBF0cc7518428fddCa050";
const comptrollerContractAddress = "0xADdC4b0d9A113D6295D95c9717D1b32b6b689FAE";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;
const priceFeed = new Contract(priceFeedAddress, priceFeedAbi, wallet);

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
 * compRatePerDay compUSDPrice compSpeedPerDay marketTotalUSDValue =
    Decimal.fastdiv (Decimal.mul compUSDPrice compSpeedPerDay) marketTotalUSDValue
 */
const distributionAPY = async function () {
  const { address, underlyingDecimals } = allMarkets[0];
  const cTokenContract = new Contract(address, cTokenAbi, wallet);
  const cashAmount = await cTokenContract.callStatic.getCash();
  const borrowAmount = await cTokenContract.callStatic.totalBorrowsCurrent();
  let compSpeed = await comptrollerContract.callStatic.compSpeeds(address);
  const underlyingTokenUSDPrice =
    (await priceFeed.callStatic.getUnderlyingPrice(address)) / 1e6;
  compSpeed / 1e18;
  compSpeed = compSpeed / 1e18;
  // COMP issued to suppliers OR borrowers
  const compSpeedPerDay = compSpeed * 4 * 60 * 24;
  const compUSDPrice = (await priceFeed.price("COMP")) / 1e6;

  const compSupplyRatePerDay =
    (compSpeedPerDay * compUSDPrice) /
    (((cashAmount + borrowAmount) * underlyingTokenUSDPrice) /
      underlyingDecimals);

  const compBorrowRatePerDay =
    (compSpeedPerDay * compUSDPrice) /
    ((borrowAmount * underlyingTokenUSDPrice) / underlyingDecimals);

  const distributionSupplyAPY = calculateAPY(compSupplyRatePerDay);
  const distributionBorrowAPY = calculateAPY(compBorrowRatePerDay);

  console.log("Distribution Supply APY: ", distributionSupplyAPY);
  console.log("Distribution Borrow APY: ", distributionBorrowAPY);
};

const summary = async function () {
  const { address } = allMarkets[0];

  // Supply APY
  const cTokenContract = new Contract(address, cTokenAbi, wallet);
  const supplyRatePerBlock =
    await cTokenContract.callStatic.supplyRatePerBlock();
  const supplyAPY = calculateAPY(supplyRatePerBlock);
  console.log("supply APY:", supplyAPY);

  // Borrow APY
  const borrowRatePerBlock =
    await cTokenContract.callStatic.supplyRatePerBlock();
  const borrowAPY = calculateAPY(borrowRatePerBlock);
  console.log("borrow APY:", borrowAPY);

  // Collateral Factor
  let { 1: collateralFactor } = await comptrollerContract.callStatic.markets(
    address
  );
  collateralFactor = (collateralFactor / 1e18) * 100; // Convert to percent
  console.log("Collateral Factor:", collateralFactor);

  // 供给余额乘以市场的抵押物因子，然后求和;然后减去借款余额，得到相等的账户流动性

  // Current Liquidity
  const liquidity = await comptrollerContract.callStatic.getAccountLiquidity(
    wallet.getAddress()
  );
  const currentLiquidity = +liquidity[1] / Math.pow(10, 18);
  console.log("Liquidity:", currentLiquidity);

  // Total Borrowed
  const totalBorrowed = (
    await Promise.all(
      allMarkets.map(async ({ address, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd =
          await priceFeed.callStatic.getUnderlyingPrice(address);
        underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
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

  // Total Supplied
  const totalSupplied = (
    await Promise.all(
      allMarkets.map(async ({ address, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd =
          await priceFeed.callStatic.getUnderlyingPrice(address);
        underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
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

  // Collateralized Assets
  const collateralAddresses = await comptrollerContract.getAssetsIn(
    myWalletAddress
  );
  // Total Collateral
  const totalCollateral = (
    await Promise.all(
      allMarkets
        .filter((m) => collateralAddresses.includes(m.address))
        .map(async ({ address, underlyingDecimals }: any) => {
          const cToken = new Contract(address, cTokenAbi, wallet);
          let underlyingPriceInUsd =
            await priceFeed.callStatic.getUnderlyingPrice(address);
          underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
          const balance = await cToken.callStatic.balanceOfUnderlying(
            myWalletAddress
          );
          return (
            underlyingPriceInUsd * (+balance / Math.pow(10, underlyingDecimals))
          );
        })
    )
  ).reduce((sum, usd) => sum + usd, 0);

  const borrowLimit = totalBorrowed + currentLiquidity;
  console.log("Total Borrowed:", totalBorrowed);
  console.log("Total Supplied:", totalSupplied);
  console.log("Total Collateral:", totalCollateral);
  console.log("Borrowed Limit:", borrowLimit);
  // Borrow Limit Used
  console.log(
    "Borrow Limit Used:",
    currentLiquidity === 0 ? 0 : (totalBorrowed / borrowLimit) * 100
  );

  // Health
  console.log(
    "Health:",
    totalBorrowed === 0 ? 100 : borrowLimit / totalBorrowed
  );
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
    await supply();
    //   await collateral();
    //   await revokeCollateral();
    //   await withdraw();
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
