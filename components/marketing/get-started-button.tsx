"use client";

import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics";

export function GetStartedButton() {
  return (
    <Link
      href="/login?mode=signup"
      data-cta="get-started"
      onClick={() => track("cta_click", { cta: "get_started", placement: "hero" })}
    >
      <Button size="lg" className="w-full sm:w-auto">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
