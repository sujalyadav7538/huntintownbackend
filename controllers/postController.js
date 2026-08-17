import mongoose from "mongoose";
import Post from "../models/postSchema.js";
import Response from "../models/responseSchema.js";
import { geoCode } from "../utils/geoCode.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import {
  METRIC_TYPES,
  ACTIONS,
  GEO_TYPE,
  POST_STATUS,
  MODEL_NAMES,
} from "../config/constants.js";
import User from "../models/userSchema.js";
import { calculateRecommendationScore } from "../service/recommendationService.js";
import Metric from "../models/userMetricSchema.js";
import {
  createRecommendationPool,
  getRecommendationPool,
  removeRecommendationPool,
} from "../service/recommendationPoolService.js";

const PAGE_SIZE = 20;

export const createPost = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      address,
      type,
      budget,
      timeline,
      expiryDays,
      expiresAt,
    } = req.body;

    if (!title || !description || !category || !address) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // Parse complex fields — may arrive as JSON strings when sent via FormData
    let location = req.body.location;
    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch {
        location = null;
      }
    }

    let questions = req.body.questions;
    if (typeof questions === "string") {
      try {
        questions = JSON.parse(questions);
      } catch {
        questions = [];
      }
    }

    let contactMethods = req.body.contactMethods;
    if (typeof contactMethods === "string") {
      try {
        contactMethods = JSON.parse(contactMethods);
      } catch {
        contactMethods = null;
      }
    }

    // Images: prefer multer-uploaded files (Cloudinary URLs), fall back to body
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((f) => f.path);
    } else if (req.body.images) {
      const raw = req.body.images;
      imageUrls = Array.isArray(raw) ? raw : [];
    }

    let coordinates = location?.coordinates;
    if (!coordinates) {
      coordinates = await geoCode(address);
    }

    const post = await Post.create({
      title,
      description,
      category,
      address,
      location: {
        type: GEO_TYPE.POINT,
        coordinates,
      },
      type,
      budget,
      timeline,
      expiryDays,
      expiresAt,
      questions: questions || [],
      contactMethods,
      images: imageUrls,
      author: req.user._id,
    });

    await post.populate("author", "name avatar email rating location");

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
        .populate("author", "name avatar rating location")
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

    const refresh = req.query.refresh === "true";

    let pool = getRecommendationPool(userId);

    console.log(`Recommendation pool for user ${userId}:`,refresh);
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
