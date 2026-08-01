// routes/postRoute.js

import express from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getAvailablePosts,
  markPostCompleted,
} from "../controllers/postController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { uploadPostImages } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post("/", verifyToken, uploadPostImages.array("images", 3), createPost);

router.get("/", getAllPosts);
router.get("/getAvailablePosts", verifyToken, getAvailablePosts);
router.get("/:id", getPostById);

router.patch("/:id/complete", verifyToken, markPostCompleted);
router.put("/:id", verifyToken, updatePost);

router.delete("/:id", verifyToken, deletePost);

export default router;
