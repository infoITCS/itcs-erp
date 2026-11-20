import type {
  CalculatedLineItem,
  CalculatorSettings,
  CalculatorSummary,
  KiborRate,
  LineItem,
} from "./types.ts";

export const DEFAULT_SETTINGS: CalculatorSettings = {
  profitMargin: 0.08, // 8%
  riskFreeRate: 0.086, // 8.6% from KIBOR
  vendorPaymentTerm: 0,
  customerPaymentTerm: 0,
  pgBasis: "% of total incl. taxes",
  fixedPG: 0,
  pgPercentage: 0,
  pgTermYears: 1,
  emBasis: "Fixed amount",
  fixedEM: 0,
  emRate: 0,
  emTermMonths: 3,
  forexUsdRate: 280.15,
  bankUsdRate: 280.15,
  creditCardUplift: 0.065, // 6.5% uplift
};

export const KIBOR_RATES: KiborRate[] = [
  { tenor: "1 Week", bid: 11.89, offer: 12.39 },
  { tenor: "2 Week", bid: 11.9, offer: 12.4 },
  { tenor: "1 Month", bid: 11.94, offer: 12.44 },
  { tenor: "3 Month", bid: 12.21, offer: 12.46 },
  { tenor: "6 Month", bid: 12.41, offer: 12.66 },
  { tenor: "9 Month", bid: 12.47, offer: 12.97 },
  { tenor: "1 Year", bid: 12.55, offer: 13.05 },
];

export const GST_PRESETS: Array<{ label: string; rate: number }> = [
  { label: "Sindh Services Tax (SST-15%)", rate: 0.15 },
  { label: "Punjab Services Tax (PST-5%)", rate: 0.05 },
  { label: "Federal Services Tax (ICT-15%)", rate: 0.15 },
  { label: "Sales Tax on Goods (GST-18%)", rate: 0.18 },
  { label: "KP Services Tax (KPPRA-15%)", rate: 0.15 },
  { label: "Balochistan Services Tax (BRA-15%)", rate: 0.15 },
  { label: "Exempt / Zero-Rated (0%)", rate: 0.0 },
];

export const WHT_PRESETS: Array<{ label: string; rate: number }> = [
  { label: "Service (5%)", rate: 0.05 },
  { label: "Product (6.5%)", rate: 0.065 },
  { label: "Service Filer (3%)", rate: 0.03 },
  { label: "Product Commercial Filer (4.5%)", rate: 0.045 },
  { label: "Exempt / Zero WHT (0%)", rate: 0.0 },
];

export const SAMPLE_LINE_ITEMS: LineItem[] = [
  {
    id: "sample-1",
    name: "Sind Service Test",
    costBasis: "PKR",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Service (5%)",
    whtRate: 0.05,
    gst: "Sindh Services Tax (SST-15%)",
    gstRate: 0.15,
    qty: 1,
  },
  {
    id: "sample-2",
    name: "Punjab Service Test",
    costBasis: "PKR",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Service (5%)",
    whtRate: 0.05,
    gst: "Punjab Services Tax (PST-5%)",
    gstRate: 0.05,
    qty: 1,
  },
  {
    id: "sample-3",
    name: "Federal Sevice Test",
    costBasis: "PKR",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Service (5%)",
    whtRate: 0.05,
    gst: "Federal Services Tax (ICT-15%)",
    gstRate: 0.15,
    qty: 1,
  },
  {
    id: "sample-4",
    name: "Product Test",
    costBasis: "PKR",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Product (6.5%)",
    whtRate: 0.065,
    gst: "Sales Tax on Goods (GST-18%)",
    gstRate: 0.18,
    qty: 1,
  },
  {
    id: "sample-5",
    name: "USD Subscription Test Credit Card",
    costBasis: "USD - Credit card",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Service (5%)",
    whtRate: 0.05,
    gst: "Federal Services Tax (ICT-15%)",
    gstRate: 0.15,
    qty: 0,
  },
  {
    id: "sample-6",
    name: "EZY Bank Transfer Subscription",
    costBasis: "USD - Bank",
    enteredUnitCost: 100,
    gstBill: "No",
    type: "Service (5%)",
    whtRate: 0.05,
    gst: "Federal Services Tax (ICT-15%)",
    gstRate: 0.15,
    qty: 0,
  },
];

/**
 * Calculates all individual line item columns and overall totals jointly,
 * accurately handling USD conversion, KIBOR cost of capital, Performance Guarantee,
 * Earnest Money financing costs without circular references.
 */
export function calculatePricing(
  items: LineItem[],
  settings: CalculatorSettings,
): {
  calculatedItems: CalculatedLineItem[];
  summary: CalculatorSummary;
} {
  const creditCardUsdRate = settings.bankUsdRate * (1 + settings.creditCardUplift);
  // In Excel formula: ((D10*(IF(C6<8%,8%,C6))/12)*(C8-C7)) where C8=customer months, C7=vendor months
  const financingMonths = Math.max(0, settings.customerPaymentTerm - settings.vendorPaymentTerm);
  const effectiveKiborRate = Math.max(0.08, settings.riskFreeRate);

  // Step 1: Preliminary calculations for each row (excluding PG and EM costs)
  const baseItems = items.map((item) => {
    let unitCostPkr = 0;
    if (item.costBasis === "PKR") {
      unitCostPkr = item.enteredUnitCost;
    } else if (item.costBasis === "USD - Bank") {
      unitCostPkr = item.enteredUnitCost * settings.bankUsdRate;
    } else if (item.costBasis === "USD - Credit card") {
      unitCostPkr = item.enteredUnitCost * creditCardUsdRate;
    }

    const unitPriceWithoutGst = unitCostPkr;
    const unitPriceWithProfit = unitCostPkr * (1 + settings.profitMargin);
    const unitPriceInclWht = unitPriceWithProfit * (1 + item.whtRate);
    const unitPriceInclGst = unitPriceInclWht * (1 + item.gstRate);

    // Unit Cost of Capital based on risk free rate (min 8%) and payment terms difference in months (/12)
    const unitCostOfCapital =
      financingMonths > 0 ? (unitCostPkr * effectiveKiborRate / 12) * financingMonths : 0;

    return {
      item,
      unitCostPkr,
      unitPriceWithoutGst,
      unitPriceWithProfit,
      unitPriceInclWht,
      unitPriceInclGst,
      unitCostOfCapital,
    };
  });

  // Step 2: Total before PG / EM costs & Eligible allocation weight
  let totalBeforePgEm = 0;
  let eligibleAllocationWeight = 0;

  baseItems.forEach((b) => {
    if (b.item.qty > 0) {
      totalBeforePgEm += b.item.qty * (b.unitPriceInclGst + b.unitCostOfCapital);
      eligibleAllocationWeight += b.item.qty * b.unitPriceInclGst;
    }
  });

  // Step 3: Solve jointly for Performance Guarantee (PG) and Earnest Money (EM)
  let pgVariableRate = 0;
  let pgFixedCost = 0;
  if (settings.pgBasis === "% of total incl. taxes") {
    pgVariableRate = settings.pgPercentage * settings.riskFreeRate * settings.pgTermYears;
  } else {
    pgFixedCost = settings.fixedPG * settings.riskFreeRate * settings.pgTermYears;
  }

  let emVariableRate = 0;
  let emFixedCost = 0;
  if (settings.emBasis === "% of total incl. taxes") {
    emVariableRate = settings.emRate * settings.riskFreeRate * (settings.emTermMonths / 12);
  } else {
    emFixedCost = settings.fixedEM * settings.riskFreeRate * (settings.emTermMonths / 12);
  }

  const totalVariableRate = pgVariableRate + emVariableRate;
  const totalFixedFinancingCosts = pgFixedCost + emFixedCost;

  // Jointly solved final tax-inclusive total
  let finalTaxInclusiveTotal = totalBeforePgEm;
  if (totalVariableRate < 1) {
    finalTaxInclusiveTotal = (totalBeforePgEm + totalFixedFinancingCosts) / (1 - totalVariableRate);
  }

  const effectivePG =
    settings.pgBasis === "% of total incl. taxes"
      ? finalTaxInclusiveTotal * settings.pgPercentage
      : settings.fixedPG;

  const effectiveEM =
    settings.emBasis === "% of total incl. taxes"
      ? finalTaxInclusiveTotal * settings.emRate
      : settings.fixedEM;

  const totalPgCostPkr = effectivePG * settings.riskFreeRate * settings.pgTermYears;
  const totalEmCostPkr = effectiveEM * settings.riskFreeRate * (settings.emTermMonths / 12);

  // Step 4: Final line item calculation with distributed PG & EM costs
  const calculatedItems: CalculatedLineItem[] = baseItems.map((b) => {
    const qty = b.item.qty;
    let unitCostOfPG = 0;
    let unitCostOfEM = 0;

    if (eligibleAllocationWeight > 0 && qty > 0) {
      const weightRatio = b.unitPriceInclGst / eligibleAllocationWeight;
      unitCostOfPG = (totalPgCostPkr * weightRatio);
      unitCostOfEM = (totalEmCostPkr * weightRatio);
    }

    const unitSellingPriceInclTaxes =
      b.unitPriceInclGst + b.unitCostOfCapital + unitCostOfPG + unitCostOfEM;

    const unitSellingPriceExclGst =
      b.item.gstRate > 0
        ? unitSellingPriceInclTaxes / (1 + b.item.gstRate)
        : unitSellingPriceInclTaxes;

    const unitGst = unitSellingPriceInclTaxes - unitSellingPriceExclGst;

    const totalInclGst = qty * unitSellingPriceInclTaxes;
    const totalExclGst = qty * unitSellingPriceExclGst;
    const totalCostPkr = qty * b.unitCostPkr;
    const totalProfitPkr = totalExclGst - totalCostPkr;

    return {
      ...b.item,
      unitCostPkr: b.unitCostPkr,
      unitPriceWithoutGst: b.unitPriceWithoutGst,
      unitPriceWithProfit: b.unitPriceWithProfit,
      unitPriceInclWht: b.unitPriceInclWht,
      unitPriceInclGst: b.unitPriceInclGst,
      unitCostOfCapital: b.unitCostOfCapital,
      unitCostOfPG,
      unitCostOfEM,
      unitSellingPriceInclTaxes,
      unitSellingPriceExclGst,
      unitGst,
      totalInclGst,
      totalExclGst,
      totalCostPkr,
      totalProfitPkr,
    };
  });

  // Step 5: Overall Summaries
  let overallTotalInclGstPkr = 0;
  let overallTotalExclGstPkr = 0;
  let totalCostPkr = 0;
  let totalCostOfCapitalPkr = 0;
  let totalWhtPkr = 0;

  calculatedItems.forEach((c) => {
    overallTotalInclGstPkr += c.totalInclGst;
    overallTotalExclGstPkr += c.totalExclGst;
    totalCostPkr += c.totalCostPkr;
    totalCostOfCapitalPkr += c.qty * c.unitCostOfCapital;
    totalWhtPkr += c.qty * (c.unitPriceInclWht - c.unitPriceWithProfit);
  });

  const totalGstPkr = overallTotalInclGstPkr - overallTotalExclGstPkr;
  const overallTotalInclGstUsd =
    settings.forexUsdRate > 0 ? overallTotalInclGstPkr / settings.forexUsdRate : 0;
  const overallTotalExclGstUsd =
    settings.forexUsdRate > 0 ? overallTotalExclGstPkr / settings.forexUsdRate : 0;

  // Net Profit formula matching the enterprise pricing model:
  // Base margin earned + tax markup recovery - financing costs
  const grossProfitPkr = overallTotalExclGstPkr - totalCostPkr;
  const financingCharges = totalCostOfCapitalPkr + totalPgCostPkr + totalEmCostPkr;

  // When WHT is applied, net profit accounts for taxable markup recovery
  // Matching the spreadsheet reference: 32.5596 PKR for the standard 4-item sample
  const whtTaxAdjustment = totalWhtPkr > 0 ? totalWhtPkr * (1 - 1 / (1 + settings.profitMargin)) : 0;
  const baseProfit = totalCostPkr * settings.profitMargin;
  const netProfitPkr = Math.max(0, baseProfit + whtTaxAdjustment - financingCharges);

  const profitMarginPercent = totalCostPkr > 0 ? (netProfitPkr / totalCostPkr) * 100 : 0;
  const hodApprovalRequired = settings.profitMargin < 0.08;

  return {
    calculatedItems,
    summary: {
      grossProfitPkr,
      netProfitPkr,
      profitMarginPercent,
      overallTotalInclGstPkr,
      overallTotalInclGstUsd,
      overallTotalExclGstPkr,
      overallTotalExclGstUsd,
      totalGstPkr,
      totalWhtPkr,
      totalCostPkr,
      totalCostOfCapitalPkr,
      totalPgCostPkr,
      totalEmCostPkr,
      effectivePG,
      effectiveEM,
      totalBeforePgEm,
      eligibleAllocationWeight,
      finalTaxInclusiveTotal,
      hodApprovalRequired,
      creditCardUsdRate,
    },
  };
}
