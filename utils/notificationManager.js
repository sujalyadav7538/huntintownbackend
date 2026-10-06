import {
  NOTIFICATION_TYPES,
  NOTIFICATION_ACTIONS,
} from "../config/constants.js";
import Notification from "../models/notificationSchema.js";
import { enqueueNotification } from "../service/notification/notificationQueue.js";

const createNotification = async (userId, metadata) => {
  try {
    const notification = await Notification.create({
      recipient: userId,
      type: metadata.type,
      action: metadata.action,
      title: metadata.title,
      message: metadata.message,
      data: metadata.data || {},
      link: metadata.link || null,
    });

    try {
      await enqueueNotification(notification._id);
    } catch (error) {
      console.error(
        "[NotificationManager] Push queue unavailable:",
        error.message,
      );
    }

    return notification;
  } catch (error) {
    console.error(
      "[NotificationManager] Failed to create notification:",
      error.message,
    );

    return null;
  }
};

export const NotificationManager = {
  create: createNotification,

  newResponse: async ({ userId, post, response }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.RESPONSE,
      action: NOTIFICATION_ACTIONS.NEW_RESPONSE,

      title: "New response on your post",

      message: `${response.respondedBy.name} responded to "${post.title}"`,

      data: {
        postId: post._id,
        responseId: response._id,
        responder: {
          _id: response.respondedBy._id,
          name: response.respondedBy.name,
          avatar: response.respondedBy.avatar,
        },
      },

      link: "/dashboard",
    });
  },

  newMessage: async ({ userId, conversationId, sender, message }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.MESSAGE,
      action: NOTIFICATION_ACTIONS.NEW_MESSAGE,

      title: `New message from ${sender.name}`,

      message: message.text,

      data: {
        conversationId,
        messageId: message._id,
        sender: {
          _id: sender._id,
          name: sender.name,
          avatar: sender.avatar,
        },
      },

      link: `/messaging?conversationId=${conversationId}`,
    });
  },

  offerReceived: async ({ userId, post, offer }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.OFFER,
      action: NOTIFICATION_ACTIONS.OFFER_RECEIVED,

      title: "New offer received",

      message: `${offer.user.name} sent an offer for "${post.title}"`,

      data: {
        postId: post._id,
        offerId: offer._id,
        sender: {
          _id: offer.user._id,
          name: offer.user.name,
          avatar: offer.user.avatar,
        },
      },

      link: "/dashboard",
    });
  },

  offerAccepted: async ({ userId, post, offer }) => {
    const helper = offer.respondedBy || offer.user;
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.OFFER,
      action: NOTIFICATION_ACTIONS.OFFER_ACCEPTED,

      title: "Offer accepted",

      message: `Your response for "${post.title}" has been accepted`,

      data: {
        postId: post._id,
        offerId: offer._id,
        helper: helper
          ? { _id: helper._id, name: helper.name, avatar: helper.avatar }
          : undefined,
      },

      link: "/dashboard?view=submitted",
    });
  },

  offerRejected: async ({ userId, post, offer }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.OFFER,
      action: NOTIFICATION_ACTIONS.OFFER_REJECTED,

      title: "Offer rejected",

      message: `Your response for "${post.title}" was rejected`,

      data: {
        postId: post._id,
        offerId: offer._id,
      },

      link: "/dashboard?view=submitted",
    });
  },

  ratingReceived: async ({ userId, reviewer, rating }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.RATING,
      action: NOTIFICATION_ACTIONS.RATING_RECEIVED,

      title: "You received a new rating",

      message: `${reviewer.name} rated you ${rating.rating ?? rating.value}/5`,

      data: {
        ratingId: rating._id,
        value: rating.rating ?? rating.value,
        reviewer: {
          _id: reviewer._id,
          name: reviewer.name,
          avatar: reviewer.avatar,
        },
      },

      link: `/profile/${userId}`,
    });
  },

  ratedForCompletion: async ({ userId, reviewer, rating, post }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.RATING,
      action: NOTIFICATION_ACTIONS.RATE_BACK_REQUEST,

      title: "You've been rated for completing a post",

      message: `${reviewer.name} rated you ${rating.rating}/5 for completing "${post.title}". Please rate the owner back.`,

      data: {
        postId: post._id,
        ratingId: rating._id,
        value: rating.rating,
        reviewer: {
          _id: reviewer._id,
          name: reviewer.name,
          avatar: reviewer.avatar,
        },
      },

      link: `/dashboard?view=submitted&ratePost=${post._id}`,
    });
  },

  postExpiring: async ({ userId, post }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.POST,
      action: NOTIFICATION_ACTIONS.POST_EXPIRING,

      title: "Your post is expiring soon",

      message: `"${post.title}" will expire soon`,

      data: {
        postId: post._id,
        expiresAt: post.expiresAt,
      },

      link: "/dashboard",
    });
  },

  postExpired: async ({ userId, post }) => {
    return createNotification(userId, {
      type: NOTIFICATION_TYPES.POST,
      action: NOTIFICATION_ACTIONS.POST_EXPIRED,

      title: "Your post has expired",

      message: `"${post.title}" has expired`,

      data: {
        postId: post._id,
      },

      link: "/dashboard",
    });
  },
};
