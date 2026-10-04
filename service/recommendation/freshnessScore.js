/**
 * Calculate recommendation score based on post age.
 *
 * @param {Date|string} createdAt
 * @returns {number}
 */
export default function calculateFreshnessScore(createdAt) {
  if (!createdAt) return 0;

  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();

  const hoursOld = (now - createdTime) / (1000 * 60 * 60);

  if (hoursOld <= 6) return 20;

  if (hoursOld <= 24) return 15;

  if (hoursOld <= 72) return 10;

  if (hoursOld <= 168) return 5;

  return 0;
}
