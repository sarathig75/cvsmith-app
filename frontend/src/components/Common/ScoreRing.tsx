/** Score bands (docs/API_CONTRACT.md, "ATS score panel"): amber under 50, blue 50-79, green 80 and over. */
export const bandColor = (score: number) => (score < 50 ? '#B45309' : score < 80 ? '#2563EB' : '#047857');

/** A ring with the score in the middle. The number is always shown, so colour is never the only signal. */
export function ScoreRing({
  score,
  size = 170,
  testId,
  label = 'Score',
}: {
  score: number;
  size?: number;
  testId?: string;
  label?: string;
}) {
  const stroke = Math.round(size / 12);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, score));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${shown} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bandColor(shown)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * shown) / 100} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-900" style={{ fontSize: size / 3.8 }}>
        <span data-testid={testId}>{shown}</span>
        <span className="ml-0.5 font-medium text-slate-500" style={{ fontSize: size / 8.5 }}>
          /100
        </span>
      </div>
    </div>
  );
}
