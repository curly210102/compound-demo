import configs from "../configs";
import getContract, { myWalletAddress } from "../utils/getContract";

export default async function getBorrowBalance() {
  const borrowBalances = await Promise.all(
    configs.markets.map(async (symbol) => {
      const { address, underlyingDecimals } = configs.assets[symbol];
      const cToken = getContract(address, configs.abi.token);
      const [_error, _tokenBalance, borrowBalance, _exchangeRate] =
        await cToken.getAccountSnapshot(myWalletAddress);
      return [symbol, borrowBalance / Math.pow(10, underlyingDecimals)];
    })
  );
  const borrowBalanceMap = Object.fromEntries(borrowBalances);
  return borrowBalanceMap;
}
