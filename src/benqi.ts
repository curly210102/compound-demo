import { Wallet, Contract, providers, BigNumber } from "ethers";
import cTokenAbi from "./abis/qiErc20.json";
import compAbi from "./abis//qiComptroller.json";
import erc20Abi from "./abis/erc20.json";
import priceOracleAbi from "./abis/qiPriceOracle.json"
const provider = new providers.JsonRpcProvider(
  "https://matic-mumbai.chainstacklabs.com"
);
// Just Test Account
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";

const priceOracleAddress = "0x316aE55EC59e0bEb2121C0e41d4BDef8bF66b32B";
const comptrollerContractAddress = "0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4";
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
    symbol: "AVAX",
    underlyingAddress: "",
    address: "0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c",
    decimals: 8,
    underlyingDecimals: 18,
    native: true
  },
  {
    symbol: "BTC",
    underlyingAddress: "0x50b7545627a5162F82A992c33b87aDc75187B218",
    address: "0xe194c4c5aC32a3C9ffDb358d9Bfd523a0B6d1568",
    decimals: 8,
    underlyingDecimals: 8,
    native: false
  },
  {
    symbol: "ETH",
    underlyingAddress: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
    address: "0x334AD834Cd4481BB02d09615E7c11a00579A7909",
    decimals: 8,
    underlyingDecimals: 18,
    native: false
  },
  {
    symbol: "USDT",
    underlyingAddress: "0xc7198437980c041c805A1EDcbA50c1Ce5db95118",
    address: "0xc9e5999b8e75C3fEB117F6f73E664b9f3C8ca65C",
    decimals: 8,
    underlyingDecimals: 6,
    native: false
  },
  {
    symbol: "LINK",
    underlyingAddress: "0x5947BB275c521040051D82396192181b413227A3",
    address: "0x4e9f683A27a6BdAD3FC2764003759277e93696e6",
    decimals: 8,
    underlyingDecimals: 18,
    native: false
  },
  {
    symbol: "USDC",
    underlyingAddress: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664",
    address: "0xBEb5d47A3f720Ec0a390d04b4d41ED7d9688bC7F",
    decimals: 8,
    underlyingDecimals: 6,
    native: false
  },
  {
    symbol: "DAI",
    underlyingAddress: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
    address: "0x835866d37AFB8CB8F8334dCCdaf66cf01832Ff5D",
    decimals: 8,
    underlyingDecimals: 18,
    native: false
  },
  {
    symbol: "Qi",
    underlyingAddress: "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5",
    address: "0x35Bd6aedA81a7E5FC7A7832490e71F757b0cD9Ce",
    decimals: 8,
    underlyingDecimals: 18,
    native: false
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
  const underlyingTokenUSDPrice = (await priceOracle.callStatic.getUnderlyingPrice(address)) / 1e6;
  compSpeed / 1e18;
  compSpeed = compSpeed / 1e18;
  // COMP issued to suppliers OR borrowers
  const compSpeedPerDay = compSpeed * 4 * 60 * 24;
  const compUSDPrice = (await priceOracle.price("COMP")) / 1e6;

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
  const { address } = allMarkets[1];

  // Supply APY
  const cTokenContract = new Contract(address, cTokenAbi, wallet);
  const supplyRatePerTimestamp =
    await cTokenContract.callStatic.supplyRatePerTimestamp();
  const supplyAPY = calculateAPY(supplyRatePerTimestamp);
  console.log("supply APY:", supplyAPY);

  // Borrow APY
  const borrowRatePerTimestamp =
    await cTokenContract.callStatic.borrowRatePerTimestamp();
  const borrowAPY = calculateAPY(borrowRatePerTimestamp);
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
        let underlyingPriceInUsd = await priceOracle.callStatic.getUnderlyingPrice(address);
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
        let underlyingPriceInUsd = await priceOracle.callStatic.getUnderlyingPrice(address);
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
          let underlyingPriceInUsd = await priceOracle.callStatic.getUnderlyingPrice(address);
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
  // console.log('Borrow Transaction', trx);
};

const main = async () => {
  // await distributionAPY();
  await summary();
//   await supply();
//   await collateral();
//   await revokeCollateral();
//   await withdraw();
};

main().catch((err) => {
  console.error(err);
});

function calculateAPY(ratePerTimestamps: number) {
  const ethMantissa = 1e18;
  const secondsPerDay = 86400; // seconds per day
  const daysPerYear = 365;

  return (
    (Math.pow((ratePerTimestamps / ethMantissa) * secondsPerDay + 1, daysPerYear) -
      1) *
    100
  );
}
