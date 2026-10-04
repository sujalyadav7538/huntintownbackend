/**
 * Calculate recommendation score based on
 * owner's trust score.
 *
 * @param {number} trustScore
 * @returns {number}
 */
export default function calculateTrustScore(trustScore = 0) {
  if (trustScore >= 90) return 15;

  if (trustScore >= 80) return 12;

  if (trustScore >= 70) return 8;

  if (trustScore >= 60) return 5;

  return 0;
}