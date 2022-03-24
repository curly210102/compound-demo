import configs from "../configs";
import getContract, { myWalletAddress } from "../utils/getContract";
export default async function getSupplyBalance() {
  const supplyBalances = await Promise.all(
    configs.markets.map(async (symbol) => {
      const { address, decimals, underlyingDecimals } = configs.assets[symbol];
      const cToken = getContract(address, configs.abi.token);
      const [_error, tokenBalanceRaw, _borrowBalance, exchangeRateRaw] =
        await cToken.getAccountSnapshot(myWalletAddress);
      const exchangeRateDecimals = 18 + underlyingDecimals - decimals;
      const exchangeRate = exchangeRateRaw / Math.pow(10, exchangeRateDecimals);
      const tokenBalance = tokenBalanceRaw / Math.pow(10, decimals);
      const supplyBalance = tokenBalance * exchangeRate;

      return [symbol, supplyBalance];
    })
  );
  const supplyBalanceMap = Object.fromEntries(supplyBalances);

  return supplyBalanceMap;
}
