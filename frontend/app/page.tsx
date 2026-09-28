"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getApiError, getJob, getJobCounts, healthCheck, listFailedJobs, listJobs, retryJob,
  type FailedJob, type Job, type JobStatus,
} from "../lib/api";
import { AdminKeyModal } from "../components/admin-key-modal";
import { CreateJobModal } from "../components/create-job-modal";
import { JobDetails } from "../components/job-details";
import { JobTable } from "../components/job-table";
import { Pagination } from "../components/pagination";
import { StatCard } from "../components/stat-card";

const statuses: Array<JobStatus | "ALL"> = ["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"];

export default function Home() {
  const [view, setView] = useState<"jobs" | "failed">("jobs");
  const [jobs, setJobs] = useState<Job[]>([]), [failedJobs, setFailedJobs] = useState<FailedJob[]>([]), [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<JobStatus | "ALL">("ALL"), [search, setSearch] = useState(""), [page, setPage] = useState(1), [failedPage, setFailedPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1), [failedTotalPages, setFailedTotalPages] = useState(1);
  const [counts, setCounts] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 }), [workerOnline, setWorkerOnline] = useState(false);
  const [loading, setLoading] = useState(true), [failedLoading, setFailedLoading] = useState(false), [error, setError] = useState("");
  const [adminKey, setAdminKey] = useState(""), [showCreate, setShowCreate] = useState(false), [showAdminKey, setShowAdminKey] = useState(false), [retrying, setRetrying] = useState(false);

  useEffect(() => { setAdminKey(sessionStorage.getItem("async-queue-admin-key") ?? "") }, []);

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

  const refreshCounts = useCallback(async () => { try { setCounts(await getJobCounts()) } catch { } }, []);
  const refreshHealth = useCallback(async () => { try { await healthCheck(); setWorkerOnline(true) } catch { setWorkerOnline(false) } }, []);
  const refreshFailedJobs = useCallback(async () => {
    if (!adminKey) { setFailedJobs([]); return }
    setFailedLoading(true);
    try { const result = await listFailedJobs(adminKey, failedPage); setFailedJobs(result.jobs); setFailedTotalPages(Math.max(1, result.pagination.totalPages)) }
    catch (err) { setError(getApiError(err, "Could not load failed jobs.")) }
    finally { setFailedLoading(false) }
  }, [adminKey, failedPage]);

  useEffect(() => { void refreshJobs() }, [refreshJobs]);
  useEffect(() => { void refreshCounts(); void refreshHealth(); const id = window.setInterval(() => { void refreshCounts(); void refreshHealth() }, 5000); return () => window.clearInterval(id) }, [refreshCounts, refreshHealth]);
  useEffect(() => { if (view === "failed") void refreshFailedJobs() }, [view, refreshFailedJobs]);

  function saveAdminKey(key: string) { setAdminKey(key); if (key) sessionStorage.setItem("async-queue-admin-key", key); else sessionStorage.removeItem("async-queue-admin-key"); setShowAdminKey(false); setFailedPage(1) }
  async function selectJob(job: Job) { try { setSelectedJob(await getJob(job.id)) } catch (err) { setError(getApiError(err, "Could not load job details.")) } }
  async function handleRetry(job: Job) {
    if (!adminKey) { setShowAdminKey(true); return }
    setRetrying(true); setError("");
    try { await retryJob(job.id, adminKey); setSelectedJob(null); await Promise.all([refreshJobs(), refreshCounts(), refreshFailedJobs()]) }
    catch (err) { setError(getApiError(err, "Could not retry job.")) }
    finally { setRetrying(false) }
  }
  async function handleFailedRetry(jobId: string) { const job = await getJob(jobId); await handleRetry(job) }

  const filteredJobs = jobs.filter(job => { const query = search.trim().toLowerCase(); return !query || job.id.toLowerCase().includes(query) || job.type.toLowerCase().includes(query) });

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">Q</span><div><strong>Async Queue</strong><small>Operations</small></div></div>
      <nav className="sidebar-nav">
        <button className={view === "jobs" ? "nav-item active" : "nav-item"} onClick={() => setView("jobs")}><span>▤</span> Jobs</button>
        <button className={view === "failed" ? "nav-item active" : "nav-item"} onClick={() => setView("failed")}><span>!</span> Failed jobs</button>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowAdminKey(true)}><span>⚙</span> Admin access</button></div>
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="connection"><span className={workerOnline ? "online-dot" : "offline-dot"} />{workerOnline ? "API connected" : "API unavailable"}</div><button className="user-button" onClick={() => setShowAdminKey(true)}>A</button></header>
      <main className="content">
        <div className="page-title"><div><span className="eyebrow">Queue operations</span><h1>{view === "jobs" ? "Jobs" : "Failed jobs"}</h1><p>{view === "jobs" ? "Monitor background work and inspect individual jobs." : "Review jobs that exhausted their automatic retries."}</p></div>{view === "jobs" && <button className="button button-primary" onClick={() => setShowCreate(true)}>+ Create job</button>}</div>
        {error && <div className="alert" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

        {view === "jobs" ? <>
          <section className="stats-grid"><StatCard label="Pending" value={counts.pending} hint="Waiting to run" /><StatCard label="Processing" value={counts.processing} hint="Currently running" /><StatCard label="Completed" value={counts.completed} hint="Successfully finished" /><StatCard label="Failed" value={counts.failed} hint="Exhausted attempts" /></section>
          <div className="workspace">
            <section className="panel jobs-panel">
              <div className="panel-toolbar"><div className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID or type" /></div><select value={status} onChange={e => { setStatus(e.target.value as JobStatus | "ALL"); setPage(1) }}>{statuses.map(item => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}</select></div>
              {loading ? <div className="loading">Loading jobs…</div> : <JobTable jobs={filteredJobs} selectedId={selectedJob?.id} onSelect={selectJob} />}
              <div className="panel-footer"><span>{filteredJobs.length} jobs on this page</span><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>
            </section>
            <JobDetails job={selectedJob} onRetry={job => { if (!retrying) void handleRetry(job) }} />
          </div>
        </> : <section className="panel">
          <div className="panel-toolbar"><div><span className="eyebrow">Dead-letter view</span><h2>Open failed jobs</h2></div></div>
          {!adminKey ? <div className="empty-state"><strong>Admin access required</strong><p>Enter the backend admin API key to inspect and retry failed jobs.</p><button className="button button-secondary" onClick={() => setShowAdminKey(true)}>Configure access</button></div> : failedLoading ? <div className="loading">Loading failed jobs…</div> : !failedJobs.length ? <div className="empty-state">No open failed jobs.</div> : <div className="table-scroll"><table className="jobs-table"><thead><tr><th>Job</th><th>Type</th><th>Attempts</th><th>Failed</th><th /></tr></thead><tbody>{failedJobs.map(job => <tr key={job.jobId}><td className="mono">{job.jobId.slice(0, 14)}…</td><td className="job-type">{job.type}</td><td>{job.attempts}/{job.maxAttempts}</td><td>{job.failedAt ? new Date(job.failedAt).toLocaleString() : "—"}</td><td><button className="button button-secondary" disabled={retrying} onClick={() => void handleFailedRetry(job.jobId)}>Retry</button></td></tr>)}</tbody></table></div>}
          <div className="panel-footer"><span>{failedJobs.length} failed jobs on this page</span><Pagination page={failedPage} totalPages={failedTotalPages} onChange={setFailedPage} /></div>
        </section>}
      </main>
    </div>

    {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} onCreated={async jobId => { setShowCreate(false); setPage(1); await Promise.all([refreshJobs(), refreshCounts()]); try { setSelectedJob(await getJob(jobId)) } catch { } }} />}
    {showAdminKey && <AdminKeyModal initialValue={adminKey} onClose={() => setShowAdminKey(false)} onSave={saveAdminKey} />}
  </div>;
}
