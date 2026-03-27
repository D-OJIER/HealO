"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
    >
      Sign out
    </button>
  );
}
