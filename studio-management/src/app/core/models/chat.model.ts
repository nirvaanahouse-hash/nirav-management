export interface ChatContact {
  _id: string;
  name: string;
  userName: string;
  role: string;
  image: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  _id: string;
  sender: string;
  recipient: string;
  text: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  /** Only present on the live socket payload, not the REST history. */
  senderName?: string;
}
