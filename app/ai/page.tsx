import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/auth");
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">AI Triage</h1>
      <p className="mt-2 text-zinc-600">
        Use the patient dashboard to submit symptoms and receive specialty recommendations.
      </p>
    </main>
  );
}
