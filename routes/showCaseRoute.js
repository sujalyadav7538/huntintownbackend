import { Router } from "express";
import {
  addShowcaseItem,
  deleteShowcaseItem,
  getUserShowcase,
  reorderShowcaseItems,
  updateShowcaseItem,
} from "../controllers/showCaseController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", verifyToken, getUserShowcase);

router.post("/items", verifyToken, addShowcaseItem);

router.patch("/items/:itemId", verifyToken, updateShowcaseItem);

router.delete("/items/:itemId", verifyToken, deleteShowcaseItem);

router.patch("/items/reorder", verifyToken, reorderShowcaseItems);

export default router;
