import { Wallet, Contract, providers, BigNumber } from "ethers";
import cTokenAbi from "./abis/cToken.json";
import compAbi from "./abis/comptroller.json";
import erc20Abi from "./abis/erc20.json";
import priceFeedAbi from "./abis/priceFeed.json";
const provider = new providers.JsonRpcProvider(
  "https://kovan.infura.io/v3/2b17a18942384c25ad91e8636764a89f"
);
// Just Test Account
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";

const priceFeedAddress = "0xbBdE93962Ca9fe39537eeA7380550ca6845F8db7";
const comptrollerContractAddress = "0x5eae89dc1c671724a672ff0630122ee834098657";
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
    symbol: "DAI",
    underlyingAddress: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
    address: "0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD",
    decimals: 8,
    underlyingDecimals: 18,
  },
  {
    symbol: "ETH",
    underlyingAddress: "",
    address: "0x41B5844f4680a8C38fBb695b7F9CFd1F64474a72",
    decimals: 8,
    underlyingDecimals: 18,
    native: true,
  },
  {
    symbol: "BAT",
    underlyingAddress: "0x482dC9bB08111CB875109B075A40881E48aE02Cd",
    address: "0x4a77fAeE9650b09849Ff459eA1476eaB01606C7a",
    decimals: 8,
    underlyingDecimals: 18,
  },
];

/**
 * compRatePerDay compUSDPrice compSpeedPerDay marketTotalUSDValue =
    Decimal.fastdiv (Decimal.mul compUSDPrice compSpeedPerDay) marketTotalUSDValue
 */
const distributionAPY = async function () {
  const { address, symbol, underlyingDecimals } = allMarkets[0];
  const cTokenContract = new Contract(address, cTokenAbi, wallet);
  const cashAmount = await cTokenContract.callStatic.getCash();
  const borrowAmount = await cTokenContract.callStatic.totalBorrowsCurrent();
  let compSpeed = await comptrollerContract.callStatic.compSpeeds(address);
  const underlyingTokenUSDPrice = (await priceFeed.price(symbol)) / 1e6;
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
  const currentLiquidity = +liquidity[1] / 1e18;
  console.log("Liquidity:", currentLiquidity);

  // Total Borrowed
  const totalBorrowed = (
    await Promise.all(
      allMarkets.map(async ({ address, symbol, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
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
      allMarkets.map(async ({ address, symbol, underlyingDecimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
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
        .map(async ({ address, symbol, underlyingDecimals }: any) => {
          const cToken = new Contract(address, cTokenAbi, wallet);
          let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
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
  // Borrow Limit Used: totalBorrowed / borrowLimit
  console.log(
    "Borrow Limit Used:",
    currentLiquidity === 0 ? 0 : (totalBorrowed / borrowLimit) * 100
  );

  // Health: borrowLimit / totalBorrowed
  console.log(
    "Health:",
    calculateHealth(currentLiquidity, totalBorrowed)
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
    console.log(`Use c${symbol} as Collateral`);
  } else {
    console.log(`c${symbol} already used as Collateral`);
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
  console.log(`Revoke c${assetName} as Collateral`);
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
  const inputToSupply = "0.1";
  const underlyingToSupply = BigNumber.from(
    (+inputToSupply * Math.pow(10, underlyingDecimals)).toString()
  );

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
  console.log(`c${assetName} "Mint" operation successful.`, "\n");

  // Supply underlyingToken Balance
  const bal = await cTokenContract.callStatic.balanceOfUnderlying(
    myWalletAddress
  );
  const balanceOfUnderlying = +bal / Math.pow(10, underlyingDecimals);
  console.log(
    `${assetName} supplied to the Compound Protocol:`,
    balanceOfUnderlying,
    "\n"
  );

  // Wallet cToken Balance
  let cTokenBalance =
    +(await cTokenContract.callStatic.balanceOf(myWalletAddress)) / 1e8;
  console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance);

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
  console.log(`Redeeming the c${symbol} for ${symbol}...`);
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

  // Health after withdraw
  // calculateHealth(currentLiquidity - underlyingAmount * collateralFactor * underlyingPrice, totalBorrowed)
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

  // Health after borrow
  // calculateHealth(currentLiquidity, totalBorrowed + scaledUpBorrowAmount * underlyingPrice)
};

const main = async () => {
  await summary();
  // await supply();
  // await collateral();
  // await revokeCollateral();
  // await withdraw();
};

main().catch((err) => {
  console.error(err);
});

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

function calculateHealth (liquidity: number, totalBorrowed: number) {
  return totalBorrowed === 0 ? 100 : Math.min(1 + liquidity / totalBorrowed, 99.99)
}
