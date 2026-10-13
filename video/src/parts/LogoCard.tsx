import React from "react";
import { VovoLogo } from "./VovoLogo";

/**
 * The site's REAL logo, positioned for the film. Uses the shared clean asset
 * via <VovoLogo> (LOGO_ASSET in brand.ts — swap there to change it).
 * The single soft bloom is drawn by the film (HeroFilm); no second glow layer.
 */
export const LogoCard: React.FC<{
  x: number;
  y: number;
  size: number;
  scale: number;
  opacity: number;
  bloom: number;
}> = ({ x, y, size, scale, opacity, bloom }) => {
  void bloom;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      <VovoLogo
        size={size}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
};
