import { headers } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserProfile } from "@/models/types";

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as UserProfile;
}

export async function getApiUserProfile(): Promise<UserProfile | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return null;
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return null;
  }

  const service = createServiceClient();
  const { data } = await service.from("users").select("*").eq("id", user.id).single();

  return (data as UserProfile) ?? null;
}
