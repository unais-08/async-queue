import type { JobStatus } from "../lib/api";

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}>{status}</span>;
}
