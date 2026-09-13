// HR / mainHr are stored as decimal hours (e.g. "1.5" for a "1:30" entry on
// the ticket form). Under an hour (i.e. the H part was 0 — decimal hours
// stays below 1 since minutes only run 0-59) prices by raw minutes instead
// of the hour fraction, e.g. "0:03" -> 3, but "1:30" -> 1.5. Mirrors
// studio-management/src/app/core/utils/time-format.ts `pricingMultiplier`.
const pricingMultiplier = (decimalHours) => {
  if (!Number.isFinite(decimalHours) || decimalHours <= 0) return 0;
  return decimalHours < 1 ? Math.round(decimalHours * 60) : decimalHours;
};

function calculateTicketFinancials(t) {
  const hrPrice = Number(t.hrPrice || 0);
  const mainHrPrice = Number(t.mainHrPrice || 0);
  const HR = pricingMultiplier(Number(t.HR || 0));
  const mainHr = pricingMultiplier(Number(t.mainHr || 0));
  const amount = Number(t.amount || 0);
  const mainAmount = Number(t.mainAmount || 0);
  const isJobType =
    t.ticketType === "job" ||
    (typeof t.ticketType === "string" && t.ticketType.endsWith("Job"));

  let calculatedAmount = amount;
  let calculatedMainAmount = mainAmount;
  if (isJobType) {
    if ((amount === 0 || !t.amount) && hrPrice > 0) {
      calculatedAmount = hrPrice * HR;
    }
    if ((mainAmount === 0 || !t.mainAmount) && mainHrPrice > 0) {
      calculatedMainAmount = mainHrPrice * mainHr;
    }
  }

  const userPercentage = Number(t.userPersentage || 0);
  const employeeEarnings = calculatedAmount * (userPercentage / 100);
  const companyProfit = calculatedMainAmount - employeeEarnings;

  return { calculatedAmount, calculatedMainAmount, employeeEarnings, companyProfit };
}

module.exports = { calculateTicketFinancials };
