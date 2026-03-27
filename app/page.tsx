import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-16">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Healoz Healthcare Platform</p>
        <h1 className="mt-2 text-4xl font-bold text-zinc-900">AI-Assisted Care. Faster Appointments.</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">
          Patients can triage symptoms, discover specialists, and book appointments. Doctors get a focused dashboard
          to manage patient visits.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/auth" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Get started
          </Link>
          <Link
            href="/patient"
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Patient dashboard
          </Link>
          <Link
            href="/doctor"
            className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Doctor dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
