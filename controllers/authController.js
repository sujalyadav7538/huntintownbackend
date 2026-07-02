import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import User from "../models/userSchema.js";
import { generateAccessToken } from "../utils/generateToken.js";

export const Signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
    });

    const access_token = generateAccessToken({
      _id: user._id,
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      access_token,
      user: userResponse,
    });
  } catch (error) {
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

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

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