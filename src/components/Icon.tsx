/** 单色描边图标（16px 默认 · stroke 用 currentColor，随文字变色）。 */
export type IconName =
  | "grid"
  | "flask"
  | "scatter"
  | "shield"
  | "info"
  | "layers"
  | "atom"
  | "target"
  | "heart";

const PATHS: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6.2l-5.1 8.6A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.7-3.2L14 9.2V3" />
    </>
  ),
  scatter: (
    <>
      <circle cx="7" cy="9" r="1.9" />
      <circle cx="15.5" cy="6.8" r="1.9" />
      <circle cx="10" cy="16" r="1.9" />
      <circle cx="17.6" cy="15" r="1.9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.2 3v6c0 4.1-3.1 7.3-7.2 9-4.1-1.7-7.2-4.9-7.2-9V6z" />
      <path d="M9 12l2.2 2.2L15.4 10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l8.2 4-8.2 4L3.8 7z" />
      <path d="M3.8 11.4L12 15.4l8.2-4" />
      <path d="M3.8 15.6L12 19.6l8.2-4" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="1.9" />
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-60 12 12)" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  heart: (
    <path d="M12 20.2s-7.2-4.6-7.2-9.2a4.1 4.1 0 0 1 7.2-2.7 4.1 4.1 0 0 1 7.2 2.7c0 4.6-7.2 9.2-7.2 9.2z" />
  ),
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
