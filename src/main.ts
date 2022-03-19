import { Wallet, Contract, providers, BigNumber } from "ethers";
import cEthAbi from "./abis/cEth.json";
import cTokenAbi from "./abis/cToken.json";
import compAbi from "./abis/comptroller.json";
import compoundLensAbi from "./abis/compoundLens.json";
import erc20Abi from "./abis/erc20.json";
import priceFeedAbi from "./abis/priceFeed.json";
const provider = new providers.JsonRpcProvider(
  "https://mainnet.infura.io/v3/2b17a18942384c25ad91e8636764a89f"
);

// Just Test Account
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;
const priceFeedAddress = "0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae";
const priceFeed = new Contract(priceFeedAddress, priceFeedAbi, wallet);

const comptrollerContractAddress = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b";
const comptrollerContract = new Contract(
  comptrollerContractAddress,
  compAbi,
  provider
);

const allMarkets = [
  {
    symbol: "DAI",
    underlyingAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
    decimals: 18,
  },
  {
    symbol: "ETH",
    underlyingAddress: "",
    address: "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5",
    decimals: 18,
    native: true,
  },
  {
    symbol: "BAT",
    underlyingAddress: "0x0D8775F648430679A709E98d2b0Cb6250d2887EF",
    address: "0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E",
    decimals: 18,
  },
];

/**
 * compRate compUSDPrice compSpeedPerDay marketTotalUSDValue =
    Decimal.fastdiv (Decimal.mul compUSDPrice compSpeedPerDay) marketTotalUSDValue
        |> Maybe.map
            (\compOverMarket ->
                Decimal.sub (pow365 (Decimal.add Decimal.one compOverMarket)) Decimal.one
            )
 */
const distributionAPY = async function () {
  const { address, symbol, decimals } = allMarkets[0];
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
    (((cashAmount + borrowAmount) * underlyingTokenUSDPrice) / decimals);

  const compBorrowRatePerDay =
    (compSpeedPerDay * compUSDPrice) /
    ((borrowAmount * underlyingTokenUSDPrice) / decimals);

  const distributionSupplyAPY = calculateAPY(compSupplyRatePerDay);
  const distributionBorrowAPY = calculateAPY(compBorrowRatePerDay);

  console.log("Distribution Supply APY: ", distributionSupplyAPY);
  console.log("Distribution Borrow APY: ", distributionBorrowAPY);
};

const summary = async function () {
  // Supply APY
  const cDAIAddress = allMarkets[0].address;
  const cDAIContract = new Contract(cDAIAddress, cTokenAbi, wallet);
  const supplyRatePerBlock = await cDAIContract.callStatic.supplyRatePerBlock();
  const supplAPY = calculateAPY(supplyRatePerBlock);
  console.log("supply APY:", supplAPY);

  // Distribution APY

  // Collateral Factor
  let { 1: collateralFactor } = await comptrollerContract.callStatic.markets(
    cDAIAddress
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
      allMarkets.map(async ({ address, symbol, decimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
        underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
        const borrowBalance = await cToken.callStatic.borrowBalanceCurrent(
          myWalletAddress
        );
        return underlyingPriceInUsd * (+borrowBalance / Math.pow(10, decimals));
      })
    )
  ).reduce((sum, usd) => sum + usd, 0);

  // Total Supplied
  const totalSupplied = (
    await Promise.all(
      allMarkets.map(async ({ address, symbol, decimals }: any) => {
        const cToken = new Contract(address, cTokenAbi, wallet);
        let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
        underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
        const suppliedBalance = await cToken.callStatic.balanceOfUnderlying(
          myWalletAddress
        );
        return (
          underlyingPriceInUsd * (+suppliedBalance / Math.pow(10, decimals))
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
        .map(async ({ address, symbol, decimals }: any) => {
          const cToken = new Contract(address, cTokenAbi, wallet);
          let underlyingPriceInUsd = await priceFeed.callStatic.price(symbol);
          underlyingPriceInUsd = underlyingPriceInUsd / 1e6; // Price feed provides price in USD with 6 decimal places
          const balance = await cToken.callStatic.balanceOfUnderlying(
            myWalletAddress
          );
          return underlyingPriceInUsd * (+balance / Math.pow(10, decimals));
        })
    )
  ).reduce((sum, usd) => sum + usd, 0);

  console.log("Total Borrowed:", totalBorrowed);
  console.log("Total Supplied:", totalSupplied);
  console.log("Total Collateral:", totalCollateral);
  console.log("Borrowed Limit:", totalBorrowed + currentLiquidity);
  // Borrow Limit Used
  console.log(
    "Borrow Limit Used:",
    currentLiquidity === 0
      ? 0
      : (totalBorrowed / (totalBorrowed + currentLiquidity)) * 100
  );

  // Health
  console.log(
    "Health:",
    totalBorrowed === 0
      ? 100
      : (totalBorrowed + currentLiquidity) / totalBorrowed
  );
};

const collateral = async function () {
  // Use xxx as Collateral
  // to Collateral cDAI
  const cTokenContractAddress = allMarkets[0].address;
  const assetName = allMarkets[0].symbol;

  // Whether use as collateral
  const collaterals = await comptrollerContract.getAssetsIn(
    wallet.getAddress()
  );
  console.log(collaterals);
  if (!collaterals.includes(cTokenContractAddress)) {
    const enterMarkets = await comptrollerContract.enterMarkets([
      cTokenContractAddress,
    ]);
    await enterMarkets.wait(1);
    console.log(`Use c${assetName} as Collateral`);
  } else {
    console.log(`c${assetName} already used as Collateral`);
  }
};

const revokeCollateral = async function () {
  // Revoke xxx as Collateral
  const cTokenContractAddress = allMarkets[0].address;
  const assetName = allMarkets[0].symbol;

  const exitMarkets = await comptrollerContract.exitMarket(
    cTokenContractAddress
  );
  await exitMarkets.wait(1);
  console.log(`Revoke c${assetName} as Collateral`);
  console.log(await comptrollerContract.getAssetsIn(wallet.getAddress()));
};

const supply = async function () {
  // isApproved
  const cTokenContractAddress = allMarkets[0].address;
  const assetName = allMarkets[0].symbol;
  const underlyingContractAddress = allMarkets[0].underlyingAddress;
  const underlyingDecimals = allMarkets[0].decimals;
  const underlyingContract = new Contract(
    underlyingContractAddress,
    erc20Abi,
    wallet
  );
  const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);

  const allowance = await underlyingContract.callStatic.allowance(
    await wallet.getAddress(),
    cTokenContractAddress
  );

  // Approve To Supply
  const inputToSupply = "0.1";
  const underlyingToSupply = BigNumber.from(
    (+inputToSupply * Math.pow(10, underlyingDecimals)).toString()
  );
  console.log(underlyingToSupply.toString(), allowance.toString());
  if (underlyingToSupply.gt(allowance)) {
    const approve = await underlyingContract.approve(
      cTokenContractAddress,
      underlyingToSupply.toString()
    );
    await approve.wait(1);
    console.log("Approved");
  } else {
    console.log("is Enable");
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
  const cTokenContractAddress = allMarkets[0].address;
  const assetName = allMarkets[0].symbol;
  const underlyingContractAddress = allMarkets[0].underlyingAddress;
  const underlyingDecimals = allMarkets[0].decimals;
  const underlyingContract = new Contract(
    underlyingContractAddress,
    erc20Abi,
    wallet
  );
  const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);

  const bal = await cTokenContract.callStatic.balanceOfUnderlying(
    myWalletAddress
  );
  const balanceOfUnderlying = +bal / Math.pow(10, underlyingDecimals);
  console.log(
    `${assetName} supplied to the Compound Protocol:`,
    balanceOfUnderlying,
    "\n"
  );

  // Withdraw
  const inputToWithdraw = "0.05";
  if (+inputToWithdraw > balanceOfUnderlying) {
    console.log("Insufficient Liquidity");
  }
  console.log(`Redeeming the c${assetName} for ${assetName}...`);
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
    `My wallet's ${assetName} Token Balance:`,
    underlyingBalanceNumber,
    "\n"
  );
};

const borrow = async () => {
  const cTokenContractAddress = allMarkets[0].address;
  const assetName = allMarkets[0].symbol;
  const underlyingDecimals = allMarkets[0].decimals;
  const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);

  const underlyingToBorrow = 0.1;
  console.log(`Now attempting to borrow ${underlyingToBorrow} ${assetName}...`);
  const scaledUpBorrowAmount = (
    underlyingToBorrow * Math.pow(10, underlyingDecimals)
  ).toString();
  const trx = await cTokenContract.borrow(scaledUpBorrowAmount);
  await trx.wait(1);
  // console.log('Borrow Transaction', trx);
};

const main = async () => {
  await distributionAPY();
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
