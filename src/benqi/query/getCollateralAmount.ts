import configs from "../configs";
import getCollateralFactor from "./getCollateralFactor";
import getCollateralStatus from "./getCollateralStatus";
import getSupplyBalance from "./getSupplyBalance";
import getUnderlyingPrices from "./getUnderlyingPrices";

export default async function getCollateralAmount() {
  const supplyBalance = await getSupplyBalance();
  const collateralFactor = await getCollateralFactor();
  const collateralStatus = await getCollateralStatus();
  const prices = await getUnderlyingPrices();

  return Object.fromEntries(
    configs.markets.map((token) => {
      if (!collateralStatus[token]) {
        return [token, 0];
      }

      const tokenCollateral =
        supplyBalance[token] * collateralFactor[token] * prices[token];
      return [token, tokenCollateral];
    })
  );
}
