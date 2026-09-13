import { Injectable } from "@angular/core";
import { TicketRecord, UserTicketSummary } from "../models/task.model";

export interface TicketCalculations {
  employeeEarnings: number;
  companyShare: number;
  companyProfit: number;
}

@Injectable({ providedIn: "root" })
export class TaskCalculationService {
  calculate(ticket: TicketRecord): TicketCalculations {
    if (ticket.employeeEarnings !== undefined && ticket.companyProfit !== undefined) {
      return {
        employeeEarnings: ticket.employeeEarnings,
        companyShare: Number(ticket.calculatedMainAmount || 0) - ticket.employeeEarnings,
        companyProfit: ticket.companyProfit,
      };
    }

    // Prefer calculatedAmount (HR × hrPrice for job-type tickets) over the raw
    // `amount` field — for a job ticket whose stored amount predates its
    // hour/price inputs being set, the two can diverge, and calculatedAmount
    // is what the backend actually bases employeeEarnings on.
    const amount = Number(ticket.calculatedAmount ?? ticket.amount ?? 0);
    const mainAmount = Number(ticket.calculatedMainAmount ?? ticket.mainAmount ?? 0);
    const userPercentage = Number(ticket.userPersentage || 0);

    const employeeEarnings = amount * (userPercentage / 100);
    const companyShare = amount - employeeEarnings;
    const companyProfit = mainAmount - employeeEarnings;

    return {
      employeeEarnings,
      companyShare,
      companyProfit,
    };
  }

  summarizeUserTickets(tickets: TicketRecord[]): UserTicketSummary[] {
    const userMap = new Map<string, UserTicketSummary>();

    tickets.forEach((t) => {
      const calc = this.calculate(t);
      const key = t.createdByName || t.userId || "unknown";
      const existing = userMap.get(key) || {
        userId: t.userId,
        userName: t.createdByName,
        fullName: t.creatorDetails
          ? `${t.creatorDetails.firstName} ${t.creatorDetails.lastName}`.trim()
          : t.createdByName,
        totalTickets: 0,
        totalUserAmount: 0,
        totalMainAmount: 0,
        totalHours: 0,
        totalEmployeeEarnings: 0,
        totalCompanyProfit: 0,
      };

      existing.totalTickets += 1;
      existing.totalUserAmount += Number(t.amount || 0);
      existing.totalMainAmount += Number(t.mainAmount || 0);
      existing.totalHours += Number(t.HR || 0);
      existing.totalEmployeeEarnings += calc.employeeEarnings;
      existing.totalCompanyProfit += calc.companyProfit;
      existing.userId = t.userId;
      existing.userName = t.createdByName;
      existing.fullName = t.creatorDetails
        ? `${t.creatorDetails.firstName} ${t.creatorDetails.lastName}`.trim()
        : t.createdByName;

      userMap.set(key, existing);
    });

    return Array.from(userMap.values()).sort(
      (a, b) => b.totalCompanyProfit - a.totalCompanyProfit
    );
  }
}
