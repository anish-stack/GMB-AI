

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

/**
 * "Which listing should we manage?" - shown when the Google login has more than one.
 * Search, pagination (10 per page) and a footer that stays visible at the bottom.
 */
export function pickerPage(token, locations, email) {
  const rows = locations
    .map((l) => {
      const a = l.location.storefrontAddress || {};
      const addr = [...(a.addressLines || []), a.locality].filter(Boolean).join(", ");
      const cat = l.location.categories?.primaryCategory?.displayName || "";
      return { name: l.location.name, title: l.location.title || l.location.name, addr: addr || cat || l.account, cat };
    });
  const data = JSON.stringify(rows).replace(/</g, "\\u003c");
  const first = esc(rows[0]?.title || "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choose your business</title>
<style>
*{box-sizing:border-box}body{font-family:system-ui,Segoe UI,Arial;background:#f1f5f9;margin:0;color:#0f172a}
.wrap{max-width:640px;margin:0 auto;padding:24px 16px 120px}
h1{font-size:20px;margin:6px 0 4px}p{font-size:14px;color:#475569;line-height:1.6;margin:0 0 12px}
.search{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px;margin:8px 0 12px;background:#fff}
.search:focus{outline:2px solid #F53236;border-color:transparent}
.loc{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:8px 0;cursor:pointer;transition:.15s}
.loc:hover{border-color:#94a3b8}.loc.on{border-color:#F53236;box-shadow:0 0 0 3px rgba(245,50,54,.12)}
.loc input{margin-top:3px;accent-color:#F53236}.t{font-weight:600;font-size:14px}.a{font-size:12px;color:#64748b;margin-top:2px}
.all{border-style:dashed;background:#fff7f7}
.pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;font-size:13px;color:#475569}
.pager button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer;font-weight:600}
.pager button:disabled{opacity:.4;cursor:not-allowed}
.bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -8px 24px rgba(15,23,42,.08);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}
.bar .in{max-width:640px;margin:0 auto;display:flex;align-items:center;gap:12px}
.sel{flex:1;min-width:0;font-size:13px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.go{background:#F53236;color:#fff;border:0;border-radius:12px;padding:13px 22px;font-weight:700;font-size:14px;cursor:pointer}
.empty{text-align:center;color:#94a3b8;font-size:13px;padding:24px}
</style></head><body>
<form method="POST" action="/api/gmb/connect/select" id="f">
<div class="wrap">
<h1>Which business should we manage?</h1>
<p>${esc(email || "This Google account")} manages <b>${rows.length}</b> listings. Pick the ONE this connection is for - only that listing will be linked.</p>
<input type="hidden" name="t" value="${esc(token)}">
<input type="hidden" name="location" id="loc" value="${esc(rows[0]?.name || "")}">
<input class="search" id="q" type="search" placeholder="Search by name, address or category" autocomplete="off">
<div id="list"></div>
<div class="pager"><button type="button" id="prev">‹ Previous</button><span id="pinfo"></span><button type="button" id="next">Next ›</button></div>
<label class="loc all" id="allbox"><input type="radio" name="pick" value="__all__">
<span><span class="t">All ${rows.length} listings</span><div class="a">Connect every listing - this connection keeps &ldquo;${first}&rdquo;, each other listing is added as its own client.</div></span></label>
</div>
<div class="bar"><div class="in"><div class="sel" id="selt"></div><button class="go" type="submit">Connect</button></div></div>
</form>
<script>
(function(){
var rows=${data},per=10,page=0,sel=rows[0]?rows[0].name:"",list=document.getElementById("list"),q=document.getElementById("q");
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function filtered(){var t=q.value.trim().toLowerCase();return t?rows.filter(function(r){return (r.title+" "+r.addr+" "+r.cat).toLowerCase().indexOf(t)>-1}):rows}
function setSel(v){sel=v;document.getElementById("loc").value=v;var r=rows.find(function(x){return x.name===v});
document.getElementById("selt").innerHTML=v==="__all__"?"Selected: <b>all "+rows.length+" listings</b>":r?"Selected: <b>"+esc(r.title)+"</b>":"";
document.querySelector('#allbox input').checked=v==="__all__";document.getElementById("allbox").classList.toggle("on",v==="__all__");render(false)}
function render(reset){var f=filtered();if(reset)page=0;var pages=Math.max(1,Math.ceil(f.length/per));if(page>=pages)page=pages-1;
var slice=f.slice(page*per,page*per+per);
list.innerHTML=slice.length?slice.map(function(r){return '<label class="loc'+(r.name===sel?' on':'')+'"><input type="radio" name="pick" value="'+esc(r.name)+'"'+(r.name===sel?' checked':'')+'><span><span class="t">'+esc(r.title)+'</span><div class="a">'+esc(r.addr)+'</div></span></label>'}).join(""):'<div class="empty">No listing matches your search.</div>';
document.getElementById("pinfo").textContent=f.length?("Page "+(page+1)+" of "+pages+" · "+f.length+" listing(s)"):"";
document.getElementById("prev").disabled=page<=0;document.getElementById("next").disabled=page>=pages-1}
list.addEventListener("change",function(e){if(e.target.name==="pick")setSel(e.target.value)});
document.getElementById("allbox").addEventListener("change",function(){setSel("__all__")});
q.addEventListener("input",function(){render(true)});
document.getElementById("prev").onclick=function(){page--;render(false);window.scrollTo(0,0)};
document.getElementById("next").onclick=function(){page++;render(false);window.scrollTo(0,0)};
document.getElementById("f").addEventListener("submit",function(e){if(!sel){e.preventDefault();alert("Pick a listing first")}});
setSel(sel);render(true);
})();
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
