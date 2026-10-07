"use client";

import { useActionState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BOOKING_PLATFORM } from "@/domain/constants";
import { idleFormState } from "@/domain/form-state";
import { PLATFORM_LABEL } from "@/domain/labels";
import { createBookingAction, createCustomerAction, createExpenseAction, createInvoiceAction, createSupplierAction, importBankCsvAction, loginAction, recordPaymentAction, reconcileAction, updateSettingsAction } from "@/server/mutations";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-xs text-pink-500">{message}</p>;
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, idleFormState);
  return (
    <div className="mx-auto mt-10 w-full max-w-md px-4">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <form action={action} className="glass-card p-8">
      <div className="rounded-2xl bg-[#050505] px-6 py-4">
        <BrandLogo className="mx-auto h-auto w-48" priority />
      </div>
      <h1 className="mt-6 text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Sign in to an organisation you belong to.</p>
      <label className="mt-6 block text-sm">
        Email
        <input className="glass-input mt-1" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="mt-4 block text-sm">
        Password
        <input className="glass-input mt-1" name="password" type="password" autoComplete="current-password" required />
      </label>
      <p className="mt-3 text-sm text-pink-500">{state.message}</p>
      <div className="mt-6">
        <SubmitButton label="Sign in" pendingLabel="Signing in…" />
      </div>
    </form>
    </div>
  );
}

export function BookingForm({
  properties,
  customers,
}: {
  properties: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(createBookingAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2">
      <label className="text-sm">Property
        <select className="glass-input mt-1" name="propertyId">{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Guest
        <select className="glass-input mt-1" name="customerId">{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Channel
        <select className="glass-input mt-1" name="platform">{Object.values(BOOKING_PLATFORM).map((platform) => <option key={platform} value={platform}>{PLATFORM_LABEL[platform]}</option>)}</select>
        <FieldError message={state.fieldErrors.platform} />
      </label>
      <label className="text-sm">External booking ID
        <input className="glass-input mt-1" name="externalBookingId" required />
      </label>
      <label className="text-sm">Check-in
        <input className="glass-input mt-1" name="checkIn" type="date" required />
      </label>
      <label className="text-sm">Check-out
        <input className="glass-input mt-1" name="checkOut" type="date" required />
      </label>
      <label className="text-sm">Guests
        <input className="glass-input mt-1" name="guests" type="number" min={1} defaultValue={1} />
      </label>
      <MoneyInput name="accommodation" label="Accommodation £" error={state.fieldErrors.accommodation} />
      <MoneyInput name="cleaning" label="Cleaning fee £" error={state.fieldErrors.cleaning} />
      <MoneyInput name="extraGuest" label="Extra guest £" error={state.fieldErrors.extraGuest} />
      <MoneyInput name="parking" label="Parking £" error={state.fieldErrors.parking} />
      <MoneyInput name="other" label="Other revenue £" error={state.fieldErrors.other} />
      <MoneyInput name="commission" label="Platform commission £" error={state.fieldErrors.commission} />
      <MoneyInput name="processing" label="Processing fee £" error={state.fieldErrors.processing} />
      <MoneyInput name="refunds" label="Refunds £" error={state.fieldErrors.refunds} />
      <MoneyInput name="adjustments" label="Adjustments £" error={state.fieldErrors.adjustments} />
      <p className="text-sm text-pink-500 md:col-span-2">{state.message}</p>
      <SubmitButton label="Post booking" pendingLabel="Posting…" />
    </form>
  );
}

function MoneyInput({ name, label, error }: { name: string; label: string; error?: string }) {
  return (
    <label className="text-sm">
      {label}
      <input className="glass-input mt-1" name={name} inputMode="decimal" defaultValue="0" />
      <FieldError message={error} />
    </label>
  );
}

export function ExpenseForm({
  properties,
  suppliers,
  categories,
  bookings,
}: {
  properties: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  bookings: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(createExpenseAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2">
      <label className="text-sm">Supplier
        <select className="glass-input mt-1" name="supplierId"><option value="">None</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Property
        <select className="glass-input mt-1" name="propertyId"><option value="">Company</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm md:col-span-2">Category
        <select className="glass-input mt-1" name="categoryId">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Booking
        <select className="glass-input mt-1" name="bookingId"><option value="">None</option>{bookings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Invoice number
        <input className="glass-input mt-1" name="invoiceNumber" />
      </label>
      <label className="text-sm">Date
        <input className="glass-input mt-1" name="transactionDate" type="date" required />
      </label>
      <label className="text-sm">Payment method
        <select className="glass-input mt-1" name="paymentMethod" defaultValue="BANK_TRANSFER">
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD">Card</option>
          <option value="DIRECT_DEBIT">Direct debit</option>
          <option value="CASH">Cash</option>
        </select>
      </label>
      <MoneyInput name="net" label="Net £" error={state.fieldErrors.net} />
      <MoneyInput name="vat" label="VAT £" error={state.fieldErrors.vat} />
      <MoneyInput name="gross" label="Gross £" error={state.fieldErrors.gross} />
      <label className="text-sm md:col-span-2">Business purpose
        <input className="glass-input mt-1" name="description" required />
        <FieldError message={state.fieldErrors.description} />
      </label>
      <label className="text-sm md:col-span-2">Receipt
        <input className="glass-input mt-1" name="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" />
      </label>
      <p className="text-sm text-pink-500 md:col-span-2">{state.message}</p>
      <SubmitButton label="Add expense" pendingLabel="Saving…" />
    </form>
  );
}

export function InvoiceForm({ customers }: { customers: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(createInvoiceAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6">
      <label className="text-sm">Customer
        <select className="glass-input mt-1" name="customerId">{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="text-sm">Description
        <input className="glass-input mt-1" name="description" required />
      </label>
      <MoneyInput name="net" label="Net £" error={state.fieldErrors.net} />
      <label className="text-sm">Issue date
        <input className="glass-input mt-1" name="issueDate" type="date" required />
      </label>
      <label className="text-sm">Due date
        <input className="glass-input mt-1" name="dueDate" type="date" required />
      </label>
      <p className="text-sm text-pink-500">{state.message}</p>
      <SubmitButton label="Issue invoice" pendingLabel="Issuing…" />
    </form>
  );
}

export function PaymentForm({ invoiceId }: { invoiceId: string }) {
  const [state, action] = useActionState(recordPaymentAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <MoneyInput name="amount" label="Amount £" error={state.fieldErrors.amount} />
      <label className="text-sm">Date
        <input className="glass-input mt-1" name="paidOn" type="date" required />
      </label>
      <label className="text-sm">Method
        <select className="glass-input mt-1" name="method" defaultValue="BANK_TRANSFER">
          <option value="BANK_TRANSFER">Bank transfer</option>
          <option value="CARD">Card</option>
          <option value="STRIPE">Stripe</option>
        </select>
      </label>
      <p className="text-sm text-pink-500">{state.message}</p>
      <SubmitButton label="Record payment" pendingLabel="Recording…" />
    </form>
  );
}

export function PartyForm({ kind }: { kind: "customer" | "supplier" }) {
  const [state, action] = useActionState(kind === "customer" ? createCustomerAction : createSupplierAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6 md:grid-cols-2">
      <label className="text-sm">Name
        <input className="glass-input mt-1" name="name" required />
      </label>
      {kind === "supplier" ? (
        <label className="text-sm">Category
          <input className="glass-input mt-1" name="category" required />
        </label>
      ) : (
        <label className="text-sm">Company
          <input className="glass-input mt-1" name="companyName" />
        </label>
      )}
      <label className="text-sm">Email
        <input className="glass-input mt-1" name="email" type="email" />
      </label>
      <label className="text-sm">Phone
        <input className="glass-input mt-1" name="phone" />
      </label>
      <p className="text-sm text-pink-500 md:col-span-2">{state.message}</p>
      <SubmitButton label={kind === "customer" ? "Add customer" : "Add supplier"} pendingLabel="Saving…" />
    </form>
  );
}

export function BankImportForm() {
  const [state, action] = useActionState(importBankCsvAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6">
      <label className="text-sm">CSV with Date, Description, Amount, Direction, Reference
        <input className="glass-input mt-1" name="file" type="file" accept=".csv,text/csv" required />
      </label>
      <p className="text-sm text-pink-500">{state.message}</p>
      <SubmitButton label="Import transactions" pendingLabel="Importing…" />
    </form>
  );
}

export function MatchForm({ bankTransactionId, payoutId }: { bankTransactionId: string; payoutId: string }) {
  const [state, action] = useActionState(reconcileAction, idleFormState);
  return (
    <form action={action}>
      <input type="hidden" name="bankTransactionId" value={bankTransactionId} />
      <input type="hidden" name="payoutId" value={payoutId} />
      <p className="text-xs text-pink-500">{state.message}</p>
      <SubmitButton label="Match" pendingLabel="Matching…" />
    </form>
  );
}

export function SettingsForm({
  tradingName,
  phone,
  vatRegistered,
  retentionYears,
}: {
  tradingName: string;
  phone: string;
  vatRegistered: boolean;
  retentionYears: number;
}) {
  const [state, action] = useActionState(updateSettingsAction, idleFormState);
  return (
    <form action={action} className="glass-card grid gap-4 p-6">
      <label className="text-sm">Trading name
        <input className="glass-input mt-1" name="tradingName" defaultValue={tradingName} />
      </label>
      <label className="text-sm">Phone
        <input className="glass-input mt-1" name="phone" defaultValue={phone} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="vatRegistered" type="checkbox" defaultChecked={vatRegistered} />
        VAT registered
      </label>
      <label className="text-sm">Document retention years
        <input className="glass-input mt-1" name="retentionYears" type="number" min={7} max={15} defaultValue={retentionYears} />
      </label>
      <p className="text-sm text-pink-500">{state.message}</p>
      <SubmitButton label="Save settings" pendingLabel="Saving…" />
    </form>
  );
}
