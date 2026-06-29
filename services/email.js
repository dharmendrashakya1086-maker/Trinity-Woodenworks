const { Resend } = require('resend');

let resendClient = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set — emails will be logged to console');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendVerificationEmail(to, code, name) {
  const client = getClient();
  const from = process.env.EMAIL_FROM || 'Trinity Woodenworks <onboarding@resend.dev>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Tahoma,sans-serif;">
      <div style="max-width:500px;margin:40px auto;background:#111118;border:1px solid #2a2a35;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1520,#0f0a15);padding:32px;text-align:center;border-bottom:1px solid #2a2a35;">
          <h1 style="color:#C9A96E;font-size:22px;margin:0;">Trinity Woodenworks</h1>
          <p style="color:#888;font-size:13px;margin:4px 0 0;">Email Verification</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#ccc;font-size:15px;margin:0 0 20px;">Hi ${name || 'there'},</p>
          <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Use the following verification code to complete your sign up. This code expires in <strong style="color:#C9A96E;">10 minutes</strong>.
          </p>
          <div style="background:#1a1a24;border:2px solid #C9A96E;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Your Verification Code</p>
            <p style="color:#C9A96E;font-size:36px;font-weight:bold;letter-spacing:10px;margin:0;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#666;font-size:12px;line-height:1.5;margin:0;">
            If you did not request this, please ignore this email. Do not share this code with anyone.
          </p>
        </div>
        <div style="background:#0d0d14;padding:20px;text-align:center;border-top:1px solid #1a1a24;">
          <p style="color:#555;font-size:11px;margin:0;">Trinity Woodenworks &mdash; Crafted with Passion, Built to Last</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!client) {
    console.log(`[EMAIL FALLBACK] To: ${to} | Code: ${code} | Name: ${name}`);
    return { success: true, fallback: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [to],
      subject: `Your Verification Code: ${code}`,
      html
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email sent to ${to}, id: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendOTPEmail(to, otp, name) {
  return sendVerificationEmail(to, otp, name);
}

async function sendOrderMessageEmail(to, customerName, subject, message, orderNumber) {
  const client = getClient();
  const from = process.env.EMAIL_FROM || 'Trinity Woodenworks <onboarding@resend.dev>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Tahoma,sans-serif;">
      <div style="max-width:500px;margin:40px auto;background:#111118;border:1px solid #2a2a35;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1520,#0f0a15);padding:32px;text-align:center;border-bottom:1px solid #2a2a35;">
          <h1 style="color:#C9A96E;font-size:22px;margin:0;">Trinity Woodenworks</h1>
          <p style="color:#888;font-size:13px;margin:4px 0 0;">Message Regarding Your Order</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#ccc;font-size:15px;margin:0 0 20px;">Hi ${customerName || 'there'},</p>
          <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 8px;">
            We have a message regarding your order <strong style="color:#C9A96E;">#${orderNumber}</strong>.
          </p>
          <div style="background:#1a1a24;border-left:3px solid #C9A96E;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="color:#C9A96E;font-size:13px;font-weight:600;margin:0 0 10px;">${subject}</p>
            <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${message}</p>
          </div>
          <p style="color:#666;font-size:12px;line-height:1.5;margin:20px 0 0;">
            You can also view this message in your account on our website.
          </p>
        </div>
        <div style="background:#0d0d14;padding:20px;text-align:center;border-top:1px solid #1a1a24;">
          <p style="color:#555;font-size:11px;margin:0;">Trinity Woodenworks &mdash; Crafted with Passion, Built to Last</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!client) {
    console.log(`[EMAIL FALLBACK] To: ${to} | Subject: ${subject} | Order: ${orderNumber}`);
    return { success: true, fallback: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: [to],
      subject: `[Trinity Woodenworks] ${subject}`,
      html
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Message email sent to ${to}, id: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Message email failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVerificationEmail, sendOTPEmail, sendOrderMessageEmail };
