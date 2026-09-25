# Kya change hua (GMB report + duplicate post/image fix)

## 1. GMB past-performance report (naya) - download + owner ko email
Haan, Google API se past data mil sakta hai - already tha (`lib/gmb/googleProvider.js`
-> `getPerformance()`, Business Profile Performance API use karta hai). Bas UI/route
nahi tha download/email karne ka, wo add kiya:

- NEW  lib/reports/gmbReport.js          -> CSV banata hai (daily views/clicks/calls + posts)
- NEW  app/api/gmb/[id]/report/route.js  -> GET = CSV download, POST = owner ko email
- NEW  components/gmb-report-actions.js -> "Download report" + "Email report to owner" buttons
- EDIT lib/mail/templates.js             -> gmbReportEmail() template
- EDIT lib/mail/transport.js, queue.js   -> attachment (CSV) support email queue me
- EDIT app/(app)/gmb/[id]/page.js        -> buttons wire kiye page ke top action bar me

Email kisko jaata hai: client.google_email (jo Google OAuth connect ke time save hota
hai - GMB owner ka hi email hota hai). Agar wo nahi hai to error dikhega "connect GMB
first" - tab tum ?to= override bhej sakte ho POST body me `{ to: "owner@x.com" }`.
Live data na mile (API not approved / token expired) to gmb_performance cache se
fallback hota hai - report tab bhi jaata hai, bas note kar deta hai "cache_fallback".

## 2. Duplicate post/image bug - fix

Asli bug (2 jagah):

a) lib/ai/agents/topic.js -> rotateService() fallback function galat tha: ye
   service name ("SEO") ko poore purane topic string ("Search Engine Optimization
   (SEO) in Delhi") se compare kar raha tha - kabhi match hi nahi hota, isliye
   dedupe fallback hamesha wahi service/topic wapas de deta tha. FIX: ab word-level
   normalize karke check karta hai + AI ka topic bhi normalize (punctuation/case
   hata ke) compare hota hai, sirf exact string match nahi.

b) lib/ai/orchestrator.js -> content duplicate-check retry ke baad bhi agar QA score
   achha aata tha to seedha "READY FOR REVIEW" (auto-publishable) ban jaata tha,
   chahe content abhi bhi duplicate flag ho. Image ka to duplicate-check tha hi
   nahi. FIX:
   - image ka sha256 hash nikalta hai ab (lib/images/imageService.js), pichle
     images ke hash se compare karta hai (lib/repo/imageCandidates.js ->
     getRecentImageHashes), same mila to 1 retry alag concept ke saath.
   - Content YA image, dono me se koi bhi duplicate reh jaaye to status force
     "NEEDS_REVIEW" hoga - auto publish nahi hoga, staff dekh ke decide karega.

## DB migration chahiye (nayi column `content_hash`)
  mysql -u root -p gmb_ai < db/upgrade-image-dedupe.sql

(fresh install karoge to db/schema.sql me already column hai, ye sirf existing DB
ke liye hai.)

Iske baad bhi agar client ke paas services/keywords hi kam hain (jaise sirf "SEO"
1 service h), to AI thodi der me wapas wahi topic pe aa sakta hai - ye normal hai,
bas ab wo READY FOR REVIEW nahi banega seedha, review queue me "Needs attention"
dikhega taki tum manually dekh ke reject/edit kar sako.
