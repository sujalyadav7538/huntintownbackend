import mongoose from "mongoose";

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

const isObjectId = (value) =>
  value instanceof mongoose.Types.ObjectId || value?._bsontype === "ObjectId";

const toPlainObject = (value) => {
  if (!value || Array.isArray(value) || value instanceof Date || isObjectId(value)) {
    return value;
  }

  if (typeof value.toObject === "function") {
    return value.toObject({ virtuals: true });
  }

  return value;
};

export const normalizePublicIds = (value) => {
  const plainValue = toPlainObject(value);

  if (Array.isArray(plainValue)) {
    return plainValue.map((entry) => normalizePublicIds(entry));
  }

  if (!plainValue || plainValue instanceof Date || isObjectId(plainValue)) {
    return plainValue;
  }

  if (!isPlainObject(plainValue)) {
    return plainValue;
  }

  const hasMongoId = Object.prototype.hasOwnProperty.call(plainValue, "_id");
  const normalized = {};

  Object.entries(plainValue).forEach(([key, entryValue]) => {
    if (key === "__v") {
      return;
    }

    if (key === "_id") {
      normalized.id = String(entryValue);
      return;
    }

    if (key === "id" && hasMongoId) {
      return;
    }

    normalized[key] = normalizePublicIds(entryValue);
  });

  return normalized;
};

const rewriteQueryIds = (value, schema) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => rewriteQueryIds(entry, schema));
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, "id") &&
    !Object.prototype.hasOwnProperty.call(value, "_id")
  ) {
    value._id = value.id;
    delete value.id;
  }

  Object.entries(value).forEach(([key, entryValue]) => {
    if (key.startsWith("$") || isPlainObject(entryValue) || Array.isArray(entryValue)) {
      rewriteQueryIds(entryValue, schema);
    }
  });

  return value;
};

const stripImmutableIds = (value) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => stripImmutableIds(entry));
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  delete value.id;
  delete value._id;

  Object.values(value).forEach((entry) => {
    if (isPlainObject(entry) || Array.isArray(entry)) {
      stripImmutableIds(entry);
    }
  });

  return value;
};

const applyTransform = (previousTransform) => (doc, ret, options) => {
  const transformed = previousTransform ? previousTransform(doc, ret, options) ?? ret : ret;
  return normalizePublicIds(transformed);
};

export const publicIdPlugin = (schema) => {
  const jsonOptions = schema.get("toJSON") || {};
  const objectOptions = schema.get("toObject") || {};

  schema.set("toJSON", {
    ...jsonOptions,
    virtuals: true,
    transform: applyTransform(jsonOptions.transform),
  });

  schema.set("toObject", {
    ...objectOptions,
    virtuals: true,
    transform: applyTransform(objectOptions.transform),
  });

  schema.pre(
    [
      "find",
      "findOne",
      "findOneAndUpdate",
      "updateOne",
      "updateMany",
      "deleteOne",
      "deleteMany",
      "countDocuments",
    ],
    function publicIdQueryMiddleware(next) {
      rewriteQueryIds(this.getFilter(), schema);

      const update = this.getUpdate?.();
      if (update) {
        stripImmutableIds(update);
      }

      next();
    },
  );
};