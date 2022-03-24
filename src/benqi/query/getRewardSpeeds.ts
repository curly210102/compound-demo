import configs from "../configs";
import { getComptroller } from "../utils/getContract";

export default async function getRewardSpeeds() {
  const comptroller = getComptroller();
  const rewardSpeedsPromises = configs.markets.map(async (symbol) => {
    const { address } = configs.assets[symbol];
    const tokenRewardSpeedPromises = configs.rewards.map(
      async (symbol, index) => {
        const { underlyingDecimals } = configs.assets[symbol];
        const rewardSpeed = await comptroller.rewardSpeeds(index, address);

        return [symbol, rewardSpeed / Math.pow(10, underlyingDecimals)];
      }
    );

    const tokenRewardSpeed = await Promise.all(tokenRewardSpeedPromises);

    return [symbol, Object.fromEntries(tokenRewardSpeed)];
  });

  const rewardSpeeds = await Promise.all(rewardSpeedsPromises);
  return Object.fromEntries(rewardSpeeds);
}
