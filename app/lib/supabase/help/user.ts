import { createClient } from "../server";

export async function getUserWithProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("wakatime_api_key, email, role")
    .eq("id", user.id)
    .single();

  return { user, profile };
}
