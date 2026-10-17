import {json,supabaseUser,stripeAPI,needed} from "../../lib/server.mjs";
export default async function(request){
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  if(!needed("STRIPE_SECRET_KEY","PUBLIC_SUPABASE_URL","PUBLIC_SUPABASE_ANON_KEY","STRIPE_MONTHLY_PRICE_ID","STRIPE_ANNUAL_PRICE_ID"))return json({error:"Pro checkout is not available yet."},503);
  try{
    const user=await supabaseUser(request);if(!user)return json({error:"Sign in before checking out."},401);
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
