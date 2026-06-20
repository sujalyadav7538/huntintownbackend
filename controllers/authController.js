import bcrypt from "bcrypt";
import { supabase } from "../utils/SupaBaseClient.js";
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

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert({
        name,
        email,
        password: hashedPassword,
      })
      .select()
      .single();

    if (error) {
      return next(error);
    }

    delete data.password;

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: data,
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

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    console.log(user);
    if (error || !user) {
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

    const access_token = generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    delete user.password;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      access_token,
      user,
    });
  } catch (error) {
    next(error);
  }
};
