const https = require('https');
const http = require('http');

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_PHONE_NUMBER
  };
}

function getMSG91Config() {
  return {
    authKey: process.env.MSG91_AUTH_KEY,
    senderId: process.env.MSG91_SENDER_ID || 'TRINITY',
    templateId: process.env.MSG91_TEMPLATE_ID
  };
}

async function sendTwilioSMS(to, message) {
  const config = getTwilioConfig();
  if (!config.accountSid || !config.authToken || !config.from) {
    console.warn('Twilio config incomplete — SMS will be logged to console');
    return null;
  }

  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      To: `+91${to}`,
      From: config.from,
      Body: message
    }).toString();

    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 201 || res.statusCode === 200) {
            resolve({ success: true, sid: json.sid });
          } else {
            console.error('Twilio error:', json);
            resolve({ success: false, error: json.message || 'Twilio error' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Parse error' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Twilio request failed:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

async function sendMSG91SMS(to, message) {
  const config = getMSG91Config();
  if (!config.authKey) {
    console.warn('MSG91 config incomplete — SMS will be logged to console');
    return null;
  }

  const otp = message.match(/\d{6}/)?.[0] || message;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      route: 'q',
      sender_id: config.senderId,
      language: 'en',
      flash: 0,
      numbers: to,
      template_id: config.templateId,
      var1: otp
    });

    const req = https.request({
      hostname: 'api.msg91.com',
      path: '/api/v5/otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': config.authKey,
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: json.type === 'success', data: json });
        } catch (e) {
          resolve({ success: false, error: 'Parse error' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('MSG91 request failed:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

async function sendSMS(to, otp, name) {
  const message = `Hi ${name || 'there'}, your Trinity Woodenworks verification OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;

  // Try Twilio first
  const twilioConfig = getTwilioConfig();
  if (twilioConfig.accountSid) {
    const result = await sendTwilioSMS(to, message);
    if (result) return result;
  }

  // Try MSG91
  const msg91Config = getMSG91Config();
  if (msg91Config.authKey) {
    const result = await sendMSG91SMS(to, message);
    if (result) return result;
  }

  // Fallback: log to console
  console.log(`[SMS FALLBACK] To: +91${to} | OTP: ${otp} | Name: ${name}`);
  return { success: true, fallback: true };
}

module.exports = { sendSMS, sendTwilioSMS, sendMSG91SMS };
