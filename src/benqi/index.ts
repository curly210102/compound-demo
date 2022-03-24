import { BigNumber } from "ethers";
import configs from "./configs";
import getBorrowBalance from "./query/getBorrowBalance";
import getBorrowLimit from "./query/getBorrowLimit";
import getBorrowLimitUsed from "./query/getBorrowLimitUsed";
import getCollateralAmount from "./query/getCollateralAmount";
import getCollateralFactor from "./query/getCollateralFactor";
import getCollateralStatus from "./query/getCollateralStatus";
import getDistributionAPY from "./query/getDistributionAPY";
import getHealth, {
  healthAfterBorrow,
  healthAfterWithdraw,
} from "./query/getHealth";
import getLiquidity from "./query/getLiquidity";
import getMarketBorrowCaps from "./query/getMarketBorrowCaps";
import getNetAPY from "./query/getNetAPY";
import getRemainingBorrowLimit from "./query/getRemainingBorrowLimit";
import getSupplyBalance from "./query/getSupplyBalance";
import getTokenAPY from "./query/getTokenAPY";
import getTotalBorrow from "./query/getTotalBorrow";
import getUnderlyingPrices from "./query/getUnderlyingPrices";
import getContract, {
  getComptroller,
  getTokenContract,
  myWalletAddress,
} from "./utils/getContract";

const globalStatus = async () => {
  console.log("Global Status");

  // My Net APY
  const netAPY = await getNetAPY();
  console.log("My Net APY:", netAPY);

  // Health
  const health = await getHealth();
  console.log("Health:", health);

  // Borrow Limit Used
  const borrowLimitUsed = await getBorrowLimitUsed();
  console.log("Borrow Limit Used:", borrowLimitUsed);
};

const supply = async () => {
  console.log("Supply");

  const token = configs.testToken;
  const { underlyingDecimals, native, underlyingAddress, address } =
    configs.assets[token];
  const cTokenContract = getTokenContract(address);
  const underlyingContract = getTokenContract(underlyingAddress);

  // Supply APY
  const tokenAPY = await getTokenAPY();
  console.log("Supply APY:", tokenAPY[token].supply);
  // Supply Distribution APY
  const distributionAPY = await getDistributionAPY();
  console.log("Distribution APY:", distributionAPY[token].supply);
  // Collateral Factor
  const collateralFactor = await getCollateralFactor();
  console.log("Collateral Factor:", collateralFactor[token]);
  // Available Balance
  // Wallet underlyingToken Balance
  const underlyingBalance = await underlyingContract.callStatic.balanceOf(
    myWalletAddress
  );
  const underlyingBalanceNumber =
    +underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(
    `My wallet's ${token} Token Balance:`,
    underlyingBalanceNumber,
    "\n"
  );

  // Supply
  const inputToSupply = "100";
  const underlyingToSupply = BigNumber.from(
    (+inputToSupply * Math.pow(10, underlyingDecimals)).toString()
  );
  if (!native) {
    // Approve To Supply
    const allowance = await underlyingContract.callStatic.allowance(
      myWalletAddress,
      address
    );

    if (underlyingToSupply.gt(allowance)) {
      const approve = await underlyingContract.approve(
        address,
        underlyingToSupply.toString()
      );
      await approve.wait(1);
      console.log("Approved");
    } else {
      console.log("Supply is enabled");
    }
  }

  const tx = await cTokenContract.mint(underlyingToSupply.toString());
  await tx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
  console.log(`"Mint" operation successful.`, "\n");
};

const collateral = async () => {
  console.log("Use as Collateral");

  const token = configs.testToken;
  const { address } = configs.assets[token];
  // Use xxx as Collateral
  const collateralStatus = await getCollateralStatus();
  if (!collateralStatus[token]) {
    // Use as Collateral
    const enterMarkets = await getComptroller().enterMarkets([address]);
    // Waiting for block confirmation
    await enterMarkets.wait(1);
    console.log(`Use ${token} as Collateral`);
  } else {
    console.log(`${token} already used as Collateral`);
  }
};

const revokeCollateral = async function () {
  console.log("Revoke as Collateral");

  // Revoke xxx as Collateral
  const token = configs.testToken;
  const { address } = configs.assets[token];

  // revoke Collateral
  const collateralStatus = await getCollateralStatus();
  if (collateralStatus[token]) {
    const exitMarkets = await getComptroller().exitMarket(address);
    await exitMarkets.wait(1);
    console.log(`Revoke ${token} as Collateral`);
  } else {
    console.log(`${token} already revoked as Collateral`);
  }
};

const withdraw = async function () {
  console.log("Withdraw");

  // My Supply
  const collateralStatus = await getCollateralStatus();
  const tokenAPY = await getTokenAPY();
  const distributionAPY = await getDistributionAPY();
  const supplyBalance = await getSupplyBalance();
  const prices = await getUnderlyingPrices();
  const mySupplyData = configs.markets
    .map((symbol) => {
      return {
        Asset: symbol,
        Collateral: collateralStatus[symbol],
        SupplyAPY: tokenAPY[symbol].supply,
        DistributionAPY: distributionAPY[symbol].supply,
        Supplied: supplyBalance[symbol],
        SuppliedValue: supplyBalance[symbol] * prices[symbol],
      };
    })
    .filter(({ Supplied }) => Supplied > 0);
  console.table(mySupplyData);

  const token = configs.testToken;
  const { address, underlyingDecimals } = configs.assets[token];
  const inputToWithdraw = "10";
  const underlyingToWithdraw = BigNumber.from(
    (+inputToWithdraw * Math.pow(10, underlyingDecimals)).toString()
  );

  // Available
  const cTokenContract = getTokenContract(address);
  const balanceOfUnderlying =
    await cTokenContract.callStatic.balanceOfUnderlying(myWalletAddress);
  console.log(
    "Available:",
    balanceOfUnderlying / Math.pow(10, underlyingDecimals) + token
  );

  // Health After Withdrawal
  const health = await healthAfterWithdraw(token, underlyingToWithdraw);
  console.log("Health After Withdrawal:", health);

  // Withdraw
  if (health < 1) {
    console.log("Insufficient Liquidity");
    return;
  }

  const withdrawTx = await cTokenContract.redeemUnderlying(
    underlyingToWithdraw.toString()
  );
  await withdrawTx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
};

const borrow = async () => {
  console.log("Borrow");

  const token = configs.testToken;
  const { address } = configs.assets[token];
  const inputToBorrow = "5";
  const underlyingToBorrow = BigNumber.from((+inputToBorrow).toString());
  // No Collateralized Assets
  const collateralAmount = await getCollateralAmount();
  const hasCollateralAssets = Object.values(collateralAmount).some(
    (value) => value > 0
  );
  console.log("No Collateralized Assets: ", !hasCollateralAssets);

  // Borrow APY
  const tokenAPY = await getTokenAPY();
  console.log("Borrow APY:", tokenAPY[token].borrow);
  // Borrow Distribution APY
  const distributionAPY = await getDistributionAPY();
  console.log("Borrow Distribution APY:", distributionAPY[token].borrow);
  // USD Limit
  const remainingBorrowLimit = await getRemainingBorrowLimit();
  console.log("USD Limit:", remainingBorrowLimit);
  // USDC Limit
  const prices = await getUnderlyingPrices();
  const remainingBorrowAmount = remainingBorrowLimit / prices[token];
  console.log(token + " Limit:", remainingBorrowAmount + token);

  // Pool Liquidity
  const poolLiquidity = await getLiquidity();
  console.log("Pool Liquidity:", poolLiquidity[token]);

  // Market Borrow Cap
  const borrowCap = await getMarketBorrowCaps();
  console.log("Market Borrow Cap:", borrowCap[token]);

  // Health After Borrow
  const health = await healthAfterBorrow(token, underlyingToBorrow);
  console.log("Health After Borrow:", health);

  // Borrow
  const tokenContract = getTokenContract(address);
  const trx = await tokenContract.borrow(underlyingToBorrow);
  await trx.wait(1);
};

const repay = async () => {
  // Remaining Limit
  const remainingLimit = await getRemainingBorrowLimit();
  console.log("Remaining Limit:", remainingLimit);
  // Used Limit
  const usedLimit = await getBorrowLimitUsed();
  console.log("Used Limit:", usedLimit);
  // Health
  const health = await getHealth();
  console.log("health", health);
  // My Borrow
  const tokenAPY = await getTokenAPY();
  const distributionAPY = await getDistributionAPY();
  const borrowBalance = await getBorrowBalance();
  const prices = await getUnderlyingPrices();
  const mySupplyData = configs.markets
    .map((symbol) => {
      return {
        Asset: symbol,
        BorrowAPY: tokenAPY[symbol].borrow,
        DistributionAPY: distributionAPY[symbol].borrow,
        Borrowed: borrowBalance[symbol],
        BorrowedValue: borrowBalance[symbol] * prices[symbol],
      };
    })
    .filter(({ Borrowed }) => Borrowed > 0);
  console.table(mySupplyData);

  const token = configs.testToken;
  const { address, native, underlyingDecimals, underlyingAddress } =
    configs.assets[token];
  const inputToRepay = "10";
  const underlyingToRepay = BigNumber.from(
    (+inputToRepay * Math.pow(10, underlyingDecimals)).toString()
  );
  const underlyingContract = getTokenContract(underlyingAddress);

  // Approve
  if (!native) {
    // Approve To Supply
    const allowance = await underlyingContract.callStatic.allowance(
      myWalletAddress,
      address
    );

    if (allowance.isZero() || underlyingToRepay.gt(allowance)) {
      const approve = await underlyingContract.approve(
        address,
        BigNumber.from((Math.pow(2, 256) - 1).toFixed())
      );
      await approve.wait(1);
      console.log("Approved");
    } else {
      console.log("Repay is enabled");
    }
  }

  // Max Repay xxx USDC
  // A crude approximation of how much interest accrues to the borrow position within a minute.
  // The app updates the borrow balance every 15 seconds, so this value should be more than
  // what is accrued between consecutive balance updates.
  const borrowAPY = tokenAPY.borrow[token];
  const accruedInterestByMinute =
    (borrowAPY / (100 * 60 * 24 * 365)) * borrowBalance[token];
  const repayAllAmount = borrowBalance[token] + accruedInterestByMinute;
  console.log("Max Repay ", repayAllAmount);

  // Repay
  const repayAll = false;
  const amount = "1";
  // if (token === "AVAX" && repayAll) {
  //   // const maximillionContract = getContract(
  //   //   contractAddresses.Maximillion,
  //   //   ABI.Maximillion,
  //   //   library,
  //   //   account,
  //   // )
  //   // const avaxAmount = EthersBigNumber.from(
  //   //   amount.shiftedBy(DECIMALS.AVAX).toFixed(),
  //   // )
  //   // repayPromise = maximillionContract.repayBehalf(account, {
  //   //   value: avaxAmount,
  //   // })
  // } else {
  //   const tokenContract = getTokenContract(address);
  //   const repayAmount = repayAll
  //     ? BigNumber.from((Math.pow(2, 256) - 1).toFixed())
  //     : BigNumber.from((+amount * Math.pow(10, underlyingDecimals)).toFixed());
  //   await tokenContract.repayBorrow(
  //     token === "AVAX" ? { value: repayAmount } : repayAmount
  //   );
  // }
};

const main = async () => {
  await globalStatus();
  // await supply();
  // await collateral();
  // await revokeCollateral();
  // await withdraw();
  // await borrow();
  // await repay();
};

export default main;
