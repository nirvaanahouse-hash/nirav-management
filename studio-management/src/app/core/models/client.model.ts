export enum ClientStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
}
 
export const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: ClientStatus.Active, label: 'Active' },
  { value: ClientStatus.Inactive, label: 'Inactive' },
  { value: ClientStatus.Pending, label: 'Pending' },
];
 
export interface Client {
  _id: string;
  name: string;
  sortName?: string;
  company?: string;
  email: string;
  phone: string;
  mobileNumber?: string;
  status: ClientStatus;
  isActive: boolean;
  totalWorkAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  createdAt: string;
  updatedAt?: string;
}

export type ClientDraft = Omit<Client, '_id' | 'createdAt' | 'updatedAt' | 'totalWorkAmount' | 'paidAmount' | 'balanceDue'>;
