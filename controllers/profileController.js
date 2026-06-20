// controller/profileController.js

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

    const { name, role, location, bio, skills, avatar } = req.body;

    const { data, error } = await supabase
      .from("users")
      .update({
        name,
        role,
        location,
        bio,
        skills,
        avatar,
      })
      .eq("id", id)
      .select()
      .single();
    console.log("Updated profile data:", data);
    if (error) return next(error);

    delete data.password;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: data,
    });
  } catch (error) {
    next(error);
  }
};
