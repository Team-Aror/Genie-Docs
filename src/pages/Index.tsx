import { useState } from "react";
import { FileText, HelpCircle, MessageCircle, Sparkles, ChevronRight } from "lucide-react";
import DocumentInput from "@/components/DocumentInput";
import Summarizer from "@/components/Summarizer";
import FAQGenerator from "@/components/FAQGenerator";
import Chatbot from "@/components/Chatbot";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";

type Tab = "summarize" | "faq" | "chat";

const tabs: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "summarize", label: "Summarize", icon: FileText, description: "Get a concise overview" },
  { id: "faq", label: "FAQs", icon: HelpCircle, description: "Auto-generate Q&A" },
  { id: "chat", label: "Chatbot", icon: MessageCircle, description: "Ask anything" },
];

const Index = () => {
  const [documentText, setDocumentText] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("summarize");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero section */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card/30 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" />
            Gemini AI Powered
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
            Your <span className="genie-text-gradient">Intelligent</span> Docs
            <br />Assistant
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Summarize documents, generate FAQs, and chat with your content — all powered by Google Gemini AI.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Document Input */}
        <div className="card-glow rounded-2xl bg-card p-5 sm:p-6">
          <DocumentInput value={documentText} onChange={setDocumentText} />
        </div>

        {/* Quick hint */}
        {!documentText && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60 px-1">
            <ChevronRight className="w-3 h-3 text-primary/40" />
            Add document text above to unlock all AI features, or use the chatbot without a document.
          </div>
        )}

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-xl p-3 sm:p-4 text-left transition-all duration-200 border",
                  isActive
                    ? "card-glow bg-card border-primary/30"
                    : "bg-card/50 border-border/30 hover:border-primary/20 hover:bg-card"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                  isActive ? "genie-gradient" : "bg-secondary"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                </div>
                <div className={cn("text-sm font-semibold", isActive ? "text-primary" : "text-foreground/70")}>
                  {tab.label}
                </div>
                <div className="text-xs text-muted-foreground/60 hidden sm:block mt-0.5">
                  {tab.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feature Panel */}
        <div className="card-glow rounded-2xl bg-card p-5 sm:p-6">
          {activeTab === "summarize" && <Summarizer documentText={documentText} />}
          {activeTab === "faq" && <FAQGenerator documentText={documentText} />}
          {activeTab === "chat" && <Chatbot documentText={documentText} />}
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-xs text-muted-foreground/40">
            Genie Docs · Built with Google Gemini AI
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
