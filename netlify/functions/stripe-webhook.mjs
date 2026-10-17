import {json,validStripeSignature,stripeAPI,adminREST,needed} from "../../lib/server.mjs";
export default async function(request){
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  if(!needed("STRIPE_WEBHOOK_SECRET","STRIPE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","PUBLIC_SUPABASE_URL"))return json({error:"Webhook unconfigured."},503);
  const body=await request.text();
  if(!validStripeSignature(body,request.headers.get("stripe-signature"),process.env.STRIPE_WEBHOOK_SECRET))return json({error:"Invalid signature."},400);
  const event=JSON.parse(body);
  const watched=["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"];
  if(!watched.includes(event.type))return json({received:true});
  try {
    const object=event.data.object;
    const subId=event.type==="checkout.session.completed"?object.subscription:object.id;
    if(!subId)return json({received:true});
    // Deleted subscriptions can still be fetched for cancel_at_period_end details.
    const sub=event.type==="customer.subscription.deleted"?object:await stripeAPI("subscriptions/"+encodeURIComponent(subId),null,"GET");
    let userId=sub.metadata?.user_id || (event.type==="checkout.session.completed"?object.client_reference_id:null);
    if(!userId){
      // Metadata is set on all subscriptions initiated by our checkout function.
      // Ignore subscriptions from unrelated Stripe products rather than granting access.
      return json({received:true,skipped:"unrelated subscription"});
    }
    if(!/^[0-9a-f-]{36}$/i.test(userId))return json({received:true});
    const existing=await adminREST("gig_pro_entitlements","?user_id=eq."+encodeURIComponent(userId)+"&select=last_event_created");
    if(existing?.[0]?.last_event_created && event.created < existing[0].last_event_created)return json({received:true,skipped:"older event"});
    const accessUntil=new Date(Math.max(0,Number(sub.current_period_end)||0)*1000).toISOString();
    const row={
      user_id:userId,status:sub.status||"incomplete",
      stripe_customer_id:typeof sub.customer==="string"?sub.customer:sub.customer?.id||null,
      stripe_subscription_id:sub.id,access_until:accessUntil,last_event_created:event.created
    };
    await adminREST("gig_pro_entitlements","?on_conflict=user_id",{
      method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)
    });
    return json({received:true});
  }catch(e){console.error("webhook sync error",e.message);return json({error:"Temporary processing failure."},500);}
}
export const config={method:"POST"};
