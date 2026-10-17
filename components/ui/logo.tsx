import { cn } from "@/lib/cn";

interface LogoProps {
  variant?: "ink" | "paper";
  size?: "sm" | "md" | "lg" | "nav";
  className?: string;
  /** Show only the mark — used by collapsed sidebars */
  markOnly?: boolean;
}

/**
 * Lockup ratio: the mark is ~1.5x the wordmark's font size (32-36px mark at
 * 24px name), which reads as "slightly larger than the name" and stays
 * balanced at every size.
 */
const SIZES = {
  sm: { mark: "h-5 w-5", text: "text-sm" },
  md: { mark: "h-7 w-7", text: "text-lg" },
  lg: { mark: "h-11 w-11", text: "text-3xl" },
  nav: { mark: "h-9 w-9", text: "text-2xl" },
} as const;

/**
 * OUM — the site logo. The real logo artwork (public/oum.png) tight-cropped
 * to a transparent mark (public/oum-logo.png, no transparent padding) +
 * plain, clean, minimal sans wordmark.
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/oum-logo.png"
        alt="OUM logo"
        width={694}
        height={575}
        className={cn(
          "shrink-0 object-contain",
          s.mark,
          !isInk && "logo-mark-paper"
        )}
      />
      {!markOnly && (
        <span
          className={cn(
            "font-sans font-semibold tracking-tight",
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
