import type { Job } from "../lib/api";
import { StatusBadge } from "./status-badge";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function JobDetails({
  job,
  onRetry,
}: {
  job: Job | null;
  onRetry: (job: Job) => void;
}) {
  if (!job) {
    return (
      <aside className="panel details-panel">
        <div className="empty-state">Select a job to inspect it.</div>
      </aside>
    );
  }

  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Job details</span>
          <h2>{job.type}</h2>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <dl className="detail-list">
        <div><dt>ID</dt><dd className="mono">{job.id}</dd></div>
        <div><dt>Attempts</dt><dd>{job.attempts} / {job.maxAttempts}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(job.createdAt)}</dd></div>
        <div><dt>Started</dt><dd>{formatDate(job.startedAt)}</dd></div>
        <div><dt>Next run</dt><dd>{formatDate(job.nextRunAt)}</dd></div>
        <div><dt>Completed</dt><dd>{formatDate(job.completedAt)}</dd></div>
      </dl>

      <section className="detail-section">
        <span className="eyebrow">Payload</span>
        <pre>{JSON.stringify(job.payload ?? {}, null, 2)}</pre>
      </section>

      {job.error && (
        <section className="detail-section">
          <span className="eyebrow">Last error</span>
          <pre className="error-box">{job.error}</pre>
        </section>
      )}

      {job.status === "FAILED" && (
        <button className="button button-primary button-full" onClick={() => onRetry(job)}>
          Retry job
        </button>
      )}
    </aside>
  );
}
