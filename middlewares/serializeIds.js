/**
 * Mongo documents serialize their primary key as `_id`, but large parts of the
 * frontend read `post.id` / `author.id` / `user.id`. Lean queries and aggregation
 * pipelines bypass Mongoose virtuals, so the `id` virtual is not a reliable fix.
 *
 * This middleware wraps `res.json` and mirrors every `_id` onto an `id` field in
 * the outgoing payload, at any depth. `_id` is left untouched, so both
 * conventions work and neither side has to be rewritten.
 */

const mirrorIds = (node) => {
  if (Array.isArray(node)) {
    node.forEach(mirrorIds);
    return node;
  }

  if (!node || typeof node !== "object") {
    return node;
  }

  for (const key of Object.keys(node)) {
    mirrorIds(node[key]);
  }

  if (typeof node._id === "string" && node.id === undefined) {
    node.id = node._id;
  }

  return node;
};

export default function serializeIds(req, res, next) {
  const sendJson = res.json.bind(res);

  res.json = (body) => {
    try {
      // Round-tripping applies Mongoose toJSON transforms (which strip
      // passwordHash/googleId) and turns ObjectIds into plain strings first.
      return sendJson(mirrorIds(JSON.parse(JSON.stringify(body))));
    } catch {
      return sendJson(body);
    }
  };

  next();
}
