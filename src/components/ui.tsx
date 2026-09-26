import { EAR_LABEL, type EarSide } from "../domain/constants";

export function EarBadge({ ear }: { ear: EarSide }) {
  return <span className={`ear-badge ear-${ear}`}>{EAR_LABEL[ear]}</span>;
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "muted";
  children: React.ReactNode;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <small className="field-error">{message}</small>;
}
