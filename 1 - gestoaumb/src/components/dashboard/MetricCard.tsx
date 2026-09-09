import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  isLoading?: boolean;
  delta?: { value: number; trend: "up" | "down" | "neutral" } | null;
  onClick?: () => void;
  dotColor?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function MetricCard({
  title,
  isLoading,
  delta,
  onClick,
  dotColor,
  headerAction,
  footer,
  children,
  className,
  contentClassName,
}: MetricCardProps) {
  return (
    <Card 
      className={cn(
        "bg-card border border-border/50 shadow-none flex flex-col shrink-0",
        onClick && "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <div className="px-4 sm:px-5 pt-3 sm:pt-4 pb-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {dotColor && <div className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />}
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
          </div>
        </div>
      </div>
      
      <CardContent className={cn("px-4 sm:px-5 pb-3 sm:pb-4 flex-1 flex flex-col min-h-0", contentClassName)}>
        {isLoading ? (
          <div className="space-y-3 mt-2">
            <Skeleton className="h-3 w-32" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-16 flex-1" />
              <Skeleton className="h-10 w-16 flex-1" />
            </div>
            {footer && <Skeleton className="h-4 w-1/2 mt-4" />}
          </div>
        ) : (
          <>
            <div className="flex-1 mt-2">
              {children}
            </div>
            {footer && (
              <div className="mt-3 pt-3 border-t border-border/30">
                {footer}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
