"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/SubmitButton";
import { idleFormState } from "@/domain/form-state";
import {
  cancelReservationAction,
  connectChannelAction,
  createListingMappingAction,
  disconnectChannelAction,
  importReservationsAction,
  updateDailyRatesAction,
} from "@/server/channel-mutations";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-xs text-pink-500">{message}</p>;
}

function Result({ message, ok }: { message: string | null; ok: boolean }) {
  if (!message) {
    return null;
  }
  return <p className={`text-sm ${ok ? "text-emerald-400" : "text-pink-500"}`} data-testid="form-result">{message}</p>;
}

export function ConnectChannelForm({ providers }: { providers: Array<{ provider: string; label: string; capabilities: string[] }> }) {
  const [state, action] = useActionState(connectChannelAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6" data-testid="connect-channel">
      <div>
        <h2 className="text-lg font-semibold">Connect a channel</h2>
        <p className="mt-1 text-sm text-muted">
          No real OTA credentials are configured in this environment, so Airbnb, Booking.com and Vrbo are simulated by a
          deterministic mock adapter behind the same adapter interface a certified direct integration would use.
        </p>
      </div>
      <label className="text-sm">Channel
        <select className="glass-input mt-1" name="provider">
          {providers.map((item) => <option key={item.provider} value={item.provider}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Connection name
        <input className="glass-input mt-1" name="displayName" placeholder="e.g. Mira Properties main account" />
        <FieldError message={state.fieldErrors.displayName} />
      </label>
      <Result message={state.ok ? null : state.message} ok={false} />
      <SubmitButton label="Connect" pendingLabel="Connecting…" />
    </form>
  );
}

export function DisconnectChannelForm({ channelAccountId }: { channelAccountId: string }) {
  const [, action] = useActionState(disconnectChannelAction, idleFormState);
  return (
    <form action={action}>
      <input type="hidden" name="channelAccountId" value={channelAccountId} />
      <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold" type="submit" data-testid="disconnect-channel">
        Disconnect
      </button>
    </form>
  );
}

export function CreateListingMappingForm({
  properties,
  accounts,
}: {
  properties: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(createListingMappingAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2" data-testid="create-mapping">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Map a listing</h2>
        <p className="mt-1 text-sm text-muted">Link a Mira property to an external listing on a connected channel, and set the channel markup over Mira&rsquo;s base rate.</p>
      </div>
      <label className="text-sm">Property
        <select className="glass-input mt-1" name="propertyId">
          {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Channel connection
        <select className="glass-input mt-1" name="channelAccountId">
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="text-sm">External listing id
        <input className="glass-input mt-1" name="externalListingId" placeholder="e.g. MOCK_AIRBNB-abcd1234-1" />
        <FieldError message={state.fieldErrors.externalListingId} />
      </label>
      <label className="text-sm">Channel markup (%)
        <input className="glass-input mt-1" name="markupPercent" type="number" step="0.1" defaultValue={15} />
        <FieldError message={state.fieldErrors.markupPercent} />
      </label>
      <label className="text-sm">Sync mode
        <select className="glass-input mt-1" name="syncMode" defaultValue="ARI_ONLY">
          <option value="FULL_SYNC">Full sync — Mira owns content, rates and availability</option>
          <option value="ARI_ONLY">ARI only — Mira owns rates and availability</option>
          <option value="RESERVATIONS_ONLY">Reservations only — import bookings, no pricing control</option>
        </select>
      </label>
      <Result message={state.ok ? null : state.message} ok={false} />
      <div className="md:col-span-2"><SubmitButton label="Create mapping" pendingLabel="Saving…" /></div>
    </form>
  );
}

export function ImportReservationsForm({ mappingId }: { mappingId: string }) {
  const [state, action] = useActionState(importReservationsAction, idleFormState);
  return (
    <form action={action} className="grid gap-2" data-testid="import-reservations">
      <input type="hidden" name="mappingId" value={mappingId} />
      <SubmitButton label="Pull reservations" pendingLabel="Pulling…" />
      <Result message={state.message} ok={state.ok} />
    </form>
  );
}

export function CancelReservationForm({ reservationId }: { reservationId: string }) {
  const [state, action] = useActionState(cancelReservationAction, idleFormState);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="reservationId" value={reservationId} />
      <button className="w-fit rounded-lg border border-pink-500/40 px-4 py-2 text-sm font-semibold text-pink-400" type="submit" data-testid="cancel-reservation">
        Cancel reservation
      </button>
      <Result message={state.ok ? null : state.message} ok={false} />
    </form>
  );
}

export function UpdateDailyRatesForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(updateDailyRatesAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2" data-testid="update-rates">
      <input type="hidden" name="propertyId" value={propertyId} />
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Update the base rate</h2>
        <p className="mt-1 text-sm text-muted">Sets Mira&rsquo;s canonical nightly rate. Each connected channel&rsquo;s published price is this rate plus its own markup.</p>
      </div>
      <label className="text-sm">From
        <input className="glass-input mt-1" name="from" type="date" required />
      </label>
      <label className="text-sm">To
        <input className="glass-input mt-1" name="to" type="date" required />
      </label>
      <label className="text-sm">Base nightly rate (£)
        <input className="glass-input mt-1" name="basePrice" placeholder="120.00" />
        <FieldError message={state.fieldErrors.basePrice} />
      </label>
      <label className="text-sm">Minimum stay (nights)
        <input className="glass-input mt-1" name="minStay" type="number" min={1} max={30} defaultValue={1} />
        <FieldError message={state.fieldErrors.minStay} />
      </label>
      <Result message={state.ok ? null : state.message} ok={false} />
      <div className="md:col-span-2"><SubmitButton label="Update rates" pendingLabel="Updating…" /></div>
    </form>
  );
}
