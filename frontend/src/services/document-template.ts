import { useEffect, useState } from "react";

export interface DocumentTemplateSettings {
  // Company Identity
  companyName: string;
  tagline: string;
  logoUrl?: string; // Custom image or fallback to vector ITCS logo

  // Contact & Address
  addressLine1: string;
  addressLine2: string;
  cityPostal: string;
  email: string;
  phone: string;
  fax: string;
  website: string;

  // Tax Identifiers
  ntn: string;
  strn: string; // Sales Tax Registration Number
  taxpayerLabel: string; // e.g. "Taxpayer ID"

  // Banking & Payment Details
  bankName: string;
  swiftCode: string;
  accountNumber: string;
  ibanNumber: string;
  accountTitle: string;
  branch: string;

  // Terms & Disclaimers
  defaultNotes: string;
  footerDisclaimer: string;
  currencySymbol: string; // "₨" or "PKR" or "$"
}

export const DEFAULT_TEMPLATE_SETTINGS: DocumentTemplateSettings = {
  companyName: "ITCS (IT Consulting and Services)",
  tagline: "Since 2010",
  addressLine1: "6/K, Block 2, P.E.C.H.S",
  addressLine2: "Near Model School",
  cityPostal: "Karachi 75400",
  email: "info@itcs.com.pk",
  phone: "+92 21 111-482-711, +92 2134554818",
  fax: "+92 2134554818",
  website: "http://www.itcs.com.pk",
  ntn: "3670038-0",
  strn: "17-00-3670-038-19",
  taxpayerLabel: "Taxpayer ID",
  bankName: "Meezan Bank",
  swiftCode: "MEZNPKKA",
  accountNumber: "0303-0100449006",
  ibanNumber: "PK24MEZN0003030100449006",
  accountTitle: "ITCS (IT Consulting & Services)",
  branch: "F-7 Branch, Jinnah Super, Islamabad, Pakistan",
  defaultNotes: "- Prices are inclusive of all taxes.",
  footerDisclaimer: "Electronic document, no signature required.",
  currencySymbol: "₨",
};

const STORAGE_KEY = "itcs_erp_document_template_settings";

export function getDocumentTemplateSettings(): DocumentTemplateSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATE_SETTINGS;
    return { ...DEFAULT_TEMPLATE_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TEMPLATE_SETTINGS;
  }
}

export function saveDocumentTemplateSettings(settings: DocumentTemplateSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("itcs_document_template_updated"));
  } catch (err) {
    console.error("Failed to persist document template settings", err);
  }
}

export function useDocumentTemplate(): [
  DocumentTemplateSettings,
  (settings: DocumentTemplateSettings) => void,
  () => void,
] {
  const [template, setTemplate] = useState<DocumentTemplateSettings>(getDocumentTemplateSettings);

  useEffect(() => {
    const handler = () => {
      setTemplate(getDocumentTemplateSettings());
    };
    window.addEventListener("itcs_document_template_updated", handler);
    return () => window.removeEventListener("itcs_document_template_updated", handler);
  }, []);

  const update = (newSettings: DocumentTemplateSettings) => {
    saveDocumentTemplateSettings(newSettings);
    setTemplate(newSettings);
  };

  const reset = () => {
    saveDocumentTemplateSettings(DEFAULT_TEMPLATE_SETTINGS);
    setTemplate(DEFAULT_TEMPLATE_SETTINGS);
  };

  return [template, update, reset];
}
