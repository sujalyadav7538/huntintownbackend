import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../utils/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "huntintown/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      {
        width: 500,
        height: 500,
        crop: "fill",
        gravity: "face",
      },
    ],
    public_id: `user_${req.user.id}_${Date.now()}`,
  }),
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ── Post-image storage (landscape, no face crop) ──────────────────────────
const postImageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, _file) => ({
    folder: "huntintown/posts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 900, crop: "limit", quality: "auto:best" }],
    public_id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  }),
});

export const uploadPostImages = multer({
  storage: postImageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const chatAttachmentStorage = multer.memoryStorage();

const chatAttachmentFilter = (_req, file, cb) => {
  const allowedMimePrefixes = ["image/", "video/", "audio/"];
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ];

  if (
    allowedMimePrefixes.some((prefix) => file.mimetype.startsWith(prefix)) ||
    allowedMimeTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type for chat attachment"), false);
  }
};

export const uploadChatAttachment = multer({
  storage: chatAttachmentStorage,
  fileFilter: chatAttachmentFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export default upload;
