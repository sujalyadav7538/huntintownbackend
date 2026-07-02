import mongoose from "mongoose";

import Conversation from "../models/conversationSchema.js";
import Offer from "../models/offerSchema.js";
import Post from "../models/postSchema.js";
import User from "../models/userSchema.js";

export const createOffer = async (req, res, next) => {
  try {
    const { postId, message, answers } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot offer help on your own post",
      });
    }

    if (post.status !== "live") {
      return res.status(400).json({
        success: false,
        message: "Post is not accepting offers",
      });
    }

    if (post.expiresAt && post.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Post has expired",
      });
    }

    if (answers && !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be an array",
      });
    }

    const existingOffer = await Offer.findOne({
      postId,
      offeredBy: userId,
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted an offer.",
      });
    }

    const offer = await Offer.create({
      postId,
      offeredBy: userId,
      message: message?.trim() || "",
      answers: answers || [],
    });

    post.offersCount += 1;
    await post.save();

    await offer.populate("offeredBy", "name avatar");

    return res.status(201).json({
      success: true,
      message: "Offer submitted successfully.",
      offer,
    });
  } catch (err) {
    next(err);
  }
};

export const getOffersByPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const offers = await Offer.find({
      postId,
    })
      .populate("offeredBy", "name avatar rating location")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (err) {
    next(err);
  }
};

export const acceptOffer = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { offerId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid offer id",
      });
    }

    const offer = await Offer.findById(offerId).session(session);

    if (!offer) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    if (offer.status === "accepted") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Offer already accepted",
      });
    }

    const post = await Post.findById(offer.postId).session(session);

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

    if (post.status !== "live") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Post is no longer accepting offers",
      });
    }

    offer.status = "accepted";
    await offer.save({ session });

    post.status = "in_progress";
    await post.save({ session });

    await Offer.updateMany(
      {
        postId: post._id,
        _id: { $ne: offer._id },
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
        },
      },
      {
        session,
      },
    );

    let conversation = await Conversation.findOne({
      offerId: offer._id,
    }).session(session);

    if (!conversation) {
      conversation = (
        await Conversation.create(
          [
            {
              post: post._id,
              offerId: offer._id,
              participants: [post.author, offer.offeredBy],
              status: "active",
              lastMessage: null,
              lastMessageAt: null,
            },
          ],
          { session },
        )
      )[0];
    }

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
      message: "Offer accepted successfully",
      offer,
      conversation,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const rejectOffer = async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offer id",
      });
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    const post = await Post.findById(offer.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (offer.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: "Accepted offer cannot be rejected",
      });
    }

    if (offer.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "Offer already rejected",
      });
    }

    offer.status = "rejected";
    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Offer rejected successfully",
      offer,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const offers = await Offer.find({
      offeredBy: userId,
    })
      .populate({
        path: "postId",
        populate: {
          path: "author",
          select: "name avatar rating location",
        },
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyResponses = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const posts = await Post.find({
      author: userId,
    }).sort({
      createdAt: -1,
    });

    if (!posts.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const postIds = posts.map((p) => p._id);

    const offers = await Offer.find({
      postId: {
        $in: postIds,
      },
    })
      .populate("offeredBy", "name avatar rating location")
      .sort({
        createdAt: -1,
      });

    const offersMap = new Map();

    for (const offer of offers) {
      const key = offer.postId.toString();

      if (!offersMap.has(key)) {
        offersMap.set(key, []);
      }

      offersMap.get(key).push(offer);
    }

    const response = posts.map((post) => ({
      post,
      offers: offersMap.get(post._id.toString()) || [],
    }));

    return res.status(200).json({
      success: true,
      count: response.length,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};
