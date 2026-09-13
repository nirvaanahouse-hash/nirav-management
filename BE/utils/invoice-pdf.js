const PDFDocument = require("pdfkit");

const COMPANY_NAME = "NIRVANA HOUSE";
const STATEMENT_TITLE = "Billing Statement";
const STATEMENT_MESSAGE =
  "Statement of completed & finalised work. Kindly arrange payment for the balance shown below. " +
  "For any query about this statement, please contact the studio.";

/** Indian-grouped rupee string, e.g. 123456 -> "1,23,456". */
const inr = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB"); // DD/MM/YYYY
};

const scopeLabel = (mode, from, to) => {
  if (mode === "current") return "Current (unbilled completed work)";
  if (mode === "custom") {
    return `Custom range: ${from ? fmtDate(from) : "start"} to ${to ? fmtDate(to) : "today"}`;
  }
  return "All completed & finalised work";
};

/**
 * Build a client billing PDF.
 *
 * @param {object}   opts
 * @param {object}   opts.client   - { name, company, ... }
 * @param {Array}    opts.tickets  - [{ coupleName, deleveryDate, mainAmount }]
 * @param {object}   opts.summary  - { statementTotal, received, pending }
 * @param {string}   opts.mode     - "all" | "current" | "custom"
 * @param {string}   [opts.from]
 * @param {string}   [opts.to]
 * @returns {Promise<Buffer>}
 */
function buildClientInvoicePdf({ client, tickets, summary, mode, from, to }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;

      // ---- Header ----------------------------------------------------------
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#1a1a1a")
        .text(COMPANY_NAME, left, doc.y, { align: "center", characterSpacing: 1 });
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("#555555")
        .text(STATEMENT_TITLE, { align: "center" });

      doc.moveDown(0.6);
      doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(left, doc.y)
        .lineTo(right, doc.y)
        .stroke();
      doc.moveDown(0.8);

      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#666666")
        .text(STATEMENT_MESSAGE, left, doc.y, { align: "left", width: contentWidth });
      doc.moveDown(1);

      // ---- Meta block -----------------------------------------------------
      const metaTop = doc.y;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a1a").text("Billed to", left, metaTop);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#333333")
        .text(client.name || "-", left, doc.y + 1);
      if (client.company) doc.fillColor("#666666").fontSize(9).text(client.company);

      const rightColX = left + contentWidth / 2;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#1a1a1a")
        .text("Statement date", rightColX, metaTop, { width: contentWidth / 2, align: "right" });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#333333")
        .text(fmtDate(new Date()), rightColX, doc.y + 1, {
          width: contentWidth / 2,
          align: "right",
        });
      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(scopeLabel(mode, from, to), rightColX, doc.y + 1, {
          width: contentWidth / 2,
          align: "right",
        });

      doc.moveDown(1.5);

      // ---- Table --------------------------------------------------------
      const cols = {
        idx: { x: left, w: 28 },
        couple: { x: left + 28, w: contentWidth - 28 - 95 - 110 },
        date: { x: left + contentWidth - 95 - 110, w: 95 },
        amount: { x: left + contentWidth - 110, w: 110 },
      };
      const rowH = 22;

      const drawHeader = () => {
        const y = doc.y;
        doc.rect(left, y, contentWidth, rowH).fill("#f2f2f2");
        doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9);
        const ty = y + 7;
        doc.text("#", cols.idx.x + 4, ty, { width: cols.idx.w });
        doc.text("Couple Name", cols.couple.x + 4, ty, { width: cols.couple.w });
        doc.text("Delivery Date", cols.date.x, ty, { width: cols.date.w });
        doc.text("Main Amount", cols.amount.x, ty, { width: cols.amount.w - 4, align: "right" });
        doc.y = y + rowH;
      };

      const bottomLimit = doc.page.height - doc.page.margins.bottom - 140;

      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor("#333333");

      tickets.forEach((t, i) => {
        if (doc.y + rowH > bottomLimit) {
          doc.addPage();
          drawHeader();
          doc.font("Helvetica").fontSize(9).fillColor("#333333");
        }
        const y = doc.y;
        if (i % 2 === 1) doc.rect(left, y, contentWidth, rowH).fill("#fafafa");
        doc.fillColor("#333333").font("Helvetica").fontSize(9);
        const ty = y + 7;
        doc.text(String(i + 1), cols.idx.x + 4, ty, { width: cols.idx.w });
        doc.text(t.coupleName || "-", cols.couple.x + 4, ty, {
          width: cols.couple.w - 6,
          ellipsis: true,
          lineBreak: false,
        });
        doc.text(fmtDate(t.deleveryDate), cols.date.x, ty, { width: cols.date.w });
        doc.text(inr(t.mainAmount), cols.amount.x, ty, {
          width: cols.amount.w - 4,
          align: "right",
        });
        doc.y = y + rowH;
      });

      // table outline
      doc
        .strokeColor("#dddddd")
        .lineWidth(1)
        .moveTo(left, doc.y)
        .lineTo(right, doc.y)
        .stroke();

      // Subtotal row — total of the tickets on this statement.
      if (tickets.length > 0) {
        const statementSubtotal = tickets.reduce(
          (sum, t) => sum + Number(t.mainAmount || 0),
          0,
        );
        const y = doc.y;
        doc.rect(left, y, contentWidth, rowH).fill("#f2f2f2");
        doc.fillColor("#1a1a1a").font("Helvetica-Bold").fontSize(9);
        doc.text("Total for this statement", cols.couple.x + 4, y + 7, {
          width: cols.date.x - cols.couple.x,
        });
        doc.text(inr(statementSubtotal), cols.amount.x, y + 7, {
          width: cols.amount.w - 4,
          align: "right",
        });
        doc.y = y + rowH;
      }

      if (tickets.length === 0) {
        doc
          .moveDown(0.5)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .fillColor("#999999")
          .text("No tickets match this billing scope.", left, doc.y, {
            width: contentWidth,
            align: "center",
          });
      }

      // ---- Summary -----------------------------------------------------
      doc.moveDown(1.5);
      const boxW = 260;
      const boxX = right - boxW;
      let sy = doc.y;

      const summaryRow = (label, value, opts = {}) => {
        doc
          .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(opts.big ? 11 : 9.5)
          .fillColor(opts.color || "#333333");
        doc.text(label, boxX, sy, { width: boxW - 90, align: "left" });
        doc.text(value, boxX + boxW - 90, sy, { width: 90, align: "right" });
        sy += opts.big ? 20 : 16;
      };

      const prev = Number(summary.previousBalance || 0);
      const isCurrentRun = mode === "current";

      const thinRule = () => {
        doc
          .strokeColor("#cccccc")
          .lineWidth(1)
          .moveTo(boxX, sy + 2)
          .lineTo(right, sy + 2)
          .stroke();
        sy += 8;
      };

      if (isCurrentRun) {
        // Running-ledger view: what was owed before + this statement's new work.
        const priorPending = Math.max(0, prev);

        summaryRow("This statement (new work)", inr(summary.newWork));
        if (prev > 0) {
          summaryRow("Previous balance (earlier statements)", `+ ${inr(prev)}`);
        } else if (prev < 0) {
          summaryRow("Advance held from client", `- ${inr(Math.abs(prev))}`);
        } else {
          summaryRow("Previous balance (earlier statements)", inr(0));
        }

        thinRule();

        summaryRow("Total billed to date", inr(summary.invoicedTotal));
        summaryRow("Received from client (to date)", `- ${inr(summary.received)}`);

        thinRule();

        if (prev < 0) {
          summaryRow("Advance adjusted", `- ${inr(Math.abs(prev))}`);
        } else {
          summaryRow("Payment pending (before this bill)", inr(priorPending));
        }
      } else {
        summaryRow("Total (this statement)", inr(summary.statementTotal));
        if (
          typeof summary.invoicedTotal === "number" &&
          summary.invoicedTotal !== summary.statementTotal
        ) {
          summaryRow("Invoiced to date (all statements)", inr(summary.invoicedTotal));
        }
        summaryRow("Received from client (to date)", `- ${inr(summary.received)}`);

        thinRule();
      }

      doc
        .strokeColor("#1a1a1a")
        .lineWidth(1.4)
        .moveTo(boxX, sy + 2)
        .lineTo(right, sy + 2)
        .stroke();
      sy += 10;

      // Final amount the client owes = earlier pending + this statement.
      summaryRow("FINAL TOTAL", inr(summary.pending), {
        bold: true,
        big: true,
        color: "#a11",
      });

      // ---- Footer -----------------------------------------------------
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#999999")
        .text(
          `${COMPANY_NAME}  -  generated ${new Date().toLocaleString("en-GB")}`,
          left,
          doc.page.height - doc.page.margins.bottom - 14,
          { width: contentWidth, align: "center" },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildClientInvoicePdf };
