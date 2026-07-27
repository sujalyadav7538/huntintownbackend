import mongoose from "mongoose";
import Rating from "../models/ratingSchema.js";
import Post from "../models/postSchema.js";
import User from "../models/userSchema.js";
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

    // Check if the hunter has already rated the helper for this post
    const existingRating = await Rating.findOne({
      postId,
      hunter,
      helper,
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
    const reviews = await Rating.find({ helper: userId })
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
