import { GoogleAuth } from 'google-auth-library';

const DB = 'https://pakky-1f238-default-rtdb.firebaseio.com';

// ─── WHY THIS READS WITH CREDENTIALS ──────────────────────────────────────────
// These fields used to be world-readable, so plain unauthenticated fetches
// worked. The app's database.rules.json has since tightened trips/$code/name,
// /coverPhoto and /memberCount to ".read": "auth != null" — closing the hole
// where anyone with the database URL and a guessable pod code could read a
// pod's name, cover and roster size.
//
// After that change every anonymous REST read here returned HTTP 401 with the
// JSON BODY {"error":"Permission denied"}, and the old code called .json() on
// it without checking res.ok. That parses to an OBJECT, which is truthy and is
// not the string 'null', so it sailed through the `if (name && name !== 'null')`
// guard and got interpolated straight into the meta tags — the "[object Object]"
// invite card. og:image got it too, which is why the preview also lost its
// picture. The link itself never broke, because the OG tags are cosmetic and
// the universal-link association is driven by the AASA file, not by metadata.
//
// A service-account access token grants admin access to RTDB, bypassing rules
// entirely — so this keeps working if the rules are tightened further.
//
// Deliberately google-auth-library rather than firebase-admin: the full Admin
// SDK pulls in the @firebase/*-compat chain (and on v14 that chain has an
// undeclared @firebase/app dependency that fails to resolve), which is a lot of
// weight and a lot of failure surface for what is three field reads on a
// mostly-static marketing site. This keeps the plain fetch calls below.
//
// Needs FIREBASE_SERVICE_ACCOUNT in the Vercel project: Firebase console →
// Project settings → Service accounts → Generate new private key, pasted as a
// single line of JSON.
const SCOPES = [
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email',
];

let authClient = null;

// The library caches the token and refreshes it before expiry, so on a warm
// lambda this costs nothing after the first call.
const getAccessToken = async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    if (!authClient) {
      const auth = new GoogleAuth({
        credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
        scopes:      SCOPES,
      });
      authClient = await auth.getClient();
    }
    const { token } = await authClient.getAccessToken();
    return token || null;
  } catch (err) {
    // A missing or malformed key must not take the page down — see the
    // three-state render below.
    console.error('[join] could not mint access token:', err.message);
    authClient = null;
    return null;
  }
};

// ─── ESCAPING IS NOT OPTIONAL HERE ────────────────────────────────────────────
// Everything interpolated below is attacker-controlled. `code` comes straight
// off the query string (.toUpperCase() does not remove < or "), and pod names
// are freely editable by any member from inside the app. Unescaped, a pod named
// `"><script>…` is stored XSS delivered by a normal-looking invite link, and
// /join/"><script>… is reflected XSS needing no pod at all.
const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Cover photos are Firebase Storage URLs. Anything that is not a plain https
// link does not belong in an src= or an og:image.
const safeUrl = (v) => {
  if (typeof v !== 'string') return null;
  try {
    return new URL(v).protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  try {
    // Constraining the shape here is what stops a crafted path from reaching the
    // markup at all, and it also avoids a pointless database round-trip for
    // obvious junk. The upper bound stays 16 so a legacy pod-code link still
    // reaches the "links have changed" card instead of "no code".
    // Separators are stripped first, mirroring normalizeInviteCode() in the app
    // (src/api/invites.ts). The app *displays* codes dashed — K7M2-QX4P — so a
    // code that reaches this URL by way of a human copying the one they were
    // shown arrives with a dash in it, and the shape test below would have
    // thrown it out as "no code at all".
    const raw  = String(req.query?.code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const code = /^[A-Z0-9]{2,16}$/.test(raw) ? raw : '';

    // ── WHAT THE PATH SEGMENT ACTUALLY IS NOW ─────────────────────────────────
    // It is an INVITE code, not a pod code — 8 characters of Crockford base32,
    // minted by functions/src/invites.ts, stored at invites/{CODE} and expiring
    // in ten minutes. This page was written for the old scheme and still looked
    // up trips/{segment}/name, which an invite code can never match. So every
    // real invite link fell through to `lookupOk && !pod` and rendered
    // "Pod not found" — telling every invitee that the pod they were just
    // invited to does not exist.
    const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const looksLikeInvite =
      code.length === 8 && [...code].every((ch) => INVITE_ALPHABET.includes(ch));

    // ── THE LINK THAT OPENS THE APP FROM INSIDE AN IN-APP BROWSER ─────────────
    // This used to be the https URL — the same address as this very page. Inside
    // Instagram's (or Facebook's, or Snapchat's) embedded WKWebView that is a
    // loop: iOS only hands an https URL to the app via the AASA association when
    // the tap happens somewhere that honours universal links, which an app's own
    // web view explicitly does not. Tapping "Open in Pod" there just reloaded
    // this page inside the same in-app browser, forever.
    //
    // A custom scheme is the one thing that does escape an in-app web view, on a
    // user gesture. `pod` is the app's registered scheme (app.json) and
    // expo-router maps pod://join/CODE onto the same screen the universal link
    // reaches, so nothing in the app has to change.
    const appLink   = `pod://join/${encodeURIComponent(code)}`;
    const storeLink = 'https://apps.apple.com/app/id6760986946';

    // Which apps open links in their own web view instead of handing them to
    // Safari. Used only to add a hint — never to change what the buttons do.
    const ua = String(req.headers?.['user-agent'] || '');
    const inAppBrowser =
      /Instagram/i.test(ua)                 ? 'Instagram'
      : /FBAN|FBAV|FB_IAB/i.test(ua)        ? 'Facebook'
      : /Snapchat/i.test(ua)                ? 'Snapchat'
      : /TikTok|BytedanceWebview/i.test(ua) ? 'TikTok'
      : /LinkedInApp/i.test(ua)             ? 'LinkedIn'
      : /Line\//i.test(ua)                  ? 'LINE'
      : null;

    // ── STATES ────────────────────────────────────────────────────────────────
    //   'no-code'  → nothing usable in the path
    //   'legacy'   → an old /join/{POD-NAME} link; those stopped being a way in
    //   'invalid'  → shaped like an invite, but no such invite exists
    //   'stale'    → the invite existed and is expired, revoked or used up
    //   'ok'       → live invite, pod resolved
    //   'degraded' → could not reach the database; say nothing, offer the app
    let state = code ? (looksLikeInvite ? 'invalid' : 'legacy') : 'no-code';
    let pod   = null;

    if (looksLikeInvite) {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('no service-account token available');

        const q    = `?access_token=${encodeURIComponent(token)}`;
        const opts = { headers: { Accept: 'application/json' } };

        const inviteRes = await fetch(`${DB}/invites/${code}.json${q}`, opts);

        // ── CHECK res.ok BEFORE .json(). ──────────────────────────────────────
        // RTDB answers a rejected read with HTTP 401 and a JSON *body* of
        // {"error":"Permission denied"}. .json() parses that perfectly happily
        // into an object, and a truthiness check passes an object. Without this
        // guard the error payload becomes the invite.
        if (!inviteRes.ok) throw new Error(`RTDB responded ${inviteRes.status}`);
        const invite = await inviteRes.json();

        if (!invite || typeof invite !== 'object' || typeof invite.podCode !== 'string') {
          state = 'invalid';
        } else if (
          invite.revoked === true ||
          !(typeof invite.expiresAt === 'number' && Date.now() < invite.expiresAt) ||
          (typeof invite.maxUses === 'number' && invite.uses >= invite.maxUses)
        ) {
          // Same three conditions functions/src/invites.ts checks, in the same
          // order. A stale code must not reveal the pod — see below.
          state = 'stale';
        } else {
          const podCode = invite.podCode;
          const [nameRes, photoRes, countRes] = await Promise.all([
            fetch(`${DB}/trips/${encodeURIComponent(podCode)}/name.json${q}`,        opts),
            fetch(`${DB}/trips/${encodeURIComponent(podCode)}/coverPhoto.json${q}`,  opts),
            fetch(`${DB}/trips/${encodeURIComponent(podCode)}/memberCount.json${q}`, opts),
          ]);
          for (const r of [nameRes, photoRes, countRes]) {
            if (!r.ok) throw new Error(`RTDB responded ${r.status}`);
          }
          const [name, coverPhoto, memberCount] = await Promise.all([
            nameRes.json(), photoRes.json(), countRes.json(),
          ]);

          // Check the TYPE, not truthiness — the second half of the same lesson.
          if (typeof name === 'string' && name.trim()) {
            state = 'ok';
            pod = {
              name:       name.trim(),
              coverPhoto: safeUrl(coverPhoto),
              // Legitimately absent on older pods — maintained by the onWrite
              // Cloud Function, not written by clients. null means "make no
              // claim", which reads better than "0 people already in".
              memberCount:
                typeof memberCount === 'number' && memberCount > 0 ? memberCount : null,
            };
          } else {
            state = 'invalid'; // live invite pointing at a deleted pod
          }
        }
      } catch (err) {
        console.error('[join] firebase read failed:', err.message);
        state = 'degraded';
      }
    }

    // ── WHY A LEGACY CODE IS NEVER LOOKED UP ──────────────────────────────────
    // The previous version read trips/{segment} for ANY 2-16 character segment,
    // using the service-account token — which bypasses database rules. Those
    // rules had just been tightened to "auth != null" precisely because pod
    // codes are guessable words (MINH, BEACHTRIP), and this endpoint handed the
    // name, cover photo and member count of any guessed pod back to anonymous
    // callers, from the open internet, with no rate limit. That is the exact
    // hole the invite system was built to close. A code only earns a database
    // read here if it is shaped like an invite, and only a currently-valid
    // invite ever renders pod details.

    const title =
      state === 'ok' ? `Join ${pod.name} on Pod` : 'Join a Pod';
    const description =
      state === 'ok' && pod.memberCount
        ? `${pod.memberCount} ${pod.memberCount === 1 ? 'person' : 'people'} already in · Plan anything, with anyone.`
        : 'Plan anything, with anyone.';
    const ogImage = state === 'ok' ? pod.coverPhoto : null;

    // ── EVERY CARD OFFERS A WAY IN ────────────────────────────────────────────
    // The old "Pod not found" card rendered exactly one link — "← Back to Pod",
    // pointing at the marketing home page. So the single most motivated visitor
    // this site ever gets, someone who was just personally invited somewhere,
    // was shown an error and sent to a brochure: no app link, no App Store link,
    // nothing. Whatever went wrong with the code, the app and the store are
    // always the two things worth offering.
    const notice = {
      'no-code':  { icon: '🌊', title: 'No invite code',
                    desc: 'This link is missing its code. Ask whoever invited you to send a fresh one.' },
      'legacy':   { icon: '🌊', title: 'Invite links have changed',
                    desc: 'Pod links now use an 8-character code that expires. Ask someone in the pod to send you a new invite.' },
      'invalid':  { icon: '🌊', title: "This invite isn't valid",
                    desc: 'It may have been revoked, or the link may have been cut short on its way to you.' },
      'stale':    { icon: '⏳', title: 'This invite has expired',
                    desc: 'Invites last about ten minutes on purpose. Ask whoever sent it for a new one — it takes them a tap.' },
      'degraded': { icon: '🐋', title: 'Join a Pod',
                    desc: "We couldn't load the details for this invite just now. The app can still open it." },
    }[state];

    const openBtn = code ? `
    <a href="${esc(appLink)}" class="btn-open" id="open-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      Open in Pod
    </a>` : '';

    // Shown only when we can see we're inside someone's in-app browser. It never
    // changes what the buttons do — the pod:// button above normally escapes the
    // web view on its own — it just names the escape hatch for the cases where
    // the host app swallows the tap.
    const hint = inAppBrowser ? `
    <p class="hint">Opened from ${esc(inAppBrowser)}. Its built-in browser can't hand links to apps on its own — if the button above does nothing, tap <strong>⋯</strong> in the corner and choose <strong>Open in browser</strong>.</p>` : '';

    const buttons = `
    ${openBtn}
    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-text">${code ? "don't have the app?" : 'get the app'}</span>
      <div class="divider-line"></div>
    </div>
    <a href="${storeLink}" class="btn-store">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
      Download Pod on the App Store
    </a>
    ${hint}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>

  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url"         content="https://podplananything.com/join/${esc(code)}" />
  <meta property="og:site_name"   content="Pod" />
  <meta property="og:type"        content="website" />
  ${ogImage ? `
  <meta property="og:image"        content="${esc(ogImage)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:image"       content="${esc(ogImage)}" />
  ` : `
  <meta name="twitter:card" content="summary" />
  `}
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />

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
    .hint {
      font-size: 12px; line-height: 1.6; color: var(--muted);
      text-align: center; margin-top: 18px;
      padding-top: 16px; border-top: 1px solid var(--border);
    }
    .hint strong { color: var(--text); font-weight: 600; }
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

${state === 'ok' ? `
<div class="card">
  <div class="cover-wrap">
    ${pod.coverPhoto
      ? `<img class="cover" src="${esc(pod.coverPhoto)}" alt="${esc(pod.name)}" /><div class="cover-scrim"></div>`
      : `<div class="cover-fallback"><div class="cover-logo"><svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="10" fill="#FF4F00" opacity="0.9"/><circle cx="18" cy="18" r="16" stroke="#FF4F00" stroke-width="1.5" opacity="0.3"/><circle cx="18" cy="18" r="22" stroke="#FF4F00" stroke-width="1" opacity="0.12"/></svg></div></div>`
    }
  </div>
  <div class="body">
    <div class="badge"><span class="badge-dot"></span>You're invited</div>
    <h1 class="pod-name">${esc(pod.name)}</h1>
    <div class="pod-meta">
      ${pod.memberCount ? `
      <span>${pod.memberCount} ${pod.memberCount === 1 ? 'member' : 'members'} inside</span>
      <span class="meta-dot"></span>` : ''}
      <span>Pod · ${esc(code)}</span>
    </div>
    ${buttons}
  </div>
</div>
` : `
<div class="card">
  <div class="body" style="padding-top:40px">
    <div style="text-align:center;margin-bottom:26px">
      <span class="not-found-icon">${notice.icon}</span>
      <h1 class="not-found-title">${notice.title}</h1>
      <p class="not-found-desc" style="margin-bottom:0">${notice.desc}</p>
    </div>
    ${buttons}
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
    // Never echo err.message to the client — this page is public and crawled,
    // and the original bug was exactly a Firebase internal ("Permission denied")
    // reaching the open web. Send a plain page that still gets a real invitee
    // to the App Store.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).send(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` +
      `<title>Join a Pod</title></head>` +
      `<body style="font-family:system-ui;background:#0A0A0B;color:#F0EDE8;` +
      `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
      `min-height:100dvh;margin:0;text-align:center;padding:24px">` +
      `<h1 style="font-size:22px;margin:0 0 10px">Something went wrong</h1>` +
      `<p style="opacity:0.5;font-size:14px;margin:0 0 24px">Try the link again in a moment.</p>` +
      `<a href="https://apps.apple.com/app/id6760986946" style="color:#FF4F00;font-weight:700">` +
      `Download Pod on the App Store</a></body></html>`
    );
  }
}