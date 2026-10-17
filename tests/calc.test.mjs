import test from "node:test";
import assert from "node:assert/strict";
import { calculate, mileageRate, csvFor, sanitize } from "../src/calc.mjs";
test("2026 mileage rate is date-sensitive", () => {
  assert.equal(mileageRate("2026-06-30"), 0.725);
  assert.equal(mileageRate("2026-07-01"), 0.76);
  assert.equal(mileageRate("2026-12-31"), 0.76);
});
test("correct vehicle-cost vs deductible-mileage separation", () => {
  const r = calculate({gross:200,hours:10,miles:100,gasPerMile:0.15,wearPerMile:0.20,otherExpenses:10,workDate:"2026-10-16"});
  assert.equal(r.gas,15);
  assert.equal(r.vehicleCosts,35);
  assert.equal(r.standardMileageDeduction,76);
  assert.equal(r.estimatedBusinessProfit,114);
  assert.ok(Math.abs(r.selfEmploymentTaxReserve - 114*0.9235*0.153)<0.0000001);
  assert.ok(Math.abs(r.trueNet - (200-35-10-r.selfEmploymentTaxReserve))<0.0000001);
  assert.equal(r.hourly,r.trueNet/10);
});
test("input edge cases, no NaN or Infinity", () => {
  const r = calculate({hours:0,gross:"oops",miles:-4,gasPerMile:"NaN"});
  assert.equal(r.hourly,null); assert.equal(r.gross,0);
  assert.equal(r.miles,0); assert.equal(r.vehicleCosts,0);
});
test("total gas uses exactly the entered amount", () => {
  const r=calculate({gross:100,hours:5,miles:10,gasMode:"total",gasTotal:7,gasPerMile:999});
  assert.equal(r.gas,7); assert.equal(r.vehicleCosts,9);
});
test("negative net is preserved, tax reserve is zero for losses", () => {
  const r=calculate({gross:10,hours:2,miles:100,gasPerMile:1,otherExpenses:20});
  assert.equal(r.selfEmploymentTaxReserve,0);
  assert.ok(r.trueNet<0); assert.ok(r.hourly<0);
});
test("CSV exported with transparent distinction and disclaimer", () => {
  const s=csvFor({platform:"DoorDash"});
  assert.match(s,/Standard mileage deduction \(tax-only\)/);
  assert.match(s,/Estimates only/);
});
test("labels and platform validated",()=>{
  assert.equal(sanitize({label:"X".repeat(1000)}).label.length,90);
  assert.equal(sanitize({platform:"unknown"}).platform,"Other");
});
