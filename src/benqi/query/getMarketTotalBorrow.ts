import configs from "../configs";
import getContract from "../utils/getContract";

export default async function getMarketTotalBorrow() {
  const totalBorrowBalance = await Promise.all(
    configs.markets.map(async (symbol) => {
      const { address, underlyingDecimals } = configs.assets[symbol];
      const cToken = getContract(address, configs.abi.token);
      const totalBorrow = await cToken.totalBorrows();
      return [symbol, totalBorrow / Math.pow(10, underlyingDecimals)];
    })
  );
  const totalBorrowMap = Object.fromEntries(totalBorrowBalance);
  return totalBorrowMap;
}
