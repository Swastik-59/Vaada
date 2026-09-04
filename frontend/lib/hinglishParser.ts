// ============================================================
// VAADA — Hinglish NLP Tokenizer & Contract Synthesizer
// Extracts structured financial commitments from conversational Hindi-English
// ============================================================

export interface HinglishToken {
  text: string;
  type: "normal" | "date" | "amount" | "rail" | "intent";
}

export interface ParsedContract {
  amount: string;
  amountNumeric: number;
  date: string;
  rail: string;
  confidence: string;
  confidenceScore: number;
  action: string;
  tokens: HinglishToken[];
}

export const HINGLISH_QUICK_PROMPTS = [
  {
    id: "chip_rtgs",
    label: "RTGS Commitment",
    text: "Bhai abhi balance thoda tight hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka.",
  },
  {
    id: "chip_gst",
    label: "GST Refund UPI",
    text: "Sir kal subah 11 baje GST refund aate hi 50 hazar UPI se daal dunga.",
  },
  {
    id: "chip_cheque",
    label: "Next Month Cheque",
    text: "Agli 10 tareekh ko bill pass hote hi poora cheque clear ho jayega bhai.",
  },
  {
    id: "chip_imps",
    label: "Instant IMPS Transfer",
    text: "Monday morning 10 AM 1.2 Lakh IMPS transfer initiated pakka.",
  },
  {
    id: "chip_evening",
    label: "Evening Neft / Settlement",
    text: "Aap tension mat lo shaam tak 75k RTGS karwa deta hu pakka.",
  },
];

export function parseHinglishText(rawText: string): ParsedContract {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Amount Extraction
  let amountStr = "Full Outstanding Balance";
  let amountNum = 185000;

  const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/i);
  const hazarMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|k\b)/i);
  const rupeesMatch = lower.match(/(?:rs\.?|inr|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);

  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]);
    amountNum = Math.round(val * 100000);
    amountStr = `₹${amountNum.toLocaleString("en-IN")}.00`;
  } else if (hazarMatch) {
    const val = parseFloat(hazarMatch[1]);
    amountNum = Math.round(val * 1000);
    amountStr = `₹${amountNum.toLocaleString("en-IN")}.00`;
  } else if (rupeesMatch) {
    const rawVal = rupeesMatch[1].replace(/,/g, "");
    amountNum = Math.round(parseFloat(rawVal));
    amountStr = `₹${amountNum.toLocaleString("en-IN")}.00`;
  } else if (lower.includes("poora") || lower.includes("full")) {
    amountStr = "Full Outstanding Balance";
    amountNum = 185000;
  }

  // 2. Date / Settlement Window Extraction
  let dateStr = "Target Settlement Window";
  if (lower.includes("friday") && (lower.includes("shaam") || lower.includes("4 baje"))) {
    dateStr = "Friday, 16:00 IST";
  } else if (lower.includes("friday")) {
    dateStr = "Friday 18:00 IST";
  } else if (lower.includes("kal subah") || (lower.includes("kal") && lower.includes("11 baje"))) {
    dateStr = "Tomorrow, 11:00 IST";
  } else if (lower.includes("kal shaam") || lower.includes("kal")) {
    dateStr = "Tomorrow, 18:00 IST";
  } else if (lower.includes("monday") && (lower.includes("morning") || lower.includes("10 am"))) {
    dateStr = "Monday, 10:00 IST";
  } else if (lower.includes("monday")) {
    dateStr = "Monday, 17:00 IST";
  } else if (lower.includes("agli 10 tareekh") || lower.includes("10 tareekh")) {
    dateStr = "10th of Next Month";
  } else if (lower.includes("shaam tak")) {
    dateStr = "Today by 18:00 IST";
  } else if (lower.includes("subah")) {
    dateStr = "Next Morning Window (10:00 IST)";
  } else {
    dateStr = "Within 48h Clearing Window";
  }

  // 3. Rail Extraction
  let railStr = "Instant UPI Dynamic QR";
  if (lower.includes("rtgs")) {
    railStr = "Corporate RTGS / IMPS";
  } else if (lower.includes("upi")) {
    railStr = "Instant UPI Dynamic QR";
  } else if (lower.includes("cheque") || lower.includes("nach") || lower.includes("mandate")) {
    railStr = "Corporate e-NACH / Cheque";
  } else if (lower.includes("imps") || lower.includes("neft")) {
    railStr = "Direct IMPS / NEFT Virtual Account";
  }

  // 4. Intent & Confidence Scoring
  let score = 75;
  if (lakhMatch || hazarMatch || rupeesMatch || lower.includes("poora")) score += 8;
  if (lower.includes("friday") || lower.includes("kal") || lower.includes("monday") || lower.includes("tareekh") || lower.includes("shaam")) score += 7;
  if (lower.includes("rtgs") || lower.includes("upi") || lower.includes("cheque") || lower.includes("imps")) score += 6;
  if (lower.includes("pakka") || lower.includes("kar dunga") || lower.includes("daal dunga") || lower.includes("initiated")) score += 4;
  score = Math.min(96, Math.max(68, score));

  const confidenceStr = `${score.toFixed(1)}% Binding Confidence`;

  // 5. Autonomous Action
  let actionStr = "Friendly Reminder Scheduled";
  if (railStr.includes("RTGS")) {
    actionStr = "T-24h Friendly Reminder & RTGS Voucher Scheduled";
  } else if (railStr.includes("UPI")) {
    actionStr = "Dynamic QR Link Generated for Dispatched Window";
  } else if (railStr.includes("Cheque")) {
    actionStr = "Milestone Tracker Locked in Legal Dossier";
  } else {
    actionStr = "Virtual Account Handshake Queued";
  }

  // 6. Word-level Tokenization
  const words = text.split(/\s+/);
  const tokens: HinglishToken[] = words.map((w) => {
    const clean = w.toLowerCase().replace(/[^a-z0-9₹.]/g, "");

    if (
      clean.includes("friday") ||
      clean.includes("kal") ||
      clean.includes("subah") ||
      clean.includes("shaam") ||
      clean.includes("baje") ||
      clean.includes("tareekh") ||
      clean.includes("monday") ||
      clean.includes("morning") ||
      clean.includes("evening") ||
      clean.includes("parso")
    ) {
      return { text: w, type: "date" };
    }

    if (
      clean.includes("lakh") ||
      clean.includes("lac") ||
      clean.endsWith("l") ||
      clean.includes("hazar") ||
      clean.includes("hazaar") ||
      clean.endsWith("k") ||
      clean.includes("poora") ||
      clean.startsWith("₹") ||
      clean.startsWith("rs") ||
      /^\d+(?:\.\d+)?(?:l|k)?$/.test(clean)
    ) {
      return { text: w, type: "amount" };
    }

    if (
      clean.includes("rtgs") ||
      clean.includes("upi") ||
      clean.includes("cheque") ||
      clean.includes("imps") ||
      clean.includes("neft") ||
      clean.includes("mandate") ||
      clean.includes("nach")
    ) {
      return { text: w, type: "rail" };
    }

    if (
      clean.includes("pakka") ||
      clean.includes("dunga") ||
      clean.includes("daal") ||
      clean.includes("clear") ||
      clean.includes("initiated") ||
      clean.includes("settle") ||
      clean.includes("bhej") ||
      clean.includes("karwa")
    ) {
      return { text: w, type: "intent" };
    }

    return { text: w, type: "normal" };
  });

  return {
    amount: amountStr,
    amountNumeric: amountNum,
    date: dateStr,
    rail: railStr,
    confidence: confidenceStr,
    confidenceScore: score,
    action: actionStr,
    tokens,
  };
}

// Aliases for unified imports
export const HINGLISH_SANDBOX_PRESETS = HINGLISH_QUICK_PROMPTS;
export const parseHinglishCommitment = parseHinglishText;

