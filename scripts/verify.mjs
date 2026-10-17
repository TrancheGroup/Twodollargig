import {readFile,access} from "node:fs/promises";
import assert from "node:assert/strict";
import {join} from "node:path";
const pages=JSON.parse(await readFile("src/pages.json","utf8"));
const root="dist";
let count=0;
for(const page of pages) {
  const path=join(root,page.slug,"index.html");
  const html=await readFile(path,"utf8");
  assert.ok(html.includes("<h1>"+page.h1+"<span"),"Missing H1 in "+path);
  assert.ok(html.includes('<meta name="description"'),"Missing description in "+path);
  assert.ok(html.includes('<link rel="canonical"'),"Missing canonical in "+path);
  assert.ok(html.includes('application/ld+json'),"Missing schema in "+path);
  assert.ok(html.includes('Estimates only. Not tax or financial advice. Actual costs and taxes vary.'),"Missing results disclaimer in "+path);
  assert.ok(!html.includes("%%"),"Unreplaced template marker in "+path);
  assert.ok(html.includes("TwoDollarGig Pro"),"Missing Pro price panel in "+path);
  assert.ok(html.includes('id="gig-form"'),"Missing functional calculator form in "+path);
  assert.ok(html.includes('id="export-csv"'),"Missing CSV export in "+path);
  count++;
}
for(const p of ["privacy/index.html","terms/index.html","sitemap.xml","robots.txt","favicon.svg","assets/app.js","assets/pro.js","assets/calc.mjs","assets/styles.css"]){
  await access(join(root,p));
}
const home=await readFile(join(root,"index.html"),"utf8");
assert.ok(home.includes("True Hourly Rate Calculator for Gig Workers"),"Missing primary search title");
assert.ok(home.includes('src="/assets/app.js"'),"Missing client entry");
assert.ok(!home.includes("STRIPE_SECRET_KEY")&&!home.includes("SUPABASE_SERVICE_ROLE_KEY"),"Server-only secrets leaked");
console.log("Verified "+count+" SEO calculator pages, legal pages, assets, schema and free export hooks.");
