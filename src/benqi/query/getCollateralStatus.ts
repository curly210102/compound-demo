import configs from "../configs";
import { getComptroller, myWalletAddress } from "../utils/getContract";

export default async function () {
  const comptrollerContract = getComptroller();
  const collaterals = await comptrollerContract.getAssetsIn(myWalletAddress);

  return Object.fromEntries(
    configs.markets.map((symbol) => {
      const { address } = configs.assets[symbol];
      return [symbol, collaterals.includes(address)];
    })
  );
}
