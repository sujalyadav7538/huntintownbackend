import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { uploadPostImages } from "../middlewares/uploadMiddleware.js";
import {
  createFeedPost,
  deleteFeedPost,
  getFeedPosts,
} from "../controllers/showCaseController.js";

const router = Router();

router.get("/", verifyToken, getFeedPosts);
router.post("/", verifyToken, uploadPostImages.array("images", 10), createFeedPost);
router.delete("/:itemId", verifyToken, deleteFeedPost);

export default router;
