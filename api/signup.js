export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'No email' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pod <onboarding@resend.dev>',
        to: email,
        subject: "You're in — here's your Pod beta link 🎉",
        html: `
          <h2>Welcome to Pod beta!</h2>
          <p>Thanks for signing up. Here's your TestFlight link:</p>
          <a href="YOUR_TESTFLIGHT_LINK">Join the Beta →</a>
          <p>— Minh</p>
        `
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email failed' });
    }

    // Notify yourself too
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