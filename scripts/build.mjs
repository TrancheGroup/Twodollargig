import {readFile,writeFile,copyFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
const pages=JSON.parse(await readFile("src/pages.json","utf8"));
const template=await readFile("src/template.html","utf8");
const root=(process.env.SITE_URL || "https://twodollargig.netlify.app").replace(/\/+$/,"");
const config={supabaseUrl:process.env.PUBLIC_SUPABASE_URL||"",supabaseKey:process.env.PUBLIC_SUPABASE_ANON_KEY||""};
const out="dist";
const esc=(s)=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const cleanJson=(obj)=>JSON.stringify(obj).replaceAll("<","\\u003c");
await mkdir(join(out,"assets"),{recursive:true});
await Promise.all([copyFile("src/styles.css",join(out,"assets/styles.css")),copyFile("src/app.js",join(out,"assets/app.js")),copyFile("src/pro.js",join(out,"assets/pro.js")),copyFile("src/calc.mjs",join(out,"assets/calc.mjs")),copyFile("src/favicon.svg",join(out,"favicon.svg"))]);
for(const page of pages){
  const canonical=root+"/"+(page.slug?page.slug+"/":"");
  const other=pages.filter(item=>item.slug!==page.slug).slice(0,8);
  const faq=page.faq.map(pair=>'<details><summary>'+esc(pair[0])+'</summary><p>'+esc(pair[1])+'</p></details>').join("");
  const links=other.map(item=>'<a href="/'+(item.slug?item.slug+"/":"")+'">'+esc(item.h1)+" →</a>").join("");
  const schema={
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"WebApplication","name":"TwoDollarGig","url":canonical,"applicationCategory":"FinanceApplication","operatingSystem":"All","isAccessibleForFree":true,"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"description":page.description},
      {"@type":"FAQPage","mainEntity":page.faq.map(pair=>({"@type":"Question",name:pair[0],acceptedAnswer:{"@type":"Answer",text:pair[1]}}))}
    ]
  };
  let html=template;
  for(const [tag,value] of Object.entries({
    TITLE:esc(page.title),DESCRIPTION:esc(page.description),CANONICAL:esc(canonical),
    H1:esc(page.h1),INTRO:esc(page.intro),WHY:esc(page.why),
    FAQ:faq,RELATED:links,SCHEMA:cleanJson(schema),
    CONFIG:cleanJson({...config,platform:page.platform}),YEAR:"2026"
  }))html=html.replaceAll("%%"+tag+"%%",value);
  const dir=join(out,page.slug);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,"index.html"),html);
}
const legalPages=[
{slug:"privacy",title:"Privacy Policy",text:[
"Free calculator: Your current scenario is saved in your own browser's local storage. We do not submit free calculator entries to our servers. CSV exports are generated in your browser.",
"Pro: If enabled, magic-link login stores your email in our authentication provider and your saved entries in a cloud database. Pro checkout is handled by Stripe. We do not store payment card details.",
"Service requests: Our hosting provider may process standard security and access logs. The site does not require you to create a free account. Some fonts and Pro login resources may load from third parties.",
"Control: You can clear your device's saved free calculation by clearing this site's local storage. You can delete Pro history entries from your account. Contact the site owner for account-data requests."]},
{slug:"terms",title:"Terms of Use",text:[
"TwoDollarGig provides planning estimates only, not accounting, legal, financial, or tax advice. Results are not guaranteed. You are responsible for verifying calculations, tracking eligible business miles, and consulting applicable tax guidance.",
"Business mileage deductions and self-employment taxes depend on facts that may not appear here, including annual income, other wages, personal miles, and IRS limitations.",
"TwoDollarGig is independent and is not affiliated with Uber, DoorDash, Lyft, Instacart or Amazon Flex.",
"The basic calculator, CSV download and print-to-PDF functionality are free. Pro, when enabled, is an optional recurring subscription with prices displayed before checkout and cancellation available through billing management."]}
];
for(const p of legalPages){
  const body=p.text.map(x=>"<p>"+esc(x)+"</p>").join("");
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+p.title+' | TwoDollarGig</title><meta name="robots" content="index,follow"><link rel="canonical" href="'+root+'/'+p.slug+'/"><link rel="stylesheet" href="/assets/styles.css"></head><body><div class="top-stripe"><span></span><span></span></div><header class="site-header"><div class="container nav"><a class="brand" href="/">TwoDollarGig</a><a href="/">← Back to calculator</a></div></header><main class="container legal-content" style="max-width:770px;padding-top:70px;padding-bottom:100px"><h1>'+p.title+'</h1><p>Last updated October 16, 2026.</p>'+body+'<p><a href="/">Back to the free calculator</a></p></main></body></html>';
  await mkdir(join(out,p.slug),{recursive:true});
  await writeFile(join(out,p.slug,"index.html"),html);
}
const paths=[...pages.map(p=>"/"+(p.slug?p.slug+"/":"")),"/privacy/","/terms/"];
await writeFile(join(out,"sitemap.xml"),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>"<url><loc>"+esc(root+path)+"</loc></url>").join("")+"</urlset>\n");
await writeFile(join(out,"robots.txt"),"User-agent: *\nAllow: /\nSitemap: "+root+"/sitemap.xml\n");
await writeFile(join(out,"404.html"),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | TwoDollarGig</title><link rel="stylesheet" href="/assets/styles.css"></head><body><main class="container" style="padding-top:90px"><h1>Not found.</h1><p>Try the <a href="/">free gig-work calculator</a>.</p></main></body></html>');
console.log("Built "+pages.length+" calculator pages and "+legalPages.length+" legal pages for "+root);
