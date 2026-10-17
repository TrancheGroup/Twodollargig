export const YEAR = 2026;
export const DEFAULTS = Object.freeze({
  platform: "DoorDash", workDate: "2026-10-16", gross: 180, hours: 8,
  miles: 105, gasMode: "perMile", gasPerMile: 0.14, gasTotal: 0,
  wearPerMile: 0.20, otherExpenses: 0, kind: "shift", label: ""
});
export const PLATFORMS = ["DoorDash", "Uber", "Instacart", "Lyft", "Amazon Flex", "Other"];
export const DISCLAIMER = "Estimates only. Not tax or financial advice. Actual costs and taxes vary.";
export function money(n) {
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(value);
}
export function mileageRate(dateString) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString)) ? dateString : "2026-10-16";
  if (date.slice(0,4) !== "2026") return 0.725;
  return date >= "2026-07-01" ? 0.76 : 0.725;
}
export function nonnegative(raw) {
  const v = Number(raw);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}
export function sanitize(input = {}) {
  const a = {...DEFAULTS, ...input};
  return {
    platform: PLATFORMS.includes(a.platform) ? a.platform : "Other",
    workDate: /^\d{4}-\d{2}-\d{2}$/.test(String(a.workDate)) ? a.workDate : DEFAULTS.workDate,
    gross: nonnegative(a.gross), hours: nonnegative(a.hours), miles: nonnegative(a.miles),
    gasMode: a.gasMode === "total" ? "total" : "perMile",
    gasPerMile: nonnegative(a.gasPerMile), gasTotal: nonnegative(a.gasTotal),
    wearPerMile: nonnegative(a.wearPerMile), otherExpenses: nonnegative(a.otherExpenses),
    kind: a.kind === "week" ? "week" : "shift",
    label: String(a.label ?? "").trim().slice(0,90)
  };
}
export function calculate(input = {}) {
  const a = sanitize(input);
  const gas = a.gasMode === "total" ? a.gasTotal : a.miles * a.gasPerMile;
  const nonFuelVehicleCosts = a.miles * a.wearPerMile;
  const vehicleCosts = gas + nonFuelVehicleCosts;
  const standardMileageDeduction = a.miles * mileageRate(a.workDate);
  // Deductible mileage is used INSTEAD of operating costs when estimating taxable profit.
  // It is NOT another cash expense and should never be subtracted from take-home twice.
  const estimatedBusinessProfit = Math.max(0, a.gross - standardMileageDeduction - a.otherExpenses);
  // Simplified SE tax: 15.3% x 92.35% of estimated Schedule C profit.
  // Actual liability depends on the annual $400 threshold, wage base, total wages, etc.
  const selfEmploymentTaxReserve = estimatedBusinessProfit * 0.9235 * 0.153;
  const trueNet = a.gross - vehicleCosts - a.otherExpenses - selfEmploymentTaxReserve;
  const hourly = a.hours > 0 ? trueNet / a.hours : null;
  const grossHourly = a.hours > 0 ? a.gross / a.hours : null;
  return {
    ...a, gas, nonFuelVehicleCosts, vehicleCosts, standardMileageDeduction,
    mileageRate: mileageRate(a.workDate), estimatedBusinessProfit,
    selfEmploymentTaxReserve, trueNet, hourly, grossHourly,
    cashExpenses: vehicleCosts + a.otherExpenses, totalOutflowAndReserve: vehicleCosts + a.otherExpenses + selfEmploymentTaxReserve
  };
}
export function csvFor(a) {
  const b = calculate(a);
  const rows = [
    ["Metric","Value"],["Work date",b.workDate],["Platform",b.platform],
    ["Type",b.kind],["Gross pay",b.gross],["Hours worked",b.hours],["Miles driven",b.miles],
    ["Gas expense",b.gas],["Non-fuel vehicle cost",b.nonFuelVehicleCosts],
    ["Estimated vehicle costs",b.vehicleCosts],["Other cash expenses",b.otherExpenses],
    ["IRS standard mileage rate",b.mileageRate],["Standard mileage deduction (tax-only)",b.standardMileageDeduction],
    ["Estimated taxable business profit",b.estimatedBusinessProfit],
    ["Self-employment tax reserve (estimate)",b.selfEmploymentTaxReserve],
    ["True net earnings",b.trueNet],["True net hourly rate",b.hourly ?? "N/A"],
    ["Disclaimer",DISCLAIMER]
  ];
  return rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(",")).join("\r\n")+"\r\n";
}
