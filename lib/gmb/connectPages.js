

const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const STYLE = `body{font-family:system-ui,Segoe UI,Arial;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}
.card{background:#fff;max-width:560px;width:100%;padding:28px;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.12)}
h1{font-size:19px;margin:0 0 6px;color:#0f172a} p{font-size:14px;color:#475569;line-height:1.6;margin:0 0 10px}
label.loc{display:flex;gap:12px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:8px 0;cursor:pointer}
label.loc:hover{border-color:#F53236} .t{font-weight:600;color:#0f172a;font-size:14px} .a{font-size:12px;color:#64748b}
button{margin-top:14px;width:100%;background:#F53236;color:#fff;border:0;border-radius:10px;padding:12px;font-weight:600;font-size:14px;cursor:pointer}
.ok{color:#047857}.bad{color:#b91c1c}`;

export function resultPage(ok, message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Business Profile</title><style>${STYLE}</style></head>
<body><div class="card" style="text-align:center"><h1 class="${ok ? "ok" : "bad"}">${ok ? "Connected successfully" : "Connection failed"}</h1><p>${esc(message)}</p>
<p style="font-size:12px;color:#94a3b8">You can close this window. Nothing is posted without your agency's review.</p></div></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** "Which listing should we manage?" - shown when the Google login has more than one. */
export function pickerPage(token, locations, email) {
  const items = locations
    .map((l, i) => {
      const a = l.location.storefrontAddress || {};
      const addr = [...(a.addressLines || []), a.locality].filter(Boolean).join(", ");
      return `<label class="loc"><input type="radio" name="location" value="${esc(l.location.name)}" ${i === 0 ? "checked" : ""} required>
<span><span class="t">${esc(l.location.title || l.location.name)}</span><br><span class="a">${esc(addr || l.account)}</span></span></label>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choose your business</title><style>${STYLE}</style></head>
<body><form class="card" method="POST" action="/api/gmb/connect/select">
<h1>Which business should we manage?</h1>
<p>${esc(email || "This Google account")} manages ${locations.length} listings. Pick the ONE this connection is for - only that listing will be linked. Choose &ldquo;All listings&rdquo; only if every listing should be managed.</p>
<input type="hidden" name="t" value="${esc(token)}">${items}
<label class="loc" style="border-style:dashed"><input type="radio" name="location" value="__all__">
<span><span class="t">All ${locations.length} listings</span><br><span class="a">Connect every listing - this connection keeps &ldquo;${esc(locations[0].location.title || locations[0].location.name)}&rdquo;, each other listing is added as its own client.</span></span></label>
<button type="submit">Connect</button></form></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
