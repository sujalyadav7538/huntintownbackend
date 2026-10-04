// routes/postRoute.js

import express from "express";
import multer from "multer";
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
const MAX_POST_IMAGES = 4;

router.post("/", verifyToken, (req, res, next) => {
  uploadPostImages.array("images", MAX_POST_IMAGES)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: `You can upload up to ${MAX_POST_IMAGES} images only.`,
        });
      }

      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          message: "Unexpected upload field. Use the 'images' field.",
        });
      }

      return next(err);
    }

    if (err) {
      return next(err);
    }

    return createPost(req, res, next);
  });
});

router.get("/", getAllPosts);
router.get("/getAvailablePosts", verifyToken, getAvailablePosts);
router.get("/:id", getPostById);

router.patch("/:id/complete", verifyToken, markPostCompleted);
router.put("/:id", verifyToken, updatePost);

router.delete("/:id", verifyToken, deletePost);

export default router;
