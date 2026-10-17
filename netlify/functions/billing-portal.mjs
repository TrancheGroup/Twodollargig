import {json,supabaseUser,stripeAPI,adminREST,needed} from "../../lib/server.mjs";
export default async function(request){
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  if(!needed("STRIPE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","PUBLIC_SUPABASE_URL","PUBLIC_SUPABASE_ANON_KEY"))return json({error:"Billing management unavailable."},503);
  try{
    const user=await supabaseUser(request);if(!user)return json({error:"Sign in first."},401);
    const rows=await adminREST("gig_pro_entitlements","?user_id=eq."+encodeURIComponent(user.id)+"&select=stripe_customer_id");
    if(!rows?.[0]?.stripe_customer_id)return json({error:"No subscription found."},404);
    const form=new URLSearchParams();
    form.set("customer",rows[0].stripe_customer_id);
    form.set("return_url",new URL(request.url).origin+"/");
    const session=await stripeAPI("billing_portal/sessions",form);
    return json({url:session.url});
  }catch(e){console.error("billing portal error",e.message);return json({error:"Unable to open billing management."},500);}
}
export const config={method:"POST",rateLimit:{action:"rate_limit",aggregateBy:"ip",windowSize:60,windowLimit:15}};
