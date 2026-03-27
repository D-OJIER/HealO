import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth";
import { getAppointmentsByRole } from "@/services/appointment-service";
import { formatDateTime } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/auth");
  }

  const appointments = await getAppointmentsByRole({
    role: profile.role,
    userId: profile.id,
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">Appointments</h1>
      <div className="mt-6 space-y-3">
        {appointments.length === 0 ? (
          <p className="text-zinc-600">No appointments yet.</p>
        ) : (
          appointments.map((appointment) => (
            <article key={appointment.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="font-medium text-zinc-900">
                {profile.role === "patient"
                  ? appointment.doctors?.users?.name ?? "Doctor"
                  : appointment.patient?.name ?? "Patient"}
              </p>
              <p className="text-sm text-zinc-600">{formatDateTime(appointment.time)}</p>
              <p className="text-sm text-zinc-500 capitalize">{appointment.status}</p>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
