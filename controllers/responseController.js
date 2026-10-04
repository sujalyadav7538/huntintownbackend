import mongoose from "mongoose";

import Conversation from "../models/conversationSchema.js";
import Response from "../models/responseSchema.js";
import Post from "../models/postSchema.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import {
  METRIC_TYPES,
  ACTIONS,
  POST_STATUS,
  RESPONSE_STATUS,
  CONVERSATION_STATUS,
} from "../config/constants.js";
import { NotificationManager } from "../utils/notificationManager.js";

export const createResponse = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { postId, message, answers } = req.body;
    const helperId = req.user._id;

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

    if (post.author.toString() === helperId.toString()) {
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
      respondedBy: helperId,
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
          respondedBy: helperId,
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
      helperId,
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

    await response.populate("respondedBy", "_id name avatar");

    // Notify User.....
    await NotificationManager.newResponse({
      userId: post.author,
      post,
      response,
    });
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

export const acceptResponse = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { responseId } = req.params;
    const hunterId = req.user._id;

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

    if (post.author.toString() !== hunterId.toString()) {
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

    // Helper: their response was accepted
    await updateUserMetrics(
      response.respondedBy,
      [
        {
          type: METRIC_TYPES.HELPER,
          action: ACTIONS.RESPONSE_ACCEPTED,
        },
      ],
      session,
    );

    // Hunter: accepted a response
    await updateUserMetrics(
      hunterId,
      [
        {
          type: METRIC_TYPES.HUNTER,
          action: ACTIONS.RESPONSE_ACCEPTED,
        },
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
        select: "_id name avatar rating location",
      },
      {
        path: "post",
        select: "_id title category",
      },
    ]);

    await response.populate("respondedBy", "_id name avatar");
    await NotificationManager.offerAccepted({
      userId: response.respondedBy._id,
      post,
      offer: response,
    });

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
    const hunterId = req.user._id;

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

    if (post.author.toString() !== hunterId.toString()) {
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

    // Only the helper has a counter for a cancelled response — passing
    // RESPONSE_CANCELLED to the hunter metric throws "Invalid Hunter Action".
    await updateUserMetrics(
      response.respondedBy,
      [
        {
          type: METRIC_TYPES.HELPER,
          action: ACTIONS.RESPONSE_CANCELLED,
        },
      ],
      session,
    );

    await session.commitTransaction();
    session.endSession();

    await response.populate("respondedBy", "_id name avatar");
    await NotificationManager.offerRejected({
      userId: response.respondedBy._id,
      post,
      offer: response,
    });

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

export const reconsiderResponse = async (req, res, next) => {
  try {
    const { responseId } = req.params;
    const ownerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(responseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid response id",
      });
    }

    const response = await Response.findById(responseId);
    if (!response) {
      return res.status(404).json({
        success: false,
        message: "Response not found",
      });
    }

    const post = await Post.findById(response.postId).select("author");
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== ownerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (response.status !== RESPONSE_STATUS.REJECTED) {
      return res.status(400).json({
        success: false,
        message: "Only rejected responses can be reconsidered",
      });
    }

    response.status = RESPONSE_STATUS.PENDING;
    await response.save();

    return res.status(200).json({
      success: true,
      message: "Response moved back to pending",
      response,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const responses = await Response.find({
      respondedBy: userId,
    })
      .select(
        "postId message answers status acceptedAt completedAt cancelledAt createdAt updatedAt",
      )
      .populate({
        path: "postId",
        select:
          "_id title description category address location budget timeline images status expiresAt author responsesCount createdAt",
        populate: {
          path: "author",
          select: "_id name avatar role location",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: responses.length,
      data: responses,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const posts = await Post.find({
      author: userId,
    })
      .select(
        "_id title description category address location budget timeline images status expiresAt responsesCount createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: posts.length,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllResponses = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { sort = "trustScore" } = req.query;
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const userId = req.user._id;
    const paginated = req.query.pagination === "true";
    const page = paginated
      ? Math.max(1, parseInt(req.query.page, 10) || 1)
      : 1;
    const limit = paginated
      ? Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 10))
      : Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(postId).select("author").lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Only the post owner may read the actual applications. Everyone else gets
    // the responder list without the private message and screening answers.
    const isOwner = post.author.toString() === userId.toString();

    if (status && !Object.values(RESPONSE_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid response status",
      });
    }

    const responseMatch = {
      postId: new mongoose.Types.ObjectId(postId),
      ...(status ? { status } : {}),
    };

    const sortOptions = {
      trustScore: {
        trustScore: -1,
        createdAt: -1,
      },
      trustScoreAsc: {
        trustScore: 1,
        createdAt: -1,
      },
      trustScoreDesc: {
        trustScore: -1,
        createdAt: -1,
      },
      ratingAsc: {
        averageRating: 1,
        trustScore: -1,
        createdAt: -1,
      },
      ratingDesc: {
        averageRating: -1,
        trustScore: -1,
        createdAt: -1,
      },
      earliest: {
        createdAt: 1,
      },
      latest: {
        createdAt: -1,
      },
    };

    const selectedSort = sortOptions[sort] ?? sortOptions.trustScore;

    const responses = await Response.aggregate([
      {
        $match: {
          ...responseMatch,
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

      ...(paginated ? [{ $skip: skip }] : []),

      {
        $limit: limit,
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

    const visibleResponses = isOwner
      ? responses
      : responses.map(({ message, answers, ...rest }) => rest);
    const total = paginated
      ? await Response.countDocuments(responseMatch).exec()
      : visibleResponses.length;

    return res.status(200).json({
      success: true,
      count: visibleResponses.length,
      sort,
      isOwner,
      responses: visibleResponses,
      ...(paginated && {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + visibleResponses.length < total,
        },
      }),
    });
  } catch (error) {
    next(error);
  }
};
