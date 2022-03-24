import configs from "../configs";
import getContract, { myWalletAddress } from "../utils/getContract";

const getExchangeRates = async () => {
  const exchangeRatePromises = configs.markets.map(async (symbol) => {
    const { address, underlyingDecimals, decimals } = configs.assets[symbol];
    const qiContract = getContract(address, configs.abi.token);

    const [_error, _tokenBalanceRaw, _borrowBalance, exchangeRate] =
      await qiContract.getAccountSnapshot(myWalletAddress);

    const exchangeRateDecimals = 18 + underlyingDecimals - decimals;
    return [symbol, exchangeRate / Math.pow(10, exchangeRateDecimals)];
  });

  return Object.fromEntries(await Promise.all(exchangeRatePromises));
};

export default getExchangeRates;
