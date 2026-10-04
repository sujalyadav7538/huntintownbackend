import jwt from "jsonwebtoken";
import User from "../models/userSchema.js";

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded._id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const user = await User.findById(decoded._id).select("_id").lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Expose the id under both keys as strings: controllers use `_id` and
    // `id` interchangeably, and the JWT payload itself only carries `_id`.
    req.user = {
      ...decoded,
      _id: String(user._id),
      id: String(user._id),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};
