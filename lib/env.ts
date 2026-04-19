function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseServiceRoleKey() {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function getXaiApiKey() {
  return process.env.XAI_API_KEY || "";
}

export function getXaiBaseUrl() {
  return process.env.XAI_BASE_URL || "https://api.x.ai/v1";
}

export function getXaiModel() {
  return process.env.XAI_MODEL || "grok-4";
}
