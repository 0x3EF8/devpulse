"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareNodes } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";

export default function InviteFriendsButton() {
  const handleInvite = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Leaderboard link copied to clipboard!");
    }
  };

  return (
    <button
      onClick={handleInvite}
      className="flex items-center gap-2 text-sm font-medium bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg transition-all"
    >
      <FontAwesomeIcon icon={faShareNodes} className="w-4 h-4" />
      Invite Friends
    </button>
  );
}
