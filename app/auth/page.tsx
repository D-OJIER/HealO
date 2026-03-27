import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const profile = await getCurrentUserProfile();
  if (profile?.role === "doctor") {
    redirect("/doctor");
  }
  if (profile?.role === "patient") {
    redirect("/patient");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-6 py-10">
      <div className="w-full">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900">Welcome to Healoz</h1>
        <p className="mb-6 text-zinc-600">Sign in to continue or create your patient/doctor account.</p>
        <AuthForm />
      </div>
    </main>
  );
}
