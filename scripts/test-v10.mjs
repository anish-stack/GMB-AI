import "dotenv/config";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
const B="http://localhost:3258"; const R=[]; const ok=(n,c,i="")=>R.push([c?"PASS":"FAIL",n,String(i).slice(0,150)]);
const sql=(q)=>execSync(`mysql -uroot -proot --default-character-set=utf8mb4 gmb_ai -N -e "${q.replace(/"/g,'\\"')}"`).toString().trim();
const login=async(e,p)=>{const r=await fetch(B+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:e,password:p})});return r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");};
const o=await login("owner@hovermedia.in","owner123"), a=await login("superadmin@gmbai.cloud","super123"), t2=await login("owner@peakdigital.in","owner123");
const j=async(p,opt={},ck=o)=>{const r=await fetch(B+p,{...opt,headers:{cookie:ck,...(opt.body&&typeof opt.body==="string"?{"content-type":"application/json"}:{}),...(opt.headers||{})},redirect:"manual"});const ct=r.headers.get("content-type")||"";return{status:r.status,ct,loc:r.headers.get("location"),data:ct.includes("json")?await r.json().catch(()=>null):ct.includes("image")?await r.arrayBuffer():await r.text()};};
const post=(p,b,ck=o)=>j(p,{method:"POST",body:JSON.stringify(b)},ck);
try{
// tracked keywords
let r=await j("/api/gmb/1/tracked-keywords"); ok("tracked: limit + suggestions",r.status===200&&r.data.limit>0&&r.data.suggestions.length>5,`limit ${r.data?.limit}, ${r.data?.suggestions?.length} sugg: ${r.data?.suggestions?.slice(0,3).map(s=>s.keyword).join(" | ")}`);
r=await post("/api/gmb/1/tracked-keywords",{action:"add",keywords:"best dentist in rohini, dental clinic near me, best dentist in rohini"}); ok("add comma list (dupe skipped)",r.data.added?.length===2&&r.data.skipped?.length===1,JSON.stringify(r.data));
sql("UPDATE plans SET max_keywords_client=5 WHERE id=(SELECT plan_id FROM subscriptions WHERE tenant_id=1 ORDER BY id DESC LIMIT 1)");
const lim=(await j("/api/gmb/1/tracked-keywords")).data.limit;
r=await post("/api/gmb/1/tracked-keywords",{action:"add",keywords:Array.from({length:lim+3},(_,i)=>"kw number "+i)}); ok("slot limit enforced",(await j("/api/gmb/1/tracked-keywords")).data.tracked.length===lim,`limit ${lim}`);
const tid=(await j("/api/gmb/1/tracked-keywords")).data.tracked[0].id; await post("/api/gmb/1/tracked-keywords",{action:"remove",id:tid}); ok("remove",(await j("/api/gmb/1/tracked-keywords")).data.tracked.length===lim-1);
r=await j("/api/gmb/1/tracked-keywords",{},t2); ok("tracked: other tenant blocked",r.status===404||r.status===403,r.status);
// pages
for(const p of ["/gmb/1/services/new","/gmb/1/services/0","/gmb/1/products/new","/gmb/1/audit","/gmb/1/review-qr","/gmb/1?tab=keywords","/billing","/rank-tracker?client=1&keywords=a,b"]){r=await j(p);ok(`page ${p}`,r.status===200,r.status);}
r=await j("/gmb/1/audit"); ok("audit has score + checks",/\/ 100/.test(r.data)&&r.data.includes("No keyword stuffing")&&r.data.includes("Review responses"));
// services save via API (mock)
const sv=(await j("/api/gmb/1/services")).data; r=await j("/api/gmb/1/services",{method:"PUT",body:JSON.stringify({items:[...sv.items,{name:"Teeth polishing",category:sv.categories[0].id,description:"Quick polish",price:499}]})}); ok("service add (PUT list)",r.status===200&&(await j("/api/gmb/1/services")).data.items.some(i=>i.name==="Teeth polishing"),r.status);
// review flow
r=await j("/api/gmb/1/review-flow"); const slug=r.data.flow.slug; ok("review flow created",r.status===200&&slug&&r.data.flow.steps.length===2&&r.data.flowUrl.endsWith(slug),slug);
r=await j(`/review/${slug}`,{},""); ok("public review page (no login)",r.status===200&&r.data.includes("How was your experience"));
r=await post(`/api/public/review/${slug}`,{action:"scan"},""); ok("scan counted",r.status===200&&sql("select scans from review_flows where client_id=1")==="1");
r=await post(`/api/public/review/${slug}`,{action:"suggest",rating:5,picks:["Friendly staff","Quick service"],lang:"English"},""); ok("3 AI drafts",r.data.reviews?.length===3,r.data.reviews?.[0]);
r=await post(`/api/public/review/${slug}`,{action:"feedback",rating:2,message:"Waited 40 minutes",name:"Ravi"},""); ok("private feedback stored + notified",r.status===200&&sql("select count(*) from review_feedback where client_id=1")==="1"&&Number(sql("select count(*) from notifications where title like 'Private feedback%'"))>=1);
r=await post(`/api/public/review/${slug}`,{action:"google",rating:5},""); ok("google click counted",sql("select google_clicks from review_flows where client_id=1")==="1");
r=await j("/api/gmb/1/review-flow",{method:"PUT",body:JSON.stringify({mode:"AI",threshold:4,steps:[{title:"Best part?",options:["Doctor","Staff"]}],poster:{style:"midnight",accent:"#DB2777",headline:"Love us? Review us!",subtitle:"30 seconds",steps:["Scan","Pick","Post"]}})}); ok("save flow + poster",r.data.flow.poster.style==="midnight"&&r.data.flow.steps.length===1);
r=await j("/api/gmb/1/review-qr?format=png"); ok("branded QR PNG",r.status===200&&r.ct.includes("image/png")&&r.data.byteLength>5000,r.data?.byteLength);
r=await j("/api/gmb/1/review-qr?poster=1"); ok("A4 poster PNG",r.status===200&&r.ct.includes("image/png")&&r.data.byteLength>20000,r.data?.byteLength);
r=await j("/api/gmb/1/review-qr?format=svg"); ok("QR SVG",r.status===200&&String(r.ct).includes("svg"));
r=await j("/api/gmb/1/review-qr?format=png",{},t2); ok("QR other tenant blocked",r.status===404);
// automation
r=await j("/api/clients/1/auto-publish"); ok("automation diagnostics",r.status===200&&"auto_schedule" in r.data&&r.data.schedule_mode==="plan"&&r.data.scheduler,JSON.stringify(r.data).slice(0,120));
const { autoScheduleFromPlans } = await import("../lib/posting/autoSchedule.js");
sql("DELETE FROM content_calendar WHERE client_id IN (SELECT id FROM clients WHERE tenant_id=1)"); sql("DELETE FROM ai_tasks WHERE tenant_id=1");
sql("UPDATE client_posting_plans SET status='ACTIVE', start_date=CURDATE()-INTERVAL 1 DAY, end_date=CURDATE()+INTERVAL 60 DAY, posting_days=NULL, posts_per_week=7 WHERE client_id=1 AND status<>'REPLACED'");
const day=new Date(Date.now()+86400000).toLocaleDateString("en-CA");
let s1=await autoScheduleFromPlans(day,{clientId:1}); ok("auto-schedule creates entry from plan",s1.scheduled===1&&sql(`select source from content_calendar where client_id=1 and scheduled_date='${day}'`)==="auto",JSON.stringify(s1));
s1=await autoScheduleFromPlans(day,{clientId:1}); ok("no duplicate same day",s1.scheduled===0);
const ws=(v)=>fetch(B+"/api/admin/web-settings",{method:"PATCH",headers:{cookie:a,"content-type":"application/json"},body:JSON.stringify({auto_schedule_mode:v})});
r=await ws("manual");
const day2=new Date(Date.now()+2*86400000).toLocaleDateString("en-CA"); s1=await autoScheduleFromPlans(day2,{clientId:1}); ok("admin MANUAL mode stops auto-schedule",Boolean(s1.disabled),JSON.stringify(s1)+" admin:"+r.status);
r=await j("/api/clients/1/auto-publish"); ok("card shows manual mode",r.data.schedule_mode==="manual");
await ws("plan");
// rank multiple keywords (no Places key here -> clean error)
r=await post("/api/rank/scans",{client_id:1,keywords:"a b c, dentist rohini",grid_size:3,spacing_km:1}); ok("rank multi-keyword request handled",[200,400,409,503].includes(r.status),`${r.status} ${JSON.stringify(r.data).slice(0,90)}`);
// autopay
r=await j("/api/billing/autopay"); ok("autopay status",r.status===200&&"available" in r.data,JSON.stringify(r.data).slice(0,140));
const subId=sql("select id from subscriptions where tenant_id=1 order by id desc limit 1"); const before=sql(`select current_period_end from subscriptions where id=${subId}`);
sql(`UPDATE subscriptions SET rzp_subscription_id='sub_TEST1', autopay_status='AUTHENTICATED', price=999 WHERE id=${subId}`);
const ev=JSON.stringify({event:"subscription.charged",payload:{subscription:{entity:{id:"sub_TEST1",charge_at:Math.floor(Date.now()/1000)+2592000}},payment:{entity:{id:"pay_TEST1",amount:117882,status:"captured",order_id:null}}}});
const sig=crypto.createHmac("sha256","whsec_x").update(ev).digest("hex");
r=await fetch(B+"/api/payments/razorpay/webhook",{method:"POST",headers:{"content-type":"application/json","x-razorpay-signature":sig},body:ev}); const wj=await r.json();
const after=sql(`select concat(status,'|',current_period_end,'|',autopay_status) from subscriptions where id=${subId}`);
ok("webhook charged -> period extended + ACTIVE",r.status===200&&after.startsWith("ACTIVE|")&&after.split("|")[1]>String(before)&&after.endsWith("ACTIVE"),`${before} -> ${after} ${JSON.stringify(wj)}`);
ok("invoice PAID + payment row",sql("select count(*) from payments where gateway_payment_id='pay_TEST1'")==="1"&&sql(`select status from invoices where tenant_id=1 order by id desc limit 1`)==="PAID");
r=await fetch(B+"/api/payments/razorpay/webhook",{method:"POST",headers:{"content-type":"application/json","x-razorpay-signature":sig},body:ev}); const wj2=await r.json(); ok("webhook idempotent",wj2.duplicate===true&&sql("select count(*) from payments where gateway_payment_id='pay_TEST1'")==="1",JSON.stringify(wj2));
const ev2=JSON.stringify({event:"subscription.halted",payload:{subscription:{entity:{id:"sub_TEST1"}}}}); r=await fetch(B+"/api/payments/razorpay/webhook",{method:"POST",headers:{"content-type":"application/json","x-razorpay-signature":crypto.createHmac("sha256","whsec_x").update(ev2).digest("hex")},body:ev2});
ok("halted -> PAST_DUE",sql(`select concat(status,'|',autopay_status) from subscriptions where id=${subId}`)==="PAST_DUE|HALTED");
r=await fetch(B+"/api/payments/razorpay/webhook",{method:"POST",headers:{"content-type":"application/json","x-razorpay-signature":"bad"},body:ev}); ok("bad webhook signature rejected",r.status===400);
r=await post("/api/billing/autopay",{action:"confirm",razorpay_payment_id:"pay_x",razorpay_subscription_id:"sub_TEST1",razorpay_signature:"nope"}); ok("checkout signature verified",r.status===400,r.data?.error);
const good=crypto.createHmac("sha256","secret_x").update("pay_x|sub_TEST1").digest("hex"); r=await post("/api/billing/autopay",{action:"confirm",razorpay_payment_id:"pay_x",razorpay_subscription_id:"sub_TEST1",razorpay_signature:good}); ok("valid signature -> AUTHENTICATED",r.status===200&&r.data.status==="AUTHENTICATED",JSON.stringify(r.data).slice(0,100));
r=await post("/api/billing/autopay",{action:"cancel"}); ok("cancel autopay (gateway unreachable -> handled)",r.status===200&&r.data.status==="CANCELLED"||r.status===502,`${r.status} ${JSON.stringify(r.data).slice(0,100)}`);
// connect picker
const { pickerPage } = await import("../lib/gmb/connectPages.js"); const html=await pickerPage("t",Array.from({length:25},(_,i)=>({account:"a",location:{name:"locations/"+i,title:"Shop "+i}})),"x").text(); ok("picker: search + pagination + sticky bar",html.includes('id="q"')&&html.includes("per=10")&&html.includes("position:fixed"));
// view on google
r=await j("/gmb/tasks"); ok("review queue renders",r.status===200);
}catch(e){console.log("CRASH",e);}
for(const q of R)console.log(q.join(" | ")); console.log(`\n${R.filter(q=>q[0]==="PASS").length}/${R.length} passed`); process.exit(0);
