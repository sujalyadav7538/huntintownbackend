import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    offeredBy: {
      id: {
        type: String,
        required: true,
      },
      name: String,
      email: String,
      avatar: String,
    },

    message: {
      type: String,
      default: "",
    },

    answers: [answerSchema],

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Offer", offerSchema);