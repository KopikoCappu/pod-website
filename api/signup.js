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
    <div style="background:#0A0A0B;padding:40px 0;font-family:sans-serif;">
      <div style="background:#111114;max-width:480px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">
        <div style="background:#FF4F00;padding:24px 32px;">
          <h1 style="color:white;margin:0;font-size:24px;font-weight:900;">Pod 🐋</h1>
          <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:14px;">Plan Anything, With Anyone</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:white;margin:0 0 12px;font-size:20px;">Your beta invite is here 🎉</h2>
          <p style="color:#a0a0a8;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Thanks for signing up — you're one of the first people to try Pod.
            Tap the button below to install via TestFlight. Takes about 30 seconds.
          </p>
          <a href="YOUR_TESTFLIGHT_LINK" style="background:#FF4F00;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Join the Beta on TestFlight →
          </a>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:32px 0;" />
          <p style="color:#a0a0a8;font-size:13px;line-height:1.6;margin:0 0 8px;">🗺️ &nbsp;Live GPS tracking for your whole group</p>
          <p style="color:#a0a0a8;font-size:13px;line-height:1.6;margin:0 0 8px;">✅ &nbsp;RSVP, itineraries, and invite codes</p>
          <p style="color:#a0a0a8;font-size:13px;line-height:1.6;margin:0 0 24px;">🔔 &nbsp;Push notifications when plans change</p>
          <p style="color:#a0a0a8;font-size:13px;line-height:1.6;margin:0;">
            Found a bug or have feedback? Just reply to this email — I read every message.
          </p>
        </div>
        <div style="background:#0d0d10;padding:20px 32px;">
          <p style="color:#555;font-size:11px;margin:0;">You're receiving this because you signed up for the Pod beta with ${email}.</p>
          <p style="color:#333;font-size:11px;margin:4px 0 0;">© 2026 Pod · podplananything.com</p>
        </div>
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