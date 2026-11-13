export default function TerpMark({ className = "" }) {
  return (
    <div className={`brand-mark ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function Wordmark() {
  return (
    <span>
      TERP<span>LINK</span>
    </span>
  );
}

