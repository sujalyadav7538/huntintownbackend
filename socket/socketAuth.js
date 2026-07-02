import jwt from "jsonwebtoken";

export default function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    console.log("[Socket Auth] Token received:", token ? "✅ Present" : "❌ Missing");
    if (token) console.log("[Socket Auth] Token length:", token.length);
    
    if (!token) {
      console.log("[Socket Auth] Rejecting: No token provided");
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[Socket Auth] Token verified for user:", decoded.id);

    socket.user = decoded;

    next();
  } catch (err) {
    console.error("[Socket Auth] JWT verification failed:", err.message);
    next(new Error("Invalid token"));
  }
}
