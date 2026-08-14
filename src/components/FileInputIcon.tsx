"use client";

type IconColor = "purple" | "blue";

const COLORS: Record<IconColor, { fill: string; stroke: string; foldFill: string }> = {
  purple: { fill: "#C4B5FD", stroke: "#8B5CF6", foldFill: "#DDD6FE" },
  blue: { fill: "#BFDBFE", stroke: "#3B82F6", foldFill: "#DBEAFE" },
};

export default function FileInputIcon({
  className = "",
  color = "purple",
}: {
  className?: string;
  color?: IconColor;
}) {
  const c = COLORS[color];

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 6C10 4.89543 10.8954 4 12 4H30L38 12V42C38 43.1046 37.1046 44 36 44H12C10.8954 44 10 43.1046 10 42V6Z"
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M30 4V12H38"
        fill={c.foldFill}
        stroke={c.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 24H30M18 30H26M18 18H24"
        stroke={c.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
