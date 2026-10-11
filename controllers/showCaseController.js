import mongoose from "mongoose";
import UserShowcase from "../models/userShowCase.js";

const getUserId = (req) => req.user?._id;
const getShowcaseImageCount = (item) =>
  Number(Boolean(item?.coverImage)) +
  (Array.isArray(item?.gallery) ? item.gallery.length : 0);

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
    return res.status(500).json({
      success: false,
      message: "Unable to fetch showcase",
    });
  }
};

export const returnShowcaseImageUploads = (req, res) => {
  return res.status(201).json({
    success: true,
    images: (req.files ?? []).map((file) => ({
      url: file.path,
      public_id: file.filename,
    })),
  });
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

    if (getShowcaseImageCount(item) > 5) {
      return res.status(400).json({
        success: false,
        message: "A portfolio item can have up to 5 images.",
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

    const updates = { ...req.body };

    const nextItem = { ...item.toObject(), ...updates };
    if (getShowcaseImageCount(nextItem) > 5) {
      return res.status(400).json({
        success: false,
        message: "A portfolio item can have up to 5 images.",
      });
    }

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

    const itemExists = showcase.items.some((item) => item.id === itemId);

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Showcase item not found",
      });
    }

    showcase.items = showcase.items.filter((item) => item.id !== itemId);

    await showcase.save();

    return res.status(200).json({
      success: true,
      message: "Showcase item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete showcase item",
    });
  }
};

export const getFeedPosts = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const showcase = await UserShowcase.findOne({ userId }).lean();
    const items = ((showcase && showcase.items) || []).filter((item) => item.type === "feed");

    return res.status(200).json({
      success: true,
      items: items.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch feed posts",
    });
  }
};

export const createFeedPost = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const description = String(req.body && req.body.description ? req.body.description : "").trim();
    const title = String(req.body && req.body.title ? req.body.title : "").trim();
    const tagsText = String(req.body && req.body.tags ? req.body.tags : "");
    const images = Array.isArray(req.files) ? req.files : [];
    let parsedTags = [];

    if (tagsText) {
      try {
        parsedTags = JSON.parse(tagsText);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid feed tags",
        });
      }
    }

    if (!title || !description || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Feed post requires a title, caption, and at least one image",
      });
    }

    let showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      showcase = new UserShowcase({ userId, items: [] });
    }

    const item = {
      id: String(req.body && req.body.id ? req.body.id : crypto.randomUUID()),
      type: "feed",
      title,
      subtitle: "",
      description,
      organization: "",
      role: "",
      location: "",
      currentlyActive: false,
      startDate: null,
      endDate: null,
      coverImage: images[0]?.path || "",
      coverImage_public_id: images[0]?.filename || "",
      gallery: images.slice(1).map((image) => ({
        url: image.path,
        public_id: image.filename,
      })),
      skills: [],
      tags: Array.isArray(parsedTags) ? parsedTags : [],
      links: [],
      metadata: {
        company: "",
        client: "",
        credential: "",
        year: "",
        duration: "",
        result: "",
        category: "",
      },
    };

    showcase.items.unshift(item);
    await showcase.save();

    return res.status(201).json({
      success: true,
      message: "Feed post created successfully",
      item,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create feed post",
    });
  }
};

export const deleteFeedPost = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const showcase = await UserShowcase.findOne({ userId });

    if (!showcase) {
      return res.status(404).json({
        success: false,
        message: "Feed not found",
      });
    }

    const itemExists = showcase.items.some(
      (item) => item.id === itemId && item.type === "feed",
    );

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: "Feed post not found",
      });
    }

    showcase.items = showcase.items.filter(
      (item) => !(item.id === itemId && item.type === "feed"),
    );
    await showcase.save();

    return res.status(200).json({
      success: true,
      message: "Feed post deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete feed post",
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

    const existingIds = new Set(showcase.items.map((item) => item.id));

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

    const itemMap = new Map(showcase.items.map((item) => [item.id, item]));

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
    return res.status(500).json({
      success: false,
      message: "Unable to reorder showcase",
    });
  }
};
