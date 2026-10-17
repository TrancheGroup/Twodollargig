import {DEFAULTS, calculate, money, csvFor, sanitize} from "./calc.mjs";
import {initPro} from "./pro.js";

const $ = (selector) => document.querySelector(selector);
const form = $("#gig-form");
const pageConfig = (() => {
  try { return JSON.parse($("#gig-config").textContent); }
  catch { return {}; }
})();
const STORAGE_KEY = "twodollargig:current:v1";
function savedScenario() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}
const initial = sanitize({...DEFAULTS, platform:pageConfig.platform || DEFAULTS.platform, ...(savedScenario() || {})});
let current = initial;
function setValue(name,value) {
  const el = form.elements.namedItem(name);
  if (!el) return;
  if (el instanceof RadioNodeList) {
    for (const input of el) input.checked = input.value === value;
  } else if (el instanceof HTMLInputElement && el.type === "radio") {
    for (const input of form.querySelectorAll('[name="'+name+'"]')) input.checked = input.value === value;
  } else el.value = value;
}
function getValue(name) {
  const el = form.elements.namedItem(name);
  return el ? el.value : undefined;
}
function read() {
  const fields = Object.keys(DEFAULTS);
  return sanitize(Object.fromEntries(fields.map(key => [key,key === "label" ? current.label : getValue(key)])));
}
function setScenario(input) {
  const clean = sanitize(input);
  for (const [name,value] of Object.entries(clean)) if (name !== "label") setValue(name,value);
  current = clean;
  toggleGas();
  update();
}
function text(id,value) { const target = $("#"+id); if (target) target.textContent = value; }
function signed(n) { return (n < 0 ? "−" : "") + money(Math.abs(n)); }
function toggleGas() {
  const total = getValue("gasMode") === "total";
  $("#gas-total-wrap").classList.toggle("is-hidden",!total);
  $("#gas-per-mile-wrap").classList.toggle("is-hidden",total);
}
function render(b) {
  text("rate",b.hourly === null ? "—" : money(b.hourly));
  const span=document.createElement("span"); span.textContent="/hr"; $("#rate").append(span);
  $("#rate").classList.toggle("negative",b.hourly !== null && b.hourly < 0);
  text("comparison",b.hours === 0 ? "Enter hours worked to calculate your hourly rate." : "Gross "+money(b.grossHourly)+"/hr → true net "+money(b.hourly)+"/hr");
  text("net-earnings",money(b.trueNet));
  text("gross-hourly",b.grossHourly === null ? "—" : money(b.grossHourly)+"/hr");
  text("r-gross",money(b.gross));
  text("r-vehicle","−"+money(b.vehicleCosts));
  text("r-other","−"+money(b.otherExpenses));
  text("r-tax","−"+money(b.selfEmploymentTaxReserve));
  text("r-net",money(b.trueNet));
  text("r-mileage",money(b.standardMileageDeduction));
  text("r-rate","("+Math.round(b.mileageRate*1000)/10+"¢/mile)");
  // The allocation visual is only proportional for nonnegative cash net. A loss fills costs/tax.
  const total = Math.max(b.gross,b.totalOutflowAndReserve,0.01);
  const netShare = Math.max(0,b.trueNet)/total;
  const costsShare = Math.min(1,b.cashExpenses/total);
  const taxShare = Math.min(1,b.selfEmploymentTaxReserve/total);
  $(".strip-net").style.width=(100*netShare)+"%";
  $(".strip-cost").style.width=(100*costsShare)+"%";
  $(".strip-tax").style.width=(100*taxShare)+"%";
  $("#allocation").setAttribute("aria-label","Gross "+money(b.gross)+", cash costs "+money(b.cashExpenses)+", tax reserve "+money(b.selfEmploymentTaxReserve)+", true net "+money(b.trueNet));
  text("print-date",b.platform+" • "+b.kind+" • "+b.workDate+" • "+b.hours+" hours • "+b.miles+" business miles");
}
function update() {
  current = read();
  const b = calculate(current);
  render(b);
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(current)); } catch {}
}
setScenario(initial);
form.addEventListener("input",()=>{toggleGas();update();});
form.addEventListener("change",()=>{toggleGas();update();});
form.addEventListener("submit",(e)=>e.preventDefault());
$("#export-csv").addEventListener("click",()=>{
  const b=calculate(current);
  const file=new Blob(["\ufeff",csvFor(b)],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");a.href=url;a.download="twodollargig-"+b.platform.toLowerCase().replace(/\s+/g,"-")+"-"+b.workDate+".csv";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("#print").addEventListener("click",()=>window.print());
initPro({config:pageConfig,getCurrent:()=>({...current}),loadScenario:setScenario});
