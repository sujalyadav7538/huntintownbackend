import jwt from "jsonwebtoken";

export const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};