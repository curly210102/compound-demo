import configs from "../configs";
import getBorrowBalance from "./getBorrowBalance";
import getUnderlyingPrices from "./getUnderlyingPrices";

export default async function getTotalBorrow() {
  const supplyBalance = await getBorrowBalance();
  const prices = await getUnderlyingPrices();

  return configs.markets.reduce((total, symbol) => {
    const tokenBorrowBalance = supplyBalance[symbol];
    const tokenPrice = prices[symbol];
    const borrowValue = tokenBorrowBalance * tokenPrice;

    return total + borrowValue;
  }, 0);
}
