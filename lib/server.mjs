import {createHmac,timingSafeEqual} from "node:crypto";

export const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export function needed(...keys){return keys.every(key=>!!process.env[key]);}
export async function supabaseUser(request){
  const token=(request.headers.get("authorization")||"").match(/^Bearer (.+)$/i)?.[1];
  const url=process.env.PUBLIC_SUPABASE_URL;
  const key=process.env.PUBLIC_SUPABASE_ANON_KEY;
  if(!token || !url || !key)return null;
  const response=await fetch(url+"/auth/v1/user",{headers:{"apikey":key,"Authorization":"Bearer "+token}});
  if(!response.ok)return null;
  const user=await response.json();
  return user?.id && user?.email?user:null;
}
export async function stripeAPI(path,form,method="POST"){
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key)throw new Error("Billing not configured.");
  const body=form instanceof URLSearchParams?form:undefined;
  const response=await fetch("https://api.stripe.com/v1/"+path,{
    method,headers:{"Authorization":"Bearer "+key,...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},
    ...(body?{body:body.toString()}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error?.message||"Stripe request failed");
  return data;
}
export async function adminREST(table,query="",options={}){
  const base=process.env.PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!secret)throw new Error("Cloud storage not configured.");
  const response=await fetch(base+"/rest/v1/"+table+query,{
    ...options,
    headers:{"apikey":secret,"Authorization":"Bearer "+secret,
      "Content-Type":"application/json",...(options.headers||{})}
  });
  if(!response.ok)throw new Error("Cloud database request failed ("+response.status+")");
  const text=await response.text();
  return text?JSON.parse(text):null;
}
export function validStripeSignature(payload,header,secret){
  if(!payload||!header||!secret)return false;
  const parts=Object.fromEntries(header.split(",").map(piece=>piece.split("=",2)));
  const timestamp=Number(parts.t);
  if(!Number.isFinite(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)return false;
  const digest=createHmac("sha256",secret).update(String(timestamp)+"."+payload).digest("hex");
  return header.split(",").filter(p=>p.startsWith("v1=")).some(p=>{
    const supplied=p.slice(3);
    if(!/^[0-9a-f]{64}$/i.test(supplied))return false;
    return timingSafeEqual(Buffer.from(digest,"hex"),Buffer.from(supplied,"hex"));
  });
}
