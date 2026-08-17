import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import User from "../models/userSchema.js";
import { generateAccessToken } from "../utils/generateToken.js";
import Metric from "../models/userMetricSchema.js";
import UserBadge from "../models/userBadgeSchema.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import { METRIC_TYPES, ACTIONS } from "../config/constants.js";
export const Signup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [createdUser] = await User.create(
      [
        {
          id: uuidv4(),
          name,
          email,
          password: hashedPassword,
        },
      ],
      { session },
    );

    await Metric.create(
      [
        {
          userId: createdUser._id,
        },
      ],
      { session },
    );

    await UserBadge.create(
      [
        {
          userId: createdUser._id,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    const access_token = generateAccessToken({
      _id: createdUser._id,
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
    });

    const userResponse = createdUser.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      access_token,
      user: userResponse,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const Signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastSeen = new Date();
    await user.save();

    const access_token = generateAccessToken({
      _id: user._id,
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    await updateUserMetrics(user._id, [
      { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.LOGIN },
    ]);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      access_token,
      user: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

export const GoogleSignin = async (req, res, next) => {
  try {
    const { access_token: googleAccessToken } = req.body;

    if (!googleAccessToken) {
      return res.status(400).json({ success: false, message: "Google access token required" });
    }

    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ success: false, message: "Invalid Google token" });
    }

    const { sub: googleId, email, name, picture } = await googleRes.json();

    if (!email) {
      return res.status(400).json({ success: false, message: "Google account has no email" });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const [created] = await User.create(
          [
            {
              id: uuidv4(),
              name: name || email.split("@")[0],
              email,
              password: await bcrypt.hash(uuidv4(), 10),
              avatar: picture || "",
              googleId,
            },
          ],
          { session },
        );
        await Metric.create([{ userId: created._id }], { session });
        await UserBadge.create([{ userId: created._id }], { session });
        await session.commitTransaction();
        session.endSession();
        user = created;
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    } else if (!user.googleId) {
      user.googleId = googleId;
    }

    if (picture && !user.avatar) user.avatar = picture;
    user.lastSeen = new Date();
    await user.save();

    updateUserMetrics(user._id, [
      { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.LOGIN },
    ]).catch(() => {});

    const access_token = generateAccessToken({
      _id: user._id,
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: "Google sign-in successful",
      access_token,
      user: userResponse,
    });
  } catch (error) {
    next(error);
  }
};
