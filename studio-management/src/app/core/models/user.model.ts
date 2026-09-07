import { UserRole } from "../constants/app.constants";

export type { UserRole };

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  isActive: boolean;
  /** Fine-grained permission keys (SA => full list). See core/constants/permissions.ts. */
  permissions?: string[];
  /** Plain login password — only returned to SA on the Users list. */
  plainPassword?: string;
  /** SA-set profit share (%). Managed from the Users page. */
  percentage?: number;
  /** Profile fields — returned by GET /employees/:id, editable by SA. */
  homeAddress?: string;
  gender?: string;
  dob?: string;
  image?: string;
  /** Enriched on the Users list: what the studio still owes this user. */
  totalEarned?: number;
  totalPaid?: number;
  balanceDue?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  mobileNumber: string;
  role: UserRole;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: User;
}

export interface AuthSession {
  user: User;
}

export interface EmployeeSummary {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
}
