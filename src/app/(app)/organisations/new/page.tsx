import { redirect } from "next/navigation";

import { CreateOrganizationForm } from "@/features/organisations/CreateOrganizationForm";
import { getAuthenticatedUser, userCanCreateOrganization } from "@/server/session";

export default async function NewOrganisationPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await userCanCreateOrganization(user.userId))) {
    redirect("/organisations");
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Create an organisation</h1>
      <CreateOrganizationForm email={user.email} />
    </main>
  );
}
