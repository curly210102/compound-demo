import { BigNumber } from "ethers";
import getBorrowLimit from "./getBorrowLimit";
import getCollateralFactor from "./getCollateralFactor";
import getCollateralStatus from "./getCollateralStatus";
import getTotalBorrow from "./getTotalBorrow";
import getUnderlyingPrices from "./getUnderlyingPrices";

export default async function getHealth() {
  const borrowLimit = await getBorrowLimit();
  const totalBorrow = await getTotalBorrow();

  return Math.max(Math.min(100, borrowLimit / totalBorrow), 0);
}

export async function healthAfterWithdraw(token: string, amount: BigNumber) {
  const collateralStatus = await getCollateralStatus();
  if (!collateralStatus[token]) {
    return getHealth();
  }

  const borrowLimit = await getBorrowLimit();
  const totalBorrow = await getTotalBorrow();
  const collateralFactor = await getCollateralFactor();
  const prices = await getUnderlyingPrices();

  const health =
    (borrowLimit - +amount * prices[token] * collateralFactor[token]) /
    totalBorrow;

  return Math.max(0, Math.min(100, health));
}

export async function healthAfterBorrow(token: string, amount: BigNumber) {
  const borrowLimit = await getBorrowLimit();
  const totalBorrow = await getTotalBorrow();
  const prices = await getUnderlyingPrices();

  const health = borrowLimit / (+amount * prices[token] + totalBorrow);

  if (isNaN(health)) {
    return 0;
  } else {
    return Math.max(0, Math.min(health, 100));
  }
}
