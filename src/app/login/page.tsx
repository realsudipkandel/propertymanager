import { LoginForm } from "@/features/forms/LedgerForms";

export default function LoginPage() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "director@miraproperties.example";
  const password = process.env.NODE_ENV === "production" ? null : process.env.SEED_ADMIN_PASSWORD ?? null;
  return <LoginForm email={email} password={password} />;
}
