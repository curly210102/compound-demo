import getBorrowLimit from "./getBorrowLimit";
import getTotalBorrow from "./getTotalBorrow";

export default async function getBorrowLimitUsed() {
  const borrowLimit = await getBorrowLimit();
  const totalBorrow = await getTotalBorrow();

  const borrowLimitUsed = (totalBorrow / borrowLimit) * 100;
  if (isNaN(borrowLimitUsed)) {
    return 0;
  } else if (!isFinite(borrowLimitUsed)) {
    return 100;
  } else {
    return borrowLimitUsed;
  }
}
