import mongoose from "mongoose";
import Post from "../models/postSchema.js";
import Offer from "../models/offerSchema.js";

export const createPost = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      location,
      type,
      budget,
      timeline,
      expiryDays,
      expiresAt,
      questions,
      contactMethods,
      images,
    } = req.body;

    if (!title || !description || !category || !location) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    const post = await Post.create({
      title,
      description,
      category,
      location,
      type,
      budget,
      timeline,
      expiryDays,
      expiresAt,
      questions: questions || [],
      contactMethods,
      images: images || [],
      author: req.user._id,
    });

    await post.populate("author", "name avatar email rating location");

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
    const posts = await Post.find()
      .populate("author", "name avatar rating location")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: posts.length,
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

    const post = await Post.findById(id)
      .populate("author", "name avatar rating location")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "name avatar rating location",
        },
      });

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

    Object.assign(post, req.body);

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

    await Offer.deleteMany(
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

export const getAvailablePosts = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const appliedOffers = await Offer.find({
      offeredBy: userId,
    }).select("postId");

    const appliedPostIds = appliedOffers.map((offer) => offer.postId);

    const posts = await Post.find({
      author: {
        $ne: userId,
      },
      _id: {
        $nin: appliedPostIds,
      },
      status: "live",
    })
      .populate("author", "name avatar rating location")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error) {
    next(error);
  }
};
