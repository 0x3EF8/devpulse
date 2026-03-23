import { User } from "@supabase/supabase-js";
import { Conversation } from "../Chat";

export default function Conversations({
  conversations,
  user,
  conversationId,
  setConversationId,
}: {
  conversations: Conversation[];
  user: User;
  conversationId: string | null;
  setConversationId: (id: string) => void;
}) {
  return (
    <>
      {conversations.map((conv, idx) => {
        const otherUser = conv.users.find((u) => u.id !== user.id);
        const isActive = conv.id === conversationId; // check active

        return (
          <div
            key={idx}
            onClick={() => setConversationId(conv.id)}
            className="flex flex-col items-center min-w-15 cursor-pointer"
          >
            <div
              className={`
                flex justify-center items-center w-10 h-10 rounded-full border border-white/10
                ${isActive ? "bg-indigo-500 text-white" : "bg-white/5 text-gray-300"}
              `}
            >
              {otherUser?.email[0]?.toUpperCase()}
            </div>
            <span
              className={`text-xs mt-1 ${isActive ? "text-white" : "text-gray-300"}`}
            >
              {(() => {
                const name = otherUser?.email?.split("@")[0] || "";
                return name.length > 10 ? name.slice(0, 8) + "..." : name;
              })()}
            </span>
          </div>
        );
      })}
    </>
  );
}
