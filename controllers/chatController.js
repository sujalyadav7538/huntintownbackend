import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
// updateResponseMetric removed — was only used in sendMessage (now dead, moved to chatSocket.js)

// DEAD: getMyConversations — GET /api/chat/conversations route is unused.
// The fetchConversations thunk in frontend/src/store/thunks.ts calls this endpoint
// but that thunk is never imported or dispatched anywhere in the app.
// export const getMyConversations = async (req, res, next) => {
//   try {
//     const userId = req.user._id;
//
//     const conversations = await Conversation.find({
//       participants: userId,
//     })
//       .populate("post", "title category budget location status")
//       .populate("participants", "id name avatar role rating location")
//       .sort({ updatedAt: -1 });
//
//     return res.status(200).json({
//       success: true,
//       count: conversations.length,
//       data: conversations,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

/**
 * GET /api/chat/posts
 * Returns the unique posts that have conversations for the current user,
 * aggregated with conversationCount and latest activity time.
 */
export const getPostsWithConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .populate("post", "title category budget address status")
      .sort({ updatedAt: -1 })
      .lean();

    // Group by post, accumulate stats
    const postMap = new Map();
    for (const conv of conversations) {
      if (!conv.post) continue;
      const postId = conv.post._id.toString();
      if (!postMap.has(postId)) {
        postMap.set(postId, {
          _id: conv.post._id,
          title: conv.post.title,
          category: conv.post.category,
          budget: conv.post.budget,
          location: conv.post.address,
          status: conv.post.status,
          conversationCount: 0,
          lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        });
      }
      const entry = postMap.get(postId);
      entry.conversationCount++;
      const convTime = conv.lastMessageAt || conv.updatedAt;
      if (convTime > entry.lastMessageAt) entry.lastMessageAt = convTime;
    }

    return res.status(200).json({
      success: true,
      data: Array.from(postMap.values()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/posts/:postId/conversations
 * Returns all conversations the current user has for a specific post.
 */
export const getConversationsByPost = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const conversations = await Conversation.find({
      participants: userId,
      post: postId,
    })
      .populate("post", "title category budget address status")
      .populate("participants", "id name avatar role rating location")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        isRead: false,
      },
      {
        isRead: true,
        $addToSet: {
          readBy: userId,
        },
      },
    );
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((participant) =>
      participant.equals(userId),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const messages = await Message.find({
      conversationId,
    })
      .populate("sender", "id name avatar")
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// DEAD: sendMessage (HTTP) — POST /api/chat/:conversationId/message is never called from the frontend.
// The frontend exclusively uses the socket "send-message" event (MessageInput.tsx) to send messages.
// The socket handler in chatSocket.js is the live counterpart that handles response metrics too.
// export const sendMessage = async (req, res, next) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//
//   try {
//     const { conversationId } = req.params;
//     const { text } = req.body;
//
//     const userId = req.user._id;
//
//     if (!text?.trim()) {
//       await session.abortTransaction();
//       session.endSession();
//
//       return res.status(400).json({
//         success: false,
//         message: "Message is required",
//       });
//     }
//
//     const conversation =
//       await Conversation.findById(conversationId).session(session);
//
//     if (!conversation) {
//       await session.abortTransaction();
//       session.endSession();
//
//       return res.status(404).json({
//         success: false,
//         message: "Conversation not found",
//       });
//     }
//
//     const isParticipant = conversation.participants.some((participant) =>
//       participant.equals(userId),
//     );
//
//     if (!isParticipant) {
//       await session.abortTransaction();
//       session.endSession();
//
//       return res.status(403).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }
//
//     const [createdMessage] = await Message.create(
//       [
//         {
//           conversationId,
//           sender: userId,
//           text: text.trim(),
//           readBy: [userId],
//         },
//       ],
//       { session },
//     );
//
//     // ----------------------------------------
//     // RESPONSE METRIC
//     // ----------------------------------------
//
//     // First message after offer acceptance
//     if (!conversation.responseTracking.firstMessageAt) {
//       const responseTime = Math.ceil(
//         (createdMessage.createdAt - conversation.responseTracking.acceptedAt) /
//           (1000 * 60),
//       );
//
//       if (
//         conversation.hunter.equals(userId) &&
//         !conversation.responseTracking.hunterCompleted
//       ) {
//         await updateResponseMetric(
//           conversation.hunter,
//           "hunter",
//           responseTime,
//           session,
//         );
//
//         conversation.responseTracking.hunterCompleted = true;
//       } else if (
//         conversation.helper.equals(userId) &&
//         !conversation.responseTracking.helperCompleted
//       ) {
//         await updateResponseMetric(
//           conversation.helper,
//           "helper",
//           responseTime,
//           session,
//         );
//
//         conversation.responseTracking.helperCompleted = true;
//       }
//
//       conversation.responseTracking.firstMessageAt = createdMessage.createdAt;
//     }
//
//     // Second participant's first response
//     else {
//       const responseTime = Math.ceil(
//         (createdMessage.createdAt -
//           conversation.responseTracking.firstMessageAt) /
//           (1000 * 60),
//       );
//
//       if (
//         conversation.hunter.equals(userId) &&
//         !conversation.responseTracking.hunterCompleted
//       ) {
//         await updateResponseMetric(
//           conversation.hunter,
//           "hunter",
//           responseTime,
//           session,
//         );
//
//         conversation.responseTracking.hunterCompleted = true;
//       } else if (
//         conversation.helper.equals(userId) &&
//         !conversation.responseTracking.helperCompleted
//       ) {
//         await updateResponseMetric(
//           conversation.helper,
//           "helper",
//           responseTime,
//           session,
//         );
//
//         conversation.responseTracking.helperCompleted = true;
//       }
//     }
//
//     conversation.lastMessage = createdMessage._id;
//     conversation.lastMessageAt = createdMessage.createdAt;
//
//     await conversation.save({ session });
//
//     await session.commitTransaction();
//     session.endSession();
//
//     return res.status(201).json({
//       success: true,
//       data: createdMessage,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     next(error);
//   }
// };

// DEAD: markMessagesAsRead — PATCH /api/chat/:conversationId/read is never called from the frontend.
// The socket "mark-read" event in chatSocket.js is also never emitted by any frontend code.
// export const markMessagesAsRead = async (req, res, next) => {
//   try {
//     const { conversationId } = req.params;
//     const userId = req.user._id;
//
//     await Message.updateMany(
//       {
//         conversationId,
//         readBy: {
//           $ne: userId,
//         },
//       },
//       {
//         $push: {
//           readBy: userId,
//         },
//       },
//     );
//
//     return res.status(200).json({
//       success: true,
//       message: "Messages marked as read",
//     });
//   } catch (error) {
//     next(error);
//   }
// };
