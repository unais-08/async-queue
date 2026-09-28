"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createJob,
  getApiError,
  getJob,
  getJobCounts,
  healthCheck,
  listFailedJobs,
  listJobs,
  retryJob,
  type FailedJob,
  type Job,
  type JobStatus,
} from "../lib/api";
import { AdminKeyModal } from "../components/admin-key-modal";
import { CreateJobModal } from "../components/create-job-modal";
import { JobDetails } from "../components/job-details";
import { JobTable } from "../components/job-table";
import { Pagination } from "../components/pagination";
import { StatCard } from "../components/stat-card";

const statuses: Array<JobStatus | "ALL"> = ["ALL", "QUEUED", "PROCESSING", "COMPLETED", "FAILED"];

export default function Home() {
  const [view, setView] = useState<"jobs" | "failed">("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<JobStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [failedPage, setFailedPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [failedTotalPages, setFailedTotalPages] = useState(1);
  const [counts, setCounts] = useState({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [apiOnline, setApiOnline] = useState(false);
  const [workerConfigured, setWorkerConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failedLoading, setFailedLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  useEffect(() => {
    setAdminKey(sessionStorage.getItem("async-queue-admin-key") ?? "");
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const result = await listJobs({ page, limit: 20, ...(status === "ALL" ? {} : { status }) });
      setJobs(result.jobs);
      setTotalPages(Math.max(1, result.pagination.totalPages));
      setSelectedJob((current) => {
        if (!current) return result.jobs[0] ?? null;
        return result.jobs.find((job) => job.id === current.id) ?? current;
      });
    } catch (err) {
      setError(getApiError(err, "Could not load jobs."));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await getJobCounts());
    } catch {
      // The connection indicator reports API availability separately.
    }
  }, []);

  const refreshApiHealth = useCallback(async () => {
    try {
      const health = await healthCheck();
      setApiOnline(true);
      setWorkerConfigured(health.workerConfigured);
    } catch {
      setApiOnline(false);
      setWorkerConfigured(false);
    }
  }, []);

  const refreshFailedJobs = useCallback(async () => {
    if (!adminKey) {
      setFailedJobs([]);
      return;
    }
    setFailedLoading(true);
    try {
      const result = await listFailedJobs(adminKey, failedPage);
      setFailedJobs(result.jobs);
      setFailedTotalPages(Math.max(1, result.pagination.totalPages));
    } catch (err) {
      setError(getApiError(err, "Could not load failed jobs."));
    } finally {
      setFailedLoading(false);
    }
  }, [adminKey, failedPage]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    const refresh = () => {
      void refreshJobs();
      void refreshCounts();
      void refreshApiHealth();
      if (view === "failed") void refreshFailedJobs();
    };
    void refreshCounts();
    void refreshApiHealth();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [refreshJobs, refreshCounts, refreshApiHealth, refreshFailedJobs, view]);

  useEffect(() => {
    if (view === "failed") void refreshFailedJobs();
  }, [view, refreshFailedJobs]);

  function saveAdminKey(key: string) {
    setAdminKey(key);
    if (key) sessionStorage.setItem("async-queue-admin-key", key);
    else sessionStorage.removeItem("async-queue-admin-key");
    setShowAdminKey(false);
    setFailedPage(1);
  }

  async function selectJob(job: Job) {
    setSelectedJob(job);
    try {
      setSelectedJob(await getJob(job.id));
    } catch (err) {
      setError(getApiError(err, "Could not load job details."));
    }
  }

  async function handleRetry(jobId: string) {
    if (!adminKey) {
      setShowAdminKey(true);
      return;
    }
    setRetrying(true);
    setError("");
    try {
      await retryJob(jobId, adminKey);
      setSelectedJob(await getJob(jobId));
      await Promise.all([refreshJobs(), refreshCounts(), refreshFailedJobs()]);
    } catch (err) {
      setError(getApiError(err, "Could not retry job."));
    } finally {
      setRetrying(false);
    }
  }

  async function handleCreated(jobId: string) {
    setShowCreate(false);
    setPage(1);
    setStatus("ALL");
    setView("jobs");
    try {
      const job = await getJob(jobId);
      setSelectedJob(job);
      await Promise.all([refreshCounts(), refreshJobs()]);
    } catch (err) {
      setError(getApiError(err, "Job was submitted, but its details could not be loaded."));
    }
  }

  async function runPdfDemo() {
    setDemoSubmitting(true);
    setError("");
    try {
      const created = await createJob({ type: "generate_pdf", payload: { text: "Hello from Async Queue" } });
      await handleCreated(created.jobId);
    } catch (err) {
      setError(getApiError(err, "Could not submit the PDF demo job."));
    } finally {
      setDemoSubmitting(false);
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const query = search.trim().toLowerCase();
    return !query || job.id.toLowerCase().includes(query) || job.type.toLowerCase().includes(query);
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <div><strong>Async Queue</strong><small>Job operations</small></div>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button className={view === "jobs" ? "nav-item active" : "nav-item"} onClick={() => setView("jobs")}>
            <span aria-hidden="true">J</span> Jobs <b>{counts.queued + counts.processing}</b>
          </button>
          <button className={view === "failed" ? "nav-item active" : "nav-item"} onClick={() => setView("failed")}>
            <span aria-hidden="true">!</span> Failed jobs {counts.failed > 0 && <b>{counts.failed}</b>}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><strong>Generic queue</strong><p>Applications provide handlers. The queue manages delivery, retries, and job state.</p></div>
          <button className="nav-item" onClick={() => setShowAdminKey(true)}><span aria-hidden="true">A</span> Admin access</button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="connection" aria-live="polite">
            <span className={apiOnline ? "online-dot" : "offline-dot"} />
            {apiOnline ? "API connected" : "API unavailable"}
            <span className={workerConfigured ? "worker-configured" : "worker-missing"}>
              {!apiOnline ? "Worker status unavailable" : workerConfigured ? "Worker key is set" : "Worker key missing"}
            </span>
            <span className="poll-label">Refreshes every 3 seconds</span>
          </div>
          <button className="user-button" aria-label="Configure admin access" onClick={() => setShowAdminKey(true)}>{adminKey ? "A" : "?"}</button>
        </header>

        <main className="content">
          <div className="page-title">
            <div><span className="eyebrow">Queue operations</span><h1>{view === "jobs" ? "Background jobs" : "Failed jobs"}</h1><p>{view === "jobs" ? "Submit work, follow its progress, and inspect each attempt." : "Review dead-letter jobs and send them back through the queue."}</p></div>
            {view === "jobs" && <button className="button button-primary" onClick={() => setShowCreate(true)}><span aria-hidden="true">+</span> Submit a job</button>}
          </div>

          {view === "jobs" && <section className="demo-banner" aria-label="Example queue flow">
            <div className="demo-copy"><span className="demo-kicker">External app example</span><h2>Generate a PDF in the background</h2><p>The separate PDF app submits a job. Its worker claims it and runs its registered handler.</p><div className="demo-actions"><button className="button button-primary" disabled={!apiOnline || demoSubmitting} onClick={() => void runPdfDemo()}>{demoSubmitting ? "Submitting..." : "Run PDF demo"}</button><button className="demo-link" onClick={() => setShowCreate(true)}>Create a custom job</button></div></div>
            <div className="flow-steps"><div className="flow-step"><span>01</span><strong>Submit</strong><code>POST /jobs</code></div><i aria-hidden="true" /><div className="flow-step"><span>02</span><strong>Queue + worker</strong><code>type: generate_pdf</code></div><i aria-hidden="true" /><div className="flow-step"><span>03</span><strong>Application handler</strong><code>PDF generated</code></div></div>
            <pre className="demo-payload">{"{\n  \"type\": \"generate_pdf\",\n  \"payload\": { \"text\": \"Hello World\" }\n}"}</pre>
            {apiOnline && !workerConfigured && <div className="worker-warning" role="status"><strong>Worker access is not configured</strong><span>Set WORKER_API_KEY in the queue API environment and restart it. Jobs can be queued, but worker requests will receive a 503.</span></div>}
          </section>}

          {error && <div className="alert" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

          {view === "jobs" ? <>
            <section className="stats-grid" aria-label="Job counts">
              <StatCard label="Queued" value={counts.queued} hint="Waiting for a worker" />
              <StatCard label="Processing" value={counts.processing} hint="Currently claimed by a worker" />
              <StatCard label="Completed" value={counts.completed} hint="Handler finished successfully" />
              <StatCard label="Failed" value={counts.failed} hint="Ready for review or retry" />
            </section>
            <div className="workspace">
              <section className="panel jobs-panel">
                <div className="panel-toolbar"><div><span className="eyebrow">Queue</span><h2>Recent jobs</h2></div><div className="job-filters"><label className="search-box"><input aria-label="Search jobs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ID or type" /></label><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as JobStatus | "ALL"); setPage(1); }}>{statuses.map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}</select></div></div>
                {loading ? <div className="loading">Loading jobs...</div> : <JobTable jobs={filteredJobs} selectedId={selectedJob?.id} onSelect={selectJob} />}
                <div className="panel-footer"><span>{filteredJobs.length} of {jobs.length} jobs on this page</span><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
              </section>
              <JobDetails job={selectedJob} retrying={retrying} onRetry={(job) => { if (!retrying) void handleRetry(job.id); }} />
            </div>
          </> : <section className="panel failed-panel">
            <div className="panel-toolbar"><div><span className="eyebrow">Dead-letter queue</span><h2>Jobs requiring attention</h2></div><span className="failed-count">{counts.failed} open</span></div>
            {!adminKey ? <div className="empty-state"><strong>Admin access required</strong><p>Configure the admin API key to inspect failed job records and retry them.</p><button className="button button-secondary" onClick={() => setShowAdminKey(true)}>Configure admin access</button></div> : failedLoading ? <div className="loading">Loading failed jobs...</div> : !failedJobs.length ? <div className="empty-state"><strong>No open failed jobs</strong><p>When a job exhausts its attempts, it will appear here.</p></div> : <div className="table-scroll"><table className="jobs-table"><thead><tr><th>Job ID</th><th>Type</th><th>Attempts</th><th>Failed at</th><th /></tr></thead><tbody>{failedJobs.map((job) => <tr key={job.jobId}><td className="mono" title={job.jobId}>{job.jobId.slice(0, 8)}...{job.jobId.slice(-6)}</td><td className="job-type">{job.type}</td><td>{job.attempts}/{job.maxAttempts}</td><td>{job.failedAt ? new Date(job.failedAt).toLocaleString() : "..."}</td><td><button className="button button-secondary" disabled={retrying} onClick={() => void handleRetry(job.jobId)}>{retrying ? "Retrying..." : "Retry job"}</button></td></tr>)}</tbody></table></div>}
            <div className="panel-footer"><span>{failedJobs.length} failed jobs on this page</span><Pagination page={failedPage} totalPages={failedTotalPages} onChange={setFailedPage} /></div>
          </section>}
        </main>
      </div>

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {showAdminKey && <AdminKeyModal initialValue={adminKey} onClose={() => setShowAdminKey(false)} onSave={saveAdminKey} />}
    </div>
  );
}
