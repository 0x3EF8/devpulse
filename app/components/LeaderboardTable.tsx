import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCode,
  faTerminal,
  faServer,
  faBolt,
  faFire,
  faStar,
  faRocket,
  faTrophy,
  faGhost,
  faMedal,
  faCrown,
} from "@fortawesome/free-solid-svg-icons";
import { Database } from "../supabase-types";

type LeaderboardMembersRow =
  Database["public"]["Views"]["leaderboard_members_view"]["Row"];

// Supabase-generated types for views are always nullable
// due to the nature of views and
// conservative type generation.
export type NonNullableMember = Omit<
  LeaderboardMembersRow,
  | "user_id"
  | "role"
  | "email"
  | "total_seconds"
  | "languages"
  | "operating_systems"
  | "editors"
> & {
  user_id: string;
  role: string;
  email: string;
  total_seconds: number;
  languages: { name: string }[];
  operating_systems: { name: string }[];
  editors: { name: string }[];
};


const getBadgeInfo = (rank: number, hours: number) => {
  if (hours >= 160) return { label: "MISSION IMPOSSIBLE", class: "badge-impossible", icon: faGhost };
  if (hours >= 130) return { label: "GOD LEVEL", class: "badge-god", icon: faCrown };
  if (hours >= 100) return { label: "STARLIGHT", class: "badge-starlight", icon: faStar };
  if (hours >= 50) return { label: "ELITE", class: "badge-elite", icon: faFire };
  if (hours >= 20) return { label: "PRO", class: "badge-pro", icon: faBolt };
  if (hours >= 5) return { label: "NOVICE", class: "badge-novice", icon: faMedal };
  if (hours >= 1) return { label: "NEWBIE", class: "badge-newbie", icon: null };
  return { label: "", class: "hidden", icon: null }; // 0 hours
};

function LeaderboardPodium({ topUsers }: { topUsers: any[] }) {
  if (topUsers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
      {topUsers.map((user, idx) => {
        const rankColor =
          idx === 0
            ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]"
            : idx === 1
              ? "text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.4)]"
              : "text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]";
        
        const badgeInfo = getBadgeInfo(user.rank, user.hours);
        const initial = (user.email?.[0] || "?").toUpperCase();

        return (
          <div
            key={user.user_id}
            className="glass-card p-5 flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300"
          >
            {/* Minimal Background Glow based on rank */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 transition-transform group-hover:scale-125 duration-700 ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-300' : 'bg-amber-600'}`} />

            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl font-bold text-gray-200 shadow-inner relative">
                    {initial}
                  </div>
                  <div>
                    <div className="font-semibold text-white tracking-tight truncate max-w-[120px] sm:max-w-[140px]">
                      {user.email.split("@")[0]}
                    </div>
                    <div className={`mt-1.5 badge-base ${badgeInfo.class}`}>
                      {badgeInfo.icon && (
                        <FontAwesomeIcon icon={badgeInfo.icon} className="w-2.5 h-2.5" />
                      )}
                      {badgeInfo.label}
                    </div>
                  </div>
                </div>
                
                <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 backdrop-blur-md shadow-lg ${rankColor}`}>
                  <span className="text-xl font-black tracking-widest leading-none">
                    {idx === 0 ? "01" : idx === 1 ? "02" : "03"}
                  </span>
                </div>
              </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4 relative z-10">
              <div className="text-center flex flex-col justify-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">
                  Hours
                </span>
                <span className="text-lg font-bold text-white tracking-tighter">
                  {user.hours}
                </span>
              </div>
              <div className="text-center flex flex-col justify-center border-l border-white/5 pl-2">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">
                  Language
                </span>
                <span className="text-sm font-medium text-gray-300 truncate">
                  {user.languages?.[0] || "N/A"}
                </span>
              </div>
              <div className="text-center flex flex-col justify-center border-l border-white/5 pl-2">
                <span className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">
                  Editor
                </span>
                <span className="text-sm font-medium text-gray-300 truncate">
                  {user.editor || "N/A"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeaderboardTable({
  members,
  ownerId,
}: {
  members: NonNullableMember[];
  ownerId?: string;
}) {
  const ranked = members
    .sort((a, b) => (b.total_seconds || 0) - (a.total_seconds || 0))
    .map((member, index) => ({
      user_id: member.user_id,
      rank: index + 1,
      email: member.email,
      hours: Math.round((member.total_seconds || 0) / 3600),
      role: member.role,
      languages: (member.languages || []).slice(0, 3).map((l) => l.name),
      os: member.operating_systems?.[0]?.name || "N/A",
      editor: member.editors?.[0]?.name || "N/A",
    }));

  const maxHours = ranked[0]?.hours || 1;
  const formatRank = (rank: number) => rank.toString().padStart(2, "0");

  const getRankColor = (rank: number) => {
    if (rank === 1)
      return "text-yellow-400 font-bold drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]";
    if (rank === 2) return "text-gray-300 font-bold";
    if (rank === 3) return "text-amber-600 font-bold";
    return "text-gray-600 font-medium";
  };

  return (
    <div className="w-full">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shimmer-bg {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .badge-base {
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.5rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          line-height: normal;
        }
        .badge-impossible {
          background: linear-gradient(90deg, rgba(255,0,102,0.15) 0%, rgba(255,51,153,0.8) 50%, rgba(255,0,102,0.15) 100%);
          background-size: 200% auto;
          animation: pulse-glow 1.5s infinite, shimmer-bg 1.5s linear infinite;
          border: 1px solid rgba(255,0,102,0.8);
          color: #ff99cc;
          box-shadow: 0 0 15px rgba(255,0,102,0.6);
        }
        .badge-god {
          background: linear-gradient(90deg, rgba(217,70,239,0.15) 0%, rgba(232,121,249,0.6) 50%, rgba(217,70,239,0.15) 100%);
          background-size: 200% auto;
          animation: shimmer-bg 2s linear infinite, glow-pulse 2s alternate infinite;
          border: 1px solid rgba(217,70,239,0.6);
          color: #f0abfc;
          box-shadow: 0 0 10px rgba(217,70,239,0.4);
        }
        .badge-starlight {
          background: linear-gradient(90deg, rgba(56,189,248,0.15) 0%, rgba(125,211,252,0.6) 50%, rgba(56,189,248,0.15) 100%);
          background-size: 200% auto;
          animation: shimmer-bg 2.5s linear infinite;
          border: 1px solid rgba(56,189,248,0.5);
          color: #bae6fd;
          box-shadow: 0 0 10px rgba(56,189,248,0.3);
        }
        .badge-elite {
          background: linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(248,113,113,0.6) 50%, rgba(239,68,68,0.15) 100%);
          background-size: 200% auto;
          animation: shimmer-bg 3s linear infinite;
          border: 1px solid rgba(239,68,68,0.5);
          color: #fca5a5;
          box-shadow: 0 0 10px rgba(239,68,68,0.3);
        }
        .badge-pro {
          background: linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(253,224,71,0.5) 50%, rgba(234,179,8,0.15) 100%);
          background-size: 200% auto;
          animation: shimmer-bg 4s linear infinite;
          border: 1px solid rgba(234,179,8,0.5);
          color: #fef08a;
          box-shadow: 0 0 10px rgba(234,179,8,0.2);
        }
        .badge-master {
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.4);
          color: #a5b4fc;
        }
        .badge-hustler {
          background: rgba(59,130,246,0.15);
          border: 1px solid rgba(59,130,246,0.4);
          color: #93c5fd;
        }
        .badge-novice {
          background: linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(52,211,153,0.3) 50%, rgba(16,185,129,0.1) 100%);
          background-size: 200% auto;
          animation: shimmer-bg 5s linear infinite;
          border: 1px solid rgba(16,185,129,0.4);
          color: #6ee7b7;
        }
        .badge-newbie {
          background: rgba(107,114,128,0.15);
          border: 1px solid rgba(107,114,128,0.4);
          color: #d1d5db;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255,0,102,0.6); }
          50% { box-shadow: 0 0 25px rgba(255,0,102,1); }
        }
        @keyframes glow-pulse {
          0% { box-shadow: 0 0 5px rgba(217,70,239,0.4); }
          100% { box-shadow: 0 0 15px rgba(217,70,239,0.8); }
        }
      `,
        }}
      />
      
      <LeaderboardPodium topUsers={ranked.slice(0, 3)} />

      {ranked.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-gray-500 tracking-tight font-medium">
            No tracking data available yet.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Header Row (Desktop) */}
          <div className="hidden md:flex items-center px-4 sm:px-6 py-4 border-b border-white/5 bg-white/[0.01] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="w-12 shrink-0 text-center">Rank</div>
            <div className="flex-1 ml-4">Developer</div>
            <div className="w-48 lg:w-72 xl:w-80">Language</div>
              <div className="w-32 lg:w-48">Editor</div>
            <div className="w-24 text-right">Hours</div>
          </div>

          {/* List Body */}
          <div className="flex flex-col divide-y divide-white/5">
            {ranked.slice(3).map((user) => {
              const isCurrentUser = user.user_id === ownerId;
              const pct = Math.max(2, (user.hours / maxHours) * 100);
              const badgeInfo = getBadgeInfo(user.rank, user.hours);

              return (
                <div
                  key={user.user_id}
                  className={`group relative flex flex-col md:flex-row items-start md:items-center px-4 sm:px-6 py-4 md:py-4 transition-colors hover:bg-white/[0.02] ${
                    isCurrentUser ? "bg-indigo-500/[0.02]" : "bg-transparent"
                  }`}
                >
                  {/* Background Progress Bar */}
                  <div
                    className="absolute left-0 bottom-0 h-[1px] bg-gradient-to-r from-indigo-500/50 to-transparent"
                    style={{ width: `${pct}%` }}
                  />
                  {isCurrentUser && (
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-indigo-500" />
                  )}

                  {/* MOBILE TOP ROW / DESKTOP LEFT FLEX */}
                  <div className="flex items-center w-full md:w-auto md:flex-1 min-w-0">
                    {/* Rank */}
                    <div className="w-8 sm:w-12 shrink-0 text-center flex items-center justify-center">
                      <span
                        className={`font-mono text-lg sm:text-xl tracking-tighter ${getRankColor(user.rank)}`}
                      >
                        {formatRank(user.rank)}
                      </span>
                    </div>

                    {/* Profile + Badges */}
                    <div className="flex-1 ml-3 sm:ml-4 min-w-0 flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-[10px] sm:text-sm font-semibold text-gray-300 shadow-sm uppercase">
                        {user.email.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0 gap-1 sm:gap-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-200 tracking-tight text-sm sm:text-[15px] truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[180px] lg:max-w-[200px] leading-none">
                            {user.email.split("@")[0]}
                          </p>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest leading-none">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center">
                          <div className={`badge-base ${badgeInfo.class}`}>
                            {badgeInfo.icon && (
                              <FontAwesomeIcon
                                icon={badgeInfo.icon}
                                className="w-2 h-2"
                              />
                            )}
                            {badgeInfo.label}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Score */}
                    <div className="md:hidden shrink-0 ml-3 flex flex-col items-end justify-center">
                      <p className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">
                        {user.hours}
                      </p>
                      <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">
                        hrs
                      </span>
                    </div>
                  </div>

                  {/* MOBILE BOTTOM STACK / DESKTOP RIGHT ROW */}
                  <div className="flex flex-col md:flex-row items-start md:items-center w-full md:w-auto mt-4 md:mt-0 pl-[2.75rem] sm:pl-[4.25rem] md:pl-0 gap-2.5 md:gap-0">
                      {/* Language */}
                    <div className="flex flex-wrap items-center gap-1.5 w-full md:w-48 lg:w-72 xl:w-80 md:shrink-0 md:pr-4">
                      {user.languages.length > 0 ? (
                        user.languages.map((lang, i) => (
                          <span
                            key={i}
                            className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white/[0.03] border border-white/5 text-[9px] sm:text-[10px] text-gray-300 font-medium tracking-wide truncate max-w-[70px] sm:max-w-[80px]"
                          >
                            {lang}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] sm:text-xs text-gray-600">
                          No stack tracked
                        </span>
                      )}
                    </div>

                      {/* Editor */}
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-32 lg:w-48 md:shrink-0">
                      {user.editor !== "N/A" && (
                        <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate max-w-[70px] lg:max-w-[90px]">
                          {user.editor}
                        </span>
                      )}
                      {user.editor !== "N/A" && user.os !== "N/A" && (
                        <span className="w-[3px] h-[3px] rounded-full bg-gray-600 shrink-0"></span>
                      )}
                      {user.os !== "N/A" && (
                        <span className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate max-w-[70px] lg:max-w-[90px]">
                          {user.os}
                        </span>
                      )}
                    </div>

                    {/* Score (Desktop) */}
                    <div className="hidden md:flex w-24 shrink-0 justify-end items-baseline">
                      <p className="text-2xl font-bold tracking-tight text-white leading-none">
                        {user.hours}
                      </p>
                      <span className="text-xs text-gray-500 font-medium ml-1.5 tracking-normal">
                        hrs
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
