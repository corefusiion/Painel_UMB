import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2.5 px-1 group cursor-pointer"
      >
        <h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest group-hover:text-muted-foreground transition-colors">
          {title}
        </h2>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
