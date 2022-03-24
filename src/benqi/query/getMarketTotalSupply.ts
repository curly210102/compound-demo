import configs from "../configs";
import { getTokenContract } from "../utils/getContract";
import getExchangeRates from "./getExchangeRates";

export default async function getMarketTotalSupply() {
  const totalSupplyPromises = configs.markets.map(async (symbol) => {
    const exchangeRates = await getExchangeRates();
    const { address, decimals } = configs.assets[symbol];
    const tokenContract = getTokenContract(address);
    const totalSupply = await tokenContract.totalSupply();
    const tokenTotalSupply = totalSupply / Math.pow(10, decimals);
    return [symbol, tokenTotalSupply * exchangeRates[symbol]];
  });

  return Object.fromEntries(await Promise.all(totalSupplyPromises));
}
