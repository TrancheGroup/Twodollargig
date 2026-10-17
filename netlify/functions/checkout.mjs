import {json,supabaseUser,stripeAPI,adminREST,needed} from "../../lib/server.mjs";
export default async function(request){
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  if(!needed("STRIPE_SECRET_KEY","PUBLIC_SUPABASE_URL","PUBLIC_SUPABASE_ANON_KEY","STRIPE_MONTHLY_PRICE_ID","STRIPE_ANNUAL_PRICE_ID","SUPABASE_SERVICE_ROLE_KEY","STRIPE_WEBHOOK_SECRET"))return json({error:"Pro checkout is not available yet."},503);
  try{
    const user=await supabaseUser(request);if(!user)return json({error:"Sign in before checking out."},401);
    const active=await adminREST("gig_pro_entitlements","?user_id=eq."+encodeURIComponent(user.id)+"&select=status,access_until");
    if(active?.[0] && ["active","trialing","canceled"].includes(active[0].status) && new Date(active[0].access_until).getTime()>Date.now()){
      return json({error:"You already have Pro. Use Manage subscription instead."},409);
    }
    const payload=await request.json().catch(()=>({}));
    const plan=payload.plan==="annual"?"annual":"monthly";
    const price=plan==="annual"?process.env.STRIPE_ANNUAL_PRICE_ID:process.env.STRIPE_MONTHLY_PRICE_ID;
    const origin=new URL(request.url).origin;
    const data=new URLSearchParams();
    data.set("mode","subscription");data.set("line_items[0][price]",price);data.set("line_items[0][quantity]","1");
    data.set("customer_email",user.email);data.set("client_reference_id",user.id);
    data.set("subscription_data[metadata][user_id]",user.id);data.set("metadata[user_id]",user.id);
    data.set("success_url",origin+"/?checkout=success");
    data.set("cancel_url",origin+"/?checkout=canceled");
    data.set("allow_promotion_codes","true");
    const session=await stripeAPI("checkout/sessions",data);
    if(!session.url)return json({error:"Could not create checkout session."},502);
    return json({url:session.url});
  }catch(e){console.error("checkout error",e.message);return json({error:"Unable to start checkout. Try again later."},500);}
}
export const config={method:"POST",rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:15}};
