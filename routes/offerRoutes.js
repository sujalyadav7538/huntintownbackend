import express from "express";
import {
  createOffer,
  getOffersByPost,
  acceptOffer,
  rejectOffer,
  getMyActivity,
  getMyResponses,
} from "../controllers/offerController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// To Create an Offer
router.post("/", verifyToken, createOffer);

// To Get Offers for a Post
router.get("/post/:postId", verifyToken, getOffersByPost);

// To Accept an Offer
router.patch("/:offerId/accept", verifyToken, acceptOffer);

// To Reject an Offer
router.patch("/:offerId/reject", verifyToken, rejectOffer);

// To Get My Activity
router.get("/my-activity", verifyToken, getMyActivity);

// To Get My Responses
router.get("/responses", verifyToken, getMyResponses);

export default router;
