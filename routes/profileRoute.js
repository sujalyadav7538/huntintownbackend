// routes/profileRoute.js

import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();


router.get("/", verifyToken, getProfile);
router.put("/update", verifyToken, upload.single("avatar"), updateProfile);

export default router;
