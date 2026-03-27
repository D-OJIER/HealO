import type { Appointment } from "@/models/types";
import { formatDateTime } from "@/utils/format";

export function DoctorAppointments({ appointments }: { appointments: Appointment[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">Upcoming Appointments</h2>
      <div className="mt-4 space-y-3">
        {appointments.length === 0 ? (
          <p className="text-sm text-zinc-600">No appointments yet.</p>
        ) : (
          appointments.map((appointment) => (
            <article key={appointment.id} className="rounded-lg border border-zinc-200 p-4">
              <p className="font-medium text-zinc-900">{appointment.patient?.name ?? "Patient"}</p>
              <p className="text-sm text-zinc-600">{formatDateTime(appointment.time)}</p>
              <p className="text-sm text-zinc-500 capitalize">Status: {appointment.status}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
