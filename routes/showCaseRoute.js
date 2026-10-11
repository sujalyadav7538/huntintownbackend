import { Router } from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import {
  addShowcaseItem,
  deleteShowcaseItem,
  getUserShowcase,
  returnShowcaseImageUploads,
  reorderShowcaseItems,
  updateShowcaseItem,
} from "../controllers/showCaseController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { uploadShowcaseImages } from "../middlewares/uploadMiddleware.js";

const router = Router();

router.get("/", verifyToken, getUserShowcase);

router.post("/images", verifyToken, (req, res, next) => {
  uploadShowcaseImages.array("images", 5)(req, res, async (error) => {
    if (!error) return returnShowcaseImageUploads(req, res, next);

    await Promise.allSettled(
      (req.files ?? [])
        .filter((file) => file?.filename)
        .map((file) => cloudinary.uploader.destroy(file.filename)),
    );

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_COUNT"
          ? "You can upload up to 5 portfolio images."
          : error.code === "LIMIT_FILE_SIZE"
            ? "Each image must be 5 MB or smaller."
            : "Unable to upload these images.";
      return res.status(400).json({ success: false, message });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to upload these images.",
    });
  });
});

router.post("/items", verifyToken, addShowcaseItem);

router.patch("/items/:itemId", verifyToken, updateShowcaseItem);

router.delete("/items/:itemId", verifyToken, deleteShowcaseItem);

router.patch("/items/reorder", verifyToken, reorderShowcaseItems);

export default router;
