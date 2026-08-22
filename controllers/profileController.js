import User from "../models/userSchema.js";
import cloudinary from "../utils/cloudinary.js";
import {
  updateUserMetrics,
  getBadgeMetadata,
} from "../service/userMetricService.js";
import { METRIC_TYPES, GEO_TYPE } from "../config/constants.js";
import Metric from "../models/userMetricSchema.js";
import UserBadge from "../models/userBadgeSchema.js";
import Post from "../models/postSchema.js";

export const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, metric, post] = await Promise.all([
      User.findById(userId)
        .select("-passwordHash -googleId -__v")
        // .populate({
        //   path: "showcase",
        // })
        .lean(),

      Metric.findOne({
        userId,
      })
        .select("-userId -__v")
        .lean(),

      Post.find({ author: userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!metric) {
      return res.status(500).json({
        success: false,
        message: "User metric data is missing",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        metric,
      },
      posts: post,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    // --------------------------------------------------
    // Validate public user ID
    // --------------------------------------------------

    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const publicUserId = id.trim();

    // --------------------------------------------------
    // Fetch user + metric in parallel
    // --------------------------------------------------

    const user = await User.findOne({
      id: publicUserId,
      isActive: true,
    })
      .select(
        [
          "id",
          "name",
          "bio",
          "role",
          "avatar",
          "coverImage",
          "website",
          "skills",
          "isEmailVerified",
          "isPhoneVerified",
          "governmentVerificationStatus",
          "isOnline",
          "lastSeen",
          "createdAt",
        ].join(" "),
      )

      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const [metric, post] = await Promise.all([
      Metric.findOne({
        userId: publicUserId,
      })
        .select(
          [
            "reviewMetrics",
            "profileMetrics",
            "helperMetrics",
            "hunterMetrics",
            "responseMetrics",
            "activityMetrics",
            "trustScore",
          ].join(" "),
        )
        .lean(),

      Post.find({
        author: publicUserId,
        status: METRIC_TYPES.POST_STATUS.LIVE,
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // --------------------------------------------------
    // Public response
    // --------------------------------------------------

    delete user._id;

    return res.status(200).json({
      success: true,

      user: {
        ...user,

        metric: metric
          ? {
              reviewMetrics: metric.reviewMetrics,
              profileMetrics: metric.profileMetrics,
              helperMetrics: metric.helperMetrics,
              hunterMetrics: metric.hunterMetrics,
              responseMetrics: metric.responseMetrics,
              activityMetrics: metric.activityMetrics,
              trustScore: metric.trustScore,
            }
          : null,
        posts: post,
      },
    });
  } catch (error) {
    next(error);
  }
};

const normalizeString = (value) => {
  return typeof value === "string" ? value.trim() : value;
};

const parseJSONField = (value, fieldName) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`Invalid ${fieldName} format`);
    error.statusCode = 400;
    throw error;
  }
};

const isValidCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [longitude, latitude] = coordinates;

  return (
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
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

    // --------------------------------------------------
    // Parse multipart/form-data fields
    // --------------------------------------------------

    let { name, role, bio, skills, address, coordinates, phone, website } =
      req.body;

    skills = parseJSONField(skills, "skills");
    coordinates = parseJSONField(coordinates, "coordinates");

    // --------------------------------------------------
    // Validate fields before modifying user
    // --------------------------------------------------

    if (name !== undefined) {
      if (typeof name !== "string") {
        return res.status(400).json({
          success: false,
          message: "Name must be a string",
        });
      }

      name = name.trim();

      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 100 characters",
        });
      }
    }

    if (role !== undefined) {
      if (typeof role !== "string") {
        return res.status(400).json({
          success: false,
          message: "Role must be a string",
        });
      }

      role = role.trim();

      if (role.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Role cannot exceed 100 characters",
        });
      }
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({
          success: false,
          message: "Bio must be a string",
        });
      }

      bio = bio.trim();

      if (bio.length > 700) {
        return res.status(400).json({
          success: false,
          message: "Bio cannot exceed 700 characters",
        });
      }
    }

    if (address !== undefined) {
      if (typeof address !== "string") {
        return res.status(400).json({
          success: false,
          message: "Address must be a string",
        });
      }

      address = address.trim();

      if (address.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Address cannot exceed 500 characters",
        });
      }
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be a string",
        });
      }

      phone = phone.trim();
    }

    if (website !== undefined) {
      if (typeof website !== "string") {
        return res.status(400).json({
          success: false,
          message: "Website must be a string",
        });
      }

      website = website.trim();
    }

    // --------------------------------------------------
    // Validate skills
    // --------------------------------------------------

    if (skills !== undefined) {
      if (!Array.isArray(skills)) {
        return res.status(400).json({
          success: false,
          message: "Skills must be an array",
        });
      }

      if (skills.length > 50) {
        return res.status(400).json({
          success: false,
          message: "You cannot have more than 50 skills",
        });
      }

      const invalidSkill = skills.some(
        (skill) =>
          typeof skill !== "string" ||
          !skill.trim() ||
          skill.trim().length > 100,
      );

      if (invalidSkill) {
        return res.status(400).json({
          success: false,
          message: "Each skill must be a valid string",
        });
      }

      skills = [...new Set(skills.map((skill) => skill.trim()))];
    }

    // --------------------------------------------------
    // Validate coordinates
    // --------------------------------------------------

    if (coordinates !== undefined && coordinates !== null) {
      if (!isValidCoordinates(coordinates)) {
        return res.status(400).json({
          success: false,
          message:
            "Coordinates must be [longitude, latitude] with valid ranges",
        });
      }
    }

    // --------------------------------------------------
    // Apply profile changes
    // --------------------------------------------------

    if (name !== undefined) {
      user.name = name;
    }

    if (role !== undefined) {
      user.role = role;
    }

    if (bio !== undefined) {
      user.bio = bio;
    }

    if (skills !== undefined) {
      user.skills = skills;
    }

    if (address !== undefined) {
      user.address = address;
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (website !== undefined) {
      user.website = website;
    }

    // --------------------------------------------------
    // Location
    // --------------------------------------------------

    if (coordinates !== undefined) {
      if (coordinates === null) {
        // Allow user to remove location.
        user.location = undefined;
      } else {
        user.location = {
          type: GEO_TYPE.POINT,
          coordinates,
        };
      }
    }

    // --------------------------------------------------
    // Files
    // --------------------------------------------------

    const avatarFile = req.files?.avatar?.[0];
    const coverImageFile = req.files?.coverImage?.[0];

    let oldAvatarPublicId = null;
    let oldCoverPublicId = null;

    // --------------------------------------------------
    // Avatar
    // --------------------------------------------------

    if (avatarFile) {
      oldAvatarPublicId = user.avatar_public_id || null;

      user.avatar = avatarFile.path;
      user.avatar_public_id = avatarFile.filename;
    }

    // --------------------------------------------------
    // Cover image
    // --------------------------------------------------

    if (coverImageFile) {
      oldCoverPublicId = user.coverImage_public_id || null;

      user.coverImage = coverImageFile.path;
      user.coverImage_public_id = coverImageFile.filename;
    }

    // --------------------------------------------------
    // Save user
    // --------------------------------------------------

    await user.save();

    // --------------------------------------------------
    // Delete old Cloudinary assets AFTER DB succeeds
    // --------------------------------------------------

    const cloudinaryDeletePromises = [];

    if (oldAvatarPublicId && oldAvatarPublicId !== user.avatar_public_id) {
      cloudinaryDeletePromises.push(
        cloudinary.uploader.destroy(oldAvatarPublicId),
      );
    }

    if (oldCoverPublicId && oldCoverPublicId !== user.coverImage_public_id) {
      cloudinaryDeletePromises.push(
        cloudinary.uploader.destroy(oldCoverPublicId),
      );
    }

    if (cloudinaryDeletePromises.length) {
      await Promise.allSettled(cloudinaryDeletePromises);
    }

    // --------------------------------------------------
    // Update profile metric
    // --------------------------------------------------

    await updateUserMetrics(user._id, [
      {
        type: METRIC_TYPES.PROFILE,
      },
    ]);

    // --------------------------------------------------
    // Return sanitized user
    // --------------------------------------------------

    const updatedUser = await User.findById(user._id)
      .select("-passwordHash -googleId -__v")
      // .populate({
      //   path: "showcase",
      //   select: "-__v",
      // })
      .lean();

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
