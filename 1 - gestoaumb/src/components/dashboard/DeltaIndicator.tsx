import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DeltaIndicatorProps {
  delta: number;
  /** For metrics where increase is bad (e.g. leaks, water shortage) */
  invertColors?: boolean;
}

export function DeltaIndicator({ delta, invertColors = true }: DeltaIndicatorProps) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" />
        <span>=</span>
      </span>
    );
  }

  const isUp = delta > 0;
  // For water/leaks: up is bad (red), down is good (green)
  // invertColors=true means up=red, down=green
  const colorClass = invertColors
    ? (isUp ? "text-destructive" : "text-emerald-500")
    : (isUp ? "text-emerald-500" : "text-destructive");

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${colorClass}`}>
      {isUp ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      <span>{isUp ? `+${delta}` : delta}</span>
    </span>
  );
}
