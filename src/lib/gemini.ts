// Multiple API keys — if one is rate limited, automatically falls back to the next
const GEMINI_KEYS = [
  "AIzaSyC-hG5VQXqXhTdsY25sg9dczUDl2rzvRck",
  "AIzaSyC8Bs6BE6Qt8oaPnhQHtMVEzp9AdkXqKrY",
  "AIzaSyCL2n41OzKpunMz18SpD3Uu9ZHGE2ahOVU",
];

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_DOC_CHARS = 12000;
const MAX_HISTORY_CHARS = 3000;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n...[Truncated to ${maxChars} characters]`;
}

async function callGemini(prompt: string): Promise<string> {
  const errors: string[] = [];

  // Try each key in order
  for (let keyIndex = 0; keyIndex < GEMINI_KEYS.length; keyIndex++) {
    const apiKey = GEMINI_KEYS[keyIndex];
    console.log(`Trying API key ${keyIndex + 1}/${GEMINI_KEYS.length}...`);

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
      console.log(`✅ Key ${keyIndex + 1} succeeded`);
      return body.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    }

    const errMessage = body?.error?.message || "Unknown error";
    console.warn(`❌ Key ${keyIndex + 1} failed (HTTP ${response.status}):`, errMessage);
    errors.push(`Key ${keyIndex + 1}: ${errMessage}`);

    // Only skip to next key on rate limit (429), fail fast on other errors
    if (response.status !== 429) {
      throw new Error(errMessage);
    }

    // Small pause before trying next key
    if (keyIndex < GEMINI_KEYS.length - 1) {
      await new Promise((res) => setTimeout(res, 500));
    }
  }

  // All keys exhausted
  throw new Error(
    "All API keys are rate limited. Please wait a few minutes and try again.\n\n" +
    errors.join("\n")
  );
}

export async function summarizeText(text: string): Promise<string> {
  const safeText = truncate(text, MAX_DOC_CHARS);
  const prompt = `Please provide a comprehensive yet concise summary of the following document or text. 
Highlight the key points, main ideas, and important conclusions. 
Format the summary with clear sections if applicable.

TEXT TO SUMMARIZE:
${safeText}`;
  return callGemini(prompt);
}

export async function generateFAQs(
  text: string
): Promise<{ question: string; answer: string }[]> {
  const safeText = truncate(text, MAX_DOC_CHARS);
  const prompt = `Analyze the following document/text and generate 6-8 frequently asked questions (FAQs) along with detailed answers based on the content.

Format your response as a JSON array like this:
[
  {"question": "Question here?", "answer": "Detailed answer here."},
  ...
]

Only return the JSON array, no other text.

DOCUMENT:
${safeText}`;

  const result = await callGemini(prompt);
  try {
    const cleaned = result.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [{ question: "Could not parse FAQs", answer: result }];
  }
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
  const safeDoc = truncate(documentContext, MAX_DOC_CHARS);
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  const safeHistory = truncate(historyText, MAX_HISTORY_CHARS);

  const prompt = `You are Genie, a helpful AI assistant for document analysis. 
You have access to the following document/context:

DOCUMENT CONTEXT:
${safeDoc || "No document provided. Answer general questions helpfully."}

CONVERSATION HISTORY:
${safeHistory}

User: ${userMessage}

Please provide a helpful, accurate, and concise response based on the document context and conversation history. 
If the question is not related to the document, still try to be helpful.
Assistant:`;

  return callGemini(prompt);
}