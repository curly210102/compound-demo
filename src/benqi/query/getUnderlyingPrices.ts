import config from "../configs";
import getContract, { getComptroller } from "../utils/getContract";

export default async function getUnderlyingPrices() {
  const comptroller = getComptroller();
  const oracleAddress = await comptroller.oracle();
  console.log(oracleAddress);
  const priceOracle = getContract(oracleAddress, config.abi.priceOracle);
  // underlyingTokenPrice
  const underlyingTokenPrices = await Promise.all(
    config.markets.map(async (symbol) => {
      const { address, underlyingDecimals } = config.assets[symbol];
      const underlyingPriceInUSD =
        (await priceOracle.callStatic.getUnderlyingPrice(address)) /
        Math.pow(10, 36 - underlyingDecimals);
      return [symbol, underlyingPriceInUSD];
    })
  );
  const underlyingTokenPriceMap = Object.fromEntries(underlyingTokenPrices);
  return underlyingTokenPriceMap;
}
