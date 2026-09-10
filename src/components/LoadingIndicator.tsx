import collieRunning from "../../CPCollieRunning.gif";

type LoadingIndicatorProps = {
  label: string;
  size?: "default" | "small" | "inline";
  className?: string;
};

export function LoadingIndicator({
  label,
  size = "default",
  className = "",
}: LoadingIndicatorProps) {
  const classes = ["loading-indicator", `loading-indicator-${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="status" aria-live="polite">
      <img className="loading-indicator-image" src={collieRunning} alt="" aria-hidden="true" />
      <span className="loading-indicator-label">{label}</span>
    </span>
  );
}
