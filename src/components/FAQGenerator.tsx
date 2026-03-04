import { useState } from "react";
import { HelpCircle, Loader2, ChevronDown, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFAQs } from "@/lib/gemini";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FAQProps {
  documentText: string;
}

const FAQGenerator = ({ documentText }: FAQProps) => {
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!documentText.trim()) {
      toast({ title: "No document", description: "Please add document text first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setFaqs([]);
    try {
      const result = await generateFAQs(documentText);
      setFaqs(result);
      setOpenIndex(0);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-bold">FAQ Generator</h2>
            <p className="text-xs text-muted-foreground">Auto-generate questions & answers</p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading || !documentText.trim()}
          size="sm"
          className="bg-accent border-0 text-accent-foreground font-semibold gap-2 hover:opacity-90"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Generate FAQs</>
          )}
        </Button>
      </div>

      {faqs.length > 0 && (
        <div className="space-y-2 animate-slide-up">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border transition-all duration-200 overflow-hidden",
                openIndex === i
                  ? "border-accent/30 bg-accent/5"
                  : "border-border/40 bg-card hover:border-accent/20"
              )}
            >
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span className="text-sm font-medium pr-4 text-foreground/90">{faq.question}</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                    openIndex === i && "rotate-180 text-accent"
                  )}
                />
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!faqs.length && !loading && (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <HelpCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground/50">Generated FAQs will appear here</p>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-8 text-center">
          <Loader2 className="w-10 h-10 text-accent/50 mx-auto mb-2 animate-spin" />
          <p className="text-sm text-muted-foreground">Generating FAQs from your document...</p>
        </div>
      )}
    </div>
  );
};

export default FAQGenerator;
