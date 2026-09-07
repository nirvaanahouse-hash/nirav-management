export interface EmployeeComparisonRow {
  _id: string;
  name: string;
  userName: string;
  isActive: boolean;
  percentage: number;
  ticketsAssigned: number;
  ticketsCompleted: number;
  ticketsFinalized: number;
  workValue: number;
  earnings: number;
  paid: number;
  balanceDue: number;
}

export interface EmployeeComparisonResponse {
  success: boolean;
  data: EmployeeComparisonRow[];
  range: { from: string; to: string };
}
