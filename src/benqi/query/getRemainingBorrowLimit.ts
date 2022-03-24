import getBorrowLimit from "./getBorrowLimit";
import getBorrowLimitUsed from "./getBorrowLimitUsed";

export default async function () {
  const borrowLimit = await getBorrowLimit();
  const borrowLimitUsed = await getBorrowLimitUsed();

  return (borrowLimit * (100 - borrowLimitUsed)) / 100;
}
