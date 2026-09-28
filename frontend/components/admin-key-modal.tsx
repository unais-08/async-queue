"use client";

import { useState } from "react";

export function AdminKeyModal({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue: string;
  onClose: () => void;
  onSave: (key: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal small-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Admin access</span>
            <h2>Admin API key</h2>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>
        <div className="form-body">
          <label>
            API key
            <input
              type="password"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Enter x-admin-key"
            />
          </label>
          <p className="helper-text">
            The key is kept in this browser session and is only sent to admin endpoints.
          </p>
        </div>
        <div className="modal-actions">
          <button className="button button-secondary" onClick={() => onSave("")}>Clear</button>
          <button className="button button-primary" onClick={() => onSave(value.trim())}>Save</button>
        </div>
      </div>
    </div>
  );
}
