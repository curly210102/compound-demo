import getCollateralAmount from "./getCollateralAmount";

export default async function () {
  const collateralAmount = await getCollateralAmount();
  return Object.values(collateralAmount).reduce((total, amount) => {
    return total + amount;
  }, 0);
}
