import nodemailer from "nodemailer";

type MailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(params: MailParams): Promise<{ sent: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  // If SMTP isn't configured, we won't fail the request. We'll just log the email.
  if (!host || !from) {
    console.log("📧 SMTP not configured. Would send email:", {
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    return { sent: false, error: "SMTP_NOT_CONFIGURED" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return { sent: true };
  } catch (e: any) {
    console.error("❌ Email send failed:", e?.message || e);
    return { sent: false, error: e?.message || "EMAIL_SEND_FAILED" };
  }
}
