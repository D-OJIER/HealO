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

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}
