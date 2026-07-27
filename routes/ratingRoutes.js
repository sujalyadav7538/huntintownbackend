import express from 'express';
import { rateUser, getUserReviews } from '../controllers/ratingController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post("/", verifyToken, rateUser);
router.get("/user/:userId", getUserReviews);

export default router;