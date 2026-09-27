"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const status = useFormStatus();
  return (
    <button className="primary-button" type="submit" disabled={status.pending} data-testid="submit-action">
      {status.pending ? pendingLabel : label}
    </button>
  );
}
