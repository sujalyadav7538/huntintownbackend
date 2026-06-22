// controller/profileController.js

import cloudinary from "../utils/cloudinary.js";
import { supabase } from "../utils/SupaBaseClient.js";

export const getProfile = async (req, res, next) => {
  try {
    const { id } = req.user;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return next(error);

    delete data.password;

    res.status(200).json({
      success: true,
      user: data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.user;

    let { name, role, location, bio, skills } = req.body;

    // Parse skills if received from FormData
    if (typeof skills === "string") {
      try {
        skills = JSON.parse(skills);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid skills format",
        });
      }
    }

    // Get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatePayload = {};

    // Only update fields that are actually provided
    if (name !== undefined) updatePayload.name = name.trim();
    if (role !== undefined) updatePayload.role = role.trim();
    if (location !== undefined) updatePayload.location = location.trim();
    if (bio !== undefined) updatePayload.bio = bio.trim();
    if (skills !== undefined) updatePayload.skills = skills;
    console.log("FILE:", req.file);
    console.log("BODY:", req.body);
    // Handle avatar update
    if (req.file) {
      try {
        // Delete previous avatar if exists
        if (existingUser.avatar_public_id) {
          await cloudinary.uploader.destroy(existingUser.avatar_public_id);
        }

        updatePayload.avatar = req.file.path;
        updatePayload.avatar_public_id = req.file.filename;
      } catch (cloudinaryError) {
        return res.status(500).json({
          success: false,
          message: "Failed to process avatar image",
        });
      }
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return next(updateError);
    }

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }

    delete updatedUser.password;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
