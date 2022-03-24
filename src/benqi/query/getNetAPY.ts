import getBorrowBalance from "./getBorrowBalance";
import getDistributionAPY from "./getDistributionAPY";
import getSupplyBalance from "./getSupplyBalance";
import getTokenAPY from "./getTokenAPY";
import getTotalBorrow from "./getTotalBorrow";
import getUnderlyingPrices from "./getUnderlyingPrices";

import config from "../configs";
import getTotalSupply from "./getTotalSupply";

const { markets } = config;

export default async function getNetAPY() {
  const prices = await getUnderlyingPrices();
  const APY = await getTokenAPY();
  const distributionAPY = await getDistributionAPY();
  const supplyBalance = await getSupplyBalance();
  const totalSupply = await getTotalSupply();
  const borrowBalance = await getBorrowBalance();
  const totalBorrow = await getTotalBorrow();

  const totalInterest = markets.reduce((interest, token) => {
    const supplyInterest =
      supplyBalance[token] *
      prices[token] *
      (APY[token].supply + distributionAPY[token].supply);

    const borrowInterest =
      borrowBalance[token] *
      prices[token] *
      (APY[token].borrow - distributionAPY[token].borrow);
    return interest + supplyInterest - borrowInterest;
  }, 0);

  if (totalInterest > 0) {
    return totalInterest / totalSupply;
  } else if (totalInterest < 0) {
    return totalInterest / totalBorrow;
  } else {
    return 0;
  }
}
