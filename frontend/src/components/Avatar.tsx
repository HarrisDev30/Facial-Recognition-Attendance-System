import { useRef, useState } from "react";

interface AvatarProps {
  src?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  loading?: boolean;
}

const SIZE_MAP = { sm: 40, md: 80, lg: 120 };
const FONT_SIZES = { sm: 14, md: 28, lg: 40 };

const DEFAULT_API_URL = "https://silver-spork-jrj976w6xwggf799-8000.app.github.dev";
const envUrl = import.meta.env.VITE_API_URL as string | undefined;
const BASE_URL = (envUrl && envUrl.trim() !== "") ? envUrl.trim() : DEFAULT_API_URL;

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const cleanBase = BASE_URL.replace(/\/+$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

const GRADIENTS = [
  "linear-gradient(135deg, #2d2d2d, #3b3b3b)",
  "linear-gradient(135deg, #2a2832, #3a3844)",
  "linear-gradient(135deg, #1e2a2e, #2e3a3e)",
  "linear-gradient(135deg, #2a1e2a, #3a2e3a)",
  "linear-gradient(135deg, #1e2a20, #2e3a30)",
  "linear-gradient(135deg, #2a2a1e, #3a3a2e)",
];

function getInitials(first?: string | null, last?: string | null): string {
  const a = first?.charAt(0)?.toUpperCase() ?? "";
  const b = last?.charAt(0)?.toUpperCase() ?? "";
  return a + b || "?";
}

function hashStr(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function Avatar({
  src,
  firstName,
  lastName,
  size = "md",
  onClick,
  loading,
}: AvatarProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const px = SIZE_MAP[size];
  const fontSize = FONT_SIZES[size];

  const fullSrc = resolveImageUrl(src);
  const showImage = Boolean(fullSrc && !imgFailed);
  const initials = getInitials(firstName, lastName);
  const gradient = GRADIENTS[hashStr(initials) % GRADIENTS.length];

  return (
    <div
      onClick={onClick}
      title={onClick ? "Change profile photo" : undefined}
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: showImage ? "none" : gradient,
        cursor: onClick ? "pointer" : "default",
        opacity: loading ? 0.5 : 1,
        transition: "opacity 0.2s",
        flexShrink: 0,
      }}
    >
      {showImage && fullSrc ? (
        <img
          ref={imgRef}
          src={fullSrc}
          alt={initials}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          style={{
            fontSize,
            fontWeight: 500,
            color: "#888888",
            lineHeight: 1,
            userSelect: "none",
            textTransform: "uppercase",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
