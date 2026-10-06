export const MAX_SEARCH_LENGTH = 100;

export const parseSearchTerm = (value) =>
  typeof value === "string" ? value.trim().slice(0, MAX_SEARCH_LENGTH) : "";

// User input is escaped so it is matched literally and cannot inject regex (ReDoS).
export const buildSearchRegex = (term) =>
  new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export const POST_SEARCH_FIELDS = ["title", "description", "category", "address"];

export const buildFieldsSearch = (regex, fields = POST_SEARCH_FIELDS) =>
  fields.map((field) => ({ [field]: regex }));
