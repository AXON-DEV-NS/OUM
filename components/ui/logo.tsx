import { cn } from "@/lib/cn";

interface LogoProps {
  variant?: "ink" | "paper";
  size?: "sm" | "md" | "lg" | "nav";
  className?: string;
  /** Show only the mark — used by collapsed sidebars */
  markOnly?: boolean;
}

const SIZES = {
  sm: { mark: "h-7 w-7", text: "text-sm" },
  md: { mark: "h-9 w-9", text: "text-lg" },
  lg: { mark: "h-16 w-16", text: "text-2xl" },
  nav: { mark: "h-12 w-auto", text: "text-2xl" },
} as const;

/**
 * OUM — the site logo. Transparent mark (public/oum.png) + wordmark.
 */
export function Logo({
  variant = "ink",
  size = "md",
  className,
  markOnly = false,
}: LogoProps) {
  const s = SIZES[size];
  const isInk = variant === "ink";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src="/oum.png"
        alt="OUM logo"
        width={1200}
        height={896}
        className={cn("shrink-0 object-contain", s.mark)}
      />
      {!markOnly && (
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            s.text,
            isInk ? "text-ink" : "text-paper-high"
          )}
        >
          OUM
        </span>
      )}
    </span>
  );
}
