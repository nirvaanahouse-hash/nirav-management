const mongoose = require("mongoose");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const { ERole } = require("../constants");
const { emitToUsers } = require("../services/notification.service");
const { sendPushToUser } = require("../services/push.service");

const userSummarySelect = "firstName lastName userName role image";

function nameOf(user) {
  if (!user) return "";
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName || "";
}

// GET /api/messages/contacts — the people this user can chat with, each with
// a last-message preview and unread count. An SA's contacts are every active
// employee; an employee's contacts are every active SA (in practice almost
// always exactly one studio account, but this stays correct if a second SA
// is ever added instead of hardcoding a single recipient).
const getContacts = async (req, res) => {
  try {
    const { user } = req;
    const isSA = user.role === ERole.SA;
    const contactRole = isSA ? ERole.U : ERole.SA;

    const contacts = await User.find({ role: contactRole, isActive: true })
      .select(userSummarySelect)
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const ids = contacts.map((c) => c._id);
    // Aggregate $match/$eq do a literal BSON comparison — unlike find(), a
    // plain string id here would never match the ObjectId-typed sender/
    // recipient fields, so it has to be cast explicitly.
    const myId = new mongoose.Types.ObjectId(user.id);
    const [lastMessages, unread] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            $or: [
              { sender: myId, recipient: { $in: ids } },
              { recipient: myId, sender: { $in: ids } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ["$sender", myId] }, "$recipient", "$sender"] },
            text: { $first: "$text" },
            createdAt: { $first: "$createdAt" },
            fromMe: { $first: { $eq: ["$sender", myId] } },
          },
        },
      ]),
      Message.aggregate([
        { $match: { recipient: myId, sender: { $in: ids }, isRead: false } },
        { $group: { _id: "$sender", count: { $sum: 1 } } },
      ]),
    ]);

    const lastByContact = {};
    lastMessages.forEach((m) => {
      lastByContact[String(m._id)] = { text: m.text, createdAt: m.createdAt, fromMe: m.fromMe };
    });
    const unreadByContact = {};
    unread.forEach((u) => {
      unreadByContact[String(u._id)] = u.count;
    });

    const data = contacts.map((c) => {
      const cid = String(c._id);
      return {
        _id: cid,
        name: nameOf(c),
        userName: c.userName,
        role: c.role,
        image: c.image || "",
        lastMessage: lastByContact[cid]?.text || "",
        lastMessageAt: lastByContact[cid]?.createdAt || null,
        lastMessageFromMe: lastByContact[cid]?.fromMe || false,
        unreadCount: unreadByContact[cid] || 0,
      };
    });

    data.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/messages/:withUserId — full thread with one contact, oldest first.
const getThread = async (req, res) => {
  try {
    const { user } = req;
    const { withUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: user.id, recipient: withUserId },
        { sender: withUserId, recipient: user.id },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/messages — SA -> any active employee, or employee -> any active
// SA. Never employee <-> employee: this is a one-to-one studio<->staff
// channel, not group chat.
const sendMessage = async (req, res) => {
  try {
    const { user } = req;
    const { recipient, text } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: "Message text is required." });
    }

    const isSA = user.role === ERole.SA;
    const recipientUser = await User.findOne({
      _id: recipient,
      role: isSA ? ERole.U : ERole.SA,
      isActive: true,
    }).lean();
    if (!recipientUser) {
      return res.status(403).json({
        success: false,
        message: isSA
          ? "You can only message active employees."
          : "You can only message an active Super Admin.",
      });
    }

    const message = await Message.create({
      sender: user.id,
      recipient,
      text: String(text).trim(),
    });

    const senderName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName;
    const payload = { ...message.toObject(), senderName };
    emitToUsers("message-new", payload, [recipient, user.id]);

    // Only the recipient — the sender already sees their own message land.
    sendPushToUser(recipient, {
      title: senderName,
      body: message.text,
      tag: "chat-message",
      url: "/messages",
    }).catch(() => {});

    return res.status(201).json({ success: true, message: "Message sent", data: message });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/messages/read/:withUserId — mark every message *from* that
// contact as read, and let their own session know live (so a sent message
// flips to "read" without them needing to reopen the thread).
const markRead = async (req, res) => {
  try {
    const { user } = req;
    const { withUserId } = req.params;

    await Message.updateMany(
      { sender: withUserId, recipient: user.id, isRead: false },
      { $set: { isRead: true } },
    );

    emitToUsers("message-read", { withUserId: user.id }, [withUserId]);

    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getContacts,
  getThread,
  sendMessage,
  markRead,
};
