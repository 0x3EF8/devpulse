import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Member = {
  user_id: string;
  role: string;
  email: string;
  total_seconds: number;
  languages: { name: string }[];
  operating_systems: { name: string }[];
  editors: { name: string }[];
};

function LeaderboardStats({ members }: { members: Member[] }) {
  // Total coding time in hours
  const totalHours = Math.round(
    members.reduce((acc, m) => acc + (m.total_seconds || 0), 0) / 3600,
  );

  // Count languages, editors, OS
  const languageCount: Record<string, number> = {};
  const editorCount: Record<string, number> = {};
  const osCount: Record<string, number> = {};

  members.forEach((m) => {
    m.languages.forEach((l) => {
      languageCount[l.name] = (languageCount[l.name] || 0) + 1;
    });
    m.editors.forEach((e) => {
      editorCount[e.name] = (editorCount[e.name] || 0) + 1;
    });
    m.operating_systems.forEach((os) => {
      osCount[os.name] = (osCount[os.name] || 0) + 1;
    });
  });

  const languageEntries = Object.entries(languageCount).filter(
    ([_, count]) => count > 0,
  );
  const topLanguage =
    languageEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const leastLanguage =
    languageEntries.sort((a, b) => b[1] - a[1]).slice(-1)[0]?.[0] || "N/A";

  const topEditor =
    Object.entries(editorCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  const topOS =
    Object.entries(osCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 text-sm text-gray-400">
      <div className="bg-white/5 p-4 rounded-xl flex-1 text-center border border-white/10">
        <div className="font-bold text-yellow-300 text-lg">
          {totalHours} hrs
        </div>
        <div>Last 7 Days</div>
      </div>
      <div className="bg-white/5 p-4 rounded-xl flex-1 text-center border border-white/10">
        <div className="font-bold text-yellow-300 text-lg">{topLanguage}</div>
        <div>Top Language</div>
      </div>
      <div className="bg-white/5 p-4 rounded-xl flex-1 text-center border border-white/10">
        <div className="font-bold text-yellow-300 text-lg">{leastLanguage}</div>
        <div>Least Language</div>
      </div>
      <div className="bg-white/5 p-4 rounded-xl flex-1 text-center border border-white/10">
        <div className="font-bold text-yellow-300 text-lg">{topEditor}</div>
        <div>Top Editor</div>
      </div>
      <div className="bg-white/5 p-4 rounded-xl flex-1 text-center border border-white/10">
        <div className="font-bold text-yellow-300 text-lg">{topOS}</div>
        <div>Top OS</div>
      </div>
    </div>
  );
}

export default function LeaderboardTable({
  members,
  isOwner,
  ownerId,
}: {
  members: Member[];
  isOwner: boolean;
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
      languages: member.languages
        .slice(0, 3)
        .map((l) => l.name)
        .join(", "),
      os: member.operating_systems[0]?.name || "N/A",
      editor: member.editors[0]?.name || "N/A",
    }));

  return (
    <div>
      <LeaderboardStats members={members} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((user) => (
          <div
            key={user.email}
            className={`bg-white/5 border rounded-2xl p-5 min-w-0
              hover:bg-white/10 transition  ${user.user_id === ownerId ? "border-yellow-300" : "border-white/10"}`}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-bold text-indigo-400">
                #{user.rank}
              </span>

              <div>
                <span className="text-sm text-gray-400">{user.hours} hrs</span>
                {/*
                {isOwner && user.user_id !== ownerId && (
                  <button className="ml-2">
                    <FontAwesomeIcon
                      icon={faTrash}
                      className="text-red-500 ml-2 cursor-pointer hover:text-red-400 transition"
                    />
                  </button>
                )}*/}
              </div>
            </div>

            <p className="font-semibold text-white mb-4 truncate">
              {user.email}
            </p>

            <div className="space-y-1 text-sm text-gray-300">
              <p>
                <span className="text-gray-400">Languages:</span>{" "}
                {user.languages.length > 0 ? user.languages : "N/A"}
              </p>

              <p>
                <span className="text-gray-400">OS:</span> {user.os}
              </p>

              <p>
                <span className="text-gray-400">Editor:</span> {user.editor}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
