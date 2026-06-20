// routes/profileRoute.js

import express from "express";
import {
  getProfile,
  updateProfile,
} from "../controllers/profileController.js";
import  { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getProfile);
router.put("/update", verifyToken, updateProfile);

export default router;