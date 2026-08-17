/**
 * Calculates recommendation score based on
 * category and user skills.
 *
 * @param {string[]} userSkills
 * @param {string} postCategory
 * @returns {number}
 */
export default function calculateCategoryScore(userSkills = [], postCategory = "") {
  if (!Array.isArray(userSkills) || !postCategory) {
    return 0;
  }

  const normalizedSkills = userSkills.map((skill) =>
    skill.trim().toLowerCase(),
  );

  const category = postCategory.trim().toLowerCase();

  if (normalizedSkills.includes(category)) {
    return 25;
  }

  return 0;
}