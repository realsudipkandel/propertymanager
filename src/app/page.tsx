import { redirect } from "next/navigation";

import { getAuthenticatedUser, landingPathForUser } from "@/server/session";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }
  redirect(await landingPathForUser(user.userId));
}
