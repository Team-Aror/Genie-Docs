import { Sparkles } from "lucide-react";

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl genie-gradient flex items-center justify-center animate-pulse-glow">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold genie-text-gradient" style={{ fontFamily: 'Syne, sans-serif' }}>
              Genie Docs
            </h1>
            <p className="text-xs text-muted-foreground -mt-0.5">AI Documentation Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground hidden sm:block">Powered by Gemini AI</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
