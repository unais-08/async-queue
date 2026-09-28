import axios from "axios";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type Job = {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  nextRunAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  updatedAt: string;
};

export type FailedJob = {
  jobId: string;
  type: string;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  status: "OPEN" | "RESOLVED";
  failedAt: string | null;
  lastRetriedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  timeout: 8000,
});

export async function healthCheck() {
  const response = await client.get<{ ok: boolean }>("/health");
  return response.data;
}

export async function listJobs(params: {
  page?: number;
  limit?: number;
  status?: JobStatus;
}) {
  const response = await client.get<{ jobs: Job[]; pagination: Pagination }>(
    "/jobs",
    { params },
  );
  return response.data;
}


export async function getJob(id: string) {
  const response = await client.get<Job>(`/jobs/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createJob(input: {
  type: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const response = await client.post<{
    jobId: string;
    status: JobStatus;
    createdAt: string;
  }>("/jobs", input);
  return response.data;
}

export async function listFailedJobs(adminKey: string, page = 1) {
  const response = await client.get<{
    jobs: FailedJob[];
    pagination: Pagination;
  }>("/admin/failed-jobs", {
    params: { page, limit: 20 },
    headers: { "x-admin-key": adminKey },
  });
  return response.data;
}

export async function retryJob(id: string, adminKey: string) {
  const response = await client.post(
    `/jobs/${encodeURIComponent(id)}/retry`,
    undefined,
    { headers: { "x-admin-key": adminKey } },
  );
  return response.data;
}

export async function getJobCounts() {
  const statuses: JobStatus[] = [
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
  ];

  const results = await Promise.all(
    statuses.map((status) =>
      listJobs({
        page: 1,
        limit: 1,
        status,
      }),
    ),
  );

  return {
    pending: results[0].pagination.total,
    processing: results[1].pagination.total,
    completed: results[2].pagination.total,
    failed: results[3].pagination.total,
  };
}

export function getApiError(
  error: unknown,
  fallback = "Something went wrong.",
) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? fallback;
  }

  return fallback;
}