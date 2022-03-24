import configs from "../configs";
import { getComptroller } from "../utils/getContract";

export default async function getMarketBorrowCaps() {
  const comptroller = await getComptroller();
  const borrowCapPromises = configs.markets.map(async (symbol) => {
    const { address, underlyingDecimals } = configs.assets[symbol];
    const borrowCap =
      (await comptroller.borrowCaps(address)) /
      Math.pow(10, underlyingDecimals);
    return [symbol, borrowCap === 0 ? Infinity : borrowCap];
  });

  return Object.fromEntries(await Promise.all(borrowCapPromises));
}
