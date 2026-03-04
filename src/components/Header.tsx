import { Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { Button } from "@/components/ui/button";

const Header = () => {
  const { theme, toggleTheme } = useTheme();
  
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
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Powered by Gemini AI</span>
          </div>
          {/* Theme toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="w-9 h-9 border-border/60 hover:border-primary/50 hover:bg-primary/10 transition-all"
            title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-foreground" />
            )}
          </Button>

        </div>
      </div>
    </header>
  );
};

export default Header;
