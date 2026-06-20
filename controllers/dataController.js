import Post from "../models/postSchema.js";

export const getLivePosts = async (req, res) => {
  try {
    const count = await Post.countDocuments({ status: "Live" });

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
