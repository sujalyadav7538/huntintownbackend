/**
 * Gives a small boost to higher budget posts.
 *
 * @param {number} budget
 * @returns {number}
 */
export default function calculateBudgetScore(budget = 0) {
  if (!budget || budget <= 0) {
    return 0;
  }

  if (budget >= 100000) return 10;

  if (budget >= 50000) return 8;

  if (budget >= 20000) return 6;

  if (budget >= 10000) return 4;

  if (budget >= 5000) return 2;

  return 0;
}
