import configs from "../configs";
import getMarketTotalBorrow from "./getMarketTotalBorrow";
import getMarketTotalSupply from "./getMarketTotalSupply";

export default async function getLiquidity() {
  const totalBorrow = await getMarketTotalBorrow();
  const totalSupply = await getMarketTotalSupply();

  return Object.fromEntries(
    configs.markets.map((symbol) => {
      return [symbol, totalSupply[symbol] - totalBorrow[symbol]];
    })
  );
}
