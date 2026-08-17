import mongoose from "mongoose";

import Conversation from "../models/conversationSchema.js";
import Response from "../models/responseSchema.js";
import Post from "../models/postSchema.js";
import Metric from "../models/userMetricSchema.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import {
  METRIC_TYPES,
  ACTIONS,
  POST_STATUS,
  RESPONSE_STATUS,
  CONVERSATION_STATUS,
} from "../config/constants.js";

export const createResponse = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { postId, message, answers } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(postId).session(session);

    if (!post) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() === userId.toString()) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "You cannot respond to your own post",
      });
    }

    if (![POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS].includes(post.status)) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Post is not accepting responses",
      });
    }

    if (post.expiresAt && post.expiresAt < new Date()) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Post has expired",
      });
    }

    if (answers && !Array.isArray(answers)) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Answers must be an array",
      });
    }

    const existingResponse = await Response.findOne({
      postId,
      respondedBy: userId,
    }).session(session);

    if (existingResponse) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "You have already submitted a response.",
      });
    }

    const [response] = await Response.create(
      [
        {
          postId,
          respondedBy: userId,
          message: message?.trim() || "",
          answers: answers || [],
        },
      ],
      { session },
    );

    post.responsesCount += 1;
    await post.save({ session });

    // Helper: submitted a response
    await updateUserMetrics(
      userId,
      [
        {
          type: METRIC_TYPES.HELPER,
          action: ACTIONS.RESPONSE_SUBMITTED,
        },
        {
          type: METRIC_TYPES.ACTIVITY,
          action: ACTIONS.RESPONSE_SUBMITTED,
        },
      ],
      session,
    );

    // Hunter: received a new response
    await updateUserMetrics(
      post.author,
      [
        {
          type: METRIC_TYPES.HUNTER,
          action: ACTIONS.RESPONSE_RECEIVED,
        },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await response.populate("respondedBy", "name avatar");

    return res.status(201).json({
      success: true,
      message: "Response submitted successfully.",
      response,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    next(err);
  }
};

export const getResponsesByPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(postId).lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 1. Fetch responses
    const responses = await Response.find({ postId })
      .populate("respondedBy", "name avatar rating location")
      .sort({ createdAt: -1 })
      .lean();

    if (!responses.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        responses: [],
      });
    }

    // 2. Collect responder IDs
    const userIds = responses.map((r) => r.respondedBy?._id).filter(Boolean);

    // 3. Fetch all metrics in ONE query
    const metrics = await Metric.find({
      userId: { $in: userIds },
    })
      .select("userId trustScore")
      .lean();

    // 4. Create quick lookup
    const metricMap = new Map(
      metrics.map((m) => [m.userId.toString(), m.trustScore ?? 0]),
    );

    // 5. Attach trust score
    const scoredResponses = responses.map((r) => ({
      ...r,
      trustScore: metricMap.get(r.respondedBy?._id?.toString()) ?? 0,
    }));

    // 6. Sort by trust score, then by newest
    scoredResponses.sort((a, b) => {
      if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.status(200).json({
      success: true,
      count: scoredResponses.length,
      responses: scoredResponses,
    });
  } catch (err) {
    next(err);
  }
};

export const acceptResponse = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { responseId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid response id",
      });
    }

    const response = await Response.findById(responseId).session(session);

    if (!response) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    if (response.status === RESPONSE_STATUS.ACCEPTED) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Response already accepted",
      });
    }

    const post = await Post.findById(response.postId).session(session);

    if (!post) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== userId) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (![POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS].includes(post.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Post is no longer accepting responses",
      });
    }

    response.status = RESPONSE_STATUS.ACCEPTED;
    await response.save({ session });

    post.status = POST_STATUS.IN_PROGRESS;
    await post.save({ session });

    await Response.updateMany(
      {
        postId: post._id,
        _id: { $ne: response._id },
        status: RESPONSE_STATUS.PENDING,
      },
      {
        $set: {
          status: RESPONSE_STATUS.REJECTED,
        },
      },
      { session },
    );

    let conversation = await Conversation.findOne({
      responseId: response._id,
    }).session(session);

    if (!conversation) {
      conversation = (
        await Conversation.create(
          [
            {
              post: post._id,
              responseId: response._id,
              hunter: post.author,
              helper: response.respondedBy,
              participants: [post.author, response.respondedBy],
              status: CONVERSATION_STATUS.ACTIVE,
              responseTracking: {
                acceptedAt: new Date(),
              },
              lastMessage: null,
              lastMessageAt: null,
            },
          ],
          { session },
        )
      )[0];
    }

    const applicants = post?.applicants ?? [];
    post.applicants = [...applicants, response.respondedBy];
    await post.save({ session });

    // Helper: their response was accepted
    await updateUserMetrics(
      response.respondedBy,
      [{ type: METRIC_TYPES.HELPER, action: ACTIONS.RESPONSE_ACCEPTED }],
      session,
    );
    // Hunter: accepted a response
    await updateUserMetrics(
      req.user._id,
      [
        { type: METRIC_TYPES.HUNTER, action: ACTIONS.RESPONSE_ACCEPTED },
        {
          type: METRIC_TYPES.ACTIVITY,
          action: ACTIONS.RESPONSE_ACCEPTED,
        },
        {
          type: METRIC_TYPES.ACTIVITY,
          action: ACTIONS.CONVERSATION_STARTED,
        },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await conversation.populate([
      {
        path: "participants",
        select: "name avatar rating location",
      },
      {
        path: "post",
        select: "title category",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Response accepted successfully",
      response,
      conversation,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const rejectResponse = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { responseId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid response id",
      });
    }

    const response = await Response.findById(responseId).session(session);

    if (!response) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    const post = await Post.findById(response.postId).session(session);

    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (response.status === RESPONSE_STATUS.ACCEPTED) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Accepted response cannot be rejected",
      });
    }

    if (response.status === RESPONSE_STATUS.REJECTED) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Response already rejected",
      });
    }

    response.status = RESPONSE_STATUS.REJECTED;
    await response.save({ session });

    await updateUserMetrics(
      response.respondedBy,
      [
        { type: METRIC_TYPES.HELPER, action: ACTIONS.RESPONSE_CANCELLED },
        { type: METRIC_TYPES.HUNTER, action: ACTIONS.RESPONSE_CANCELLED },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Response rejected successfully",
      response,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const getMyActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const responses = await Response.find({
      respondedBy: userId,
    })
      .populate({
        path: "postId",
        populate: {
          path: "author",
          select: "name avatar rating location",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: responses.length,
      data: responses,
    });
  } catch (error) {
    next(error);
  }
};

export const getResponsesForMyPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const posts = await Post.find({ author: userId }).sort({ createdAt: -1 });

    if (!posts.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const postIds = posts.map((p) => p._id);

    const responses = await Response.find({
      postId: { $in: postIds },
    })
      .populate("respondedBy", "name avatar rating location")
      .sort({ createdAt: -1 });

    const responsesMap = new Map();

    for (const r of responses) {
      const key = r.postId.toString();
      if (!responsesMap.has(key)) responsesMap.set(key, []);
      responsesMap.get(key).push(r);
    }

    const data = posts.map((post) => ({
      post,
      responses: responsesMap.get(post._id.toString()) || [],
    })).filter((item) => item.responses.length > 0);

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllResponses = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { sort = "trustScore" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const postExists = await Post.exists({ _id: postId });

    if (!postExists) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const sortOptions = {
      trustScore: { trustScore: -1, createdAt: -1 },
      earliest: { createdAt: 1 },
      latest: { createdAt: -1 },
    };

    const selectedSort = sortOptions[sort] ?? sortOptions.trustScore;

    const responses = await Response.aggregate([
      {
        $match: {
          postId: new mongoose.Types.ObjectId(postId),
        },
      },

      // Get responder
      {
        $lookup: {
          from: "users",
          localField: "respondedBy",
          foreignField: "_id",
          as: "respondedBy",
        },
      },

      {
        $unwind: {
          path: "$respondedBy",
          preserveNullAndEmptyArrays: false,
        },
      },

      // Get metric
      {
        $lookup: {
          from: "metrics",
          localField: "respondedBy._id",
          foreignField: "userId",
          as: "metric",
        },
      },

      {
        $unwind: {
          path: "$metric",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Extract required metrics
      {
        $set: {
          trustScore: {
            $ifNull: ["$metric.trustScore", 0],
          },

          averageRating: {
            $ifNull: ["$metric.reviewMetrics.averageRating", 0],
          },
        },
      },

      // Sort
      {
        $sort: selectedSort,
      },

      // Only top 50
      {
        $limit: 50,
      },

      // Return only what frontend needs
      {
        $project: {
          _id: 1,
          postId: 1,
          message: 1,
          answers: 1,
          status: 1,
          acceptedAt: 1,
          completedAt: 1,
          cancelledAt: 1,
          createdAt: 1,
          updatedAt: 1,

          trustScore: 1,
          averageRating: 1,

          "respondedBy._id": 1,
          "respondedBy.name": 1,
          "respondedBy.avatar": 1,
          "respondedBy.role": 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: responses.length,
      sort,
      responses,
    });
  } catch (error) {
    next(error);
  }
};
