import User from "../models/userSchema.js";
import cloudinary from "../utils/cloudinary.js";
import {
  updateUserMetrics,
  getBadgeMetadata,
} from "../service/userMetricService.js";
import { METRIC_TYPES, GEO_TYPE } from "../config/constants.js";
import Metric from "../models/userMetricSchema.js";
import UserBadge from "../models/userBadgeSchema.js";

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

    let { name, role, bio, skills, address, coordinates, phone, website } =
      req.body;

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

    // Parse coordinates coming from multipart/form-data
    if (typeof coordinates === "string") {
      try {
        coordinates = JSON.parse(coordinates);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid coordinates format",
        });
      }
    }

    if (coordinates !== undefined) {
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates.some((c) => typeof c !== "number")
      ) {
        return res.status(400).json({
          success: false,
          message: "Coordinates must be an array of [longitude, latitude]",
        });
      }
    }

    if (name !== undefined) user.name = name.trim();
    if (role !== undefined) user.role = role.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (skills !== undefined) user.skills = skills;
    if (address !== undefined) user.address = address.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (website !== undefined) user.website = website.trim();
    if (coordinates !== undefined) {
      user.location = { type: GEO_TYPE.POINT, coordinates };
    }

    const avatarFile = req.files?.avatar?.[0];
    const coverImageFile = req.files?.coverImage?.[0];

    // Avatar Upload
    if (avatarFile) {
      try {
        if (user.avatar_public_id) {
          await cloudinary.uploader.destroy(user.avatar_public_id);
        }

        user.avatar = avatarFile.path;
        user.avatar_public_id = avatarFile.filename;
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload avatar",
        });
      }
    }

    // Cover Image Upload
    if (coverImageFile) {
      try {
        if (user.coverImage_public_id) {
          await cloudinary.uploader.destroy(user.coverImage_public_id);
        }

        user.coverImage = coverImageFile.path;
        user.coverImage_public_id = coverImageFile.filename;
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload cover image",
        });
      }
    }

    await user.save();

    // Update the user metric for profile completion
    await updateUserMetrics(user._id, [{ type: METRIC_TYPES.PROFILE }]);

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

export const getMyMetric = async (req, res, next) => {
  try {
    const metric = await Metric.findOne({ userId: req.user._id });
    if (!metric) {
      return res
        .status(404)
        .json({ success: false, message: "Metric not found" });
    }
    return res.status(200).json({ success: true, metric });
  } catch (error) {
    next(error);
  }
};

export const getMyBadges = async (req, res, next) => {
  try {
    const userBadge = await UserBadge.findOne({ userId: req.user._id });
    if (!userBadge) {
      return res.status(200).json({ success: true, badges: [] });
    }
    // Enrich each badge with its metadata from BADGE_RULES
    const enriched = userBadge.badges.map((b) => {
      const meta = getBadgeMetadata(b.badgeId) || {};
      return {
        badgeId: b.badgeId,
        level: b.level,
        earnedAt: b.earnedAt,
        name: meta.name || b.badgeId,
        description: meta.description || "",
        icon: meta.icon || "",
        category: meta.category || "general",
        rarity: meta.rarity || "common",
      };
    });
    return res.status(200).json({ success: true, badges: enriched });
  } catch (error) {
    next(error);
  }
};
