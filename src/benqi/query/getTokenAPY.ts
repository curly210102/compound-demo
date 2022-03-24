import configs from "../configs";
import calculateAPY from "../utils/calculateAPY";
import getContract from "../utils/getContract";

export default async function getTokenAPY() {
  const tokenAPYPromises = configs.markets.map(async (symbol) => {
    const { address } = configs.assets[symbol];
    const cTokenContract = getContract(address, configs.abi.token);
    const supplyRatePerTimestamp =
      await cTokenContract.callStatic.supplyRatePerTimestamp();
    const supplyAPY = calculateAPY(supplyRatePerTimestamp / 1e18);

    // Borrow APY：借贷年利率
    const borrowRatePerTimestamp =
      await cTokenContract.callStatic.borrowRatePerTimestamp();
    const borrowAPY = calculateAPY(borrowRatePerTimestamp / 1e18);

    return [
      symbol,
      {
        supply: supplyAPY,
        borrow: borrowAPY,
      },
    ];
  });

  return Object.fromEntries(await Promise.all(tokenAPYPromises));
}
