/**
 * The Spigot mark: a valve wheel with a droplet falling clear of it.
 * The wheel is the control, the droplet is the payout — two shapes, one idea.
 *
 * `id` keeps the gradient definitions unique when several marks share a page,
 * which otherwise makes every instance inherit the first one's fill.
 */
export function Mark({
  size = 32,
  id = "mark",
  className,
}: {
  size?: number;
  id?: string;
  className?: string;
}) {
  const a = `${id}-body`;
  const b = `${id}-drop`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Spigot"
    >
      <defs>
        <linearGradient id={a} x1="12" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.55" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={b} x1="32" y1="42" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="24" r="17" stroke={`url(#${a})`} strokeWidth="5" />

      <g stroke={`url(#${a})`} strokeWidth="5" strokeLinecap="round">
        <path d="M32 12.5V19" />
        <path d="M21.4 30.2 27 27" />
        <path d="M42.6 30.2 37 27" />
      </g>

      <circle cx="32" cy="24" r="4.4" fill={`url(#${a})`} />

      <path
        d="M32 43.5c4.6 4.6 6.9 8.1 6.9 11.1a6.9 6.9 0 0 1-13.8 0c0-3 2.3-6.5 6.9-11.1Z"
        fill={`url(#${b})`}
      />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} id="wordmark" />
      <span
        className="font-semibold text-slate-50"
        style={{ fontSize: size * 0.75, letterSpacing: "-0.03em" }}
      >
        Spigot
      </span>
    </span>
  );
}
