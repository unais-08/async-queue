import type { Job } from "../lib/api";
import { StatusBadge } from "./status-badge";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function JobDetails({
  job,
  onRetry,
  retrying,
}: {
  job: Job | null;
  onRetry: (job: Job) => void;
  retrying: boolean;
}) {
  if (!job) {
    return (
      <aside className="panel details-panel">
        <div className="empty-state"><strong>Select a job</strong><p>Choose a row to inspect its payload, attempts, and current status.</p></div>
      </aside>
    );
  }

  return (
    <aside className="panel details-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Job details</span>
          <h2>{job.type}</h2>
          <span className="mono details-id" title={job.id}>{job.id}</span>
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
        <div><dt>Last updated</dt><dd>{formatDate(job.updatedAt)}</dd></div>
      </dl>

      <section className="detail-section lifecycle-section">
        <span className="eyebrow">Lifecycle</span>
        <ol className="lifecycle-list">
          <li className="lifecycle-done">Submitted <time>{formatDate(job.createdAt)}</time></li>
          <li className={job.startedAt ? "lifecycle-done" : ""}>Worker claimed{job.startedAt && <time>{formatDate(job.startedAt)}</time>}</li>
          <li className={job.status === "COMPLETED" ? "lifecycle-done" : job.status === "FAILED" ? "lifecycle-failed" : ""}>{job.status === "COMPLETED" ? "Handler completed" : job.status === "FAILED" ? "Job failed" : job.status === "PROCESSING" ? "Handler running" : "Waiting for a worker"}{job.completedAt && <time>{formatDate(job.completedAt)}</time>}</li>
        </ol>
      </section>

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
        <button className="button button-primary button-full" disabled={retrying} onClick={() => onRetry(job)}>
          {retrying ? "Queueing retry…" : "Retry failed job"}
        </button>
      )}
    </aside>
  );
}
