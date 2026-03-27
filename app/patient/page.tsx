import { redirect } from "next/navigation";
import { PatientWorkflow } from "@/components/patient/workflow";
import { getCurrentUserProfile } from "@/lib/auth";
import { getDoctorsBySpecialty } from "@/services/doctor-service";

export const dynamic = "force-dynamic";

export default async function PatientPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/auth");
  }
  if (profile.role !== "patient") {
    redirect("/doctor");
  }

  const doctors = await getDoctorsBySpecialty();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Patient Navigation Dashboard</h1>
        <p className="text-zinc-600">Hello {profile.name}, discover care with live map routing and instant booking.</p>
      </header>
      <PatientWorkflow allDoctors={doctors} />
    </main>
  );
}
