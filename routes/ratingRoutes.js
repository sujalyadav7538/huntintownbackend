import express from 'express';
import { rateUser, getUserReviews, reviewOwner, getReviewStatus } from '../controllers/ratingController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post("/", verifyToken, rateUser);
router.post("/review-owner", verifyToken, reviewOwner);
router.get("/review-status/:postId", verifyToken, getReviewStatus);
router.get("/user/:userId", getUserReviews);

export default router;