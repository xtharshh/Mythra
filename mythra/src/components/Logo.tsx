// Mythio mark — a hexagonal portal ring with a rising world + orbit spark.
// Unique to this game: hex = forged stories, ring = worlds, spark = solvers.
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Mythio logo" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="mythra-g" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd9a8" />
          <stop offset="0.45" stopColor="#ffb45e" />
          <stop offset="0.75" stopColor="#ff6b35" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="mythra-p" cx="0.38" cy="0.32" r="0.9">
          <stop offset="0" stopColor="#ffb08a" />
          <stop offset="0.55" stopColor="#c1553b" />
          <stop offset="1" stopColor="#4a1508" />
        </radialGradient>
      </defs>
      <polygon points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5" stroke="url(#mythra-g)" strokeWidth="3" fill="rgba(20,9,5,0.6)" strokeLinejoin="round" />
      <circle cx="24" cy="26" r="9.5" fill="url(#mythra-p)" />
      <ellipse cx="24" cy="26" rx="16" ry="6.5" stroke="url(#mythra-g)" strokeWidth="2" transform="rotate(-18 24 26)" />
      <circle cx="38.5" cy="17.5" r="2.6" fill="#ffd9a8" />
    </svg>
  );
}
