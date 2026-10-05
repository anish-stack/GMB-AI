/**
 * Guided tour of the panel. `target` is a CSS selector; steps whose target isn't
 * on screen (hidden menu item, mobile) are shown as a centred card instead.
 */
const nav = (href) => `aside a[href="${href}"]`;

export const PANEL_TOUR = [
  { title: "Welcome to your GMB panel 👋", body: "A 2-minute tour of how to run Google Business Profiles here: connect listings, plan posts, let AI write them, review, publish and track results. Use ← → keys or the buttons." },
  { target: nav("/clients"), title: "1. Clients", body: "Every business you manage is a client. Add one with just the business name - after you send the Google connect link, its category, services, keywords, logo and links are imported automatically." },
  { target: nav("/gmb"), title: "2. GMB profiles", body: "All connected listings. “Import all listings from Google” connects one Google login and turns every listing into its own client - no switching locations. Open a profile to edit info, services, products, photos, Q&R, links/QR and the website." },
  { target: nav("/gmb/calendar"), title: "3. Content calendar", body: "Plan posts per client: date, time, topic, keywords and button - or upload many at once with “Import Excel”. Posting-plan limits (posts per week / total) are enforced here." },
  { target: '[data-tour="run-ai"]', title: "4. Run AI job", body: "Writes the scheduled posts now (it also runs automatically every night): research → keywords → 1200-1500 character post → humanize → branded image → quality check." },
  { target: nav("/gmb/tasks"), title: "5. Review queue", body: "Check each post: human-vs-AI score, quality score, keywords, button and image. Edit, regenerate, approve and publish to Google. Turn on auto-publish per profile to post QA 80+ automatically at the scheduled time." },
  { target: nav("/reviews"), title: "6. Review inbox", body: "Every client's Google reviews in one place with AI reply drafts. Switch on auto-reply per profile for 4-5★ reviews; low ratings always wait for you." },
  { target: nav("/keywords"), title: "7. Keywords", body: "Primary, secondary and local keywords per client - from real Google search terms and AI. Posts use them automatically." },
  { target: nav("/listing-health"), title: "8. Listing health", body: "Warns about suspensions, lost access, duplicates, unanswered reviews and stale profiles before they hurt rankings." },
  { target: nav("/rank-tracker"), title: "9. Rank tracker", body: "Grid heat-map of where a listing ranks on Google Maps for a keyword across the city, with competitors." },
  { target: nav("/analytics"), title: "10. Analytics & reports", body: "Views, calls, website clicks and directions. From a GMB profile you can download or share a branded PDF report with the client." },
  { target: '[data-tour="bell"]', title: "11. Notifications", body: "New reviews, finished AI jobs, auto-published posts and health alerts appear here (and as phone push notifications if you allow them)." },
  { target: '[data-tour="credits"]', title: "12. Credits", body: "AI writing and images use credits from your plan. See usage and top up under Billing & plan." },
  { target: '[data-tour="help"]', title: "That's it! 🎉", body: "Re-open this tour any time from this button. Inside a GMB profile, the Website tab builds a full website from the Google data in one click." },
];
