const { createOtp, verifyOtp } = require("../services/financialReveal.service");
const { sendOtpEmail } = require("../services/email.service");

// Hides the middle of the address in the confirmation message, since this
// response could be visible on a shared screen right after the request.
const maskEmail = (email) => email.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");

const requestReveal = async (req, res) => {
  try {
    const { user } = req;
    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "No email address on file for your account.",
      });
    }

    const otp = createOtp(user.id);
    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: `Code sent to ${maskEmail(user.email)}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Could not send the code.",
    });
  }
};

const verifyReveal = async (req, res) => {
  try {
    const { user } = req;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: "Enter the code." });
    }

    const result = verifyOtp(user.id, otp);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: "Verified",
      data: { revealUntil: result.revealUntil },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { requestReveal, verifyReveal };
