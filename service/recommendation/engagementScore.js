/**
 * Boost posts having fewer applicants.
 *
 * @param {number} applicantsCount
 * @returns {number}
 */
export default function calculateEngagementScore(applicantsCount = 0) {
  if (applicantsCount === 0) return 15;

  if (applicantsCount <= 2) return 10;

  if (applicantsCount <= 5) return 5;

  return 0;
}