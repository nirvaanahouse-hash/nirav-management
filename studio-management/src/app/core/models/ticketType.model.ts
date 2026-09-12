// SA-managed ticket types. Mirrors BE/models/ticketType.model.js and the
// response shape of BE/controllers/ticketType.controller.js.

import { BadgeVariant } from '../constants/app.constants';

export interface TicketTypeRecord {
  _id: string;
  /** What every ticket stores in `ticketType`. Fixed once created. */
  key: string;
  label: string;
  variant: BadgeVariant;
  /** Hex for the variant — charts and PDFs, not badges. */
  color: string;
  /** Hour-wise (JOB) pricing: HR × HR price instead of a flat amount. */
  isJob: boolean;
  isActive: boolean;
  /** Show a "N tickets match" count on the Tickets page when this type is selected. */
  showCount: boolean;
  sortOrder: number;
  /** How many tickets already use this type — a type in use cannot be deleted. */
  usageCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TicketTypeDraft {
  label: string;
  variant: BadgeVariant;
  isJob?: boolean;
  isActive?: boolean;
  showCount?: boolean;
}

export interface TicketTypePatch {
  label?: string;
  variant?: BadgeVariant;
  isActive?: boolean;
  showCount?: boolean;
  sortOrder?: number;
}
