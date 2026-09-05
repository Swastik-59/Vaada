"use client";

import React, { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedPreviewRow {
  invoice_number: string;
  customer_name: string;
  amount: string;
  due_date: string;
  is_msme: string;
}

export default function ImportCsvModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportCsvModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported_count: number;
    duplicate_count: number;
    error_count: number;
    errors: string[];
    total_amount_minor: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split("\n");
        if (lines.length < 2) {
          setError("CSV file must contain a header row and at least one data row.");
          setPreviewRows([]);
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
        const invIdx = headers.findIndex((h) => h.includes("invoice"));
        const custIdx = headers.findIndex((h) => h.includes("customer") || h.includes("buyer"));
        const amtIdx = headers.findIndex((h) => h.includes("amount") || h.includes("total"));
        const dueIdx = headers.findIndex((h) => h.includes("due"));
        const msmeIdx = headers.findIndex((h) => h.includes("msme"));

        const previews: ParsedPreviewRow[] = [];
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
          if (cols.length >= 3) {
            previews.push({
              invoice_number: cols[invIdx] || cols[0] || `Row ${i}`,
              customer_name: cols[custIdx] || cols[1] || "—",
              amount: cols[amtIdx] || cols[2] || "0",
              due_date: cols[dueIdx] || cols[3] || "—",
              is_msme: cols[msmeIdx] || "false",
            });
          }
        }
        setPreviewRows(previews);
      } catch {
        setError("Failed to parse CSV preview. Please verify file format.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      processFile(file);
    } else {
      setError("Please drop a valid .csv file.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file to upload.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const data = await apiFetch("/api/v1/invoices/import", {
        method: "POST",
        body: formData,
      });

      setResult(data);
      if (data.imported_count > 0) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || "Import failed. Please check your data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0d1117",
          border: "1px solid #30363d",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.75rem",
          color: "#e6edf3",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f0f6fc", margin: "0 0 0.25rem 0" }}>
              Import Receivables (CSV)
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#8b949e", margin: 0 }}>
              Batch upload commercial invoices with debtor contacts, statutory dates, and Section 43B(h) classifications.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Template Download Link */}
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#161b22",
            border: "1px solid #21262d",
            borderRadius: "6px",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "0.82rem", color: "#c9d1d9" }}>
            Need the correct column structure? Download our verified template.
          </div>
          <a
            href="/api/v1/invoices/template.csv"
            download="vaada_receivables_template.csv"
            style={{
              fontSize: "0.8rem",
              color: "var(--accent, #c4943a)",
              textDecoration: "none",
              fontWeight: 500,
              padding: "0.35rem 0.75rem",
              border: "1px solid rgba(196, 148, 58, 0.4)",
              borderRadius: "4px",
              backgroundColor: "rgba(196, 148, 58, 0.08)",
            }}
          >
            Download CSV Template ↓
          </a>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed #30363d",
            borderRadius: "6px",
            padding: "2rem",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: selectedFile ? "#161b22" : "transparent",
            marginBottom: "1.25rem",
            transition: "all 0.2s ease",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem", color: "var(--accent, #c4943a)" }}>
            📄
          </div>
          {selectedFile ? (
            <div>
              <div style={{ fontWeight: 600, color: "#f0f6fc", fontSize: "0.95rem" }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "0.25rem" }}>
                {(selectedFile.size / 1024).toFixed(1)} KB · Click or drag to replace
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 500, color: "#f0f6fc", fontSize: "0.95rem" }}>
                Drop commercial receivables CSV here, or click to browse
              </div>
              <div style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "0.25rem" }}>
                Supports standard UTF-8 CSV with invoice number, customer name, amount, and due date.
              </div>
            </div>
          )}
        </div>

        {/* Parse Preview Table */}
        {previewRows.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#8b949e", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Data Preview (First {previewRows.length} Rows)
            </div>
            <div style={{ overflowX: "auto", border: "1px solid #21262d", borderRadius: "6px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#161b22", borderBottom: "1px solid #21262d", color: "#8b949e" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Invoice #</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Debtor Name</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Amount</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Due Date</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>MSME</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #21262d" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontFamily: "var(--font-mono, monospace)", color: "#c9d1d9" }}>
                        {row.invoice_number}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#f0f6fc" }}>{row.customer_name}</td>
                      <td style={{ padding: "0.5rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#f0f6fc" }}>
                        ₹{Number(row.amount).toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#8b949e" }}>{row.due_date}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {row.is_msme === "true" ? (
                          <span style={{ color: "var(--status-recovered, #22c55e)", fontSize: "0.75rem" }}>Yes</span>
                        ) : (
                          <span style={{ color: "#8b949e", fontSize: "0.75rem" }}>No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "6px",
              color: "#f87171",
              fontSize: "0.85rem",
              marginBottom: "1.25rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Results Summary */}
        {result && (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: result.imported_count > 0 ? "rgba(34, 197, 94, 0.1)" : "#161b22",
              border: `1px solid ${result.imported_count > 0 ? "rgba(34, 197, 94, 0.3)" : "#30363d"}`,
              borderRadius: "6px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ fontWeight: 600, color: result.imported_count > 0 ? "#22c55e" : "#f0f6fc", marginBottom: "0.25rem" }}>
              {result.imported_count > 0 ? "✓ Ingestion Complete" : "Ingestion Finished with Warnings"}
            </div>
            <div style={{ color: "#c9d1d9" }}>
              Successfully imported <strong>{result.imported_count}</strong> receivables totaling{" "}
              <strong>₹{Math.round(result.total_amount_minor / 100).toLocaleString("en-IN")}</strong>.
              {result.duplicate_count > 0 && (
                <span style={{ color: "#8b949e" }}> ({result.duplicate_count} duplicates skipped).</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: "0.5rem", color: "#f87171", fontSize: "0.8rem" }}>
                {result.errors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.6rem 1.25rem",
              backgroundColor: "#21262d",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#c9d1d9",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              disabled={!selectedFile || loading}
              onClick={handleSubmit}
              style={{
                padding: "0.6rem 1.25rem",
                backgroundColor: selectedFile && !loading ? "var(--accent, #c4943a)" : "#30363d",
                border: "none",
                borderRadius: "6px",
                color: "#0d1117",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: selectedFile && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Processing CSV..." : "Start Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
