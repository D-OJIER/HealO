import { redirect } from "next/navigation";
import { DoctorDashboard } from "@/components/doctor/dashboard";
import { getCurrentUserProfile } from "@/lib/auth";
import { getAppointmentsByRole } from "@/services/appointment-service";
import { getDoctorDecisionSupport } from "@/services/doctor-dashboard-service";

export const dynamic = "force-dynamic";

export default async function DoctorPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/auth");
  }
  if (profile.role !== "doctor") {
    redirect("/patient");
  }

  const appointments = await getAppointmentsByRole({
    role: "doctor",
    userId: profile.id,
  });

  const support = await getDoctorDecisionSupport({ userId: profile.id });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Doctor Dashboard</h1>
        <p className="text-zinc-600">Welcome back Dr. {profile.name}. Track your patient bookings here.</p>
      </header>
      <div className="space-y-6">
        <DoctorDashboard initialAppointments={appointments} />

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900">Clinical Decision Support</h2>
          <p className="mt-1 text-sm text-zinc-600">Recent patient history and prescriptions summary.</p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Past appointments</h3>
              <div className="mt-2 space-y-2">
                {support.pastAppointments.length === 0 ? (
                  <p className="text-sm text-zinc-600">No past appointments.</p>
                ) : (
                  support.pastAppointments.map((a) => (
                    <div key={a.id} className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-sm font-medium text-zinc-900">{a.patient?.name ?? "Patient"}</p>
                      <p className="text-xs text-zinc-500 capitalize">{a.status}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Recent prescriptions</h3>
              <div className="mt-2 space-y-2">
                {support.recentPrescriptions.length === 0 ? (
                  <p className="text-sm text-zinc-600">No prescriptions yet.</p>
                ) : (
                  support.recentPrescriptions.map((p) => (
                    <div key={p.id} className="rounded-lg border border-zinc-200 p-3">
                      <p className="text-sm font-medium text-zinc-900">{p.diagnosis}</p>
                      <p className="text-xs text-zinc-500">Meds: {(p.medications ?? []).length}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
