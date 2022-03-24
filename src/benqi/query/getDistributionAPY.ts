/**
 * 奖励率 = 每秒产生的奖励价值 / 流通币价值
 * 贡献1刀流通币每秒能分发到多少价值的 Qi/AVAX
 *
 * rewardRatePerTimestamp =
 * (rewardSpeedPerTimestamp * rewardUSDPrice) / (totalSupply * underlyingTokenUSDPrice)
 *
 * totalSupply = getCash + totalBorrows - totalReserves
 * getCash: 合约中剩余的数量
 * totalBorrows: 借出的包含利息的数量
 * totalReserves: 准备金，市场中的储备
 * totalSupply: 市场中流通的 underlyingToken 数量
 */

import configs from "../configs";
import calculateAPY from "../utils/calculateAPY";
import getRewardSpeeds from "./getRewardSpeeds";
import getBorrowBalance from "./getBorrowBalance";
import getSupplyBalance from "./getSupplyBalance";
import getUnderlyingPrices from "./getUnderlyingPrices";

export default async function getDistributionAPY() {
  console.log("Start calculate distribution APY");

  const supplyBalance = await getSupplyBalance();
  const totalBorrowBalance = await getBorrowBalance();
  const rewardSpeed = await getRewardSpeeds();

  const prices = await getUnderlyingPrices();

  const distributionAPY = configs.markets.map((symbol) => {
    const rewards = configs.rewards.map((reward) => {
      const rewardSpeedPerTimestamp = rewardSpeed[symbol][reward];
      const rewardSupplyRateTimestamp =
        (rewardSpeedPerTimestamp * prices[reward]) /
        (supplyBalance[symbol] * prices[symbol]);

      const rewardBorrowRateTimestamp =
        (rewardSpeedPerTimestamp * prices[reward]) /
        (totalBorrowBalance[symbol] * prices[symbol]);

      const distributionSupplyAPY = calculateAPY(rewardSupplyRateTimestamp);
      const distributionBorrowAPY = calculateAPY(rewardBorrowRateTimestamp);

      return {
        reward,
        supply: distributionSupplyAPY,
        borrow: distributionBorrowAPY,
      };
    });

    const [supply, borrow] = rewards.reduce(
      (total, { supply, borrow }) => {
        return [total[0] + supply, total[1] + borrow];
      },
      [0, 0]
    );

    return [
      symbol,
      {
        supply: Math.min(10000, supply),
        borrow: Math.min(10000, borrow),
        rewards: rewards.map(({ reward, supply, borrow }) => {
          return {
            [reward]: {
              supply: Math.min(10000, supply),
              borrow: Math.min(10000, borrow),
            },
          };
        }),
      },
    ];
  });

  return Object.fromEntries(distributionAPY);
}
