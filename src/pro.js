import {calculate,money,sanitize} from "./calc.mjs";

const $ = (s) => document.querySelector(s);
let client=null;
let user=null;
let enabled=false;
let hasPro=false;
let openRequested=false;
let currentPlan="monthly";
let historyOffset=0;
let getCurrent,loadScenario;
const dialog=$("#pro-dialog");
function message(s,isError=false) {
  $("#pro-message").textContent=s;
  $("#pro-message").style.color=isError?"#b13b38":"#457449";
}
async function connect(config) {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  // A public publishable/anon key only; service-role secrets never enter browser code.
  const mod=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
  client=mod.createClient(config.supabaseUrl,config.supabaseKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
  return client;
}
async function authToken() {
  const {data}=await client.auth.getSession();
  return data?.session?.access_token || null;
}
async function request(path,payload={}) {
  const token=await authToken();
  if (!token) throw new Error("Please sign in first.");
  const response=await fetch("/.netlify/functions/"+path,{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.error || "Could not complete request.");
  return result;
}
async function loadHistory(reset=true) {
  if (!client || !user || !hasPro) return;
  if(reset)historyOffset=0;
  const {data,error}=await client.from("gig_entries").select("id,label,kind,platform,work_date,gross,hours,miles,gas_mode,gas_per_mile,gas_total,wear_per_mile,other_expenses,net_hourly,net_earnings,created_at").order("created_at",{ascending:false}).range(historyOffset,historyOffset+99);
  if (error) {message("Could not load history: "+error.message,true);return;}
  const list=$("#history-list");if(reset)list.replaceChildren();
  historyOffset+=(data||[]).length;
  $("#load-more").hidden=(data||[]).length<100;
  if (!data?.length) {const p=document.createElement("p");p.className="fine-print";p.textContent="No saved shifts yet. Your first calculation is ready to save.";list.append(p);return;}
  for (const item of data) {
    const row=document.createElement("div"); row.className="history-item";
    const summary=document.createElement("div");
    const name=document.createElement("strong");name.textContent=item.label || (item.platform+" "+item.kind);summary.append(name);
    const sub=document.createElement("small");sub.textContent=item.work_date+" · "+item.hours+" hr · "+item.miles+" mi";summary.append(sub);
    const actions=document.createElement("div");actions.className="history-actions";
    const rate=document.createElement("b");rate.textContent=item.net_hourly === null?"—":money(item.net_hourly)+"/hr";actions.append(rate);
    const restore=document.createElement("button");restore.type="button";restore.textContent="Use";restore.setAttribute("aria-label","Use saved "+(item.label||item.platform)+" calculation");
    restore.addEventListener("click",()=>{
      loadScenario(sanitize({
        platform:item.platform,kind:item.kind,workDate:item.work_date,gross:item.gross,hours:item.hours,miles:item.miles,
        gasMode:item.gas_mode,gasPerMile:item.gas_per_mile,gasTotal:item.gas_total,
        wearPerMile:item.wear_per_mile,otherExpenses:item.other_expenses,label:item.label
      }));
      dialog.close();window.scrollTo({top:0,behavior:"smooth"});
    });
    const del=document.createElement("button");del.type="button";del.textContent="×";del.setAttribute("aria-label","Delete saved entry");
    del.addEventListener("click",async()=>{
      if (!confirm("Delete this saved entry?")) return;
      const {error}=await client.from("gig_entries").delete().eq("id",item.id);
      if (error)message(error.message,true);else await loadHistory();
    });
    actions.append(restore,del);row.append(summary,actions);list.append(row);
  }
}
async function refresh() {
  if (!client) return;
  const {data:{user:u}}=await client.auth.getUser();
  user=u;
  if (!user) {
    hasPro=false;
    $("#login-form").hidden=false;$("#history-area").hidden=true;$("#start-checkout").hidden=true;
    return;
  }
  const {data,error}=await client.from("gig_pro_entitlements").select("status,access_until").eq("user_id",user.id).maybeSingle();
  if (error) {message("Unable to check subscription. Try again.",true);return;}
  hasPro=!!(data && ["active","trialing","canceled"].includes(data.status) && new Date(data.access_until).getTime()>Date.now());
  $("#login-form").hidden=true;
  $("#history-area").hidden=!hasPro;
  $("#start-checkout").hidden=hasPro;
  if(hasPro) {message("Pro is active. Save a shift or browse your history.");await loadHistory();}
  else {message("You're signed in. Choose a plan to enable cloud history.");await checkoutIfRequested();}
}
async function checkoutIfRequested() {
  if (!openRequested || hasPro || !user) return;
  openRequested=false;
  message("Opening secure checkout…");
  try {
    const result=await request("checkout",{plan:currentPlan});
    if (!result.url || !result.url.startsWith("https://checkout.stripe.com/"))throw new Error("Checkout unavailable.");
    window.location.assign(result.url);
  } catch(e) {message(e.message,true);}
}
export function initPro({config,getCurrent:current,loadScenario:load}) {
  getCurrent=current; loadScenario=load;
  enabled=!!(config.supabaseUrl&&config.supabaseKey);
  const open=async()=>{
    if (!dialog.open) dialog.showModal();
    if (!enabled) {message("Cloud history is not available yet. The free calculator and exports are fully functional.");return;}
    try {await connect(config);await refresh();}
    catch(e) {message("Connection unavailable. Please try again.",true);}
  };
  document.querySelectorAll("[data-open-pro]").forEach(b=>b.addEventListener("click",open));
  $("#close-dialog").addEventListener("click",()=>dialog.close());
  $("#start-checkout").addEventListener("click",async()=>{openRequested=true;await checkoutIfRequested();});
  $("#load-more").addEventListener("click",()=>loadHistory(false));
  dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  document.querySelectorAll("[name=plan]").forEach(r=>r.addEventListener("change",()=>{currentPlan=document.querySelector("[name=plan]:checked").value;}));
  $("#login-form").addEventListener("submit",async e=>{
    e.preventDefault();
    if (!enabled)return message("Cloud history is not configured yet.",true);
    const email=$("#login-email").value.trim();
    if(!email)return;
    message("Sending a sign-in link…");
    try{
      await connect(config);
      const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+"/"}});
      if(error)throw error;
      message("Check your email for a sign-in link. You can keep using the free calculator.");
    } catch(e) {message(e.message,true);}
  });
  $("#save-cloud").addEventListener("click",async()=>{
    if(!hasPro||!user)return message("An active Pro subscription is required.",true);
    const a=getCurrent(); const b=calculate(a);
    const label=$("#entry-label").value.trim().slice(0,90);
    const row={
      user_id:user.id,label,kind:b.kind,platform:b.platform,work_date:b.workDate,
      gross:b.gross,hours:b.hours,miles:b.miles,gas_mode:b.gasMode,
      gas_per_mile:b.gasPerMile,gas_total:b.gasTotal,wear_per_mile:b.wearPerMile,
      other_expenses:b.otherExpenses,net_hourly:b.hourly,net_earnings:b.trueNet
    };
    const {error}=await client.from("gig_entries").insert(row);
    if(error)message(error.message,true);else {message("Saved to your cloud history.");$("#entry-label").value="";await loadHistory();}
  });
  $("#manage-billing").addEventListener("click",async()=>{
    try{const result=await request("billing-portal");if(result.url)location.assign(result.url);}
    catch(e){message(e.message,true);}
  });
  $("#sign-out").addEventListener("click",async()=>{
    if(client)await client.auth.signOut();
    user=null;hasPro=false;$("#login-form").hidden=false;$("#history-area").hidden=true;message("Signed out.");
  });
  const onCheckoutComplete=async()=>{
    const query=new URLSearchParams(location.search);
    if(query.get("checkout")==="success"){
      await open();
      message("Payment received. Your cloud access may take a moment to activate. Refresh if it isn't visible yet.");
      history.replaceState({},"",location.pathname+location.hash);
    }
  };
  if(enabled) {
    connect(config).then(async c=>{
      c.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="TOKEN_REFRESHED")queueMicrotask(()=>refresh().catch(()=>{}));});
      await onCheckoutComplete();
    }).catch(()=>{});
  }
}
