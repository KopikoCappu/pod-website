const DB = 'https://pakky-1f238-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  try {
    const code = (req.query?.code || '').toUpperCase().trim();
    // Universal link — same domain as this page, so it works as both the
    // "open in app" trigger (intercepted by iOS via your AASA file) and
    // the plain-web fallback if the app isn't installed (just reloads this page).
    const appLink = `https://podplananything.com/join/${code}`;

    let pod = null;
        if (code) {
        try {
            const [nameRes, photoRes, countRes] = await Promise.all([
            fetch(`${DB}/trips/${code}/name.json`, { headers: { Accept: 'application/json' } }),
            fetch(`${DB}/trips/${code}/coverPhoto.json`, { headers: { Accept: 'application/json' } }),
            fetch(`${DB}/trips/${code}/memberCount.json`, { headers: { Accept: 'application/json' } }),
            ]);

            const [name, coverPhoto, memberCount] = await Promise.all([
            nameRes.json(),
            photoRes.json(),
            countRes.json(),
            ]);

            console.log('name:', name, 'coverPhoto:', coverPhoto, 'memberCount:', memberCount);

            if (name && name !== 'null') {
            pod = {
                name:        name || code,
                coverPhoto:  coverPhoto || null,
                memberCount: memberCount || 0,
            };
            }
        } catch (err) {
            console.error('Firebase fetch error:', err.message);
        }
        }

    const title       = pod ? `Join ${pod.name} on Pod` : 'Join a Pod';
    const description = pod
      ? `${pod.memberCount} ${pod.memberCount === 1 ? 'person' : 'people'} already in · Plan anything, with anyone.`
      : 'Plan anything, with anyone.';
    const ogImage = pod?.coverPhoto || null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>

  <meta property="og:title"       content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url"         content="https://podplananything.com/join/${code}" />
  <meta property="og:site_name"   content="Pod" />
  <meta property="og:type"        content="website" />
  ${ogImage ? `
  <meta property="og:image"        content="${ogImage}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:image"       content="${ogImage}" />
  ` : `
  <meta name="twitter:card" content="summary" />
  `}
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${description}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/png" href="/podlogowhite.png" />

  <style>
    :root {
      --orange: #FF4F00;
      --dark:   #0A0A0B;
      --dark-2: #111114;
      --border: rgba(255,255,255,0.07);
      --text:   #F0EDE8;
      --muted:  rgba(240,237,232,0.5);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      background: var(--dark);
      color: var(--text);
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .bg-glow {
      position: fixed; top: -20%; left: 50%; transform: translateX(-50%);
      width: 800px; height: 600px;
      background: radial-gradient(ellipse, rgba(255,79,0,0.13) 0%, transparent 65%);
      pointer-events: none;
    }
    .bg-grid {
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 56px 56px;
      mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, black 10%, transparent 100%);
      pointer-events: none;
    }
    .card {
      position: relative; z-index: 1;
      width: 100%; max-width: 420px; margin: 24px;
      background: var(--dark-2);
      border: 1px solid var(--border);
      border-radius: 32px; overflow: hidden;
      box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
      animation: rise 0.55s cubic-bezier(0.22,1,0.36,1) both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(28px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .cover { width: 100%; height: 200px; object-fit: cover; display: block; }
    .cover-fallback {
      width: 100%; height: 200px;
      background: linear-gradient(135deg, #1a1a1f 0%, #0f0f13 100%);
      display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;
    }
    .cover-fallback::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 120%, rgba(255,79,0,0.2) 0%, transparent 60%);
    }
    .cover-logo {
      width: 72px; height: 72px; border-radius: 20px;
      background: rgba(255,79,0,0.12); border: 1px solid rgba(255,79,0,0.25);
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .cover-logo svg { width: 36px; height: 36px; }
    .cover-scrim {
      position: absolute; bottom: 0; left: 0; right: 0; height: 80px;
      background: linear-gradient(transparent, var(--dark-2));
    }
    .cover-wrap { position: relative; }
    .body { padding: 28px 32px 32px; }
    .badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(255,79,0,0.1); border: 1px solid rgba(255,79,0,0.25);
      color: #FF7A3D; font-size: 11px; font-weight: 600;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 5px 12px; border-radius: 100px; margin-bottom: 20px;
    }
    .badge-dot {
      width: 5px; height: 5px; border-radius: 50%; background: var(--orange);
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.4; transform:scale(0.7); }
    }
    .pod-name { font-size: 30px; font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin-bottom: 10px; }
    .pod-meta {
      font-family: 'DM Mono', monospace; font-size: 12px; color: var(--muted);
      margin-bottom: 32px; display: flex; align-items: center; gap: 14px;
    }
    .meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--border); }
    .btn-open {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%; background: var(--orange); color: #fff;
      font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 800;
      padding: 16px; border-radius: 16px; border: none; cursor: pointer;
      text-decoration: none;
      box-shadow: 0 0 40px rgba(255,79,0,0.3), 0 4px 16px rgba(255,79,0,0.2);
      transition: transform 0.15s, box-shadow 0.15s; margin-bottom: 12px;
    }
    .btn-open:hover { transform: translateY(-2px); }
    .btn-open:active { transform: scale(0.98); }
    .btn-store {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; background: transparent; color: var(--muted);
      font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500;
      padding: 12px; border-radius: 14px; border: 1px solid var(--border);
      cursor: pointer; text-decoration: none; transition: border-color 0.2s, color 0.2s;
    }
    .btn-store:hover { border-color: rgba(255,255,255,0.15); color: var(--text); }
    .divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; }
    .divider-line { flex: 1; height: 1px; background: var(--border); }
    .divider-text { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .not-found { text-align: center; padding: 48px 32px; }
    .not-found-icon { font-size: 48px; margin-bottom: 20px; display: block; }
    .not-found-title { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
    .not-found-desc { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 28px; }
    .footer-note {
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
      font-size: 12px; color: rgba(240,237,232,0.2);
      font-family: 'DM Mono', monospace; white-space: nowrap; z-index: 1;
    }
    @media (max-width: 480px) { .body { padding: 22px 24px 28px; } .pod-name { font-size: 26px; } }
  </style>
</head>
<body>

<div class="bg-glow"></div>
<div class="bg-grid"></div>

${!code || !pod ? `
<div class="card">
  <div class="not-found">
    <span class="not-found-icon">🌊</span>
    <h1 class="not-found-title">${!code ? 'No pod code' : 'Pod not found'}</h1>
    <p class="not-found-desc">${!code ? 'This link is missing a pod code.' : 'This pod may have ended or the link is incorrect.'}</p>
    <a href="https://podplananything.com" class="btn-open">← Back to Pod</a>
  </div>
</div>
` : `
<div class="card">
  <div class="cover-wrap">
    ${pod.coverPhoto
      ? `<img class="cover" src="${pod.coverPhoto}" alt="${pod.name}" /><div class="cover-scrim"></div>`
      : `<div class="cover-fallback"><div class="cover-logo"><svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="10" fill="#FF4F00" opacity="0.9"/><circle cx="18" cy="18" r="16" stroke="#FF4F00" stroke-width="1.5" opacity="0.3"/><circle cx="18" cy="18" r="22" stroke="#FF4F00" stroke-width="1" opacity="0.12"/></svg></div></div>`
    }
  </div>
  <div class="body">
    <div class="badge"><span class="badge-dot"></span>You're invited</div>
    <h1 class="pod-name">${pod.name}</h1>
    <div class="pod-meta">
      <span>${pod.memberCount} ${pod.memberCount === 1 ? 'member' : 'members'} inside</span>
      <span class="meta-dot"></span>
      <span>Pod · ${code}</span>
    </div>
    <a href="${appLink}" class="btn-open" id="open-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      Open in Pod
    </a>
    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-text">don't have the app?</span>
      <div class="divider-line"></div>
    </div>
    <a href="https://apps.apple.com/app/id6760986946" class="btn-store">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
      Download Pod on the App Store
    </a>
  </div>
</div>
`}

<p class="footer-note">podplananything.com</p>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).send(html);

  } catch (err) {
    console.error('Join page error:', err);
    res.status(500).json({ error: err.message });
  }
}