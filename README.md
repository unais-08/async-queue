# Async Queue

A small background job service built with TypeScript, Express, and PostgreSQL. The queue service stores jobs and manages claiming, concurrency, leases, retries, and failed jobs. Each application runs its own worker and keeps its own handler code.

## Architecture

```text
Application API --> Queue API --> PostgreSQL
                       ^
                       | claim, heartbeat, complete, fail
                       |
Application worker --> registered handlers --> actual work
```

The queue service does not import application handlers and does not give application workers database access. Workers use the small client exported by this project.

## Try the separate PDF example

The example application lives outside the queue backend in examples/pdf-app. Its handler writes a PDF locally; the queue only sees the job type and JSON payload.

### 1. Configure and start the queue service

Create a PostgreSQL database, then configure the backend environment:

```env
DATABASE_URL=postgres://user:password@localhost:5432/async_queue
PORT=4000
MAX_ATTEMPTS=3
WORKER_API_KEY=use-the-same-private-key-for-each-worker
ADMIN_API_KEY=choose-a-separate-admin-key
```

From the backend directory:

```sh
npm install
npm run build
npm run dev
```

The queue API listens on port 4000 and initializes the database schema when it starts. The queue runs by itself; it does not start an application worker.

### 2. Build the client SDK, then install and start the example application

From the repository root, build the SDK package first:

~~~sh
cd client-sdk
npm install
npm run build
cd ../examples/pdf-app
npm install
~~~

From examples/pdf-app, create an environment file:

```env
QUEUE_URL=http://localhost:4000
WORKER_API_KEY=use-the-same-private-key-for-each-worker
WORKER_CONCURRENCY=2
PDF_OUTPUT_DIR=./generated-pdfs
```

Then start the worker:

```sh
npm run worker
```

The PDF handler is registered in the example application's worker. Its generated files go into examples/pdf-app/generated-pdfs.

### 3. Submit a job from the example application

In another terminal, from examples/pdf-app:

```sh
npm run submit -- "Hello from another project"
```

The command returns a job ID. Check its status with:

```sh
curl http://localhost:4000/jobs/JOB_ID
```

The frontend dashboard also shows the job lifecycle. Open the frontend and create a job with type generate_pdf and payload {"text":"Hello World"}.

## Integrate another application

Install the small client package in the other project. For local development, build it first, then install its folder:

```sh
cd path/to/async-queue/client-sdk
npm install
npm run build
cd path/to/other-project
npm install path/to/async-queue/client-sdk
```

When the client package is published, install it as @async-queue/client. The application needs Node.js 18 or newer. The client is independent of the queue server's Express and PostgreSQL dependencies.

### Submit jobs

Use the SDK in the application API or wherever the work is requested:

```ts
import { createQueueClient } from "@async-queue/client";

const queue = createQueueClient({
  queueUrl: process.env.QUEUE_URL!,
});

const result = await queue.submit("generate_pdf", {
  text: "Hello World",
});

console.log(result.jobId, result.status);
```

The HTTP API is also available directly:

```http
POST /jobs
Content-Type: application/json

{"type":"generate_pdf","payload":{"text":"Hello World"}}
```

### Run application-owned handlers

In the other project, make a worker entry point and register the handlers that project owns:

```ts
import { registerHandler, startWorker } from "@async-queue/client";

registerHandler("generate_pdf", async (payload: { text: string }) => {
  // This implementation belongs to this application.
  await generatePdf(payload.text);
});

const worker = startWorker({
  queueUrl: process.env.QUEUE_URL!,
  workerKey: process.env.WORKER_API_KEY!,
  concurrency: 4,
});

process.on("SIGTERM", () => void worker.stop());
```

Run that entry point as a separate process or service alongside the application. It can be deployed and scaled independently of the queue API. The worker client polls only for types registered by that application, dispatches jobs by type, renews leases while a handler runs, and reports success or failure. Applications should make handlers safe to run more than once because a worker may lose its lease after performing an external side effect.

Set QUEUE_URL to the queue API address and WORKER_API_KEY to the same private key configured on the queue service. Do not give application workers the PostgreSQL connection string.

## Job lifecycle

Jobs move through QUEUED, PROCESSING, and either COMPLETED or FAILED. Handler errors are retried with exponential backoff until maxAttempts is reached. Permanently failed jobs are copied to failed-job storage and can be retried by an administrator with POST /jobs/:id/retry and the x-admin-key header.

Each worker claims only the types its application registered. A job stays queued until a worker that supports its type is running; one application's worker cannot consume another application's work.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | /jobs | Submit a job |
| GET | /jobs/:id | Read job status |
| GET | /jobs | List jobs |
| POST | /jobs/:id/retry | Admin retry |
| GET | /admin/failed-jobs | List dead-letter jobs |
| POST | /worker/jobs/claim | Worker claim; requires x-worker-key |
| POST | /worker/jobs/:id/heartbeat | Renew a lease; requires x-worker-key |
| POST | /worker/jobs/:id/complete | Complete a job; requires x-worker-key |
| POST | /worker/jobs/:id/fail | Report a failure; requires x-worker-key |
| GET | /health | API health |

Worker claim requests include the types that worker registered, for example: {"types":["generate_pdf"]}. This lets several unrelated applications share one queue service without taking each other's jobs.

Worker credentials use WORKER_API_KEY. Admin operations use the separate ADMIN_API_KEY. These simple shared keys are suitable for this focused demonstration; deploy the API over HTTPS and keep both keys secret.

## Configuration

Queue service:

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | PostgreSQL connection string |
| PORT | Queue API port; defaults to 4000 |
| MAX_ATTEMPTS | Default retry limit |
| WORKER_API_KEY | Shared key for application worker requests |
| ADMIN_API_KEY | Key for admin operations |
| LOG_LEVEL | Log verbosity |

Application worker:

| Variable | Purpose |
| --- | --- |
| QUEUE_URL | Base URL of the queue API |
| WORKER_API_KEY | Same worker key configured on the queue service |
| WORKER_CONCURRENCY | Number of jobs processed concurrently |
| PDF_OUTPUT_DIR | PDF example output folder |

## Project layout

```text
backend/                 Queue API and PostgreSQL storage
client-sdk/              Small client SDK for external applications
frontend/                Queue operations dashboard
examples/pdf-app/        Separate example application and its PDF handler
```

PostgreSQL uses FOR UPDATE SKIP LOCKED for safe concurrent claims. Lease expiry recovers work abandoned by a stopped worker, and the failed-job table supports inspection and manual retry. Execution is at least once, not exactly once.
