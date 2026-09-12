function calculateTicketFinancials(t) {
  const hrPrice = Number(t.hrPrice || 0);
  const mainHrPrice = Number(t.mainHrPrice || 0);
  const HR = Number(t.HR || 0);
  const mainHr = Number(t.mainHr || 0);
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
