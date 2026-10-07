"use client";

import { useActionState, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";

import { SubmitButton } from "@/components/SubmitButton";
import { MESSAGE } from "@/domain/constants";
import { idleFormState } from "@/domain/form-state";
import {
  draftPropertyFromText,
  emptyPropertyDraft,
  PROPERTY_SEARCH_MIN_LENGTH,
  propertyDraftHasSignal,
  type PropertyDraft,
} from "@/domain/property";
import { searchUkPropertyAddresses } from "@/server/address-search";
import { createPropertyAction } from "@/server/mutations";

export function CreateProperty() {
  const [state, formAction] = useActionState(createPropertyAction, idleFormState);
  const [sourceText, setSourceText] = useState("");
  const [draft, setDraft] = useState<PropertyDraft>(emptyPropertyDraft);
  const [usingDraft, setUsingDraft] = useState(false);
  const [matches, setMatches] = useState<PropertyDraft[]>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const parsed = draftPropertyFromText(sourceText);
  const shown = usingDraft ? draft : parsed;
  const showDetails = usingDraft || propertyDraftHasSignal(parsed) || state.message !== null;

  function handleSourceChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setSourceText(event.target.value);
    setDraft(emptyPropertyDraft());
    setUsingDraft(false);
    setMatches([]);
    setSearchMessage("");
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    const field = draftFieldName(event.currentTarget.name);
    if (!field) {
      return;
    }
    const base = usingDraft ? draft : parsed;
    setDraft({ ...base, [field]: event.currentTarget.value });
    setUsingDraft(true);
  }

  function handleChooseMatch(event: MouseEvent<HTMLButtonElement>): void {
    const match = matches[Number(event.currentTarget.dataset.index)];
    if (!match) {
      return;
    }
    setDraft(match);
    setUsingDraft(true);
    setMatches([]);
    setSearchMessage("");
  }

  async function handleFindAddress(): Promise<void> {
    setSearching(true);
    setSearchMessage("");
    try {
      const result = await searchUkPropertyAddresses(sourceText);
      const onlyMatch = result.matches.length === 1 ? result.matches[0] : undefined;
      if (onlyMatch) {
        setDraft(onlyMatch);
        setUsingDraft(true);
        setMatches([]);
        setSearchMessage(result.message ?? "");
        return;
      }
      setMatches(result.matches);
      setSearchMessage(result.message ?? "");
    } catch {
      setSearchMessage(MESSAGE.PROPERTY_SEARCH_UNAVAILABLE);
    } finally {
      setSearching(false);
    }
  }

  function renderMatch(match: PropertyDraft, index: number) {
    return (
      <li key={`${match.postcode}-${match.address}-${match.name}`}>
        <button
          type="button"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm"
          data-index={index}
          data-testid="address-match"
          onClick={handleChooseMatch}
        >
          {matchLabel(match)}
        </button>
      </li>
    );
  }

  return (
    <form action={formAction} className="glass-card grid gap-4 p-6" data-testid="create-property">
      <div>
        <h2 className="text-lg font-semibold">Add a property</h2>
        <p className="mt-1 text-sm text-muted">Paste an address, or a line such as “Canal House, 12 Canal Street, London SW1A 1AA, 2 bedrooms”.</p>
      </div>
      <label className="text-sm">Address or description
        <textarea
          className="glass-input mt-1 min-h-24"
          value={sourceText}
          data-testid="property-source"
          onChange={handleSourceChange}
        />
      </label>
      <button
        type="button"
        className="w-fit rounded-[0.85rem] border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-60"
        data-testid="find-address"
        onClick={handleFindAddress}
        disabled={searching || sourceText.trim().length < PROPERTY_SEARCH_MIN_LENGTH}
      >
        {searching ? "Searching…" : "Find address"}
      </button>
      {searchMessage ? <p className="text-sm text-muted" data-testid="address-search-status">{searchMessage}</p> : null}
      {matches.length > 1 ? <ul className="grid gap-2">{matches.map(renderMatch)}</ul> : null}
      {showDetails ? (
        <div className="grid gap-4 md:grid-cols-2" data-testid="create-property-details">
          <DraftField label="Name" name="name" value={shown.name} testId="property-name" error={state.fieldErrors.name} onChange={handleDraftChange} />
          <DraftField label="Bedrooms" name="bedrooms" value={shown.bedroomsRaw} testId="property-bedrooms" error={state.fieldErrors.bedrooms} onChange={handleDraftChange} inputMode="numeric" />
          <DraftField label="Address" name="address" value={shown.address} testId="property-address" error={state.fieldErrors.address} onChange={handleDraftChange} />
          <DraftField label="City" name="city" value={shown.city} testId="property-city" error={state.fieldErrors.city} onChange={handleDraftChange} />
          <DraftField label="Postcode" name="postcode" value={shown.postcode} testId="property-postcode" error={state.fieldErrors.postcode} onChange={handleDraftChange} />
        </div>
      ) : null}
      {state.message && !state.ok ? <p className="text-sm text-pink-500">{state.message}</p> : null}
      {showDetails ? <SubmitButton label="Add property" pendingLabel="Saving…" /> : null}
    </form>
  );
}

function DraftField({
  label,
  name,
  value,
  testId,
  error,
  onChange,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  testId: string;
  error?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  inputMode?: "numeric";
}) {
  return (
    <label className="text-sm">
      {label}
      <input className="glass-input mt-1" name={name} value={value} data-testid={testId} onChange={onChange} inputMode={inputMode} />
      {error ? <p className="mt-1 text-xs text-pink-500">{error}</p> : null}
    </label>
  );
}

function draftFieldName(value: string): keyof PropertyDraft | null {
  if (value === "bedrooms") {
    return "bedroomsRaw";
  }
  if (value === "name" || value === "address" || value === "city" || value === "postcode") {
    return value;
  }
  return null;
}

function matchLabel(match: PropertyDraft): string {
  const place = [match.address, match.city, match.postcode].filter((part) => part.length > 0).join(", ");
  if (match.name.length > 0 && match.name.toLowerCase() !== match.address.toLowerCase()) {
    return `${match.name} — ${place}`;
  }
  return place;
}
