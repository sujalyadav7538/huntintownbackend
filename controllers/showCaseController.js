import mongoose from "mongoose";
import  UserShowcase  from "../models/userShowCase.js";

const getUserId = (req) => req.user?._id;

export const getUserShowcase = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const showcase = await UserShowcase.findOne({ userId }).lean();

    return res.status(200).json({
      success: true,
      showcase: showcase || {
        userId,
        items: [],
      },
    });
  } catch (error) {
    console.error("getUserShowcase error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch showcase",
    });
  }
};

export const addShowcaseItem = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const item = req.body;

    if (!item?.id || !item?.type || !item?.title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "id, type and title are required",
      });
    }

    let showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      showcase = new UserShowcase({
        userId,
        items: [],
      });
    }

    const existingItem = showcase.items.some(
      (existing) => existing.id === item.id,
    );

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: "Showcase item already exists",
      });
    }

    showcase.items.push({
      ...item,
      title: item.title.trim(),
    });

    await showcase.save();

    const createdItem = showcase.items[showcase.items.length - 1];

    return res.status(201).json({
      success: true,
      message: "Showcase item added successfully",
      item: createdItem,
    });
  } catch (error) {
    console.error("addShowcaseItem error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Invalid showcase data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to add showcase item",
    });
  }
};

export const updateShowcaseItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Showcase item id is required",
      });
    }

    const showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      return res.status(404).json({
        success: false,
        message: "Showcase not found",
      });
    }

    const item = showcase.items.find(
      (showcaseItem) => showcaseItem.id === itemId,
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Showcase item not found",
      });
    }

    const updates = req.body;

    delete updates.id;
    delete updates._id;

    Object.assign(item, updates);

    if (updates.title !== undefined) {
      item.title = updates.title.trim();
    }

    await showcase.save();

    return res.status(200).json({
      success: true,
      message: "Showcase item updated successfully",
      item,
    });
  } catch (error) {
    console.error("updateShowcaseItem error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Invalid showcase data",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update showcase item",
    });
  }
};

export const deleteShowcaseItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Showcase item id is required",
      });
    }

    const showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      return res.status(404).json({
        success: false,
        message: "Showcase not found",
      });
    }

    const itemExists = showcase.items.some(
      (item) => item.id === itemId,
    );

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Showcase item not found",
      });
    }

    showcase.items = showcase.items.filter(
      (item) => item.id !== itemId,
    );

    await showcase.save();

    return res.status(200).json({
      success: true,
      message: "Showcase item deleted successfully",
    });
  } catch (error) {
    console.error("deleteShowcaseItem error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete showcase item",
    });
  }
};

export const reorderShowcaseItems = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemIds } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({
        success: false,
        message: "itemIds must be an array",
      });
    }

    const showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      return res.status(404).json({
        success: false,
        message: "Showcase not found",
      });
    }

    const existingIds = new Set(
      showcase.items.map((item) => item.id),
    );

    const requestedIds = new Set(itemIds);

    if (
      requestedIds.size !== itemIds.length ||
      requestedIds.size !== existingIds.size ||
      [...requestedIds].some((id) => !existingIds.has(id))
    ) {
      return res.status(400).json({
        success: false,
        message: "itemIds must contain every showcase item exactly once",
      });
    }

    const itemMap = new Map(
      showcase.items.map((item) => [item.id, item]),
    );

    showcase.items = itemIds.map((id, index) => {
      const item = itemMap.get(id);
      item.order = index;
      return item;
    });

    await showcase.save();

    return res.status(200).json({
      success: true,
      message: "Showcase reordered successfully",
      items: showcase.items,
    });
  } catch (error) {
    console.error("reorderShowcaseItems error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reorder showcase",
    });
  }
};