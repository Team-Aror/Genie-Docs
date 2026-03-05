const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7
].filter(Boolean);

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Per-request payload guardrails
const MAX_DOC_CHARS = 12000;
const MAX_HISTORY_CHARS = 3000;
const CHUNK_SIZE_CHARS = 10000;
const CHUNK_OVERLAP_CHARS = 800;
const MAX_SUMMARY_CHUNKS = 30;
const MAX_FAQ_CHUNKS = 20;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n...[Truncated to ${maxChars} characters]`;
}

function splitIntoChunks(
  text: string,
  chunkSize = CHUNK_SIZE_CHARS,
  overlap = CHUNK_OVERLAP_CHARS
): string[] {
  const clean = text?.trim() || "";
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    // Prefer splitting on sentence/paragraph boundaries.
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const splitAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (splitAt > chunkSize * 0.6) {
        end = start + splitAt + 1;
      }
    }

    chunks.push(clean.slice(start, end).trim());

    if (end >= clean.length) break;
    start = Math.max(end - overlap, 0);
  }

  return chunks.filter(Boolean);
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(Boolean);
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
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
}

function extractCsvTextFromContext(documentContext: string): string | null {
  const normalized = documentContext.replace(/^\uFEFF/, "").trimStart();
  const prefix = "Cleaned CSV Data:";

  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length).trimStart();
  }

  return null;
}

function parseOrdinalWordToNumber(word: string): number | null {
  const map: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
  };
  return map[word.toLowerCase()] ?? null;
}

function parseOrdinalLikeNumber(token: string): number | null {
  const numeric = token.match(/^(\d+)$/);
  if (numeric) return Number(numeric[1]);

  const ordinalNumeric = token.match(/^(\d+)(st|nd|rd|th)$/i);
  if (ordinalNumeric) return Number(ordinalNumeric[1]);

  return parseOrdinalWordToNumber(token);
}

function parseColumnNumber(lowerQ: string): number | null {
  const direct = lowerQ.match(/(?:column|col)(?:\s*(?:number|no|#))?\s*(\d+)/i);
  if (direct) return Number(direct[1]);

  const ordinal = lowerQ.match(/\b(1st|2nd|3rd|[4-9]th|[1-9]\d*th)\s+(?:column|col)\b/i);
  if (ordinal) {
    const n = Number(ordinal[1].replace(/\D+/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  const word = lowerQ.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:column|col)\b/i);
  if (word) return parseOrdinalWordToNumber(word[1]);

  const reverseWord = lowerQ.match(/\b(?:column|col)\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/i);
  if (reverseWord) return parseOrdinalWordToNumber(reverseWord[1]);

  return null;
}

function parseRowNumber(lowerQ: string): number | null {
  const direct = lowerQ.match(/row(?:\s*(?:number|no|#))?\s*(\d+)/i);
  if (direct) return Number(direct[1]);

  const rowOrdinal = lowerQ.match(/\b(1st|2nd|3rd|[4-9]th|[1-9]\d*th)\s+row\b/i);
  if (rowOrdinal) {
    const n = Number(rowOrdinal[1].replace(/\D+/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  const word = lowerQ.match(/\brow(?:\s*(?:number|no|#))?\s*(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/i);
  if (word) return parseOrdinalWordToNumber(word[1]);

  const reverseWord = lowerQ.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+row\b/i);
  if (reverseWord) return parseOrdinalWordToNumber(reverseWord[1]);

  const spelledOne = lowerQ.match(/\brow(?:\s*(?:number|no|#))?\s*(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (spelledOne) {
    const altMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    return altMap[spelledOne[1].toLowerCase()] ?? null;
  }

  return null;
}

function parseLastRowOffset(lowerQ: string): number | null {
  // Returns 0 for "last row", 1 for "second last row", 2 for "third last row"
  if (/\bthird\s+last\s+row\b/i.test(lowerQ)) return 2;
  if (/\bsecond\s+last\s+row\b/i.test(lowerQ)) return 1;
  if (/\blast\s+row\b/i.test(lowerQ)) return 0;
  return null;
}

function parseSearchTerm(lowerQ: string): string | null {
  const quoted = lowerQ.match(/["']([^"']+)["']/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const beforeWord = lowerQ.match(/\b([a-z0-9_-]{2,})\s+word\b/i);
  if (beforeWord?.[1]) return beforeWord[1].trim();

  const beforeRow = lowerQ.match(/\b([a-z0-9_-]{2,})\s+(?:kis|konsi|kon\s*si|which|what)\s+row\b/i);
  if (beforeRow?.[1]) return beforeRow[1].trim();

  const beforeColumn = lowerQ.match(/\b([a-z0-9_-]{2,})\s+(?:kis|konsi|kon\s*si|which|what)\s+(?:column|col)\b/i);
  if (beforeColumn?.[1]) return beforeColumn[1].trim();

  const afterWord = lowerQ.match(/(?:word|value|term|text)\s+([a-z0-9_-]{2,})/i);
  if (afterWord?.[1]) return afterWord[1].trim();

  const contains = lowerQ.match(/(?:contains|include|includes|has|exist|exists)\s+([a-z0-9_-]{2,})/i);
  if (contains?.[1]) return contains[1].trim();

  return null;
}

function answerCsvLookup(userMessage: string, documentContext: string): string | null {
  const csvText = extractCsvTextFromContext(documentContext);
  if (!csvText) return null;

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return "CSV data is empty.";

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const lowerQ = userMessage.toLowerCase();
  const asksRow = /\brow\b/i.test(lowerQ) || /\blast\s+row\b/i.test(lowerQ);
  const asksCol = /\b(column|col)\b/i.test(lowerQ);
  const isLookupQuery = asksRow || asksCol;

  const rowNoParsed = parseRowNumber(lowerQ);
  const colNoParsed = parseColumnNumber(lowerQ);
  const lastRowOffset = parseLastRowOffset(lowerQ);
  const lastRowAsked = lastRowOffset !== null;
  const searchTerm = parseSearchTerm(lowerQ);
  const asksRowForTerm =
    /\b(?:kis|konsi|kon\s*si|which|what)\s+row\b/i.test(lowerQ) ||
    /\brow\b.*\b(?:for|of)\b/i.test(lowerQ);
  const asksColForTerm =
    /\b(?:kis|konsi|kon\s*si|which|what)\s+(?:column|col)\b/i.test(lowerQ) ||
    /\b(?:column|col)\b.*\b(?:for|of)\b/i.test(lowerQ);
  const asksWhere = /\b(?:where|kahan)\b/i.test(lowerQ);

  if (/\b(total|how many)\s+rows\b/i.test(lowerQ)) {
    return `This CSV has ${dataRows.length} data rows (excluding header).`;
  }

  if (/\b(total|how many)\s+columns\b/i.test(lowerQ)) {
    return `This CSV has ${headers.length} columns.`;
  }

  const findMatches = (term: string): Array<{ row: number; col: number; value: string }> => {
    const matches: Array<{ row: number; col: number; value: string }> = [];
    for (let r = 0; r < dataRows.length; r++) {
      for (let c = 0; c < headers.length; c++) {
        const cell = dataRows[r]?.[c] ?? "";
        if (cell.toLowerCase().includes(term)) {
          matches.push({ row: r + 1, col: c + 1, value: cell });
        }
      }
    }
    return matches;
  };

  if ((asksRowForTerm || asksColForTerm || asksWhere) && searchTerm) {
    const matches = findMatches(searchTerm);
    if (!matches.length) {
      return `No, "${searchTerm}" was not found in the CSV.`;
    }

    if (asksRowForTerm && !asksColForTerm) {
      const uniqueRows = Array.from(new Set(matches.map((m) => m.row))).sort((a, b) => a - b);
      return `"${searchTerm}" found in row(s): ${uniqueRows.join(", ")}.`;
    }

    if (asksColForTerm && !asksRowForTerm) {
      const uniqueCols = Array.from(new Set(matches.map((m) => m.col))).sort((a, b) => a - b);
      return `"${searchTerm}" found in column(s): ${uniqueCols.join(", ")}.`;
    }

    const preview = matches
      .slice(0, 5)
      .map((m) => `row ${m.row}, column ${m.col}`)
      .join("; ");
    return `"${searchTerm}" found at: ${preview}${matches.length > 5 ? ` (+${matches.length - 5} more)` : ""}.`;
  }

  if (asksRow && colNoParsed === null) {
    return "Please specify a column number, e.g. 'row 100 column 1'.";
  }

  if (asksCol && !asksRow && rowNoParsed === null && !lastRowAsked) {
    return "Please specify a row number too, e.g. 'row 100 column 1' or 'last row column 1'.";
  }

  if (!isLookupQuery) {
    if (searchTerm) {
      let count = 0;
      for (const row of dataRows) {
        for (const cell of row) {
          if (cell.toLowerCase().includes(searchTerm)) count++;
        }
      }
      return count > 0
        ? `Yes, "${searchTerm}" exists in the CSV (${count} match${count > 1 ? "es" : ""}).`
        : `No, "${searchTerm}" was not found in the CSV.`;
    }
    return null;
  }

  if (colNoParsed === null) return null;
  const colNo = colNoParsed;
  if (!Number.isFinite(colNo) || colNo < 1 || colNo > headers.length) {
    return `Column ${colNo} is out of range. Valid columns: 1 to ${headers.length}.`;
  }

  const rowNo = lastRowAsked ? dataRows.length - (lastRowOffset ?? 0) : rowNoParsed ?? NaN;
  if (!lastRowAsked && rowNoParsed === null) {
    return "Please specify a row number, e.g. 'row 100 column 1' or 'last row column 1'.";
  }
  if (!Number.isFinite(rowNo) || rowNo < 1 || rowNo > dataRows.length) {
    return `Row is out of range. Valid rows: 1 to ${dataRows.length}.`;
  }

  const value = dataRows[rowNo - 1]?.[colNo - 1] ?? "";
  const header = headers[colNo - 1] || `Column ${colNo}`;
  return `Row ${rowNo}, Column ${colNo} (${header}) = ${value || "[empty]"}`;
}

function answerTextLookup(userMessage: string, documentContext: string): string | null {
  const cleanContext = documentContext.replace(/\s+/g, " ").trim();
  if (!cleanContext) return null;

  const lowerQ = userMessage.toLowerCase();
  const words = cleanContext.match(/[\p{L}\p{N}'-]+/gu) || [];
  if (!words.length) return null;

  const asksThirdLastWord =
    /\bthird\s+last\s+word\b/i.test(lowerQ) ||
    /\bteesr(?:a|y)\s+last\s+word\b/i.test(lowerQ);
  if (asksThirdLastWord) {
    if (words.length < 3) return "Context has fewer than 3 words.";
    return `The third last word in the context is "${words[words.length - 3]}".`;
  }

  const asksSecondLastWord =
    /\bsecond\s+last\s+word\b/i.test(lowerQ) ||
    /\b2nd\s+last\s+word\b/i.test(lowerQ) ||
    /\bdusra\s+last\s+word\b/i.test(lowerQ);
  if (asksSecondLastWord) {
    if (words.length < 2) return "Context has fewer than 2 words.";
    return `The second last word in the context is "${words[words.length - 2]}".`;
  }

  const asksLastWord =
    /\blast\s+word\b/i.test(lowerQ) ||
    /\b(last|ending)\s+(?:wala\s+)?word\b/i.test(lowerQ) ||
    /\bcontext\s+ka\s+last\b/i.test(lowerQ);

  if (asksLastWord) {
    return `The last word in the context is "${words[words.length - 1]}".`;
  }

  const nextWordPatterns = [
    /\bafter\s+["']?([\p{L}\p{N}'-]+)["']?/iu,
    /\b["']?([\p{L}\p{N}'-]+)["']?\s+(?:ke|ky|kay)?\s*(?:bad|baad)\s*(?:konsa|kon\s*sa|next)?\s*word\b/iu,
    /\bnext\s+word\s+(?:of|after)\s+["']?([\p{L}\p{N}'-]+)["']?/iu,
    /\bword\s+["']?([\p{L}\p{N}'-]+)["']?\s+(?:ke|ky|kay)?\s*(?:bad|baad)\s*konsa\s+word\b/iu,
  ];
  const m = nextWordPatterns
    .map((re) => lowerQ.match(re))
    .find((match) => Boolean(match?.[1]));

  if (m?.[1]) {
    const target = m[1].toLowerCase();
    const idx = words.findIndex((w) => w.toLowerCase() === target);
    if (idx === -1) return `The word "${m[1]}" was not found in the context.`;
    if (idx === words.length - 1) return `"${m[1]}" is the last word, so there is no next word.`;
    return `The word after "${m[1]}" is "${words[idx + 1]}".`;
  }

  // Query asks for "next word" but didn't provide base word.
  if (/\bnext\s+word\b/i.test(lowerQ) || /\bbad\s+konsa\s+word\b/i.test(lowerQ)) {
    return "Please specify the word first, e.g. 'word water ke baad konsa word hai?'.";
  }

  return null;
}

function pickRelevantContext(documentText: string, query: string, maxChars = MAX_DOC_CHARS): string {
  if (!documentText) return "";
  if (documentText.length <= maxChars) return documentText;

  const retrievalChunks = splitIntoChunks(documentText, 2200, 250);
  const queryTokens = tokenize(query);

  const scored = retrievalChunks.map((chunk, idx) => {
    const lower = chunk.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
      const occurrences = lower.split(token).length - 1;
      score += occurrences;
    }

    if (queryTokens.length > 0 && lower.includes(query.toLowerCase())) {
      score += 8;
    }

    return { idx, chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let selected = "";
  for (const entry of scored) {
    if (selected.length + entry.chunk.length + 2 > maxChars) continue;
    selected += (selected ? "\n\n" : "") + entry.chunk;
    if (selected.length >= maxChars * 0.9) break;
  }

  // Fallback if no score matched tokens.
  if (!selected) {
    selected = documentText.slice(0, maxChars);
  }

  return selected;
}

function tryParseFaqArray(raw: string): { question: string; answer: string }[] | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item) => ({
        question: String(item?.question || "").trim(),
        answer: String(item?.answer || "").trim(),
      }))
      .filter((qa) => qa.question && qa.answer);
  } catch {
    return null;
  }
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_KEYS.length) {
    throw new Error("No Gemini API key configured.");
  }

  const errors: string[] = [];

  for (let keyIndex = 0; keyIndex < GEMINI_KEYS.length; keyIndex++) {
    const apiKey = GEMINI_KEYS[keyIndex];

    let response: Response;
    try {
      response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });
    } catch (networkErr) {
      throw new Error(`Network error: ${networkErr}`);
    }

    const body = await response.json();

    if (response.ok) {
      return body.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    }

    const errMessage = body?.error?.message || "Unknown error";
    errors.push(`Key ${keyIndex + 1}: ${errMessage}`);

    if (response.status !== 429) {
      throw new Error(errMessage);
    }

    if (keyIndex < GEMINI_KEYS.length - 1) {
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  throw new Error(
    "All API keys are rate limited. Please wait a few minutes and try again.\n\n" +
      errors.join("\n")
  );
}

export async function summarizeText(text: string): Promise<string> {
  const source = text?.trim() || "";
  if (!source) return "Please provide document text first.";

  const chunks = splitIntoChunks(source).slice(0, MAX_SUMMARY_CHUNKS);

  if (chunks.length === 1) {
    const prompt = `Please provide a comprehensive yet concise summary of the following document or text.
Highlight the key points, main ideas, and important conclusions.
Format the summary with clear sections if applicable.

TEXT TO SUMMARIZE:
${truncate(chunks[0], MAX_DOC_CHARS)}`;
    return callGemini(prompt);
  }

  const partials: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const partialPrompt = `You are summarizing part ${i + 1} of ${chunks.length} from a large document.
Create a concise summary of this part only, focusing on key facts, entities, decisions, and important numbers.
Return plain text with short bullet points.

DOCUMENT PART ${i + 1}:
${chunks[i]}`;
    partials.push(await callGemini(partialPrompt));
  }

  const mergedPartials = partials
    .map((s, i) => `Part ${i + 1} Summary:\n${s}`)
    .join("\n\n");

  const finalPrompt = `You are given summaries of multiple parts of one large document.
Create one unified final summary with:
1) Executive summary
2) Key points
3) Important details/figures
4) Final conclusions

PARTIAL SUMMARIES:
${truncate(mergedPartials, MAX_DOC_CHARS)}`;

  return callGemini(finalPrompt);
}

export async function generateFAQs(
  text: string
): Promise<{ question: string; answer: string }[]> {
  const source = text?.trim() || "";
  if (!source) return [{ question: "No document provided", answer: "Please upload or paste content first." }];

  const chunks = splitIntoChunks(source).slice(0, MAX_FAQ_CHUNKS);

  if (chunks.length === 1) {
    const prompt = `Analyze the following document/text and generate 6-8 frequently asked questions (FAQs) with detailed answers.

Format as strict JSON array:
[
  {"question": "Question here?", "answer": "Detailed answer here."}
]

Only return JSON.

DOCUMENT:
${truncate(chunks[0], MAX_DOC_CHARS)}`;

    const result = await callGemini(prompt);
    return (
      tryParseFaqArray(result) ||
      [{ question: "Could not parse FAQs", answer: result }]
    );
  }

  const candidates: { question: string; answer: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `You are analyzing part ${i + 1} of ${chunks.length} of a large document.
Generate exactly 3 high-value FAQs from this part.
Return strict JSON array only:
[
  {"question": "...", "answer": "..."}
]

DOCUMENT PART ${i + 1}:
${chunks[i]}`;

    const result = await callGemini(chunkPrompt);
    const parsed = tryParseFaqArray(result);
    if (parsed) {
      candidates.push(...parsed);
    }
  }

  if (!candidates.length) {
    return [{ question: "Could not parse FAQs", answer: "No valid FAQ JSON was returned from chunked processing." }];
  }

  const deduped = new Map<string, { question: string; answer: string }>();
  for (const qa of candidates) {
    const key = qa.question.toLowerCase().replace(/\s+/g, " ").trim();
    if (!deduped.has(key)) deduped.set(key, qa);
  }

  const candidateJson = JSON.stringify(Array.from(deduped.values()).slice(0, 30));
  const finalizePrompt = `You are given candidate FAQs generated from chunks of a large document.
Select and refine the best 8 non-overlapping FAQs.
Return strict JSON array only with this schema:
[
  {"question": "...", "answer": "..."}
]

CANDIDATE_FAQS:
${truncate(candidateJson, MAX_DOC_CHARS)}`;

  const finalResult = await callGemini(finalizePrompt);
  return (
    tryParseFaqArray(finalResult) ||
    Array.from(deduped.values()).slice(0, 8)
  );
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithDocument(
  userMessage: string,
  documentContext: string,
  history: ChatMessage[]
): Promise<string> {
  const csvText = extractCsvTextFromContext(documentContext);
  if (csvText !== null) {
    const csvAnswer = answerCsvLookup(userMessage, documentContext);
    if (csvAnswer) return csvAnswer;
  } else {
    const textAnswer = answerTextLookup(userMessage, documentContext);
    if (textAnswer) return textAnswer;
  }

  const safeDoc = pickRelevantContext(documentContext, userMessage, MAX_DOC_CHARS);
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  const safeHistory = truncate(historyText, MAX_HISTORY_CHARS);

  const prompt = `You are Genie, a helpful AI assistant for document analysis.
The user document may be very large, so only the most relevant excerpts were selected below.

RELEVANT DOCUMENT EXCERPTS:
${safeDoc || "No document provided. Answer general questions helpfully."}

CONVERSATION HISTORY:
${safeHistory}

User: ${userMessage}

Provide a helpful, accurate, and concise response grounded in the provided excerpts.
If info is missing from excerpts, clearly say so.`;

  return callGemini(prompt);
}
