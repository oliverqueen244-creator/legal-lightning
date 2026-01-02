import { cn } from "@/lib/utils";
import logoImage from "@/assets/logo.png";

interface BrandedSkeletonProps {
  className?: string;
  variant?: "card" | "list" | "text" | "avatar" | "full";
  lines?: number;
  showLogo?: boolean;
}

function BrandedSkeleton({ 
  className, 
  variant = "card", 
  lines = 3,
  showLogo = false 
}: BrandedSkeletonProps) {
  const baseClasses = "animate-pulse rounded-md bg-muted/50";

  if (variant === "full") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4 p-8", className)}>
        <div className="relative">
          <img 
            src={logoImage} 
            alt="Nyay-Hub" 
            className="h-12 w-12 opacity-40 animate-pulse"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className={cn(baseClasses, "h-4 w-32")} />
          <div className={cn(baseClasses, "h-3 w-24")} />
        </div>
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className={cn(baseClasses, "h-10 w-10 rounded-full")} />
        <div className="flex flex-col gap-2">
          <div className={cn(baseClasses, "h-4 w-24")} />
          <div className={cn(baseClasses, "h-3 w-16")} />
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)}>
        {showLogo && (
          <div className="flex items-center gap-2 mb-4">
            <img 
              src={logoImage} 
              alt="Nyay-Hub" 
              className="h-5 w-5 opacity-30"
            />
            <div className={cn(baseClasses, "h-3 w-20")} />
          </div>
        )}
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn(baseClasses, "h-4 w-4 rounded")} />
            <div className={cn(baseClasses, "h-4 flex-1")} />
            <div className={cn(baseClasses, "h-4 w-16")} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i} 
            className={cn(baseClasses, "h-4")}
            style={{ width: `${100 - (i * 10)}%` }}
          />
        ))}
      </div>
    );
  }

  // Default: card variant
  return (
    <div className={cn("glass-card p-4 space-y-4", className)}>
      {showLogo && (
        <div className="flex items-center gap-2">
          <img 
            src={logoImage} 
            alt="Nyay-Hub" 
            className="h-6 w-6 opacity-30"
          />
          <div className={cn(baseClasses, "h-4 w-24")} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className={cn(baseClasses, "h-10 w-10 rounded-lg")} />
        <div className="flex-1 space-y-2">
          <div className={cn(baseClasses, "h-4 w-3/4")} />
          <div className={cn(baseClasses, "h-3 w-1/2")} />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i} 
            className={cn(baseClasses, "h-3")}
            style={{ width: `${90 - (i * 15)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function DocketCardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-muted/50" />
          <div className="h-5 w-32 rounded bg-muted/50" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/50" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-muted/50" />
        <div className="h-4 w-3/4 rounded bg-muted/50" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <div className="h-4 w-24 rounded bg-muted/50" />
        <div className="h-4 w-4 rounded bg-muted/50" />
      </div>
    </div>
  );
}

function LiveBoardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src={logoImage} 
            alt="Nyay-Hub" 
            className="h-5 w-5 opacity-20"
          />
          <div className="h-4 w-28 rounded bg-muted/50" />
        </div>
        <div className="h-5 w-14 rounded-full bg-muted/50" />
      </div>
      <div className="flex items-center justify-center py-6">
        <div className="h-16 w-16 rounded-lg bg-muted/50" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-muted/50" />
        <div className="h-3 w-16 rounded bg-muted/50" />
      </div>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 animate-pulse">
        <img 
          src={logoImage} 
          alt="Nyay-Hub" 
          className="h-8 w-8 opacity-30"
        />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-muted/50" />
          <div className="h-3 w-24 rounded bg-muted/50" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <DocketCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export { 
  BrandedSkeleton, 
  DocketCardSkeleton, 
  LiveBoardSkeleton, 
  BriefSkeleton 
};
