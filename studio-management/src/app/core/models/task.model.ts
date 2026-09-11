import { BadgeVariant, Priority } from "../constants/app.constants";

export type TicketStatus = "pending" | "inProgress" | "completed" | "hold";

export interface TicketRecord {
  _id: string;
  userId: string;
  createdBy: string;
  /** Snapshot of the creator's name, set by the backend from the auth session. */
  createdByName: string;
  assignedEmployee: string | null;
  client: string | null;
  coupleName: string;
  /** `key` of an SA-managed ticket type (see /sa/ticket-types). */
  ticketType: string;
  HR: string;
  mainHr: string;
  priorety: Priority;
  amount: string;
  mainAmount: string;
  deleveryDate: string;
  userPersentage: string;
  hrPrice: number;
  status: TicketStatus;
  remark: string;
  isFinalized: boolean;
  finalizedBy: string | null;
  finalizedAt: string | null;
  /** true once this ticket has been included in a downloaded client invoice PDF. */
  isPdf?: boolean;
  createdAt: string;
  updatedAt: string;
  // Enriched fields from BE
  priorityColor?: string;
  ticketTypeColor?: string;
  /** Ticket type display name, resolved from the registry on every read. */
  ticketTypeLabel?: string;
  ticketTypeVariant?: BadgeVariant;
  creatorDetails?: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    role: string;
  } | null;
  employeeDetails?: {
    _id: string;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    role: string;
  } | null;
  clientDetails?: {
    _id: string;
    name: string;
    mobileNumber: string;
    sortName?: string;
    company?: string;
  } | null;
  calculatedAmount?: number;
  calculatedMainAmount?: number;
  employeeEarnings?: number;
  companyProfit?: number;
  /** Paid to the assigned employee against this ticket (net sent − received). */
  employeePaid?: number;
  /** employeeEarnings − employeePaid — what the studio still owes for this ticket. */
  balanceDue?: number;
}

export interface TicketDraft {
  coupleName?: string;
  ticketType?: string;
  HR?: string;
  mainHr?: string;
  hrPrice?: number;
  priorety?: Priority;
  amount?: string;
  mainAmount?: string;
  deleveryDate?: string;
  userPersentage?: string;
  assignedEmployee?: string | null;
  client?: string | null;
  remark?: string;
  status?: TicketStatus;
  isFinalized?: boolean;
}

export interface UserTicketSummary {
  userId: string;
  userName: string;
  fullName: string;
  totalTickets: number;
  totalUserAmount: number;
  totalMainAmount: number;
  totalEmployeeEarnings: number;
  totalCompanyProfit: number;
  totalHours: number;
}

export interface TicketResponse {
  success: boolean;
  message: string;
  data: TicketRecord[];
}

export interface TicketCreateResponse {
  success: boolean;
  message: string;
  data: TicketRecord;
}
