import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("apiKey") || "";
  let profile$: { wakatime_api_key: string };

  if (apiKey && (!apiKey.trim() || !/^waka_[0-9a-f-]{36}$/i.test(apiKey))) {
    return NextResponse.json(
      { error: "Please enter a valid WakaTime API key." },
      { status: 400 },
    );
  }

  profile$ = { wakatime_api_key: apiKey };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiKey) {
    // Get profile with API key
    const { data: profile } = await supabase
      .from("profiles")
      .select("wakatime_api_key")
      .eq("id", user.id)
      .single();

    if (!profile?.wakatime_api_key) {
      return NextResponse.json({ error: "No API key found" }, { status: 400 });
    }

    profile$ = { wakatime_api_key: profile.wakatime_api_key };

    // Check last fetch
    const { data: existing } = await supabase
      .from("user_stats")
      .select(
        `
        *,
        projects:user_projects (
          projects
        )
      `,
      )
      .eq("user_id", user.id)
      .single();

    const now = new Date();
    const sixHours = 6 * 60 * 60 * 1000;

    if (existing?.last_fetched_at) {
      const lastFetch = new Date(existing.last_fetched_at).getTime();
      if (now.getTime() - lastFetch < sixHours) {
        return NextResponse.json({ success: true, data: existing });
      }
    }
  }

  // Fetch from WakaTime
  const response = await fetch(
    "https://wakatime.com/api/v1/users/current/stats/last_7_days",
    {
      headers: {
        Authorization: `Basic ${Buffer.from(profile$.wakatime_api_key).toString(
          "base64",
        )}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch WakaTime" },
      { status: 500 },
    );
  }

  if (apiKey) {
    const { error } = await supabase
      .from("profiles")
      .update({ wakatime_api_key: apiKey })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This WakaTime API key is already in use." },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: "Failed to update API key" },
        { status: 500 },
      );
    }
  }

  const { data: statsResult, error: statsError } = await supabase
    .from("user_stats")
    .upsert({
      user_id: user.id,
      total_seconds: Math.floor(data.data.total_seconds),
      languages: data.data.languages,
      operating_systems: data.data.operating_systems,
      editors: data.data.editors,
      last_fetched_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: projectsResult, error: projectsError } = await supabase
    .from("user_projects")
    .upsert({
      user_id: user.id,
      projects: data.data.projects,
      last_fetched_at: new Date().toISOString(),
    })
    .select()
    .single();

  const mergedResult = {
    ...statsResult,
    projects: projectsResult?.projects || [],
  };

  return NextResponse.json({
    success: !!statsResult && !statsError && !projectsError,
    data: mergedResult,
    error: statsError || projectsError,
  });
}
