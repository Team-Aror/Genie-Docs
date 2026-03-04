import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, Bot, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chatWithDocument, ChatMessage } from "@/lib/gemini";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ChatbotProps {
  documentText: string;
}

const Chatbot = ({ documentText }: ChatbotProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: documentText
        ? "Hello! I've analyzed your document. Ask me anything about it!"
        : "Hello! I'm Genie, your AI assistant. Add a document above or just chat with me!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: documentText
        ? "Document loaded! I'm ready to answer questions about it."
        : "Hello! I'm Genie, your AI assistant. Add a document above or just chat with me!",
    }]);
  }, [documentText]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const reply = await chatWithDocument(userMsg, documentText, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: documentText
        ? "Chat cleared. Ask me anything about the document!"
        : "Chat cleared. How can I help you?",
    }]);
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-bold">AI Chatbot</h2>
            <p className="text-xs text-muted-foreground">Chat about your document</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="h-7 text-xs hover:text-destructive">
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] min-h-[300px] pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 animate-slide-up",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div
            className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                  msg.role === "assistant"
                    ? "genie-gradient"
                    : "bg-secondary"
                )}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-4 h-4 text-primary-foreground" />
              ) : (
                <User className="w-4 h-4 text-foreground" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "assistant"
                  ? "bg-card border border-border/40 text-foreground/90 rounded-tl-sm"
                  : "bg-primary/20 border border-primary/20 text-foreground rounded-tr-sm"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full genie-gradient flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Genie is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask about your document..."
          className="bg-secondary/50 border-border/40 focus-visible:border-primary/50 focus-visible:ring-0 text-sm"
          disabled={loading}
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          size="icon"
          className="genie-gradient border-0 text-primary-foreground hover:opacity-90 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default Chatbot;
