const nodemailer = require("nodemailer");

// Built lazily (not at module load) so a server without SMTP configured
// still boots fine — it only fails when something actually tries to send.
let transporter;
let configured = null;

function getTransporter() {
  if (configured !== null) return configured ? transporter : null;

  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    configured = false;
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  configured = true;
  return transporter;
}

async function sendOtpEmail(to, otp) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email isn't set up on the server yet (SMTP_HOST / SMTP_USER / SMTP_PASS missing from .env).",
    );
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your verification code",
    text: `Your verification code is ${otp}. It expires in 2 minutes.`,
    html: `<p>Your verification code is <strong style="font-size:18px">${otp}</strong>.</p><p>It expires in 2 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
