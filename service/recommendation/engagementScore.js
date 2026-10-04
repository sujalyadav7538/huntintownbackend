/**
 * Boost posts having fewer responses.
 *
 * @param {number} responsesCount
 * @returns {number}
 */
export default function calculateEngagementScore(responsesCount = 0) {
  if (responsesCount === 0) return 15;

  if (responsesCount <= 2) return 10;

  if (responsesCount <= 5) return 5;

  return 0;
}
