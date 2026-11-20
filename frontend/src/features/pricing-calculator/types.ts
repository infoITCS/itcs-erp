export type CostBasis = "PKR" | "USD - Bank" | "USD - Credit card";

export type GstRegion =
  | "Sindh Services Tax (SST-15%)"
  | "Punjab Services Tax (PST-5%)"
  | "Federal Services Tax (ICT-15%)"
  | "Sales Tax on Goods (GST-18%)"
  | "KP Services Tax (KPPRA-15%)"
  | "Balochistan (BRA-15%)"
  | "Exempt / Zero-Rated (0%)";

export type ItemType =
  | "Service (5%)"
  | "Product (6.5%)"
  | "Service Filer (3%)"
  | "Product Commercial (4.5%)"
  | "Custom WHT";

export interface CalculatorSettings {
  // Pricing & Payment Terms
  profitMargin: number; // e.g. 0.08 (8%)
  riskFreeRate: number; // e.g. 0.086 (8.6%)
  vendorPaymentTerm: number; // in months, e.g. 0
  customerPaymentTerm: number; // in months, e.g. 0

  // Performance Guarantee
  pgBasis: "% of total incl. taxes" | "Fixed amount";
  fixedPG: number; // PKR
  pgPercentage: number; // e.g. 0.05 for 5%
  pgTermYears: number; // e.g. 1 Year, 1.5 Years, 3 Years

  // Earnest Money
  emBasis: "Fixed amount" | "% of total incl. taxes";
  fixedEM: number; // PKR
  emRate: number; // e.g. 0.02 for 2%
  emTermMonths: number; // tender evaluation period in months, e.g. 3

  // Exchange Rates
  forexUsdRate: number; // Open market selling rate (e.g. 280.15)
  bankUsdRate: number; // Bank selling rate (e.g. 280.15)
  creditCardUplift: number; // e.g. 0.065 (6.5% markup)
}

export interface LineItem {
  id: string;
  name: string;
  enteredUnitCost: number;
  costBasis: CostBasis;
  gstBill: "Yes" | "No";
  type: string;
  whtRate: number; // e.g. 0.05
  gst: string;
  gstRate: number; // e.g. 0.15
  qty: number;
}

export interface CalculatedLineItem extends LineItem {
  unitCostPkr: number;
  unitPriceWithoutGst: number;
  unitPriceWithProfit: number;
  unitPriceInclWht: number;
  unitPriceInclGst: number;
  unitCostOfCapital: number;
  unitCostOfPG: number;
  unitCostOfEM: number;
  unitSellingPriceInclTaxes: number;
  unitSellingPriceExclGst: number;
  unitGst: number;
  totalInclGst: number;
  totalExclGst: number;
  totalCostPkr: number;
  totalProfitPkr: number;
}

export interface CalculatorSummary {
  grossProfitPkr: number;
  netProfitPkr: number;
  profitMarginPercent: number;
  overallTotalInclGstPkr: number;
  overallTotalInclGstUsd: number;
  overallTotalExclGstPkr: number;
  overallTotalExclGstUsd: number;
  totalGstPkr: number;
  totalWhtPkr: number;
  totalCostPkr: number;
  totalCostOfCapitalPkr: number;
  totalPgCostPkr: number;
  totalEmCostPkr: number;
  effectivePG: number;
  effectiveEM: number;
  totalBeforePgEm: number;
  eligibleAllocationWeight: number;
  finalTaxInclusiveTotal: number;
  hodApprovalRequired: boolean;
  creditCardUsdRate: number;
}

export interface KiborRate {
  tenor: string;
  bid: number;
  offer: number;
}
