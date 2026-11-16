import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
import { getUnreadCounts, emitToConversationUsers } from "../utils/chatUtils.js";
process.env.REDIS_URL = "";
const { markConversationRead, getConversationMessages } = await import("../controllers/chatController.js");
const { registerChatSocket } = await import("../socket/chatSocket.js");

const userId = "507f1f77bcf86cd799439011";
const otherId = "507f1f77bcf86cd799439012";
const conversationId = "507f1f77bcf86cd799439013";
const messageId = "507f1f77bcf86cd799439014";

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function ioRecorder() {
  const events = [];
  return {
    events,
    to(rooms) {
      return { emit: (name, payload) => events.push({ rooms, name, payload }) };
    },
  };
}

test("unread aggregation casts the reader id and targets the requested conversations", async (t) => {
  const conversation = new mongoose.Types.ObjectId(conversationId);
  t.mock.method(Message, "aggregate", async (pipeline) => {
    assert.deepEqual(pipeline[0].$match.conversationId.$in, [conversation]);
    assert.equal(String(pipeline[0].$match.sender.$ne), userId);
    assert.ok(pipeline[0].$match.sender.$ne instanceof mongoose.Types.ObjectId);
    assert.equal(pipeline[0].$match.isRead, false);
    return [{ _id: conversation, count: 3 }];
  });
  assert.equal((await getUnreadCounts([conversation], userId)).get(conversationId), 3);
  assert.equal((await getUnreadCounts([], userId)).size, 0);
});

test("chat events go to both participants' user rooms", () => {
  const io = ioRecorder();
  emitToConversationUsers(io, { participants: [userId, otherId] }, "new-message", { id: messageId });
  assert.deepEqual(io.events, [{
    rooms: [`user:${userId}`, `user:${otherId}`],
    name: "new-message",
    payload: { id: messageId },
  }]);
});

test("read receipts update only requested unread messages from the other participant", async (t) => {
  const io = ioRecorder();
  const conversation = { participants: [userId, otherId] };
  t.mock.method(Conversation, "findById", async () => conversation);
  t.mock.method(Message, "find", (query) => {
    assert.equal(query.conversationId, conversationId);
    assert.equal(query.sender.$ne, userId);
    assert.equal(query.isRead, false);
    assert.deepEqual(query._id.$in, [messageId]);
    return { select: () => ({ lean: async () => [{ _id: new mongoose.Types.ObjectId(messageId) }] }) };
  });
  t.mock.method(Message, "updateMany", async (query, update) => {
    assert.deepEqual(query._id.$in.map(String), [messageId]);
    assert.equal(query.isRead, false);
    assert.equal(update.$set.isRead, true);
    assert.equal(update.$addToSet.readBy, userId);
  });
  const res = response();
  await markConversationRead({
    params: { conversationId },
    user: { _id: userId },
    body: { messageIds: [messageId] },
    app: { get: () => io },
  }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.equal(io.events.length, 1);
  assert.equal(io.events[0].name, "messages-read");
  assert.deepEqual(io.events[0].payload.messageIds, [messageId]);
  assert.equal(io.events[0].payload.readerId, userId);
});

test("read receipts reject outsiders and invalid message ids", async (t) => {
  t.mock.method(Conversation, "findById", async () => ({ participants: [otherId] }));
  const req = {
    params: { conversationId },
    user: { _id: userId },
    body: { messageIds: [messageId] },
  };
  const res = response();
  await markConversationRead(req, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);
  const invalid = response();
  await markConversationRead({ ...req, body: { messageIds: ["invalid"] } }, invalid, (error) => { throw error; });
  assert.equal(invalid.statusCode, 400);
});

test("reading an already-read message emits no receipt", async (t) => {
  const io = ioRecorder();
  t.mock.method(Conversation, "findById", async () => ({ participants: [userId, otherId] }));
  t.mock.method(Message, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  const res = response();
  await markConversationRead({
    params: { conversationId },
    user: { _id: userId },
    body: { messageIds: [messageId] },
    app: { get: () => io },
  }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(io.events, []);
});

test("loading history does not mark messages read and returns stable message ids", async (t) => {
  const conversation = { participants: [{ _id: userId }, { _id: otherId }] };
  t.mock.method(Conversation, "findById", () => ({
    populate() { return this; },
    then(resolve, reject) { return Promise.resolve(conversation).then(resolve, reject); },
  }));
  t.mock.method(Message, "updateMany", () => { throw new Error("History must not mark messages read"); });
  t.mock.method(Message, "find", () => ({
    populate() { return this; },
    sort() { return this; },
    lean: async () => [{
      _id: new mongoose.Types.ObjectId(messageId),
      conversationId: new mongoose.Types.ObjectId(conversationId),
      sender: { _id: new mongoose.Types.ObjectId(otherId) },
      content: "Hello",
      isRead: false,
    }],
  }));
  const res = response();
  await getConversationMessages({ params: { conversationId }, user: { _id: userId } }, res, (error) => { throw error; });
  assert.equal(res.body.data[0].id, messageId);
  assert.equal(res.body.data[0].isRead, false);
});

test("leaving while a join is pending cannot leave the socket in an old conversation", async (t) => {
  let resolveConversation;
  t.mock.method(Conversation, "findById", () => new Promise((resolve) => {
    resolveConversation = resolve;
  }));
  const handlers = {};
  const joined = [];
  const left = [];
  const socket = {
    user: { _id: userId },
    on: (name, handler) => { handlers[name] = handler; },
    join: (room) => joined.push(room),
    leave: (room) => left.push(room),
  };
  registerChatSocket({}, socket);
  let result;
  const pending = handlers["join-conversation"](conversationId, (value) => { result = value; });
  handlers["leave-conversation"](conversationId);
  resolveConversation({ participants: [{ equals: (id) => id === userId }] });
  await pending;
  assert.deepEqual(joined, []);
  assert.deepEqual(left, [conversationId]);
  assert.equal(result.success, false);
  handlers["leave-conversation"](`user:${userId}`);
  assert.equal(left.length, 1);
});
