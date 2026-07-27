import Post from "../models/postSchema.js";
import { POST_STATUS } from "../config/constants.js";

export const getLivePosts = async (req, res) => {
  try {
    const count = await Post.countDocuments({ status: POST_STATUS.LIVE });

    res.status(200).json({
      success: true,
      data: {
        count,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch live posts count",
      error: error.message,
    });
  }
};
