import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import User from "../models/userSchema.js";
import { generateAccessToken } from "../utils/generateToken.js";
import Metric from "../models/userMetricSchema.js";
import UserBadge from "../models/userBadgeSchema.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import { METRIC_TYPES, ACTIONS } from "../config/constants.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

const normalizeName = (name) => name.trim().replace(/\s+/g, " ");

const userResponse = (user) => ({
  _id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  coverImage: user.coverImage,
  address: user.address,
  location: user.location,
  isActive: user.isActive,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
});

export const Signup = async (req, res, next) => {
  if (req.body?.acceptedTerms !== true) {
    return res.status(400).json({
      success: false,
      message:
        "Please accept the Terms & Conditions and Privacy Policy before creating an account.",
    });
  }

  const session = await mongoose.startSession();

  try {
    const { name, email, password } = req.body;

    // --------------------------------------------------
    // Basic input validation
    // --------------------------------------------------

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty",
      });
    }

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 100 characters",
      });
    }

    // --------------------------------------------------
    // Email validation
    // --------------------------------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 254 || !emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // --------------------------------------------------
    // Password validation
    // --------------------------------------------------

    const hasRequiredPasswordStrength =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9\s]/.test(password);

    if (!hasRequiredPasswordStrength) {
      return res.status(400).json({
        success: false,
        message:
          "Use at least 8 characters, including one uppercase letter, one number, and one special character (such as ! or #).",
      });
    }

    // --------------------------------------------------
    // Hash password BEFORE transaction
    // --------------------------------------------------

    const passwordHash = await bcrypt.hash(password, 12);

    // --------------------------------------------------
    // Transaction
    // --------------------------------------------------

    let createdUser;

    await session.withTransaction(async () => {
      /*
       * This lookup is useful for returning a friendly error,
       * but the unique email index is still the real protection
       * against concurrent duplicate registrations.
       */
      const existingUser = await User.findOne({
        email: normalizedEmail,
      })
        .select("_id")
        .session(session)
        .lean();

      if (existingUser) {
        const error = new Error("Email already registered");
        error.statusCode = 409;
        error.code = "EMAIL_ALREADY_EXISTS";
        throw error;
      }

      // IMPORTANT:
      // Only explicitly allowed fields are inserted.
      // Never spread req.body here.
      const [user] = await User.create(
        [
          {
            name: normalizedName,
            email: normalizedEmail,
            passwordHash,
            termsAcceptedAt: new Date(),
            isEmailVerified: false,
            isPhoneVerified: false,
            isActive: true,
          },
        ],
        { session },
      );

      createdUser = user;

      // --------------------------------------------------
      // Initial metric
      // --------------------------------------------------

      await Metric.create(
        [
          {
            userId: user._id,
          },
        ],
        { session },
      );

      // --------------------------------------------------
      // Initial badge state
      // --------------------------------------------------

      await UserBadge.create(
        [
          {
            userId: user._id,
          },
        ],
        { session },
      );
    });

    // --------------------------------------------------
    // Generate token AFTER successful transaction
    // --------------------------------------------------

    const access_token = generateAccessToken({
      _id: String(createdUser._id),
      email: createdUser.email,
      name: createdUser.name,
    });

    // --------------------------------------------------
    // Explicit response object
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      access_token,
      user: userResponse(createdUser),
    });
  } catch (error) {
    /*
     * Duplicate-key race condition.
     *
     * Even if two requests pass findOne(),
     * MongoDB's unique index will reject one of them.
     */
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      if (duplicateField === "email") {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }
    }

    if (error?.code === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
};

export const Signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // --------------------------------------------------
    // Validate input
    // --------------------------------------------------

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // --------------------------------------------------
    // Find user
    // --------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    // IMPORTANT:
    // Do not reveal whether the email exists.
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // --------------------------------------------------
    // Account status
    // --------------------------------------------------

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    // --------------------------------------------------
    // Password verification
    // --------------------------------------------------

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // --------------------------------------------------
    // Update last seen
    // --------------------------------------------------

    user.lastSeen = new Date();

    await user.save({
      validateBeforeSave: false,
    });

    // --------------------------------------------------
    // Update metrics
    // --------------------------------------------------

    await updateUserMetrics(user._id, [
      {
        type: METRIC_TYPES.ACTIVITY,
        action: ACTIONS.LOGIN,
      },
    ]);

    // --------------------------------------------------
    // Generate access token
    // --------------------------------------------------

    const access_token = generateAccessToken({
      _id: String(user._id),
      email: user.email,
      name: user.name,
    });

    // --------------------------------------------------
    // Never return the complete mongoose document
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Login successful",
      access_token,
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const GoogleSignin = async (req, res, next) => {
  console.log("[GoogleSignin] Request received");

  try {
    const { access_token: googleAccessToken } = req.body;

    console.log("[GoogleSignin] Access token received:", !!googleAccessToken);

    if (!googleAccessToken) {
      console.log("[GoogleSignin] ERROR: Access token missing");

      return res.status(400).json({
        success: false,
        message: "Google access token required",
      });
    }

    console.log("[GoogleSignin] Calling Google userinfo API");

    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    console.log("[GoogleSignin] Google API status:", googleRes.status);

    if (!googleRes.ok) {
      const errorBody = await googleRes.text();

      console.error("[GoogleSignin] Google API error:", errorBody);

      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const { sub: googleId, email, name, picture } = await googleRes.json();

    console.log("[GoogleSignin] Google user details:", {
      googleId,
      email,
      name,
      hasPicture: !!picture,
    });

    if (!email) {
      console.error("[GoogleSignin] ERROR: Google account has no email");

      return res.status(400).json({
        success: false,
        message: "Google account has no email",
      });
    }

    console.log("[GoogleSignin] Searching for existing user");

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    console.log(
      "[GoogleSignin] Existing user found:",
      !!user,
      user ? String(user._id) : null,
    );

    if (!user) {
      console.log("[GoogleSignin] Creating new user");

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const [created] = await User.create(
          [
            {
              name: name || email.split("@")[0],
              email,
              passwordHash: await bcrypt.hash(
                randomBytes(32).toString("hex"),
                10,
              ),
              avatar: picture || "",
              googleId,
            },
          ],
          { session },
        );

        console.log("[GoogleSignin] User created:", String(created._id));

        await Metric.create([{ userId: created._id }], { session });

        console.log("[GoogleSignin] Metric created");

        await UserBadge.create([{ userId: created._id }], { session });

        console.log("[GoogleSignin] UserBadge created");

        await session.commitTransaction();
        user = created;

        console.log("[GoogleSignin] Transaction committed");
      } catch (err) {
        console.error("[GoogleSignin] User creation failed:", err);

        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    } else if (!user.googleId) {
      console.log("[GoogleSignin] Linking Google ID to existing user");
      user.googleId = googleId;
    }

    if (picture && !user.avatar) {
      user.avatar = picture;
    }

    user.lastSeen = new Date();

    await user.save();

    console.log("[GoogleSignin] User saved successfully");

    updateUserMetrics(user._id, [
      {
        type: METRIC_TYPES.ACTIVITY,
        action: ACTIONS.LOGIN,
      },
    ]).catch((err) => {
      console.error("[GoogleSignin] Metrics update failed:", err);
    });

    console.log("[GoogleSignin] Generating application JWT");

    const access_token = generateAccessToken({
      _id: String(user._id),
      email: user.email,
      name: user.name,
    });

    console.log("[GoogleSignin] Sign-in successful");

    return res.status(200).json({
      success: true,
      message: "Google sign-in successful",
      access_token,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("[GoogleSignin] FATAL ERROR:", error);
    next(error);
  }
};
