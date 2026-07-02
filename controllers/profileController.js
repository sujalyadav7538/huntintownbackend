import User from "../models/userSchema.js";
import cloudinary from "../utils/cloudinary.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let { name, role, location, bio, skills } = req.body;

    // Parse skills coming from multipart/form-data
    if (typeof skills === "string") {
      try {
        skills = JSON.parse(skills);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid skills format",
        });
      }
    }

    if (name !== undefined) user.name = name.trim();
    if (role !== undefined) user.role = role.trim();
    if (location !== undefined) user.location = location.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (skills !== undefined) user.skills = skills;

    // Avatar Upload
    if (req.file) {
      try {
        if (user.avatar_public_id) {
          await cloudinary.uploader.destroy(user.avatar_public_id);
        }

        user.avatar = req.file.path;
        user.avatar_public_id = req.file.filename;
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload avatar",
        });
      }
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
