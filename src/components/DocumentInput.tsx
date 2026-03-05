import { useState, useRef } from "react";
import { FileText, Upload, X, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as mammoth from "mammoth/mammoth.browser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface DocumentInputProps {
  value: string;
  onChange: (text: string) => void;
}

type CsvPreview = {
  headers: string[];
  rows: string[][];
};

const DocumentInput = ({ value, onChange }: DocumentInputProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);

  const extractPdfText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
      pages.push(pageText);
    }

    return pages.join("\n\n");
  };

  const extractDocxText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value.trim();
  };

  const parseCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && ch === ",") {
        row.push(cell);
        cell = "";
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        continue;
      }

      cell += ch;
    }

    row.push(cell);
    rows.push(row);

    // Preserve in-between empty rows so row numbers match the original sheet.
    while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) {
      rows.pop();
    }

    return rows;
  };

  const preprocessCsv = (rawText: string): { contextText: string; preview: CsvPreview } => {
    const missingTokens = new Set(["", "na", "n/a", "null", "undefined", "nan", "-", "?"]);

    const cleanCell = (value: string): string =>
      value
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/\uFFFD/g, "")
        .replace(/\?/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const isMissing = (value: string): boolean => missingTokens.has(value.toLowerCase());

    const toNumber = (value: string): number | null => {
      const n = Number(value.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const parsed = parseCsvRows(rawText);
    if (parsed.length === 0) {
      return { contextText: "", preview: { headers: [], rows: [] } };
    }

    const width = Math.max(...parsed.map((r) => r.length));
    const normalized = parsed.map((r) => Array.from({ length: width }, (_, i) => cleanCell(r[i] ?? "")));

    const rawHeaders = normalized[0];
    const headers = rawHeaders.map((h, i) => h || `Column ${i + 1}`);
    const body = normalized.slice(1);

    const keepCols = headers
      .map((_, colIdx) => {
        const hasHeader = headers[colIdx].trim() !== "";
        const hasData = body.some((row) => !isMissing(row[colIdx] ?? ""));
        return hasHeader || hasData;
      })
      .map((keep, idx) => (keep ? idx : -1))
      .filter((idx) => idx !== -1);

    const compactHeaders = keepCols.map((idx) => headers[idx]);
    const compactRows = body.map((row) => keepCols.map((idx) => row[idx] ?? ""));

    const numericColumns = compactHeaders.map((_, colIdx) => {
      const vals = compactRows
        .map((r) => r[colIdx])
        .filter((v) => !isMissing(v))
        .map((v) => toNumber(v))
        .filter((v): v is number => v !== null);

      const nonMissingCount = compactRows.filter((r) => !isMissing(r[colIdx])).length;
      return nonMissingCount > 0 && vals.length === nonMissingCount;
    });

    const fillValues = compactHeaders.map((_, colIdx) => {
      if (numericColumns[colIdx]) {
        const vals = compactRows
          .map((r) => r[colIdx])
          .filter((v) => !isMissing(v))
          .map((v) => toNumber(v))
          .filter((v): v is number => v !== null);

        const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return Number.isInteger(mean) ? String(mean) : mean.toFixed(2);
      }

      const freq = new Map<string, number>();
      compactRows.forEach((r) => {
        const v = r[colIdx];
        if (!isMissing(v)) {
          freq.set(v, (freq.get(v) || 0) + 1);
        }
      });

      let best = "N/A";
      let bestCount = 0;
      for (const [v, count] of freq) {
        if (count > bestCount) {
          best = v;
          bestCount = count;
        }
      }
      return best;
    });

    const filledRows = compactRows.map((r) => r.map((v, colIdx) => (isMissing(v) ? fillValues[colIdx] : v)));

    const csvText = [compactHeaders, ...filledRows]
      .map((r) =>
        r
          .map((v) => {
            const needsQuotes = /[",\n]/.test(v);
            return needsQuotes ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(",")
      )
      .join("\n");

    return {
      contextText: `Cleaned CSV Data:\n${csvText}`,
      preview: { headers: compactHeaders, rows: filledRows },
    };
  };

  const handleFile = async (file: File) => {
    try {
      const lowerName = file.name.toLowerCase();
      const isDoc = lowerName.endsWith(".doc");
      const isDocx = lowerName.endsWith(".docx");
      const isCsv = lowerName.endsWith(".csv") || file.type === "text/csv";

      if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        const text = await extractPdfText(file);
        setCsvPreview(null);
        onChange(text);
        return;
      }

      if (isDocx) {
        const text = await extractDocxText(file);
        setCsvPreview(null);
        onChange(text);
        return;
      }

      if (isCsv) {
        const raw = await file.text();
        const processed = preprocessCsv(raw);
        setCsvPreview(processed.preview);
        onChange(processed.contextText);
        return;
      }

      // Legacy .doc is not reliably parseable in-browser.
      if (isDoc) {
        alert("Legacy .doc files are not fully supported. Please convert to .docx, .pdf, or .txt.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setCsvPreview(null);
        onChange((e.target?.result as string) || "");
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Failed to read file:", error);
      setCsvPreview(null);
      onChange("");
      alert("Could not read this file. Please try another PDF/DOCX/CSV/text file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCsvPreview(null);
      onChange(text);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Document / Text Input
        </label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="text-xs h-7 border-border/50 hover:border-primary/50 hover:text-primary"
          >
            <Clipboard className="w-3 h-3 mr-1" />
            Paste
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="text-xs h-7 border-border/50 hover:border-primary/50 hover:text-primary"
          >
            <Upload className="w-3 h-3 mr-1" />
            Upload
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCsvPreview(null);
                onChange("");
              }}
              className="text-xs h-7 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Textarea
          value={value}
          onChange={(e) => {
            setCsvPreview(null);
            onChange(e.target.value);
          }}
          placeholder="Paste text, drag & drop a PDF/DOC/DOCX/CSV file, or click Upload..."
          className="min-h-[160px] max-h-[300px] bg-transparent border-none rounded-xl text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <FileText className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          {value.split(/\s+/).filter(Boolean).length} words - {value.length} characters
        </p>
      )}

      {csvPreview && csvPreview.headers.length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/50">
            CSV Preview (cleaned, missing values filled)
          </div>
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {csvPreview.headers.map((h, i) => (
                    <TableHead key={`${h}-${i}`} className="whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.rows.map((r, rowIdx) => (
                  <TableRow key={`row-${rowIdx}`}>
                    {r.map((c, colIdx) => (
                      <TableCell key={`cell-${rowIdx}-${colIdx}`} className="whitespace-nowrap">
                        {c}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.csv,text/csv,.txt,.md,.json,.html,.xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
};

export default DocumentInput;
