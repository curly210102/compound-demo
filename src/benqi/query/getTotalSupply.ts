import configs from "../configs";
import getSupplyBalance from "./getSupplyBalance";
import getUnderlyingPrices from "./getUnderlyingPrices";

export default async function getTotalSupply() {
  const supplyBalance = await getSupplyBalance();
  const prices = await getUnderlyingPrices();

  return configs.markets.reduce((total, symbol) => {
    const tokenSupplyBalance = supplyBalance[symbol];
    const tokenPrice = prices[symbol];
    const supplyValue = tokenSupplyBalance * tokenPrice;

    return total + supplyValue;
  }, 0);
}
