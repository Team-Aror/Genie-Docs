import { useState } from "react";
import { FileText, Loader2, Copy, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarizeText } from "@/lib/gemini";
import { useToast } from "@/hooks/use-toast";

interface SummarizerProps {
  documentText: string;
}

const Summarizer = ({ documentText }: SummarizerProps) => {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!documentText.trim()) {
      toast({ title: "No document", description: "Please add document text first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await summarizeText(documentText);
      setSummary(result);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold">Document Summarizer</h2>
            <p className="text-xs text-muted-foreground">Get a concise summary of your document</p>
          </div>
        </div>
        <Button
          onClick={handleSummarize}
          disabled={loading || !documentText.trim()}
          size="sm"
          className="genie-gradient border-0 text-primary-foreground font-semibold gap-2 hover:opacity-90"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Summarizing...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Summarize</>
          )}
        </Button>
      </div>

      {summary && (
        <div className="card-glow rounded-xl bg-card p-4 space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Summary</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs hover:text-primary">
              {copied ? <Check className="w-3 h-3 mr-1 text-primary" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}

      {!summary && !loading && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/50">Your summary will appear here</p>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-center">
          <Loader2 className="w-10 h-10 text-primary/50 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">Analyzing and summarizing your document...</p>
        </div>
      )}
    </div>
  );
};

export default Summarizer;
