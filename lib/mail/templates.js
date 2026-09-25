import "server-only";

const BRAND = "#F53236";

function escapeHtml(s) {
  return String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

/** Shared wrapper so every email in the app looks the same. */
function shell({ title, preheader = "", bodyHtml }) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
        <tr><td style="background:${BRAND};padding:20px 28px;">
          <span style="color:#fff;font-size:16px;font-weight:600;">GMB AI Cloud</span>
        </td></tr>
        <tr><td style="padding:28px;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;color:#94a3b8;font-size:11px;">
          You are receiving this because you have an account or a connected Google Business Profile with GMB AI Cloud.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href, text) {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;margin-top:16px;">${escapeHtml(text)}</a>`;
}

/** ---------- 1. Welcome email, sent right after signup ---------- */
export function welcomeEmail({ ownerName, companyName, appUrl }) {
  const html = shell({
    title: "Welcome to GMB AI Cloud",
    preheader: `${companyName} is ready to go`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">Welcome, ${escapeHtml(ownerName)} 👋</h1>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 8px;">
        Your workspace <strong>${escapeHtml(companyName)}</strong> has been created. You can now add clients,
        connect their Google Business Profiles and let the AI pipeline start writing and publishing posts.
      </p>
      ${appUrl ? button(`${appUrl}/dashboard`, "Go to dashboard") : ""}
    `,
  });
  return { subject: `Welcome to GMB AI Cloud, ${ownerName}!`, html, text: `Welcome ${ownerName}! Your workspace ${companyName} is ready.` };
}

/** ---------- 2. OTP / 2FA login code ---------- */
export function otpEmail({ name, code, minutes, purpose = "LOGIN" }) {
  const heading = purpose === "RESET_PASSWORD" ? "Reset your password" : "Your sign-in code";
  const html = shell({
    title: heading,
    preheader: `Your verification code is ${code}`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">${heading}</h1>
      <p style="font-size:14px;color:#475569;margin:0 0 18px;">Hi ${escapeHtml(name || "there")}, use this code to continue:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:16px 0;text-align:center;">${code}</div>
      <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;">This code expires in ${minutes} minutes. If you didn't request this, you can ignore this email - your account is still safe.</p>
    `,
  });
  return { subject: `${code} is your GMB AI Cloud verification code`, html, text: `Your verification code is ${code}. It expires in ${minutes} minutes.` };
}

/** ---------- 3. Payment / invoice receipt ---------- */
export function paymentReceivedEmail({ tenantName, invoiceNo, amount, currency, planLabel, appUrl }) {
  const html = shell({
    title: "Payment received",
    preheader: `Invoice ${invoiceNo} - ${currency} ${amount}`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">Payment received ✅</h1>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 14px;">
        Thanks ${escapeHtml(tenantName)}! We've received your payment${planLabel ? ` for the <strong>${escapeHtml(planLabel)}</strong> plan` : ""}.
      </p>
      <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse;">
        <tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">Invoice</td><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;text-align:right;">${escapeHtml(invoiceNo)}</td></tr>
        <tr><td style="padding:6px 0;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(currency)} ${escapeHtml(amount)}</td></tr>
      </table>
      ${appUrl ? button(`${appUrl}/billing`, "View billing") : ""}
    `,
  });
  return { subject: `Payment received - Invoice ${invoiceNo}`, html, text: `Payment received. Invoice ${invoiceNo}, amount ${currency} ${amount}.` };
}

/** ---------- 4. Nightly AI run summary, sent once all of a tenant's tasks finish ---------- */
export function nightlySummaryEmail({ ownerName, date, rows, generated, failed, credits, appUrl }) {
  const tableRows = rows
    .map(
      (r) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">${escapeHtml(r.client)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;">${escapeHtml(r.title || "—")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">
          <span style="padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:${r.ok ? "#dcfce7" : "#fee2e2"};color:${r.ok ? "#166534" : "#991b1b"};">${escapeHtml(r.status)}</span>
        </td>
      </tr>`
    )
    .join("");

  const html = shell({
    title: "Your nightly AI run is complete",
    preheader: `${generated} posts generated for ${date}`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 6px;">Tonight's AI run is done ✅</h1>
      <p style="font-size:14px;color:#475569;margin:0 0 16px;">Hi ${escapeHtml(ownerName)}, here's what happened for <strong>${escapeHtml(date)}</strong>:</p>
      <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:10px;background:#f8fafc;border-radius:8px 0 0 8px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${generated}</div><div style="font-size:11px;color:#64748b;">Generated</div></td>
          <td style="padding:10px;background:#f8fafc;text-align:center;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${failed}</div><div style="font-size:11px;color:#64748b;">Failed</div></td>
          <td style="padding:10px;background:#f8fafc;border-radius:0 8px 8px 0;text-align:center;"><div style="font-size:20px;font-weight:700;color:#0f172a;">${credits}</div><div style="font-size:11px;color:#64748b;">Credits used</div></td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">CLIENT</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">POST</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:#64748b;border-bottom:2px solid #e2e8f0;">STATUS</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      ${appUrl ? button(`${appUrl}/tasks`, "Review posts") : ""}
    `,
  });
  return {
    subject: `Nightly AI run complete - ${generated} post(s) generated`,
    html,
    text: `Nightly AI run for ${date}: ${generated} generated, ${failed} failed, ${credits} credits used.`,
  };
}

/** ---------- 5. Post approved & published to Google Business Profile ---------- */
export function postPublishedEmail({ ownerName, businessName, title, description, ctaLabel, isMock, appUrl }) {
  const html = shell({
    title: "Your post just went live",
    preheader: title,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">Your post is live on Google 🎉</h1>
      <p style="font-size:14px;color:#475569;margin:0 0 14px;">Hi ${escapeHtml(ownerName)}, a new post for <strong>${escapeHtml(businessName)}</strong> was just published${isMock ? " (demo/mock mode)" : ""} to your Google Business Profile.</p>
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
        <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 6px;">${escapeHtml(title)}</p>
        <p style="font-size:13px;color:#475569;line-height:1.6;margin:0;">${escapeHtml(description).slice(0, 260)}${description && description.length > 260 ? "…" : ""}</p>
        ${ctaLabel ? `<p style="font-size:12px;color:#94a3b8;margin:8px 0 0;">CTA: ${escapeHtml(ctaLabel)}</p>` : ""}
      </div>
      ${appUrl ? button(`${appUrl}/tasks`, "View post") : ""}
    `,
  });
  return { subject: `Live on Google: "${title}"`, html, text: `Your post "${title}" was published to Google Business Profile for ${businessName}.` };
}

/** ---------- 6. Google Business Profile connected (mock -> real) ---------- */
export function gmbConnectedEmail({ businessName, googleEmail, locationLabel, appUrl }) {
  const html = shell({
    title: "Google Business Profile connected",
    preheader: `${businessName} is now connected to Google`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">Connected to Google ✅</h1>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 10px;">
        <strong>${escapeHtml(businessName)}</strong> is now connected to Google Business Profile${googleEmail ? ` as <strong>${escapeHtml(googleEmail)}</strong>` : ""}.
        Posts approved by your agency will now publish directly to your live listing${locationLabel ? ` (${escapeHtml(locationLabel)})` : ""} instead of the demo/mock mode.
      </p>
      ${appUrl ? button(appUrl, "Learn more") : ""}
    `,
  });
  return {
    subject: `Google Business Profile connected${businessName ? ` - ${businessName}` : ""}`,
    html,
    text: `${businessName} is now connected to Google Business Profile${googleEmail ? ` as ${googleEmail}` : ""}.`,
  };
}

/** ---------- Past-performance report, sent to the GMB owner on demand ---------- */
export function gmbReportEmail({ businessName, days, totals, source, appUrl }) {
  const liveNote =
    source === "google_live"
      ? "Live numbers straight from your Google Business Profile."
      : source === "mock"
      ? "Prototype/demo numbers - connect Google to see live figures."
      : "Numbers from the last successful sync (live fetch was unavailable just now).";
  const html = shell({
    title: "Your Google Business Profile report",
    preheader: `Last ${days} days for ${businessName}`,
    bodyHtml: `
      <h1 style="font-size:19px;color:#0f172a;margin:0 0 12px;">Your listing's last ${days} days</h1>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 14px;">
        Here's how <strong>${escapeHtml(businessName)}</strong> performed on Google Search &amp; Maps. The full daily breakdown and post list are attached as a CSV (opens in Excel/Google Sheets).
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
        <tr>
          <td style="padding:10px;text-align:center;background:#f8fafc;border-radius:8px;">
            <div style="font-size:20px;font-weight:700;color:#0f172a;">${totals.views}</div>
            <div style="font-size:11px;color:#94a3b8;">Views</div>
          </td>
          <td style="width:10px;"></td>
          <td style="padding:10px;text-align:center;background:#f8fafc;border-radius:8px;">
            <div style="font-size:20px;font-weight:700;color:#0f172a;">${totals.clicks}</div>
            <div style="font-size:11px;color:#94a3b8;">Website clicks</div>
          </td>
          <td style="width:10px;"></td>
          <td style="padding:10px;text-align:center;background:#f8fafc;border-radius:8px;">
            <div style="font-size:20px;font-weight:700;color:#0f172a;">${totals.calls}</div>
            <div style="font-size:11px;color:#94a3b8;">Calls</div>
          </td>
        </tr>
      </table>
      <p style="font-size:12px;color:#94a3b8;margin:0;">${liveNote}</p>
      ${appUrl ? button(appUrl, "View full dashboard") : ""}
    `,
  });
  return {
    subject: `Your Google Business Profile report - ${businessName}`,
    html,
    text: `${businessName}: ${totals.views} views, ${totals.clicks} clicks, ${totals.calls} calls over the last ${days} days. Full CSV attached.`,
  };
}
