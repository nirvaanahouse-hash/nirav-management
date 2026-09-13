export type AmountEntryType = "received" | "sent";
export type AmountEntryRecipientType = "employee" | "client";

export interface AmountEntry {
  _id: string;
  recipient: string;
  recipientType: AmountEntryRecipientType;
  type: AmountEntryType;
  amount: number;
  ticketId?: string | null;
  recordedBy: string;
  /** Role of whoever recorded the entry — "SA"/"A" = admin, "U" = the user themselves. */
  recordedByRole?: "SA" | "A" | "U";
  /** Display-name snapshot of whoever recorded the entry. */
  recordedByName?: string;
  description?: string;
  entryDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AmountEntryDraft {
  recipient: string;
  recipientType: AmountEntryRecipientType;
  type: AmountEntryType;
  amount: number;
  ticketId?: string;
  description?: string;
}
