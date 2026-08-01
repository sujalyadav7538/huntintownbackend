import mongoose from "mongoose";
import Rating from "../models/ratingSchema.js";
import Post from "../models/postSchema.js";
import Offer from "../models/offerSchema.js";
import { updateUserMetrics } from "./userMetricController.js";
import { METRIC_TYPES, ACTIONS } from "../config/constants.js";

export const rateUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { postId, hunter, helper, rating, comment } = req.body;
    if (!postId || !hunter || !helper || !rating) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Check if the hunter is the owner of the post
    const isOwner = await Post.findOne({ _id: postId, author: hunter }).session(
      session,
    );
    if (!isOwner) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message:
          "You are not the owner of this post and cannot rate the helper",
      });
    }

    // Check if helper has applied on this post or not
    const hasApplied = await Post.findOne({
      _id: postId,
      applicants: { $in: [helper] },
    }).session(session);
    if (!hasApplied) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message:
          "The person you are trying to rate has not applied on the post",
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
      return res.status(401).json({
        success: false,
        message: "You have already rated this user for this post",
      });
    }

    const newRating = new Rating({
      postId,
      hunter,
      helper,
      rating,
      comment,
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

    return res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      rating: newRating,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
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
    const { postId, rating, comment } = req.body;
    const helperId = req.user._id;

    if (!postId || !rating) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.status !== "completed") {
      return res.status(400).json({ success: false, message: "Post is not yet completed" });
    }

    const acceptedOffer = await Offer.findOne({ postId, offeredBy: helperId, status: "accepted" });
    if (!acceptedOffer) {
      return res.status(403).json({ success: false, message: "Your offer was not accepted for this post" });
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
      comment: comment || "",
      direction: "helper_to_hunter",
    });

    await updateUserMetrics(post.author, [{ type: METRIC_TYPES.REVIEW, rating }]);

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
