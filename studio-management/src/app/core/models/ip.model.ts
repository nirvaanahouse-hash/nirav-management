// Types for the "IP & Security" area (SA-only). Mirrors BE/models/ip*.model.js
// and BE/controllers/ip.controller.js response shapes.

export type IpRuleMode = 'allow' | 'block';

export interface IpRule {
  _id: string;
  ip: string;
  mode: IpRuleMode;
  note?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type IpRuleDraft = {
  ip: string;
  mode: IpRuleMode;
  note?: string;
  isActive?: boolean;
};

export interface IpSettings {
  guardEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitMax: number;
  logRequests: boolean;
}

export interface LoginEvent {
  _id: string;
  userId?: string;
  userName?: string;
  email?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
  createdAt: string;
}

export interface RequestLog {
  _id: string;
  userId?: string;
  userName?: string;
  role?: string;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
  createdAt: string;
}

export interface IpStats {
  totalRules: number;
  activeBlocks: number;
  activeAllows: number;
  loginsToday: number;
  failedLoginsToday: number;
  requestsToday: number;
  topIps: { ip: string; count: number }[];
  guardEnabled: boolean;
  allowlistMode: boolean;
}

export interface PagedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}
