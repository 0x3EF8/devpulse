import { createClient } from "../../../lib/supabase/server";
import LeaderboardTable from "../../../components/LeaderboardTable";
import LeaderboardHeader from "@/app/components/leaderboard/Header";

export default async function LeaderboardPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const supabase = await createClient();

  const { data: leaderboard } = await supabase
    .from("leaderboards")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!leaderboard) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Leaderboard not found {slug}
      </div>
    );
  }

  const { data: members, error } = await supabase
    .from("leaderboard_members_view")
    .select("*")
    .eq("leaderboard_id", leaderboard.id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user?.id === leaderboard.owner_id;

  if (error) {
    console.error("Error fetching members:", error);
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Error loading members.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-black text-white px-2 md:px-6 lg:px-10 py-2 md:py-6 lg:py-10">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-5xl mx-auto">
          <LeaderboardHeader leaderboard={leaderboard} isOwner={isOwner} />
        </div>
        <LeaderboardTable
          members={members || []}
          isOwner={isOwner}
          ownerId={user?.id}
        />
      </div>
    </div>
  );
}
