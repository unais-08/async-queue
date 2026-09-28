"use client";

import { useState } from "react";
import { createJob, getApiError } from "../lib/api";

export function CreateJobModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  const [type, setType] = useState("generate_pdf");
  const [payload, setPayload] = useState('{"text": "Hello World"}');
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(payload);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error();
      }
      parsed = value;
    } catch {
      setError("Payload must be a valid JSON object.");
      return;
    }

    setSaving(true);
    try {
      const result = await createJob({
        type: type.trim(),
        payload: parsed,
        maxAttempts: Number(maxAttempts),
      });
      onCreated(result.jobId);
    } catch (err) {
      setError(getApiError(err, "Could not create job."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" aria-labelledby="create-job-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">New job</span>
            <h2 id="create-job-title">Create background job</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>×</button>
        </div>

        <div className="form-body">
          <label>
            Job type
            <input value={type} onChange={(event) => setType(event.target.value)} placeholder="generate_pdf" required />
            <span className="helper-text">The worker dispatches this name to a registered application handler.</span>
          </label>
          <label>
            Payload
            <textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={8} />
            <span className="helper-text">Example: {`{ "text": "Hello World" }`}</span>
          </label>
          <label>
            Max attempts
            <input type="number" min="1" max="10" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Creating…" : "Create job"}
          </button>
        </div>
      </form>
    </div>
  );
}
