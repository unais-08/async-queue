import type { Job } from "../lib/api";
import { StatusBadge } from "./status-badge";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string) {
  return id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

export function JobTable({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: Job[];
  selectedId?: string;
  onSelect: (job: Job) => void;
}) {
  if (!jobs.length) {
    return <div className="empty-state">No jobs found.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Type</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className={selectedId === job.id ? "selected-row" : ""}
              onClick={() => onSelect(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(job);
                }
              }}
              tabIndex={0}
              aria-selected={selectedId === job.id}
              role="button"
              title={`Inspect ${job.type} job`}
            >
              <td className="mono">{shortId(job.id)}</td>
              <td className="job-type">{job.type}</td>
              <td><StatusBadge status={job.status} /></td>
              <td>{job.attempts}/{job.maxAttempts}</td>
              <td>{formatDate(job.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
