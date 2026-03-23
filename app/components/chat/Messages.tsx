"use client";

import { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Conversation, Message } from "../Chat";
import { timeAgo } from "@/app/utils/time";
import { useEffect, useState } from "react";

export default function Messages({
  messages,
  user,
  conversations,
  bottomRef,
}: {
  messages: Message[];
  user: User;
  conversations: Conversation[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    const container = document.getElementById("chat-container");

    if (!container) return;

    const handleScroll = () => {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

      setShowScrollBtn(!isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" id="chat-container">
        {showScrollBtn && (
          <button
            onClick={() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="fixed right-4 top-1/2 -translate-y-1/2 z-50
                       bg-white/10 hover:bg-white/20
                       backdrop-blur-md border border-white/10
                       text-white rounded-full p-3 shadow-lg transition"
          >
            ↓
          </button>
        )}

        {messages.length === 0 && (
          <div className="text-gray-500 text-sm italic text-center mt-10">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-end gap-2 ${
              msg.sender_id === user.id ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender_id !== user.id && (
              <div className="mb-5 flex justify-center items-center w-8 h-8 rounded-full bg-neutral-600">
                {conversations
                  .find((conv) => conv.id === msg.conversation_id)
                  ?.users.find((u) => u.id === msg.sender_id)
                  ?.email[0].toUpperCase()}
              </div>
            )}
            <div>
              <div
                className={`px-4 py-2 rounded-2xl max-w-xs overflow-hidden ${
                  msg.sender_id === user.id ? "bg-indigo-500" : "bg-neutral-700"
                }`}
              >
                {/*{msg.text}*/}
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");

                      return (
                        <>
                          {}

                          <SyntaxHighlighter
                            style={
                              atomDark as { [key: string]: React.CSSProperties }
                            }
                            language={match ? match[1] : "text"}
                            PreTag="pre"
                            className="rounded-md text-sm"
                            {...(props as Record<string, unknown>)}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </>
                      );
                    },
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>

              <div className="text-muted text-xs mt-1">
                {timeAgo(msg.created_at)}
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </>
  );
}
