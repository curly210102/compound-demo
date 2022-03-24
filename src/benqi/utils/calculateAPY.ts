export default function calculateAPY(ratePerTimestamps: number) {
  const secondsPerDay = 86400; // seconds per day
  const daysPerYear = 365;

  return (
    (Math.pow(ratePerTimestamps * secondsPerDay + 1, daysPerYear) - 1) * 100
  );
}
