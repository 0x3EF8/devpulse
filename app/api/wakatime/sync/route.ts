import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getUserWithProfile } from "@/app/lib/supabase/help/user";

function formatDateYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

type DailyStat = {
  date: string;
  total_seconds: number;
};

function buildSnapshotMetrics(dailyStats: DailyStat[]) {
  const normalized = [...dailyStats]
    .map((entry) => ({
      date: toDateKey(entry.date),
      total_seconds: Math.max(0, Math.floor(entry.total_seconds || 0)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const last7 = normalized.slice(-7);
  const totalSeconds7d = last7.reduce((sum, day) => sum + day.total_seconds, 0);
  const activeDays7d = last7.filter((day) => day.total_seconds > 0).length;

  const activeByDay = normalized.map((day) => day.total_seconds > 0);
  const activeDays = activeByDay.filter(Boolean).length;
  const consistencyPercent =
    normalized.length > 0
      ? Math.round((activeDays / normalized.length) * 100)
      : 0;

  let bestStreak = 0;
  let runningStreak = 0;
  for (const isActive of activeByDay) {
    runningStreak = isActive ? runningStreak + 1 : 0;
    if (runningStreak > bestStreak) bestStreak = runningStreak;
  }

  let currentStreak = 0;
  for (let i = activeByDay.length - 1; i >= 0; i -= 1) {
    if (!activeByDay[i]) break;
    currentStreak += 1;
  }

  const peakDay = last7.reduce(
    (max, day) => (day.total_seconds > max.total_seconds ? day : max),
    { date: "", total_seconds: 0 },
  );

  return {
    totalSeconds7d,
    activeDays7d,
    consistencyPercent,
    currentStreak,
    bestStreak,
    peakDayDate: peakDay.date || null,
    peakDaySeconds: peakDay.total_seconds,
  };
}

export async function GET(request: Request) {
  const CONSISTENCY_DAYS = 365;
  const supabase = await createClient();
  const { user, profile } = await getUserWithProfile();
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

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!apiKey) {
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
    const existingDailyStats = Array.isArray(existing?.daily_stats)
      ? existing.daily_stats
      : [];

    if (existing?.last_fetched_at) {
      const lastFetch = new Date(existing.last_fetched_at).getTime();
      if (
        now.getTime() - lastFetch < sixHours &&
        existingDailyStats.length >= CONSISTENCY_DAYS
      ) {
        return NextResponse.json({ success: true, data: existing });
      }
    }
  }

  // Fetch from WakaTime API endpoints
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(endDate.getDate() - (CONSISTENCY_DAYS - 1));
  const endStr = formatDateYMD(endDate);
  const startStr = formatDateYMD(startDate);

  const authHeader = `Basic ${Buffer.from(profile$.wakatime_api_key).toString("base64")}`;

  const [statsResponse, summariesResponse] = await Promise.all([
    fetch("https://wakatime.com/api/v1/users/current/stats/last_7_days", {
      headers: { Authorization: authHeader },
    }),
    fetch(
      `https://wakatime.com/api/v1/users/current/summaries?start=${startStr}&end=${endStr}`,
      {
        headers: { Authorization: authHeader },
      },
    ),
  ]);

  const statsData = await statsResponse.json();
  const summariesData = await summariesResponse.json();

  if (!statsResponse.ok || !summariesResponse.ok) {
    return NextResponse.json(
      { error: "Failed to fetch data from WakaTime" },
      { status: 500 },
    );
  }

  const wakaStats = statsData.data;
  const wakaSummaries = summariesData.data;

  // Process daily summaries
  const daily_stats = wakaSummaries.map(
    (day: {
      range: { date: string };
      grand_total: { total_seconds: number };
    }) => ({
      date: toDateKey(day.range.date),
      total_seconds: Math.floor(day.grand_total.total_seconds || 0),
    }),
  );

  const snapshotMetrics = buildSnapshotMetrics(daily_stats);
  const topLanguage =
    Array.isArray(wakaStats.languages) && wakaStats.languages.length > 0
      ? wakaStats.languages[0]
      : null;

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

  const [
    { data: statsResult, error: statsError },
    { data: projectsResult, error: projectsError },
  ] = await Promise.all([
    supabase
      .from("user_stats")
      .upsert({
        user_id: user.id,
        total_seconds: Math.floor(wakaStats.total_seconds),
        daily_average: Math.floor(wakaStats.daily_average || 0),
        languages: wakaStats.languages,
        operating_systems: wakaStats.operating_systems,
        editors: wakaStats.editors,
        machines: wakaStats.machines,
        categories: wakaStats.categories,
        dependencies: wakaStats.dependencies || [],
        best_day: wakaStats.best_day || {},
        daily_stats: daily_stats,
        last_fetched_at: new Date().toISOString(),
      })
      .select()
      .single(),
    supabase
      .from("user_projects")
      .upsert({
        user_id: user.id,
        projects: wakaStats.projects,
        last_fetched_at: new Date().toISOString(),
      })
      .select()
      .single(),
  ]);

  const mergedResult = {
    ...statsResult,
    projects: projectsResult?.projects || [],
  };

  const { error: snapshotError } = await supabase
    .from("user_dashboard_snapshots")
    .upsert(
      {
        user_id: user.id,
        snapshot_date: endStr,
        total_seconds_7d: snapshotMetrics.totalSeconds7d,
        active_days_7d: snapshotMetrics.activeDays7d,
        consistency_percent: snapshotMetrics.consistencyPercent,
        current_streak: snapshotMetrics.currentStreak,
        best_streak: snapshotMetrics.bestStreak,
        peak_day: snapshotMetrics.peakDayDate,
        peak_day_seconds: snapshotMetrics.peakDaySeconds,
        top_language: topLanguage?.name || null,
        top_language_percent:
          typeof topLanguage?.percent === "number"
            ? Number(topLanguage.percent.toFixed(2))
            : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,snapshot_date",
      },
    );

  if (snapshotError) {
    console.error("Failed to upsert user dashboard snapshot", snapshotError);
  }

  return NextResponse.json({
    success: !!statsResult && !statsError && !projectsError,
    data: mergedResult,
    error: statsError || projectsError,
  });
}
