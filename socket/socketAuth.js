import jwt from "jsonwebtoken";

export default function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded._id) {
      return next(new Error("Invalid token"));
    }

    socket.user = {
      ...decoded,
      _id: String(decoded._id),
    };
    socket.data.userId = String(decoded._id);

    next();
  } catch {
    next(new Error("Invalid token"));
  }
}
