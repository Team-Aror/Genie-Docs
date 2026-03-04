import { useState, useRef } from "react";
import { FileText, Upload, X, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface DocumentInputProps {
  value: string;
  onChange: (text: string) => void;
}

const DocumentInput = ({ value, onChange }: DocumentInputProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
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
              onClick={() => onChange("")}
              className="text-xs h-7 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border/50 hover:border-primary/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste your document text here, drag & drop a .txt file, or click Upload..."
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
          {value.split(/\s+/).filter(Boolean).length} words · {value.length} characters
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json,.html,.xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
};

export default DocumentInput;
