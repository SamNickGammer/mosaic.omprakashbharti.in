import Image from "next/image";

import { cn } from "@/lib/utils";
import logoFull from "@/app/assets/Logo_WithoutBackgound_FullSize.png";

/**
 * Full Mosaic wordmark (tile mark + "Mosaic"). The wordmark ink is dark slate,
 * so on dark surfaces we sit it on a light plate for contrast.
 */
export function Logo({
  className,
  plate = true,
  width = 132,
}: {
  className?: string;
  /** Wrap in a light rounded plate so the dark wordmark reads on dark bg. */
  plate?: boolean;
  width?: number;
}) {
  const img = (
    <Image
      src={logoFull}
      alt="Mosaic"
      width={width}
      height={Math.round((width * 297) / 973)}
      priority
      className="h-auto w-auto"
      style={{ width, height: "auto" }}
    />
  );

  if (!plate) return <span className={className}>{img}</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white px-2.5 py-1.5 shadow-sm",
        className,
      )}
    >
      {img}
    </span>
  );
}

/**
 * Compact tile mark using the brand gradient palette — for tight chrome
 * (sidebar headers, favicons, loading states).
 */
export function LogoMark({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="9" height="9" rx="2" fill="#4f46e5" />
      <rect x="13" y="2" width="9" height="6" rx="2" fill="#7c3aed" />
      <rect x="2" y="13" width="6" height="9" rx="2" fill="#6366f1" />
      <rect x="13" y="10" width="9" height="5" rx="2" fill="#3b82f6" />
      <rect x="10" y="17" width="5" height="5" rx="1.5" fill="#3b82f6" />
      <rect x="17" y="17" width="5" height="5" rx="1.5" fill="#06b6d4" />
    </svg>
  );
}
