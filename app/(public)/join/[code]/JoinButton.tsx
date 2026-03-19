"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Link from "next/link";

export default function JoinButton({
  code,
  leaderboardSlug,
  isLoggedIn,
  alreadyMember,
}: {
  code: string;
  leaderboardSlug: string;
  isLoggedIn: boolean;
  alreadyMember: boolean;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  if (alreadyMember) {
    return (
      <Link
        href={`/leaderboard/${leaderboardSlug}`}
        className="btn-primary inline-flex items-center justify-center gap-2 w-full py-4 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Already a Member &mdash; View Leaderboard
      </Link>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <Link
          href={`/login?redirect=${encodeURIComponent(`/join?id=${code}`)}`}
          className="btn-primary inline-flex items-center justify-center gap-2 w-full py-4 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Log In to Join
        </Link>
        <p className="text-xs text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href={`/signup?redirect=${encodeURIComponent(`/join?id=${code}`)}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign up free
          </Link>
        </p>
      </div>
    );
  }

  const handleJoin = async () => {
    setJoining(true);
    const supabase = createClient();

    const joinPromise = (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not authenticated");

      const { data: board } = await supabase
        .from("leaderboards")
        .select("id")
        .eq("join_code", code)
        .single();

      if (!board) throw new Error("Invalid invite code");

      const { error } = await supabase.from("leaderboard_members").insert({
        leaderboard_id: board.id,
        user_id: user.id,
      });

      if (error) throw error;
      return board;
    })();

    try {
      await toast.promise(joinPromise, {
        pending: "Joining leaderboard...",
        success: "You're in! Welcome to the leaderboard.",
        error: {
          render({ data }) {
            const err = data as Error;
            if (err?.code === "23505") {
              return "You are already a member of this leaderboard.";
            }
            return err?.message || "Failed to join. Please try again.";
          },
        },
      });

      router.push(`/leaderboard/${leaderboardSlug}`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <button
      onClick={handleJoin}
      disabled={joining}
      className="btn-primary inline-flex items-center justify-center gap-2 w-full py-4 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {joining ? (
        <>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Joining...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Accept Invite &amp; Join
        </>
      )}
    </button>
  );
}
