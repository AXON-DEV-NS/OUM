import React from "react";
import { Img, staticFile } from "remotion";
import { LOGO_ASSET } from "../brand";

/**
 * The official VOVO Agent AI logo asset (IoU >= 0.9787 ground-truth clean asset).
 * Rendered via staticFile pointing to LOGO_ASSET configured in brand.ts.
 */
export const VovoLogo: React.FC<{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size, className, style }) => (
  <Img
    src={staticFile(LOGO_ASSET)}
    alt="VOVO Agent AI"
    width={size ?? 512}
    height={size ?? 512}
    className={className}
    style={{
      objectFit: "contain",
      display: "block",
      ...style,
    }}
  />
);
