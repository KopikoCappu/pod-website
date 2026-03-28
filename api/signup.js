export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit: max 3 per IP per hour
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 3;

  if (rateLimit.has(ip)) {
    const { count, start } = rateLimit.get(ip);
    if (now - start < windowMs && count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    rateLimit.set(ip, now - start > windowMs
      ? { count: 1, start: now }
      : { count: count + 1, start });
  } else {
    rateLimit.set(ip, { count: 1, start: now });
  }

  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

const html = `
  <div style="background:#f4f4f4;padding:40px 0;font-family:sans-serif;">
    <div style="background:white;max-width:480px;margin:0 auto;border-radius:12px;padding:40px;">
      
      <h1 style="color:#FF4F00;font-size:32px;margin:0;font-weight:900;">POD 🐋</h1>
      <p style="color:#888;font-size:14px;margin:4px 0 0;">Plan anything, go anywhere</p>
      
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      
      <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Your beta invite is here! Tap the button below to install Pod
        via TestFlight — takes about 30 seconds.
      </p>
      
      <a href="YOUR_TESTFLIGHT_LINK" style="background:#FF4F00;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;margin-bottom:32px;">
        Join the Beta on TestFlight
      </a>
      
      <p style="color:#aaa;font-size:12px;margin:0;">
        Found a bug or have feedback? Just reply to this email — I read every message.
      </p>
      
    </div>
  </div>
`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Minh from Pod <hello@podplananything.com>',
        to: email,
        subject: "You're in — your Pod beta invite is here 🎉",
        html,
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email failed' });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pod <hello@podplananything.com>',
        to: 'minhtran60524@gmail.com',
        subject: '🚨 New Pod beta signup',
        html: `<p>${email} just signed up for the beta.</p>`
      })
    });

    res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

const rateLimit = new Map();