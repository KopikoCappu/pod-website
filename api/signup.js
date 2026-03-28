import { render } from '@react-email/render';
import { BetaInviteEmail } from '../emails/BetaInviteEmail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'No email' });

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