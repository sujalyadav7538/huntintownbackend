// routes/postRoute.js

import express from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getAvailablePosts,
} from "../controllers/postController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { uploadPostImages } from "../middlewares/uploadMiddleware.js";
import { geoCode } from "../utils/geoCode.js";

const router = express.Router();

router.post("/", verifyToken, uploadPostImages.array("images", 3), createPost);

router.get("/", getAllPosts);
router.get("/getAvailablePosts", verifyToken, getAvailablePosts);
router.get("/:id", getPostById);


router.put("/:id", verifyToken, updatePost);

router.delete("/:id", verifyToken, deletePost);

export default router;
