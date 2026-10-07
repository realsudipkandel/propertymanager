"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/SubmitButton";
import { idleFormState } from "@/domain/form-state";
import { createOrganizationAction } from "@/server/mutations";

export function CreateOrganizationForm({ email }: { email: string }) {
  const [state, action] = useActionState(createOrganizationAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6" data-testid="create-organisation">
      <label className="text-sm">Organisation name
        <input className="glass-input mt-1" name="tradingName" data-testid="organisation-name" />
      </label>
      <label className="text-sm">Legal name
        <input className="glass-input mt-1" name="legalName" />
      </label>
      <label className="text-sm">Finance email
        <input className="glass-input mt-1" name="email" type="email" defaultValue={email} />
      </label>
      <label className="text-sm">Address
        <input className="glass-input mt-1" name="addressLine1" />
      </label>
      <label className="text-sm">City
        <input className="glass-input mt-1" name="city" />
      </label>
      <label className="text-sm">Postcode
        <input className="glass-input mt-1" name="postcode" />
      </label>
      {state.message ? <p className="text-sm text-pink-500">{state.message}</p> : null}
      <SubmitButton label="Create organisation" pendingLabel="Creating…" />
    </form>
  );
}
