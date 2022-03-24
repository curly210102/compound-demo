import config from "../configs";
import { getComptroller } from "../utils/getContract";

// Collateral Factor
// 质押因子，每种货币有独立的质押因子，借款限额 = 质押价值 * 质押因子，
// e.g. 如果用户提供 100 DAI作为抵押，而DAI的质押因子为75%，那么用户最多可以借入价值 75 DAI的资产。
export default async function () {
  const comptroller = getComptroller();
  const collateralFactors = await Promise.all(
    config.markets.map(async (symbol) => {
      const { address } = config.assets[symbol];
      const { 1: collateralFactor } = await comptroller.callStatic.markets(
        address
      );
      return [symbol, collateralFactor / 1e18];
    })
  );
  const collateralFactorMap = Object.fromEntries(collateralFactors);
  //   const collateralFactor = collateralFactorMap["BTC"] * 100; // Convert to percent
  //   console.log("BTC Collateral Factor:", collateralFactor);
  return collateralFactorMap;
}
