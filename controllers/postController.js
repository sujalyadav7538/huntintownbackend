import mongoose from "mongoose";
import Post from "../models/postSchema.js";
import Response from "../models/responseSchema.js";
import { geoCode, reverseGeoCode } from "../utils/geoCode.js";
import cloudinary from "../utils/cloudinary.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import {
  METRIC_TYPES,
  ACTIONS,
  GEO_TYPE,
  POST_STATUS,
} from "../config/constants.js";
import User from "../models/userSchema.js";
import {
  parseSearchTerm,
  buildSearchRegex,
  buildFieldsSearch,
} from "../utils/search.js";

import {
  createRecommendationPool,
  getRecommendationPool,
  removeRecommendationPool,
} from "../service/recommendationPoolService.js";

const PAGE_SIZE = 20;

const SEARCH_FILTERS = ["all", "urgent", "trending", "nearby", "premium"];
const TRENDING_MIN_RESPONSES = 8;
const NEARBY_RADIUS_KM = 10;
const EARTH_RADIUS_KM = 6378.1;

const parseCoordinates = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const valid =
    lat !== undefined &&
    lng !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return valid ? [longitude, latitude] : null;
};

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 300;
const BUDGET_MAX = 40;
const TIMELINE_MAX = 40;
const MAX_QUESTIONS = 3;
const QUESTION_MAX = 150;
const DEFAULT_EXPIRY_DAYS = 7;
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const readString = (value) => (typeof value === "string" ? value.trim() : "");

const parseJsonField = (value, fallback) => {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const isValidLngLat = (coordinates) =>
  Array.isArray(coordinates) &&
  coordinates.length === 2 &&
  coordinates.every((value) => typeof value === "number" && Number.isFinite(value)) &&
  Math.abs(coordinates[0]) <= 180 &&
  Math.abs(coordinates[1]) <= 90;

// Multer has already uploaded files to Cloudinary, so a rejected request must clean them up.
const removeUploadedImages = (files = []) =>
  Promise.allSettled(
    files
      .filter((file) => file?.filename)
      .map((file) => cloudinary.uploader.destroy(file.filename)),
  );

export const createPost = async (req, res, next) => {
  const reject = async (status, message) => {
    await removeUploadedImages(req.files);
    return res.status(status).json({ success: false, message });
  };

  try {
    const title = readString(req.body.title);
    const description = readString(req.body.description);
    const category = readString(req.body.category);
    const budget = readString(req.body.budget).slice(0, BUDGET_MAX);
    const timeline = readString(req.body.timeline).slice(0, TIMELINE_MAX);
    let address = readString(req.body.address);

    if (!title || !description || !category) {
      return reject(400, "Title, description and category are required");
    }
    if (title.length > TITLE_MAX) {
      return reject(400, `Title must be ${TITLE_MAX} characters or fewer`);
    }
    if (description.length > DESCRIPTION_MAX) {
      return reject(400, `Description must be ${DESCRIPTION_MAX} characters or fewer`);
    }

    const location = parseJsonField(req.body.location, null);
    let coordinates = isValidLngLat(location?.coordinates)
      ? location.coordinates
      : null;

    if (!address && !coordinates) {
      return reject(400, "Add an address or share your current location");
    }

    if (!coordinates) {
      coordinates = await geoCode(address);
      if (!isValidLngLat(coordinates)) {
        return reject(
          400,
          "We couldn't find that address. Try a more specific one or use your current location.",
        );
      }
    }

    if (!address) {
      address = (await reverseGeoCode(coordinates)) || "Shared location";
    }

    const rawQuestions = parseJsonField(req.body.questions, []);
    const questions = (Array.isArray(rawQuestions) ? rawQuestions : [])
      .filter((question) => typeof question === "string")
      .map((question) => question.trim().slice(0, QUESTION_MAX))
      .filter(Boolean)
      .slice(0, MAX_QUESTIONS);

    const requestedDays = parseInt(req.body.expiryDays, 10);
    const expiryDays = Number.isFinite(requestedDays)
      ? Math.min(MAX_EXPIRY_DAYS, Math.max(MIN_EXPIRY_DAYS, requestedDays))
      : DEFAULT_EXPIRY_DAYS;

    const post = await Post.create({
      title,
      description,
      category,
      address,
      location: {
        type: GEO_TYPE.POINT,
        coordinates,
      },
      budget: budget || undefined,
      timeline: timeline || undefined,
      expiryDays,
      expiresAt: new Date(Date.now() + expiryDays * DAY_MS),
      questions,
      // Only server-uploaded images are accepted; arbitrary client URLs are ignored.
      images: (req.files ?? []).map((file) => file.path),
      author: req.user._id,
    });

    await post.populate("author", "name avatar location rating trustscore");

    await updateUserMetrics(req.user._id, [
      { type: METRIC_TYPES.HUNTER, action: ACTIONS.POST_CREATED },
      { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.POST_CREATED },
    ]);

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    await removeUploadedImages(req.files);
    next(error);
  }
};

export const getAllPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find()
        .populate("author", "name avatar rating trustscore location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      count: posts.length,
      page,
      hasMore: skip + posts.length < total,
      posts,
    });
  } catch (error) {
    next(error);
  }
};

export const searchPosts = async (req, res, next) => {
  try {
    const q = parseSearchTerm(req.query.q);
    const filter =
      typeof req.query.filter === "string"
        ? req.query.filter.toLowerCase()
        : "all";

    if (!SEARCH_FILTERS.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter. Use one of: ${SEARCH_FILTERS.join(", ")}`,
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || PAGE_SIZE));
    const skip = (page - 1) * limit;
    const userId = req.user?._id;

    // Same visibility rules as the Explore feed.
    const query = {
      status: { $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS] },
      expiresAt: { $gt: new Date() },
    };
    const and = [];

    if (userId) {
      const appliedPostIds = await Response.find({ respondedBy: userId }).distinct(
        "postId",
      );
      query.author = { $ne: userId };
      query._id = { $nin: appliedPostIds };
    }

    if (q) {
      const regex = buildSearchRegex(q);
      const authors = await User.find({ name: regex })
        .select("_id")
        .limit(200)
        .lean();
      and.push({
        $or: [
          ...buildFieldsSearch(regex),
          { author: { $in: authors.map((author) => author._id) } },
        ],
      });
    }

    if (filter === "urgent") {
      and.push({ $or: [{ title: /urgent/i }, { description: /urgent/i }] });
    } else if (filter === "trending") {
      query.responsesCount = { $gte: TRENDING_MIN_RESPONSES };
    } else if (filter === "premium") {
      query.budget = { $exists: true, $not: /^\s*(negotiable)?\s*$/i };
    } else if (filter === "nearby") {
      let coordinates = parseCoordinates(req.query.lat, req.query.lng);

      if (!coordinates && userId) {
        const user = await User.findById(userId).select("location").lean();
        const [lng, lat] = user?.location?.coordinates ?? [];
        coordinates = parseCoordinates(lat, lng);
      }

      if (!coordinates) {
        return res.status(400).json({
          success: false,
          message: "Location is required for the nearby filter",
        });
      }

      query.location = {
        $geoWithin: {
          $centerSphere: [coordinates, NEARBY_RADIUS_KM / EARTH_RADIUS_KM],
        },
      };
    }

    if (and.length) query.$and = and;

    const sort =
      filter === "trending"
        ? { responsesCount: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate("author", "name avatar rating trustscore location role")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page,
      hasMore: skip + posts.length < total,
      posts,
    });
  } catch (error) {
    next(error);
  }
};

export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(id).populate(
      "author",
      "name avatar rating location",
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      title,
      description,
      category,
      address,
      coordinates,
      type,
      budget,
      timeline,
      expiryDays,
      expiresAt,
      questions,
      contactMethods,
      images,
      status,
    } = req.body;

    if (coordinates !== undefined) {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates.some((c) => typeof c !== "number")
      ) {
        return res.status(400).json({
          success: false,
          message: "Coordinates must be an array of [longitude, latitude]",
        });
      }
      post.location = { type: GEO_TYPE.POINT, coordinates };
    }

    if (title !== undefined) post.title = title;
    if (description !== undefined) post.description = description;
    if (category !== undefined) post.category = category;
    if (address !== undefined) post.address = address;
    if (type !== undefined) post.type = type;
    if (budget !== undefined) post.budget = budget;
    if (timeline !== undefined) post.timeline = timeline;
    if (expiryDays !== undefined) post.expiryDays = expiryDays;
    if (expiresAt !== undefined) post.expiresAt = expiresAt;
    if (questions !== undefined) post.questions = questions;
    if (contactMethods !== undefined) post.contactMethods = contactMethods;
    if (images !== undefined) post.images = images;
    if (status !== undefined) post.status = status;

    await post.save();

    await post.populate("author", "name avatar rating location");

    return res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePost = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(id).session(session);

    if (!post) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user._id) {
      await session.abortTransaction();

      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    await Response.deleteMany(
      {
        postId: post._id,
      },
      { session },
    );

    await Post.findByIdAndDelete(post._id, {
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const markPostCompleted = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ success: false, message: "Invalid post id" });
    }

    const post = await Post.findById(id).session(session);

    if (!post) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    if (post.author.toString() !== req.user._id) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const nonCompletableStatuses = [
      POST_STATUS.COMPLETED,
      POST_STATUS.CANCELLED,
      POST_STATUS.EXPIRED,
    ];
    if (nonCompletableStatuses.includes(post.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Post is already ${post.status} and cannot be marked as completed`,
      });
    }

    post.status = POST_STATUS.COMPLETED;
    await post.save({ session });

    await updateUserMetrics(
      req.user._id,
      [
        { type: METRIC_TYPES.HUNTER, action: ACTIONS.POST_COMPLETED },
        { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.POST_COMPLETED },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await post.populate("author", "name avatar rating location");

    return res.status(200).json({
      success: true,
      message: "Post marked as completed",
      post,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const getAvailablePosts = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("location skills").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const refresh = req.query.refresh === "true";

    let pool = getRecommendationPool(userId);
    // ----------------------------------------
    // 1. Explicit refresh from frontend
    // ----------------------------------------
    if (refresh) {
      removeRecommendationPool(userId);

      pool = await createRecommendationPool({
        user,
      });
    }

    // ----------------------------------------
    // 2. No pool → create initial pool
    // ----------------------------------------
    if (!pool) {
      pool = await createRecommendationPool({
        user,
      });
    }

    // ----------------------------------------
    // 3. Pool exhausted → refill
    // ----------------------------------------
    if (pool && pool.position >= pool.posts.length) {
      removeRecommendationPool(userId);

      pool = await createRecommendationPool({
        user,
      });
    }

    // Remove expired posts from cached pool before serving results.
    if (pool?.posts?.length) {
      const now = Date.now();

      pool.posts = pool.posts.filter((item) => {
        const expiresAt = item?.post?.expiresAt;

        if (!expiresAt) return true;

        const ts = new Date(expiresAt).getTime();
        return Number.isFinite(ts) && ts > now;
      });

      if (pool.position > pool.posts.length) {
        pool.position = pool.posts.length;
      }
    }

    // If pruning exhausted the pool, rebuild once.
    if (pool && pool.position >= pool.posts.length) {
      removeRecommendationPool(userId);

      pool = await createRecommendationPool({
        user,
      });
    }

    // ----------------------------------------
    // 4. Still no posts available
    // ----------------------------------------
    if (!pool || pool.posts.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        hasMore: false,
        posts: [],
      });
    }

    // ----------------------------------------
    // 5. Get next page from pool
    // ----------------------------------------
    const start = pool.position;
    const end = Math.min(start + PAGE_SIZE, pool.posts.length);

    const results = pool.posts.slice(start, end);

    pool.position = end;

    // ----------------------------------------
    // 6. There may still be posts in pool
    // ----------------------------------------
    const hasMore = pool.position < pool.posts.length;

    return res.status(200).json({
      success: true,
      count: results.length,
      hasMore,
      posts: results.map((item) => ({
        ...item.post,
        recommendationScore: item.score,
        recommendationBreakdown: item.breakdown,
      })),
    });
  } catch (error) {
    next(error);
  }
};
