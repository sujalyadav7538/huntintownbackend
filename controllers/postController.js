// controllers/postController.js

import Post from "../models/postSchema.js";
import Offer from "../models/offerSchema.js";
import { supabase } from "../utils/SupaBaseClient.js";

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
      status,
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
    const user = req.user;

    const { data: profile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    const author = {
      id: profile?.id,
      name: profile?.name,
      email: profile?.email,
      avatar: profile?.avatar,
    };
    console.log("Profile data:", author);

    const post = await Post.create({
      title,
      description,
      category,
      location,
      type,
      budget,
      timeline,
      status,
      expiryDays,
      expiresAt,
      questions,
      contactMethods,
      images,
      author,
    });

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
    const posts = await Post.find().sort({ createdAt: -1 });

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

    const post = await Post.findById(id);

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

    const post = await Post.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

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
  try {
    const { id } = req.params;

    const post = await Post.findByIdAndDelete(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailablePosts = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const appliedOffers = await Offer.find({
      "offeredBy.id": userId,
    }).select("postId");

    const appliedPostIds = appliedOffers.map((offer) => offer.postId);

    const posts = await Post.find({
      "author.id": { $ne: userId }, // not own post
      _id: { $nin: appliedPostIds }, // not applied
      status: "Live", // only live posts
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts: posts,
    });
  } catch (error) {
    next(error);
  }
};
