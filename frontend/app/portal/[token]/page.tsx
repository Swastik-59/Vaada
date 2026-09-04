"use client";

import { use, useEffect, useState } from "react";
import { soundbox } from "@/lib/soundbox";
import styles from "./portal.module.css";

type PortalData = {
  invoice: {
    id: string;
    invoice_number: string;
    currency: string;
    amount_minor: number;
    tds_minor: number;
    net_payable_minor: number;
    status: string;
    dispute_status: string;
    dispute_notes?: string | null;
    issued_at?: string | null;
    due_at?: string | null;
  };
  supplier: {
    name: string;
    legal_name: string;
    slug: string;
  };
  customer: {
    display_name: string;
    gstin?: string | null;
    is_msme: boolean;
  };
  case: {
    id: string;
    state: string;
    root_cause?: string | null;
  };
  active_promise?: {
    id: string;
    promised_date: string;
    amount_minor: number;
    confidence: number;
    language_mix: string;
  } | null;
  statutory?: {
    is_msme: boolean;
    msme_category?: string;
    days_remaining: number;
    is_disallowed: boolean;
    statutory_interest_minor?: number;
    tax_disallowance_rate_percent?: number;
  } | null;
};

function formatCurrency(minor: number, currency: string = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function formatDate(isoString?: string | null) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<PortalData | null>(null);

  // Active Action Tab: 'pay' | 'promise' | 'tds' | 'dispute'
  const [activeTab, setActiveTab] = useState<"pay" | "promise" | "tds" | "dispute">("pay");

  // Payment State
  const [payMethod, setPayMethod] = useState<"upi" | "netbanking" | "card">("upi");
  const [paying, setPaying] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [payResult, setPayResult] = useState<{
    reference_number: string;
    amount_minor: number;
    paid_at: string;
  } | null>(null);

  // Promise State
  const [promisedDate, setPromisedDate] = useState("");
  const [promiseMessage, setPromiseMessage] = useState("");
  const [savingPromise, setSavingPromise] = useState(false);
  const [promiseSuccess, setPromiseSuccess] = useState(false);

  // TDS / Prior Payment State
  const [tdsRate, setTdsRate] = useState("2.0");
  const [tdsRef, setTdsRef] = useState("");
  const [tdsNotes, setTdsNotes] = useState("");
  const [submittingTds, setSubmittingTds] = useState(false);
  const [tdsSuccess, setTdsSuccess] = useState(false);

  // Dispute State
  const [disputeType, setDisputeType] = useState<"gst_mismatch" | "short_supply" | "price_dispute">("gst_mismatch");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeSuccess, setDisputeSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/portal/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Invalid or expired settlement link.");
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        // Default promised date to 5 days from today
        const d = new Date();
        d.setDate(d.getDate() + 5);
        setPromisedDate(d.toISOString().split("T")[0]);
      })
      .catch((err) => {
        setError(err.message || "Failed to load settlement dossier.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    if (!data) return;
    setPaying(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/portal/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: payMethod }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Payment reconciliation failed.");

      const settledAmount = resData.amount_minor || data.invoice.net_payable_minor || data.invoice.amount_minor;

      setPayResult({
        reference_number: resData.reference_number,
        amount_minor: settledAmount,
        paid_at: resData.paid_at || new Date().toISOString(),
      });
      // Refresh local invoice status
      setData({
        ...data,
        invoice: {
          ...data.invoice,
          status: "paid",
          net_payable_minor: 0,
        },
        case: {
          ...data.case,
          state: "recovered",
        },
      });

      // Trigger Web Audio harmonic chime + bilingual speech synthesis announcement
      soundbox.triggerSettlementCelebration(settledAmount, payMethod.toUpperCase());
    } catch (err: any) {
      setError(err.message || "Error processing payment.");
    } finally {
      setPaying(false);
    }
  };

  const handlePromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSavingPromise(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/portal/${token}/promise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promised_date: promisedDate,
          raw_message: promiseMessage || undefined,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to record settlement date.");

      setPromiseSuccess(true);
      setData({
        ...data,
        active_promise: {
          id: resData.promise_id,
          promised_date: resData.promised_date,
          amount_minor: resData.amount_minor,
          confidence: 0.95,
          language_mix: "en",
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to record promise.");
    } finally {
      setSavingPromise(false);
    }
  };

  const handleTdsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmittingTds(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/portal/${token}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispute_type: "tds_deducted",
          notes: tdsNotes || `TDS deducted at ${tdsRate}% under Section 194Q / 194C.`,
          tds_rate_percent: parseFloat(tdsRate) || 2.0,
          acknowledgement_ref: tdsRef || undefined,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to submit TDS declaration.");

      setTdsSuccess(true);
      setData({
        ...data,
        invoice: {
          ...data.invoice,
          dispute_status: "tds_deducted",
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to record TDS declaration.");
    } finally {
      setSubmittingTds(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmittingDispute(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/portal/${token}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispute_type: disputeType,
          notes: disputeNotes,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to submit inquiry.");

      setDisputeSuccess(true);
      setData({
        ...data,
        invoice: {
          ...data.invoice,
          dispute_status: disputeType,
          dispute_notes: disputeNotes,
        },
      });
    } catch (err: any) {
      setError(err.message || "Failed to file inquiry.");
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.portalContainer}>
        <div className={styles.stateBox}>
          <div className={styles.spinner} />
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Securing Settlement Dossier...</h2>
          <p className={styles.errorText}>Connecting to institutional verification ledger.</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.portalContainer}>
        <div className={styles.stateBox}>
          <h2 className={styles.errorTitle}>Settlement Link Expired or Unavailable</h2>
          <p className={styles.errorText}>{error}</p>
          <p style={{ marginTop: "16px", fontSize: "0.8rem", color: "#6e7681" }}>
            For enterprise verification, contact your supplier’s finance operations desk.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isFullyPaid = data.invoice.status === "paid" || data.case.state === "recovered";
  const netDue = data.invoice.net_payable_minor > 0 ? data.invoice.net_payable_minor : data.invoice.amount_minor;

  return (
    <div className={styles.portalContainer}>
      {/* Institutional Header */}
      <header className={styles.portalHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brandGroup}>
            <span className={styles.brandLogo}>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </div>
          <div className={styles.badgeSecure}>
            <span className={styles.shieldDot} />
            <span>256-Bit Encrypted Invoice Access</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className={styles.portalMain}>
        {/* Supplier & Invoice Summary */}
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <div>
              <div className={styles.supplierLabel}>Commercial Supplier</div>
              <h1 className={styles.supplierName}>{data.supplier.name}</h1>
              <div className={styles.supplierLegal}>{data.supplier.legal_name}</div>
            </div>

            <div className={styles.invoicePill}>
              <div className={styles.invoicePillNum}>{data.invoice.invoice_number}</div>
              <div className={styles.invoicePillDate}>Issued: {formatDate(data.invoice.issued_at)}</div>
            </div>
          </div>

          {/* Balance & Due Date Strip */}
          <div className={styles.balanceStrip}>
            <div className={styles.balanceBlock}>
              <span className={styles.balanceLabel}>Outstanding Balance</span>
              <span className={styles.balanceDue} style={{ color: isFullyPaid ? "#3fb950" : "#f0f6fc" }}>
                {formatCurrency(netDue, data.invoice.currency)}
              </span>
              <span className={styles.balanceMeta}>
                Gross: {formatCurrency(data.invoice.amount_minor, data.invoice.currency)}
                {data.invoice.tds_minor > 0 && ` • TDS: ${formatCurrency(data.invoice.tds_minor)}`}
              </span>
            </div>

            <div className={styles.balanceBlock}>
              <span className={styles.balanceLabel}>Payment Cutoff</span>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f0f6fc" }}>
                {formatDate(data.invoice.due_at)}
              </div>
              <div>
                <span
                  className={`${styles.statusTag} ${
                    isFullyPaid
                      ? styles.statusPaid
                      : data.invoice.dispute_status !== "none"
                      ? styles.statusDisputed
                      : styles.statusOverdue
                  }`}
                >
                  {isFullyPaid ? "Paid & Reconciled" : data.invoice.dispute_status !== "none" ? "Under Clarification" : "Payment Due"}
                </span>
              </div>
            </div>

            <div className={styles.balanceBlock}>
              <span className={styles.balanceLabel}>Debtor Organization</span>
              <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#c9d1d9" }}>
                {data.customer.display_name}
              </div>
              <div className={styles.balanceMeta}>
                {data.customer.gstin ? `GSTIN: ${data.customer.gstin}` : "Verified Commercial Buyer"}
              </div>
            </div>
          </div>

          {/* Section 43B(h) Statutory Advisory */}
          {data.statutory?.is_msme && !isFullyPaid && (
            <div className={styles.statutoryBanner}>
              <span className={styles.statutoryIcon}>⚖️</span>
              <div>
                <div className={styles.statutoryTitle}>
                  Section 43B(h) Income Tax Notice — MSMED Act Protection
                </div>
                <div className={styles.statutoryDesc}>
                  As {data.supplier.name} is a registered MSME supplier, payment must be remitted within the statutory 45-day cycle.
                  {data.statutory.days_remaining > 0 ? (
                    <strong> {data.statutory.days_remaining} days remaining before 31.2% tax deduction disallowance takes effect.</strong>
                  ) : (
                    <strong style={{ color: "#f85149" }}> Deadline exceeded. Prompt remittance prevents compounding penal interest.</strong>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Existing Commitment Banner */}
          {data.active_promise && !isFullyPaid && (
            <div
              style={{
                marginTop: "16px",
                background: "rgba(88, 166, 255, 0.1)",
                border: "1px solid rgba(88, 166, 255, 0.3)",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>📅</span>
              <span style={{ fontSize: "0.85rem", color: "#58a6ff" }}>
                Active commitment: Payment of {formatCurrency(data.active_promise.amount_minor)} scheduled for{" "}
                <strong>{formatDate(data.active_promise.promised_date)}</strong>.
              </span>
            </div>
          )}
        </section>

        {/* Action Workspace */}
        {isFullyPaid ? (
          <section className={styles.actionSection}>
            <div className={styles.receiptScreen}>
              <div className={styles.sealContainer}>
                <div className={styles.settlementSeal}>
                  <div className={styles.sealIcon}>✓</div>
                  <div className={styles.sealText}>VAADA VERIFIED</div>
                </div>
              </div>

              <h2 className={styles.receiptTitle}>Commercial Obligation Discharged</h2>
              <p className={styles.receiptSubtitle}>
                Remittance successfully reconciled through the Vaada settlement gateway. Both vendor accounts and debtor credit files are updated in real time.
              </p>

              <div className={styles.clearanceCard}>
                <div className={styles.clearanceBadge}>
                  <span>🏛️</span>
                  <span>Statutory Compliance Cleared</span>
                </div>
                <p className={styles.clearanceText}>
                  This settlement satisfies all covenants under <strong>Section 43B(h) of the Income Tax Act</strong> and <strong>Section 16 of the MSMED Act, 2006</strong>. Penal compound interest liability is extinguished.
                </p>
              </div>

              <div className={styles.receiptMetaBox}>
                <div className={styles.receiptUtr}>
                  <span>UTR: {payResult ? payResult.reference_number : "RECON-SETTLED-DIRECT"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const ref = payResult ? payResult.reference_number : "RECON-SETTLED-DIRECT";
                      navigator.clipboard.writeText(ref);
                      setCopiedUtr(true);
                      setTimeout(() => setCopiedUtr(false), 2000);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: copiedUtr ? "#3fb950" : "#8b949e",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    {copiedUtr ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <div className={styles.receiptTimestamp}>
                  Settled on {formatDate(payResult ? payResult.paid_at : new Date().toISOString())}
                </div>
              </div>

              <div className={styles.receiptActionRow}>
                <button
                  type="button"
                  onClick={() => {
                    const amt = payResult?.amount_minor || data.invoice.amount_minor;
                    soundbox.playPaymentChime();
                    soundbox.speakSettlementAnnouncement(amt, payMethod.toUpperCase());
                  }}
                  className={styles.btnSoundbox}
                >
                  <span>🔊</span>
                  <span>Replay Soundbox Announcement</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className={styles.btnCertificate}
                >
                  <span>📄</span>
                  <span>Download Clearance Certificate</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.actionSection}>
            {/* Tab Selector */}
            <nav className={styles.tabNav}>
              <button
                type="button"
                onClick={() => setActiveTab("pay")}
                className={`${styles.tabBtn} ${activeTab === "pay" ? styles.tabBtnActive : ""}`}
              >
                <span>⚡</span> Pay Instantly
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("promise")}
                className={`${styles.tabBtn} ${activeTab === "promise" ? styles.tabBtnActive : ""}`}
              >
                <span>📅</span> Pledge Settlement Date
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tds")}
                className={`${styles.tabBtn} ${activeTab === "tds" ? styles.tabBtnActive : ""}`}
              >
                <span>📄</span> Report TDS / Prior Remittance
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("dispute")}
                className={`${styles.tabBtn} ${activeTab === "dispute" ? styles.tabBtnActive : ""}`}
              >
                <span>💬</span> Raise Inquiry / Dispute
              </button>
            </nav>

            {/* Tab Content */}
            <div className={styles.tabContent}>
              {error && <div className={styles.alertError}>{error}</div>}

              {/* TAB 1: PAY NOW */}
              {activeTab === "pay" && (
                <div>
                  <div className={styles.payMethodGrid}>
                    <div
                      onClick={() => setPayMethod("upi")}
                      className={`${styles.payMethodCard} ${payMethod === "upi" ? styles.payMethodCardSelected : ""}`}
                    >
                      <div className={styles.methodIcon}>📱</div>
                      <div className={styles.methodTitle}>Instant UPI</div>
                      <div className={styles.methodDesc}>GPay / PhonePe / Paytm</div>
                    </div>

                    <div
                      onClick={() => setPayMethod("netbanking")}
                      className={`${styles.payMethodCard} ${payMethod === "netbanking" ? styles.payMethodCardSelected : ""}`}
                    >
                      <div className={styles.methodIcon}>🏛️</div>
                      <div className={styles.methodTitle}>Corporate Netbanking</div>
                      <div className={styles.methodDesc}>HDFC, ICICI, SBI, Axis</div>
                    </div>

                    <div
                      onClick={() => setPayMethod("card")}
                      className={`${styles.payMethodCard} ${payMethod === "card" ? styles.payMethodCardSelected : ""}`}
                    >
                      <div className={styles.methodIcon}>💳</div>
                      <div className={styles.methodTitle}>Corporate Card</div>
                      <div className={styles.methodDesc}>Visa / Mastercard / Amex</div>
                    </div>
                  </div>

                  {payMethod === "upi" && (
                    <div className={styles.upiDetailsBox}>
                      <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>Dynamic Commercial VPA:</div>
                      <div className={styles.upiVpa}>
                        pay.{data.supplier.slug ?? "settle"}@vaada.razorpay
                      </div>
                      <div className={styles.qrContainer}>
                        {/* Clean SVG Placeholder for Dynamic UPI QR */}
                        <svg viewBox="0 0 100 100" width="140" height="140">
                          <rect width="100" height="100" fill="#ffffff" />
                          <rect x="10" y="10" width="30" height="30" fill="#000000" />
                          <rect x="16" y="16" width="18" height="18" fill="#ffffff" />
                          <rect x="20" y="20" width="10" height="10" fill="#000000" />
                          <rect x="60" y="10" width="30" height="30" fill="#000000" />
                          <rect x="66" y="16" width="18" height="18" fill="#ffffff" />
                          <rect x="70" y="20" width="10" height="10" fill="#000000" />
                          <rect x="10" y="60" width="30" height="30" fill="#000000" />
                          <rect x="16" y="66" width="18" height="18" fill="#ffffff" />
                          <rect x="20" y="70" width="10" height="10" fill="#000000" />
                          <rect x="50" y="50" width="15" height="15" fill="#000000" />
                          <rect x="70" y="65" width="18" height="18" fill="#000000" />
                          <rect x="50" y="75" width="12" height="15" fill="#000000" />
                        </svg>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>
                        Scan using any UPI app or click below to complete settlement.
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={paying}
                    className={styles.btnPrimary}
                  >
                    {paying ? "Reconciling Institutional Settlement..." : `Authorize Payment of ${formatCurrency(netDue)}`}
                  </button>
                </div>
              )}

              {/* TAB 2: PROMISE TO PAY */}
              {activeTab === "promise" && (
                <form onSubmit={handlePromise}>
                  {promiseSuccess && (
                    <div className={styles.alertSuccess}>
                      ✓ Commitment confirmed! The supplier’s credit operations desk has been notified.
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Promised Remittance Date</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={promisedDate}
                      onChange={(e) => setPromisedDate(e.target.value)}
                      className={styles.formInput}
                    />
                    <div className={styles.formHint}>
                      Select the exact date by which your finance department will disburse payment.
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Remittance Note / Department Context (Optional)</label>
                    <textarea
                      placeholder="e.g. Audit approval underway; releasing RTGS batch this Friday."
                      value={promiseMessage}
                      onChange={(e) => setPromiseMessage(e.target.value)}
                      className={styles.formTextarea}
                    />
                    <div className={styles.formHint}>
                      Supports English, Hindi, or Hinglish. Our automated reconciliation engine will hold automated calls until this date.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPromise}
                    className={styles.btnPrimary}
                  >
                    {savingPromise ? "Recording Settlement Date..." : "Confirm Remittance Commitment"}
                  </button>
                </form>
              )}

              {/* TAB 3: TDS / PRIOR PAYMENT */}
              {activeTab === "tds" && (
                <form onSubmit={handleTdsSubmit}>
                  {tdsSuccess && (
                    <div className={styles.alertSuccess}>
                      ✓ Declaration logged! Remittance deduction submitted for verification.
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>TDS Deduction Rate (Income Tax Act)</label>
                    <select
                      value={tdsRate}
                      onChange={(e) => setTdsRate(e.target.value)}
                      className={styles.formSelect}
                    >
                      <option value="0.1">0.1% — Section 194Q (Purchase of Goods)</option>
                      <option value="1.0">1.0% — Section 194C (Contractor Individual/HUF)</option>
                      <option value="2.0">2.0% — Section 194C (Contractor Corporate / Firm)</option>
                      <option value="10.0">10.0% — Section 194J (Professional Services)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Form 16A Ack / Bank UTR Number</label>
                    <input
                      type="text"
                      placeholder="e.g. ACK-194C-998811 or UTR123456789"
                      value={tdsRef}
                      onChange={(e) => setTdsRef(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Supporting Notes</label>
                    <textarea
                      placeholder="e.g. Remitted net amount via RTGS yesterday; TDS certificate attached to vendor email."
                      value={tdsNotes}
                      onChange={(e) => setTdsNotes(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTds}
                    className={styles.btnPrimary}
                  >
                    {submittingTds ? "Submitting Declaration..." : "Submit TDS / Payment Record"}
                  </button>
                </form>
              )}

              {/* TAB 4: DISPUTE */}
              {activeTab === "dispute" && (
                <form onSubmit={handleDisputeSubmit}>
                  {disputeSuccess && (
                    <div className={styles.alertSuccess}>
                      ✓ Dispute dossier opened. An account manager from {data.supplier.name} will contact your accounts payable desk.
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Clarification Reason</label>
                    <select
                      value={disputeType}
                      onChange={(e) => setDisputeType(e.target.value as any)}
                      className={styles.formSelect}
                    >
                      <option value="gst_mismatch">GST Portal Mismatch (GSTR-2B discrepancy)</option>
                      <option value="short_supply">Quantity Discrepancy / Partial Shipment</option>
                      <option value="price_dispute">Pricing Discrepancy vs Approved PO</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Detailed Clarification</label>
                    <textarea
                      required
                      placeholder="Please specify invoice line items, revised quantities, or PO references."
                      value={disputeNotes}
                      onChange={(e) => setDisputeNotes(e.target.value)}
                      className={styles.formTextarea}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDispute}
                    className={styles.btnPrimary}
                  >
                    {submittingDispute ? "Submitting Clarification..." : "Submit Formal Inquiry"}
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className={styles.portalFooter}>
        <div className={styles.footerInner}>
          Powered by <strong>VAADA</strong> — Enterprise Receivables & Section 43B(h) Compliance Surveillance.
        </div>
      </footer>
    </div>
  );
}
