import Offer from "../models/offerSchema.js";
import Post from "../models/postSchema.js";
import { supabase } from "../utils/SupaBaseClient.js";

export const createOffer = async (req, res, next) => {
  try {
    const { postId, message, answers } = req.body;

    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!postId) {
      return res.status(400).json({
        success: false,
        message: "Post id is required",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.id === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot submit an offer on your own post",
      });
    }

    if (post.status !== "Live") {
      return res.status(400).json({
        success: false,
        message: "This post is no longer accepting offers",
      });
    }

    if (post.expiresAt && new Date(post.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "This post has expired",
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
      "offeredBy.id": userId,
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted an offer for this post",
      });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id,name,email,avatar")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const offer = await Offer.create({
      postId,
      message,
      answers: answers || [],
      offeredBy: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });

    await Post.findByIdAndUpdate(postId, {
      $inc: { offersCount: 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Offer submitted successfully",
      offer,
    });
  } catch (error) {
    next(error);
  }
};

export const getOffersByPost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view these offers",
      });
    }

    const offers = await Offer.find({
      postId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: offers.length,
      offers,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptOffer = async (req, res, next) => {
  try {
    const { offerId } = req.params;

    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    if (offer.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: "Offer already accepted",
      });
    }

    const post = await Post.findById(offer.postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized",
      });
    }

    if (post.status === "resolved") {
      return res.status(400).json({
        success: false,
        message: "Post is already resolved",
      });
    }

    offer.status = "accepted";
    await offer.save();

    await Offer.updateMany(
      {
        postId: offer.postId,
        _id: { $ne: offerId },
        status: "pending",
      },
      {
        status: "rejected",
      },
    );

    post.status = "resolved";
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Offer accepted successfully",
      offer,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectOffer = async (req, res, next) => {
  try {
    const { offerId } = req.params;

    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
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

    if (post.author.id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized",
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
    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const offers = await Offer.find({
      "offeredBy.id": userId,
    }).sort({
      createdAt: -1,
    });

    if (!offers.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const postIds = offers.map((offer) => offer.postId);

    const posts = await Post.find({
      _id: { $in: postIds },
    });

    const postMap = new Map();

    posts.forEach((post) => {
      postMap.set(post._id.toString(), post);
    });

    const activity = offers
      .map((offer) => ({
        post: postMap.get(offer.postId.toString()),
        offer,
      }))
      .filter((item) => item.post);

    return res.status(200).json({
      success: true,
      count: activity.length,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyResponses = async (req, res, next) => {
  try {
    const userId = req?.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const posts = await Post.find({
      "author.id": userId,
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

    const postIds = posts.map((post) => post._id);

    const offers = await Offer.find({
      postId: { $in: postIds },
    }).sort({
      createdAt: -1,
    });

    const offersMap = {};

    offers.forEach((offer) => {
      const key = offer.postId.toString();

      if (!offersMap[key]) {
        offersMap[key] = [];
      }

      offersMap[key].push(offer);
    });

    const data = posts.map((post) => ({
      post,
      offers: offersMap[post._id.toString()] || [],
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};
