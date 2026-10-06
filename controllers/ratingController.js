import mongoose from "mongoose";
import Rating from "../models/ratingSchema.js";
import Post from "../models/postSchema.js";
import Response from "../models/responseSchema.js";
import User from "../models/userSchema.js";
import { NotificationManager } from "../utils/notificationManager.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import {
  METRIC_TYPES,
  ACTIONS,
  POST_STATUS,
  RESPONSE_STATUS,
} from "../config/constants.js";

const isValidRating = (value) =>
  Number.isInteger(value) && value >= 1 && value <= 5;

/** GET /api/rating/post/:postId/helpers — owner lists accepted helpers with their rating state */
export const getPostHelpers = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const ownerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }

    const post = await Post.findById(postId).select("author title status").lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    if (String(post.author) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const [responses, ratings] = await Promise.all([
      Response.find({ postId, status: RESPONSE_STATUS.ACCEPTED })
        .populate("respondedBy", "_id name avatar role")
        .lean(),
      Rating.find({ postId, hunter: ownerId, direction: "hunter_to_helper" })
        .select("helper rating comment")
        .lean(),
    ]);

    const ratingByHelper = new Map(ratings.map((r) => [String(r.helper), r]));

    const helpers = responses
      .filter((response) => response.respondedBy)
      .map(({ _id: responseId, respondedBy: helper }) => {
        const existing = ratingByHelper.get(String(helper._id));
        return {
          _id: helper._id,
          name: helper.name,
          avatar: helper.avatar || "",
          role: helper.role || "",
          responseId,
          rated: Boolean(existing),
          rating: existing?.rating ?? null,
          comment: existing?.comment ?? "",
        };
      });

    return res.status(200).json({
      success: true,
      post: { _id: post._id, title: post.title, status: post.status },
      helpers,
    });
  } catch (error) {
    next(error);
  }
};

/** POST /api/rating — post owner rates an accepted helper after completion */
export const rateUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { postId, comment } = req.body;
    const helper = req.body.helper ?? req.body.helperId;
    const rating = Number(req.body.rating);
    // The rater is always the authenticated user, never a client-supplied id.
    const hunter = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(postId) ||
      !mongoose.Types.ObjectId.isValid(helper)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Valid postId and helper are required" });
    }

    if (!isValidRating(rating)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Rating must be a whole number from 1 to 5" });
    }

    const post = await Post.findOne({ _id: postId, author: hunter }).session(
      session,
    );
    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message:
          "You are not the owner of this post and cannot rate the helper",
      });
    }

    if (post.status !== POST_STATUS.COMPLETED) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Helpers can be rated once the post is completed",
      });
    }

    // Check that the helper actually worked on this post (accepted response)
    const acceptedResponse = await Response.findOne({
      postId,
      respondedBy: helper,
      status: RESPONSE_STATUS.ACCEPTED,
    }).session(session);
    if (!acceptedResponse) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message:
          "The person you are trying to rate has no accepted response on this post",
      });
    }

    // Enforce one hunter-to-helper review per post
    const existingRating = await Rating.findOne({
      postId,
      hunter,
      helper,
      direction: "hunter_to_helper",
    }).session(session);

    if (existingRating) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: "You have already rated this user for this post",
      });
    }

    const newRating = new Rating({
      postId,
      hunter,
      helper,
      rating,
      comment: typeof comment === "string" ? comment.trim().slice(0, 500) : "",
      direction: "hunter_to_helper",
    });
    await newRating.save({ session });

    await updateUserMetrics(
      helper,
      [
        { type: METRIC_TYPES.REVIEW, rating },
        { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.REVIEW_SUBMITTED },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    const reviewer = await User.findById(hunter).select("_id name avatar").lean();
    await NotificationManager.ratedForCompletion({
      userId: helper,
      reviewer,
      rating: newRating,
      post,
    });

    return res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      rating: newRating,
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;
    // Exclude reverse-direction (helper_to_hunter) reviews from the helper's public profile
    const reviews = await Rating.find({
      helper: userId,
      direction: { $ne: "helper_to_hunter" },
    })
      .populate("hunter", "name avatar role")
      .sort({ createdAt: -1 })
      .limit(20);

    const mapped = reviews.map((r) => ({
      _id: r._id,
      hunter: {
        name: r.hunter?.name || "Anonymous",
        avatar: r.hunter?.avatar || "",
        role: r.hunter?.role || "",
      },
      rating: r.rating,
      comment: r.comment || "",
      createdAt: r.createdAt,
    }));

    return res.status(200).json({ success: true, reviews: mapped });
  } catch (error) {
    next(error);
  }
};

/** POST /api/rating/review-owner — helper rates the post owner after completion */
export const reviewOwner = async (req, res, next) => {
  try {
    const { postId, comment } = req.body;
    const rating = Number(req.body.rating);
    const helperId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "Valid postId is required" });
    }
    if (!isValidRating(rating)) {
      return res.status(400).json({ success: false, message: "Rating must be a whole number from 1 to 5" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.status !== POST_STATUS.COMPLETED) {
      return res.status(400).json({ success: false, message: "Post is not yet completed" });
    }

    const acceptedResponse = await Response.findOne({ postId, respondedBy: helperId, status: RESPONSE_STATUS.ACCEPTED });
    if (!acceptedResponse) {
      return res.status(403).json({ success: false, message: "Your response was not accepted for this post" });
    }

    const existing = await Rating.findOne({ postId, hunter: post.author, helper: helperId, direction: "helper_to_hunter" });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already reviewed this post owner" });
    }

    await Rating.create({
      postId,
      hunter: post.author,
      helper: helperId,
      rating,
      comment: typeof comment === "string" ? comment.trim().slice(0, 500) : "",
      direction: "helper_to_hunter",
    });

    // The reviewed user is the post owner. updateUserMetrics mirrors the new
    // average rating and trust score onto that user document itself.
    await updateUserMetrics(post.author, [
      { type: METRIC_TYPES.REVIEW, rating },
    ]);

    await updateUserMetrics(helperId, [
      { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.REVIEW_SUBMITTED },
    ]);

    const reviewer = await User.findById(helperId).select("_id name avatar").lean();
    await NotificationManager.ratingReceived({
      userId: post.author,
      reviewer,
      rating: { _id: undefined, rating },
    });

    return res.status(201).json({ success: true, message: "Review submitted" });
  } catch (error) {
    next(error);
  }
};

/** GET /api/rating/review-status/:postId — check if current user has reviewed the owner for this post */
export const getReviewStatus = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const [helperReview, hunterReview] = await Promise.all([
      Rating.findOne({ postId, helper: userId, direction: "helper_to_hunter" }).select("_id"),
      Rating.findOne({ postId, helper: userId, direction: "hunter_to_helper" }).select("_id"),
    ]);

    return res.status(200).json({
      success: true,
      hasReviewedOwner: !!helperReview,
      ownerHasReviewedYou: !!hunterReview,
    });
  } catch (error) {
    next(error);
  }
};
