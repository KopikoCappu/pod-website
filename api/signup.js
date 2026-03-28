import { render } from '@react-email/render';
import { BetaInviteEmail } from '../emails/BetaInviteEmail.js';

const rateLimit = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Rate limit: max 3 requests per IP per hour
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 3;

  if (rateLimit.has(ip)) {
    const { count, start } = rateLimit.get(ip);
    if (now - start < windowMs && count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    if (now - start > windowMs) {
      rateLimit.set(ip, { count: 1, start: now });
    } else {
      rateLimit.set(ip, { count: count + 1, start });
    }
  } else {
    rateLimit.set(ip, { count: 1, start: now });
  }

  const { email } = req.body;

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const html = await render(BetaInviteEmail({ testflightLink: 'https://testflight.apple.com/join/c3WSSAyW', email }));

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

    // Notify yourself
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