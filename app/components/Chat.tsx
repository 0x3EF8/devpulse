"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faFile,
  faPaperPlane,
  faPlus,
  faSearch,
  faGhost,
  faCrown,
  faStar,
  faFire,
  faBolt,
  faSeedling,
  faMedal,
  faMinus,
  faInfoCircle,
  faBellSlash,
  faChevronDown,
  faChevronUp,
  faXmark,
  faChevronLeft,
  faChevronRight,
  faTrash,
  faDownload,
  faPlay
} from "@fortawesome/free-solid-svg-icons";
import Conversations from "./chat/Conversations";
import Messages from "./chat/Messages";
import Player from "./chat/Player";
import { createPortal } from "react-dom";
import Image from "next/image";
import { toast } from "react-toastify";

export interface Conversation {
  id: string;
  users: { id: string; email: string }[];
  type: string;
  created_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  attachments: {
    filename: string;
    mimetype: string;
    filesize: number;
    public_url: string;
  }[];
  created_at: string;
  optimistic?: boolean;
}

export interface ChatUser {
  user_id: string;
  email: string;
}

export interface ConversationParticipant {
  id: string;
  users: {
    user_id: string;
  }[];
}

export interface ConversationParticipantRow {
  email: string;
  conversation: ConversationParticipant[];
}

interface ParticipantPresence {
  last_seen_at: string | null;
  last_read_at: string | null;
}

interface ConversationUserRow {
  user_id: string;
  email: string | null;
  last_seen_at: string | null;
}

interface ConversationRowWithParticipants {
  id: string;
  created_at: string;
  type: string;
  users: ConversationUserRow[];
}

interface ConversationParticipantWithConversationRow {
  conversation_id: string;
  last_seen_at: string | null;
  last_read_at: string | null;
  conversation:
    | ConversationRowWithParticipants
    | ConversationRowWithParticipants[]
    | null;
}

export interface TypingState {
  user_id: string;
  label: string;
}

const GLOBAL_CONVERSATION_ID = "00000000-0000-0000-0000-000000000001";
const ONLINE_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_PRESENCE_FUTURE_SKEW_MS = 30_000;
const PRESENCE_HEARTBEAT_MS = 45_000;
const READ_RECEIPT_THROTTLE_MS = 1_500;
const TYPING_INACTIVE_TIMEOUT_MS = 1_800;
const TYPING_REMOTE_EXPIRE_MS = 2_500;
const PRESENCE_UNSEEN_AT_ISO = "1970-01-01T00:00:00.000Z";

const getAttachmentFingerprint = (attachments: Message["attachments"] = []) =>
  attachments
    .map((attachment) => {
      const filename = attachment?.filename ?? "";
      const mimetype = attachment?.mimetype ?? "";
      const filesize = String(attachment?.filesize ?? 0);
      const publicUrl = attachment?.public_url ?? "";
      return `${filename}|${mimetype}|${filesize}|${publicUrl}`;
    })
    .join("::");

type Attachment = File;

const supabase = createClient();

export default function Chat({ user }: { user: User }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [badgesByUserId, setBadgesByUserId] = useState<
    Record<string, { label: string; className: string; icon?: IconDefinition }>
  >({});
  const [unreadCountByConversationId, setUnreadCountByConversationId] = useState<
    Record<string, number>
  >({});
  const [, setParticipantMetaByConversationId] = useState<
    Record<string, ParticipantPresence>
  >({});
  const [lastSeenByUserId, setLastSeenByUserId] = useState<
    Record<string, string | null>
  >({});
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const badgeCacheRef = useRef<
    Record<string, { label: string; className: string; icon?: IconDefinition }>
  >({});
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const activeConversationIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [badWords, setBadWords] = useState<string[]>([]);
  const [dmSortOrder, setDmSortOrder] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [isDmSortOpen, setIsDmSortOpen] = useState(false);
  const creatingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{
    type: "image" | "video";
    url: string;
    filename: string;
  } | null>(null);
  const lastReadSyncAtRef = useRef<Record<string, number>>({});
  const [typingByConversationId, setTypingByConversationId] = useState<
    Record<string, TypingState>
  >({});
  const typingStopTimeoutRef = useRef<Record<string, number>>({});
  const typingExpiryTimeoutRef = useRef<Record<string, number>>({});
  const localTypingByConversationRef = useRef<Record<string, boolean>>({});

  const clearAllTypingTimers = useCallback(() => {
    Object.values(typingStopTimeoutRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    Object.values(typingExpiryTimeoutRef.current).forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    typingStopTimeoutRef.current = {};
    typingExpiryTimeoutRef.current = {};
  }, []);

  useEffect(() => {
    return clearAllTypingTimers;
  }, [clearAllTypingTimers]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((conv) => conv.id));
  }, [conversations]);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  const handleDownloadMedia = async () => {
    if (!mediaViewer) return;
    try {
      const res = await fetch(mediaViewer.url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = mediaViewer.filename || "media";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Media download failed:", err);
      window.open(mediaViewer.url, "_blank", "noopener,noreferrer");
    }
  };

  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME || "";

  const ensureGlobalConversationMembership = useCallback(async () => {
    if (!user.id) return;

    const timestamp = new Date().toISOString();

    const { error: conversationError } = await supabase
      .from("conversations")
      .upsert(
        {
          id: GLOBAL_CONVERSATION_ID,
          type: "global",
        },
        {
          onConflict: "id",
        },
      );

    if (conversationError) {
      console.error("Failed to ensure global conversation:", conversationError);
    }

    const { error: participantError } = await supabase
      .from("conversation_participants")
      .upsert(
        {
          conversation_id: GLOBAL_CONVERSATION_ID,
          user_id: user.id,
          email: user.email ?? "",
          last_seen_at: timestamp,
          last_read_at: timestamp,
        },
        {
          onConflict: "conversation_id,user_id",
        },
      );

    if (participantError) {
      console.error("Failed to ensure global conversation membership:", participantError);
    }
  }, [user.email, user.id]);

  const setRemoteTypingState = useCallback(
    (targetConversationId: string, state: TypingState | null) => {
      const activeTimeoutId = typingExpiryTimeoutRef.current[targetConversationId];
      if (activeTimeoutId) {
        window.clearTimeout(activeTimeoutId);
        delete typingExpiryTimeoutRef.current[targetConversationId];
      }

      if (!state) {
        setTypingByConversationId((prev) => {
          if (!prev[targetConversationId]) return prev;
          const next = { ...prev };
          delete next[targetConversationId];
          return next;
        });
        return;
      }

      setTypingByConversationId((prev) => ({
        ...prev,
        [targetConversationId]: state,
      }));

      typingExpiryTimeoutRef.current[targetConversationId] = window.setTimeout(() => {
        setTypingByConversationId((prev) => {
          if (!prev[targetConversationId]) return prev;
          const next = { ...prev };
          delete next[targetConversationId];
          return next;
        });
      }, TYPING_REMOTE_EXPIRE_MS);
    },
    [],
  );

  const emitTypingState = useCallback(
    (targetConversationId: string, isTyping: boolean) => {
      if (!targetConversationId) return;
      const channel = channelRef.current;
      if (!channel) return;

      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          conversation_id: targetConversationId,
          user_id: user.id,
          email: user.email ?? "",
          is_typing: isTyping,
        },
      });
    },
    [user.email, user.id],
  );

  const stopTyping = useCallback(
    (targetConversationId: string) => {
      if (!targetConversationId) return;

      const activeTimeoutId = typingStopTimeoutRef.current[targetConversationId];
      if (activeTimeoutId) {
        window.clearTimeout(activeTimeoutId);
        delete typingStopTimeoutRef.current[targetConversationId];
      }

      if (!localTypingByConversationRef.current[targetConversationId]) return;

      localTypingByConversationRef.current[targetConversationId] = false;
      emitTypingState(targetConversationId, false);
    },
    [emitTypingState],
  );

  const markTypingFromInput = useCallback(
    (targetConversationId: string, nextValue: string) => {
      if (!targetConversationId) return;

      const hasText = nextValue.trim().length > 0;
      if (!hasText) {
        stopTyping(targetConversationId);
        return;
      }

      if (!localTypingByConversationRef.current[targetConversationId]) {
        localTypingByConversationRef.current[targetConversationId] = true;
        emitTypingState(targetConversationId, true);
      }

      const activeTimeoutId = typingStopTimeoutRef.current[targetConversationId];
      if (activeTimeoutId) {
        window.clearTimeout(activeTimeoutId);
      }

      typingStopTimeoutRef.current[targetConversationId] = window.setTimeout(() => {
        stopTyping(targetConversationId);
      }, TYPING_INACTIVE_TIMEOUT_MS);
    },
    [emitTypingState, stopTyping],
  );

  const fetchUnreadCountsForConversations = useCallback(
    async (
      targetConversationIds: string[],
      readMap: Record<string, string | null>,
      mode: "replace" | "merge" = "replace",
    ) => {
      if (targetConversationIds.length === 0) {
        if (mode === "replace") {
          setUnreadCountByConversationId({});
        }
        return;
      }

      const countEntries = await Promise.all(
        targetConversationIds.map(async (targetConversationId) => {
          let query = supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", targetConversationId)
            .neq("sender_id", user.id);

          const lastReadAt = readMap[targetConversationId];
          if (lastReadAt) {
            query = query.gt("created_at", lastReadAt);
          }

          const { count } = await query;
          return [targetConversationId, count ?? 0] as const;
        }),
      );

      const nextCounts = Object.fromEntries(countEntries);

      setUnreadCountByConversationId((prev) =>
        mode === "replace" ? nextCounts : { ...prev, ...nextCounts },
      );
    },
    [user.id],
  );

  const markConversationAsRead = useCallback(
    async (targetConversationId: string) => {
      if (!targetConversationId) return;

      const timestamp = new Date().toISOString();

      setParticipantMetaByConversationId((prev) => ({
        ...prev,
        [targetConversationId]: {
          last_seen_at: timestamp,
          last_read_at: timestamp,
        },
      }));
      setUnreadCountByConversationId((prev) => ({
        ...prev,
        [targetConversationId]: 0,
      }));

      const now = Date.now();
      const lastSyncAt = lastReadSyncAtRef.current[targetConversationId] ?? 0;
      if (now - lastSyncAt < READ_RECEIPT_THROTTLE_MS) {
        return;
      }
      lastReadSyncAtRef.current[targetConversationId] = now;

      const { error } = await supabase
        .from("conversation_participants")
        .update({
          last_seen_at: timestamp,
          last_read_at: timestamp,
        })
        .eq("conversation_id", targetConversationId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to mark conversation as read:", error);
      }
    },
    [user.id],
  );

  const pingPresence = useCallback(async () => {
    const timestamp = new Date().toISOString();

    const { error } = await supabase
      .from("conversation_participants")
      .update({ last_seen_at: timestamp })
      .eq("user_id", user.id);

    if (error) {
      console.error("Presence ping failed:", error);
    }
  }, [user.id]);

  const onlineByUserId = useMemo(() => {
    const next: Record<string, boolean> = {};

    Object.entries(lastSeenByUserId).forEach(([targetUserId, lastSeenAt]) => {
      if (!lastSeenAt) {
        next[targetUserId] = false;
        return;
      }

      const seenAt = new Date(lastSeenAt).getTime();
      const ageMs = presenceNow - seenAt;

      next[targetUserId] =
        Number.isFinite(seenAt) &&
        ageMs >= -MAX_PRESENCE_FUTURE_SKEW_MS &&
        ageMs <= ONLINE_TIMEOUT_MS;
    });

    return next;
  }, [lastSeenByUserId, presenceNow]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCountByConversationId).reduce((sum, count) => sum + count, 0),
    [unreadCountByConversationId],
  );

  const globalConversations = conversations.filter((c) => c.type === "global");
  const privateConversations = conversations
    .filter((c) => c.type !== "global")
    .sort((a, b) => {
      if (dmSortOrder === "newest") {
        return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
      }
      if (dmSortOrder === "oldest") {
        return (a.created_at ? new Date(a.created_at).getTime() : 0) - (b.created_at ? new Date(b.created_at).getTime() : 0);
      }
      
      const aName = a.users.find((u) => u.id !== user.id)?.email?.split("@")[0] || "";
      const bName = b.users.find((u) => u.id !== user.id)?.email?.split("@")[0] || "";
      
      if (dmSortOrder === "az") {
        return aName.localeCompare(bName);
      }
      if (dmSortOrder === "za") {
        return bName.localeCompare(aName);
      }
      return 0;
    });

  const getBadgeInfoFromHours = (hours: number) => {
    if (hours >= 160) return { label: "MISSION IMPOSSIBLE", className: "badge-impossible", icon: faGhost };
    if (hours >= 130) return { label: "GOD LEVEL", className: "badge-god", icon: faCrown };
    if (hours >= 100) return { label: "STARLIGHT", className: "badge-starlight", icon: faStar };
    if (hours >= 50) return { label: "ELITE", className: "badge-elite", icon: faFire };
    if (hours >= 20) return { label: "PRO", className: "badge-pro", icon: faBolt };
    if (hours >= 5) return { label: "NOVICE", className: "badge-novice", icon: faMedal };
    if (hours >= 1) return { label: "NEWBIE", className: "badge-newbie", icon: faSeedling };
    return { label: "NONE", className: "badge-none", icon: faMinus };
  };

  useEffect(() => {
    const fetchBadgesForParticipants = async () => {
      if (!conversations.length) return;

      const participantIds = new Set<string>();
      conversations.forEach((c) => {
        c.users.forEach((u) => {
          if (u.id) participantIds.add(u.id);
        });
      });
      participantIds.add(user.id);

      const ids = Array.from(participantIds).filter(Boolean);
      if (ids.length === 0) return;

      const cached: Record<string, { label: string; className: string; icon?: IconDefinition }> = {};
      const missingIds: string[] = [];
      ids.forEach((id) => {
        const hit = badgeCacheRef.current[id];
        if (hit) cached[id] = hit;
        else missingIds.push(id);
      });

      if (Object.keys(cached).length > 0) {
        setBadgesByUserId((prev) => ({ ...prev, ...cached }));
      }

      if (missingIds.length === 0) return;

      const { data } = await supabase
        .from("top_user_stats")
        .select("user_id, email, total_seconds")
        .in("user_id", missingIds);

      if (!data) return;

      const next: Record<string, { label: string; className: string; icon?: IconDefinition }> = {};
      for (const row of data) {
        if (!row.user_id || row.total_seconds === null) continue;
        const hours = Math.round((row.total_seconds || 0) / 3600);
        const badge = getBadgeInfoFromHours(hours);
        next[row.user_id] = { label: badge.label, className: badge.className, icon: badge.icon };
      }

      badgeCacheRef.current = { ...badgeCacheRef.current, ...next };
      setBadgesByUserId((prev) => ({ ...prev, ...next }));
    };

    fetchBadgesForParticipants();
  }, [conversations, user.id]);

  useEffect(() => {
    fetch(
      "https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/refs/heads/master/en",
    )
      .then((res) => res.text())
      .then((text) => {
        const wordsArray = text.split("\n").filter(Boolean);
        setBadWords(wordsArray);
      });
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current;
      const minHeight = 20;
      const maxHeight = minHeight * 6;
      el.style.height = `${minHeight}px`;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  useEffect(() => {
    if (!user.id) return;

    setPresenceNow(Date.now());
    void pingPresence();

    const intervalId = window.setInterval(() => {
      setPresenceNow(Date.now());
      if (document.visibilityState === "visible") {
        void pingPresence();
      }
    }, PRESENCE_HEARTBEAT_MS);

    const handleForeground = () => {
      setPresenceNow(Date.now());
      if (document.visibilityState === "visible") {
        void pingPresence();
      }
    };

    window.addEventListener("focus", handleForeground);
    document.addEventListener("visibilitychange", handleForeground);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleForeground);
      document.removeEventListener("visibilitychange", handleForeground);
    };
  }, [pingPresence, user.id]);

  useEffect(() => {
    const fetchConversations = async () => {
      await ensureGlobalConversationMembership();

      const { data } = await supabase
        .from("conversation_participants")
        .select(
          `
          conversation_id,
          last_read_at,
          last_seen_at,
          conversation: conversations(
            id,
            created_at,
            users: conversation_participants!inner(user_id, email, last_seen_at),
            type
          )
          `,
        )
        .eq("user_id", user.id);

      if (data) {
        const participantRows =
          (data as ConversationParticipantWithConversationRow[]) ?? [];
        const convs: Conversation[] = [];
        const nextParticipantMeta: Record<string, ParticipantPresence> = {};
        const nextLastSeenByUserId: Record<string, string | null> = {};
        const readMap: Record<string, string | null> = {};

        participantRows.forEach((row) => {
          const convo = Array.isArray(row.conversation)
            ? row.conversation[0]
            : row.conversation;

          if (!convo) return;

          convs.push({
            id: convo.id,
            created_at: convo.created_at,
            users: convo.users.map((u: ConversationUserRow) => ({
              id: u.user_id,
              email: u.email ?? "",
            })),
            type: convo.type,
          });

          nextParticipantMeta[row.conversation_id] = {
            last_seen_at: row.last_seen_at ?? null,
            last_read_at: row.last_read_at ?? null,
          };
          readMap[row.conversation_id] = row.last_read_at ?? null;

          convo.users.forEach((participant) => {
            if (!participant.user_id || participant.user_id === user.id) return;

            const previous = nextLastSeenByUserId[participant.user_id];
            const incoming = participant.last_seen_at ?? null;

            if (!previous) {
              nextLastSeenByUserId[participant.user_id] = incoming;
              return;
            }

            if (!incoming) return;

            if (new Date(incoming).getTime() > new Date(previous).getTime()) {
              nextLastSeenByUserId[participant.user_id] = incoming;
            }
          });
        });

        const sortedConvs = convs.sort((a, b) =>
          a.type === "global" ? -1 : b.type === "global" ? 1 : 0,
        );
        setConversations(sortedConvs);
        setParticipantMetaByConversationId(nextParticipantMeta);
        setLastSeenByUserId(nextLastSeenByUserId);
        void fetchUnreadCountsForConversations(
          sortedConvs.map((conv) => conv.id),
          readMap,
          "replace",
        );
      }
    };

    void fetchConversations();
  }, [ensureGlobalConversationMembership, fetchUnreadCountsForConversations, user.id]);

  useEffect(() => {
    if (!user.id) return;

    const channel = supabase
      .channel(`conversation-membership-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            conversation_id: string;
            last_seen_at: string | null;
            last_read_at: string | null;
          };

          const { data } = await supabase
            .from("conversations")
            .select(
              `
                id,
                created_at,
                type,
                users:conversation_participants!inner(user_id, email, last_seen_at)
              `,
            )
            .eq("id", row.conversation_id)
            .single();

          if (!data) return;

          const convo = data as ConversationRowWithParticipants;

          const nextConversation: Conversation = {
            id: convo.id,
            created_at: convo.created_at,
            users: convo.users.map((participant) => ({
              id: participant.user_id,
              email: participant.email ?? "",
            })),
            type: convo.type,
          };

          setConversations((prev) => {
            if (prev.some((existing) => existing.id === nextConversation.id)) {
              return prev;
            }

            return [...prev, nextConversation].sort((a, b) =>
              a.type === "global" ? -1 : b.type === "global" ? 1 : 0,
            );
          });

          setParticipantMetaByConversationId((prev) => ({
            ...prev,
            [row.conversation_id]: {
              last_seen_at: row.last_seen_at ?? null,
              last_read_at: row.last_read_at ?? null,
            },
          }));

          convo.users.forEach((participant) => {
            if (participant.user_id === user.id) return;

            setLastSeenByUserId((prev) => {
              const previous = prev[participant.user_id];
              const incoming = participant.last_seen_at ?? null;

              if (!previous) {
                return { ...prev, [participant.user_id]: incoming };
              }

              if (!incoming) {
                return prev;
              }

              if (new Date(incoming).getTime() > new Date(previous).getTime()) {
                return { ...prev, [participant.user_id]: incoming };
              }

              return prev;
            });
          });

          void fetchUnreadCountsForConversations(
            [row.conversation_id],
            { [row.conversation_id]: row.last_read_at ?? null },
            "merge",
          );
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchUnreadCountsForConversations, user.id]);

  useEffect(() => {
    if (!user.id) return;

    const channel = supabase
      .channel(`conversation-participant-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
        },
        (payload) => {
          const row = payload.new as {
            conversation_id: string;
            user_id: string;
            last_seen_at: string | null;
            last_read_at: string | null;
          };

          if (!conversationIdsRef.current.has(row.conversation_id)) return;

          if (row.user_id === user.id) {
            setParticipantMetaByConversationId((prev) => ({
              ...prev,
              [row.conversation_id]: {
                last_seen_at: row.last_seen_at ?? null,
                last_read_at: row.last_read_at ?? null,
              },
            }));

            return;
          }

          setLastSeenByUserId((prev) => {
            const previous = prev[row.user_id];
            const incoming = row.last_seen_at ?? null;

            if (!previous) {
              return { ...prev, [row.user_id]: incoming };
            }

            if (!incoming) {
              return prev;
            }

            if (new Date(incoming).getTime() > new Date(previous).getTime()) {
              return { ...prev, [row.user_id]: incoming };
            }

            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user.id]);

  useEffect(() => {
    if (!user.id) return;

    const channel = supabase
      .channel(`message-unread-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const message = payload.new as Message;

          if (!conversationIdsRef.current.has(message.conversation_id)) return;
          if (message.sender_id === user.id) return;

          if (activeConversationIdRef.current === message.conversation_id) {
            void markConversationAsRead(message.conversation_id);
            return;
          }

          setUnreadCountByConversationId((prev) => ({
            ...prev,
            [message.conversation_id]: (prev[message.conversation_id] ?? 0) + 1,
          }));
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [markConversationAsRead, user.id]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    void markConversationAsRead(conversationId);

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "broadcast",
        {
          event: "typing",
        },
        ({ payload }) => {
          const typingPayload = payload as {
            conversation_id?: string;
            user_id?: string;
            email?: string | null;
            is_typing?: boolean;
          };

          if (typingPayload.conversation_id !== conversationId) return;
          if (!typingPayload.user_id || typingPayload.user_id === user.id) return;

          if (typingPayload.is_typing) {
            setRemoteTypingState(conversationId, {
              user_id: typingPayload.user_id,
              label:
                typingPayload.email?.split("@")[0] ||
                "Someone",
            });
            return;
          }

          setRemoteTypingState(conversationId, null);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incomingMessage: Message = {
            id: payload.new.id,
            conversation_id: payload.new.conversation_id,
            sender_id: payload.new.sender_id,
            text: payload.new.text,
            attachments: payload.new.attachments ?? [],
            created_at: payload.new.created_at,
          };

          setMessages((prev) => {
            if (prev.some((message) => message.id === incomingMessage.id)) {
              return prev;
            }

            const incomingFingerprint = getAttachmentFingerprint(
              incomingMessage.attachments,
            );

            const optimisticMessageIndex = prev.findIndex((message) => {
              if (!message.id.startsWith("temp-")) return false;
              if (message.sender_id !== incomingMessage.sender_id) return false;
              if (message.conversation_id !== incomingMessage.conversation_id) {
                return false;
              }
              if (message.text !== incomingMessage.text) return false;

              return (
                getAttachmentFingerprint(message.attachments) ===
                incomingFingerprint
              );
            });

            if (optimisticMessageIndex === -1) {
              return [...prev, incomingMessage];
            }

            const next = [...prev];
            next[optimisticMessageIndex] = incomingMessage;
            return next;
          });

          if (payload.new.sender_id !== user.id) {
            void markConversationAsRead(conversationId);
          }

          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        },
      )
      .subscribe();

    channelRef.current = channel;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data as Message[]);
        void markConversationAsRead(conversationId);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    };

    void fetchMessages();

    return () => {
      stopTyping(conversationId);
      setRemoteTypingState(conversationId, null);
      channel.unsubscribe();
    };
  }, [conversationId, markConversationAsRead, setRemoteTypingState, stopTyping, user.id]);

  useEffect(() => {
    if (!showModal) return;

    const fetchUsers = async () => {
      const { data } = await supabase
        .from("top_user_stats")
        .select("user_id, email")
        .neq("user_id", user.id);
      if (data) {
        const users: ChatUser[] = data.filter(
          (u): u is { user_id: string; email: string } =>
            u.user_id !== null && u.email !== null,
        );

        setAllUsers(users);
      }
    };

    fetchUsers();
  }, [showModal, user.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;

    setAttachments((prev) => [...prev, ...files]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const onDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    if (!items) return;

    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length) {
      setAttachments((prev) => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const sanitizeInput = (input: string) => {
    if (!badWords.length) return input;

    const filter = new RegExp(`\\b(${badWords.join("|")})\\b`, "gi");
    return input.replace(filter, "System says: touch grass first 🌱");
  };

  const createConversation = async (otherUser: ChatUser) => {
    if (creatingRef.current) return;
    creatingRef.current = true;

/**
 * Dear DevPulse Team,
 * 
 * I think I broke something but but but let’s pretend it’s a “feature update.”
 *
 * This update improves chat behavior, unread counters, typing indicators, online status accuracy,
 * profile-to-DM shortcuts, and overall message flow stability.
 * Also gave the UI a small glow-up.
 * 
 * Honest release note: there are many bugs.
 * Some are known, some are unknown, and some are pretending to be features.
 *
 * Good luck, and may production be slightly stable.
 *
 * - Pat
 */
 
    const existing = conversations.find((conv) => {
      if (conv.type === "global") return false;

      const participantIds = new Set(conv.users.map((u) => u.id));
      return (
        participantIds.size === 2 &&
        participantIds.has(user.id) &&
        participantIds.has(otherUser.user_id)
      );
    });
    if (existing) {
      setConversationId(existing.id);
      setShowModal(false);
      creatingRef.current = false;
      return;
    }

    const { data: convData } = await supabase
      .from("conversations")
      .insert({ type: "private" })
      .select("*")
      .single();

    if (!convData) {
      creatingRef.current = false;
      return;
    }

    const convId = convData.id;
    const timestamp = new Date().toISOString();

    await supabase.from("conversation_participants").upsert(
      [
        {
          conversation_id: convId,
          user_id: user.id,
          email: user.email,
          last_seen_at: timestamp,
          last_read_at: timestamp,
        },
        {
          conversation_id: convId,
          user_id: otherUser.user_id,
          email: otherUser.email,
          last_seen_at: PRESENCE_UNSEEN_AT_ISO,
          last_read_at: PRESENCE_UNSEEN_AT_ISO,
        },
      ],
      {
        onConflict: "conversation_id,user_id",
        ignoreDuplicates: true,
      },
    );

    setConversationId(convId);
    setConversations((prev) => [
      ...prev,
      {
        id: convId,
        created_at: convData.created_at,
        users: [
          { id: user.id, email: user.email ?? "" },
          { id: otherUser.user_id, email: otherUser.email ?? "" },
        ],
        type: "private",
      },
    ]);
    setUnreadCountByConversationId((prev) => ({ ...prev, [convId]: 0 }));
    setParticipantMetaByConversationId((prev) => ({
      ...prev,
      [convId]: {
        last_seen_at: timestamp,
        last_read_at: timestamp,
      },
    }));

    setShowModal(false);
    creatingRef.current = false;
  };

  const openPrivateChatFromGlobalProfile = (
    targetUserId: string,
    targetEmail: string,
  ) => {
    if (!targetUserId || targetUserId === user.id) return;
    if (!targetEmail) {
      toast.info("Cannot start a private chat without user email.");
      return;
    }

    void createConversation({ user_id: targetUserId, email: targetEmail });
  };

  const handleDeleteConversation = async () => {
    if (!conversationId) return;
    try {
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setUnreadCountByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setParticipantMetaByConversationId((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setConversationId(null);
      setShowRightSidebar(false);
      toast.success("Conversation deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete conversation");
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || !conversationId) return;

    const targetConversationId = conversationId;
    const originalText = input;
    const outgoingText = sanitizeInput(input.slice(0, 1000));

    try {
      const uploadedAttachments = await Promise.all(
        attachments.map(async (file) => {
          if (!bucketName || bucketName.length === 0) {
            toast.error("Storage bucket is not configured.");
            return null;
          }
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name} is too large. Max size is 10MB.`);
            return null;
          }

          const filePath = `messages/${conversationId}/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file);

          if (uploadError) {
            console.error("Upload error:", uploadError);
            return null;
          }

          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          return {
            filename: file.name,
            mimetype: file.type,
            filesize: file.size,
            public_url: data.publicUrl,
          };
        }),
      );

      const validAttachments = uploadedAttachments.filter(
        (attachment): attachment is Message["attachments"][number] =>
          attachment !== null,
      );

      if (!outgoingText.trim() && validAttachments.length === 0) {
        setAttachments([]);
        return;
      }

      const optimisticMessageId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      setMessages((prev) => [
        ...prev,
        {
          id: optimisticMessageId,
          conversation_id: targetConversationId,
          sender_id: user.id,
          text: outgoingText,
          attachments: validAttachments,
          created_at: new Date().toISOString(),
          optimistic: true,
        },
      ]);

      setInput("");
      setAttachments([]);
      stopTyping(targetConversationId);

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: targetConversationId,
        sender_id: user.id,
        text: outgoingText,
        attachments: validAttachments,
      });

      if (insertError) {
        setMessages((prev) =>
          prev.filter((message) => message.id !== optimisticMessageId),
        );
        setInput(originalText);
        setAttachments(attachments);
        throw insertError;
      }

      void markConversationAsRead(targetConversationId);
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send message. Please try again.");
    }
  };

  const activeConversation = conversations.find((c) => c.id === conversationId);
  const activeOtherUser = activeConversation?.users.find((u) => u.id !== user.id);
  const isGlobalActive = activeConversation?.type === "global";
  const activeOtherUserOnline =
    !!activeOtherUser?.id && !!onlineByUserId[activeOtherUser.id];
  const activeTypingState = conversationId
    ? typingByConversationId[conversationId]
    : undefined;
  
  const activeLabel = isGlobalActive 
    ? "Global Chat" 
    : activeOtherUser?.email?.split("@")[0] || "Unknown";
  
  const activeSublabel = isGlobalActive 
    ? "Public Channel"
    : activeOtherUserOnline
      ? "Online"
      : "Offline";

  const activeSublabelClass = activeOtherUserOnline || isGlobalActive
    ? "text-emerald-400"
    : "text-gray-500";

  const typingIndicatorText = activeTypingState
    ? isGlobalActive
      ? `${activeTypingState.label} is typing...`
      : "Typing..."
    : "";

  const activeInitials = isGlobalActive 
    ? "G" 
    : activeOtherUser?.email?.[0]?.toUpperCase() ?? "?";

  const allMediaAttachments = messages
    .flatMap((m) => m.attachments || [])
    .filter(
      (a) => a?.mimetype?.startsWith("image/") || a?.mimetype?.startsWith("video/")
    )
    .reverse();

  const currentMediaIndex = mediaViewer ? allMediaAttachments.findIndex((a) => a.public_url === mediaViewer.url) : -1;
  const hasPrevMedia = currentMediaIndex > 0;
  const hasNextMedia = currentMediaIndex !== -1 && currentMediaIndex < allMediaAttachments.length - 1;

  const navigateMedia = (e: React.MouseEvent, step: number) => {
    e.stopPropagation();
    if (currentMediaIndex === -1) return;
    const nextIndex = currentMediaIndex + step;
    if (nextIndex >= 0 && nextIndex < allMediaAttachments.length) {
      const att = allMediaAttachments[nextIndex];
      setMediaViewer({
        type: att.mimetype?.startsWith("video/") ? "video" : "image",
        url: att.public_url,
        filename: att.filename || "Media",
      });
    }
  };

  return (
    <>
      {isMounted &&
        mediaViewer &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4"
            onClick={() => setMediaViewer(null)}
          >
            {hasPrevMedia && (
              <button
                type="button"
                onClick={(e) => navigateMedia(e, -1)}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition shadow-lg backdrop-blur-md border border-white/10"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="w-5 h-5" />
              </button>
            )}

            {hasNextMedia && (
              <button
                type="button"
                onClick={(e) => navigateMedia(e, 1)}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-[10000] w-12 h-12 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition shadow-lg backdrop-blur-md border border-white/10"
              >
                <FontAwesomeIcon icon={faChevronRight} className="w-5 h-5" />
              </button>
            )}

            <div
              className="w-screen h-[100dvh] sm:w-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] rounded-none sm:rounded-2xl border-0 sm:border border-white/10 bg-[rgba(10,10,30,0.9)]/95 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`${
                  mediaViewer.type === "video"
                    ? "h-[100dvh] sm:h-[90vh] p-0 bg-black"
                    : "h-[100dvh] sm:h-[90vh] p-0 bg-black/30"
                } flex items-center justify-center`}
              >
                {mediaViewer.type === "image" ? (
                  <div className="relative h-full w-full flex items-center justify-center">
                    <Image
                      src={mediaViewer.url}
                      alt={mediaViewer.filename}
                      className="h-full w-full object-contain"
                      fill
                    />
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadMedia}
                        className="w-8 h-8 rounded-md text-white/90 hover:text-white transition"
                        aria-label="Download media"
                      >
                        <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaViewer(null)}
                        className="w-8 h-8 rounded-md text-white/90 hover:text-white transition"
                        aria-label="Close viewer"
                      >
                        <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Player
                    src={mediaViewer.url}
                    autoPlay={true}
                    immersive={true}
                    className="w-full h-full"
                    onDownload={handleDownloadMedia}
                    onClose={() => setMediaViewer(null)}
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    <div className="flex h-screen w-full bg-transparent text-white overflow-hidden relative">
      
      {/* Left Sidebar */}
      <div className={`w-full md:w-[300px] flex-shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a1a] md:bg-transparent z-20 absolute md:relative h-full transition-transform duration-300 ${conversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-100 tracking-tight">Message category</h2>
              {totalUnreadCount > 0 && (
                <span className="min-w-[24px] h-6 px-2 rounded-full bg-rose-500/90 text-white text-[11px] font-bold flex items-center justify-center">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center hover:bg-indigo-500/20 transition"
              title="New conversation"
            >
              <FontAwesomeIcon icon={faPlus} className="text-indigo-400 w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
            <input
              id="message-search"
              type="text"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
              placeholder="Search Message..."
              className="w-full bg-[rgba(10,10,30,0.6)] border border-transparent rounded-xl py-2 pl-9 pr-4 text-sm text-gray-200 placeholder:text-gray-500 outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30">
          <div>
            <h3 className="px-2 text-xs font-semibold text-gray-500 mb-2 tracking-wider">ROOMS</h3>
            <Conversations
              conversations={globalConversations}
              user={user}
              conversationId={conversationId}
              setConversationId={setConversationId}
              unreadCountByConversationId={unreadCountByConversationId}
              onlineByUserId={onlineByUserId}
              typingByConversationId={typingByConversationId}
              showLabel={true}
            />
          </div>

          <div>
            <div className="flex justify-between items-center px-2 mb-2 relative">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">DIRECT MESSAGE</h3>
              <div className="relative">
                <span
                  onClick={() => setIsDmSortOpen(!isDmSortOpen)}
                  className="text-[10px] text-gray-500 bg-[rgba(10,10,30,0.6)] px-2 py-0.5 rounded cursor-pointer hover:bg-white/5 flex items-center gap-1 select-none"
                >
                  {dmSortOrder === "newest" && "Newest"}
                  {dmSortOrder === "oldest" && "Oldest"}
                  {dmSortOrder === "az" && "A-Z"}
                  {dmSortOrder === "za" && "Z-A"}
                  <FontAwesomeIcon icon={isDmSortOpen ? faChevronUp : faChevronDown} className="w-2 h-2 ml-1" />
                </span>
                
                {isDmSortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-24 bg-[#0F0F23]/95 backdrop-blur-xl border border-white/10 rounded-md shadow-xl overflow-hidden z-[100] py-1 text-xs">
                    <button
                      onClick={() => { setDmSortOrder("newest"); setIsDmSortOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors ${dmSortOrder === "newest" ? "text-indigo-400 bg-white/5" : "text-gray-300"}`}
                    >
                      Newest
                    </button>
                    <button
                      onClick={() => { setDmSortOrder("oldest"); setIsDmSortOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors ${dmSortOrder === "oldest" ? "text-indigo-400 bg-white/5" : "text-gray-300"}`}
                    >
                      Oldest
                    </button>
                    <button
                      onClick={() => { setDmSortOrder("az"); setIsDmSortOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors ${dmSortOrder === "az" ? "text-indigo-400 bg-white/5" : "text-gray-300"}`}
                    >
                      A-Z
                    </button>
                    <button
                      onClick={() => { setDmSortOrder("za"); setIsDmSortOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors ${dmSortOrder === "za" ? "text-indigo-400 bg-white/5" : "text-gray-300"}`}
                    >
                      Z-A
                    </button>
                  </div>
                )}
              </div>
            </div>
            <Conversations
              conversations={privateConversations}
              user={user}
              conversationId={conversationId}
              setConversationId={setConversationId}
              unreadCountByConversationId={unreadCountByConversationId}
              onlineByUserId={onlineByUserId}
              typingByConversationId={typingByConversationId}
              showLabel={true}
            />
          </div>
        </div>
      </div>

      {/* Middle Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 relative bg-white/[0.01] ${!conversationId ? 'hidden md:flex' : 'flex'}`}>
        {conversationId ? (
          <>
            {/* Header */}
            <div className="h-[72px] flex items-center justify-between px-4 sm:px-6 border-b border-white/5 bg-white/[0.01] z-10 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3.5">
                <button 
                  onClick={() => setConversationId(null)}
                  className="md:hidden w-9 h-9 rounded-full bg-white/[0.02] border border-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="w-3.5 h-3.5" />
                </button>
                <div className="relative">
                  <div className={`flex justify-center items-center w-11 h-11 rounded-full text-[16px] font-bold shadow-sm ${isGlobalActive ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30" : "bg-neutral-800 text-gray-200 border border-white/10"}`}>
                    {activeInitials}
                  </div>
                  {!isGlobalActive && activeOtherUserOnline && (
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-400 border-[2px] border-transparent rounded-full"></div>
                  )}
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-gray-100 leading-tight">{activeLabel}</h2>
                  <p className={`text-xs font-medium ${activeSublabelClass}`}>{activeSublabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowRightSidebar(!showRightSidebar)}
                  className={`w-9 h-9 rounded-full ${showRightSidebar ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/[0.02] text-gray-400 border-white/5'} border hover:bg-white/10 flex items-center justify-center transition`}
                  title="Toggle Info"
                >
                  <FontAwesomeIcon icon={faInfoCircle} className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden z-10 min-h-0">
              <Messages
                messages={messages.filter((m) =>
                  (m.text || "").toLowerCase().includes(messageSearch.toLowerCase())
                )}
                user={user}
                conversations={conversations}
                bottomRef={bottomRef}
                badgesByUserId={badgesByUserId}
                onUserProfileClick={openPrivateChatFromGlobalProfile}
              />
            </div>

            {activeTypingState && (
              <div className="px-4 pb-1.5">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-[12px] text-indigo-300">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse [animation-delay:300ms]" />
                  </div>
                  <span className="font-medium">{typingIndicatorText}</span>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-white/[0.01] z-10 flex-shrink-0 pb-6 w-full">
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 px-1">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="bg-neutral-800/80 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-2 shadow-sm"
                    >
                      {file.type.startsWith("image/") ? (
                        <Image
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 rounded object-cover border border-white/10"
                        />
                      ) : (
                        <FontAwesomeIcon icon={faFile} className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="truncate max-w-[120px] text-gray-200 font-medium">{file.name}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md px-1.5 py-0.5 ml-1 transition"
                      >
                        <FontAwesomeIcon icon={faXmark} className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div
                onPaste={handlePaste}
                tabIndex={0}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={onDragLeave}
                className={`${
                  isDraggingOver 
                    ? "border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10" 
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 focus-within:border-indigo-500/50 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                } transition-all duration-300 rounded-[24px] border flex items-end gap-2 p-2 shadow-sm backdrop-blur-md`}
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 mb-[2px] rounded-full bg-transparent hover:bg-white/10 flex items-center justify-center transition-all duration-300 flex-shrink-0 group"
                  title="Attach file"
                >
                  <div className="w-[28px] h-[28px] rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-300 text-gray-400 transition-colors">
                    <FontAwesomeIcon icon={faPlus} className="w-3.5 h-3.5" />
                  </div>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  multiple
                />

                <div className="flex-1 py-[11px]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      const nextValue = e.target.value.slice(0, 1000);
                      setInput(nextValue);
                      if (conversationId) {
                        markTypingFromInput(conversationId, nextValue);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim() || attachments.length > 0) sendMessage();
                      }
                    }}
                    className="w-full block outline-none resize-none overflow-y-auto bg-transparent text-gray-100 placeholder:text-gray-500/80 leading-relaxed max-h-[150px] text-[15px] pt-0 pb-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
                    placeholder="Type a message..."
                    rows={1}
                  />
                </div>

                <div className="mb-[2px] pr-1">
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() && attachments.length === 0}
                    className={`h-10 px-5 rounded-[20px] font-semibold text-[14px] flex items-center gap-2.5 transition-all duration-300 flex-shrink-0
                      ${(input.trim() || attachments.length > 0)
                        ? "bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-md shadow-indigo-500/25 active:scale-95" 
                        : "bg-white/5 text-gray-500 cursor-not-allowed"}
                    `}
                  >
                    <span className="hidden sm:inline">Send</span>
                    <FontAwesomeIcon icon={faPaperPlane} className={`w-[14px] h-[14px] transition-transform ${(input.trim() || attachments.length > 0) ? "translate-x-0.5" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center h-full">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
              <FontAwesomeIcon icon={faPaperPlane} className="w-6 h-6" />
            </div>
            <p className="text-gray-200 text-lg font-bold mb-2">
              It&apos;s quiet here
            </p>
            <p className="text-gray-500 text-sm max-w-sm">
              Select a conversation from the left sidebar or start a new one to begin chatting.
            </p>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      {conversationId && (
        <div className={`w-full sm:w-[320px] flex-shrink-0 border-l border-white/5 flex flex-col absolute right-0 top-0 bottom-0 h-full z-40 bg-[rgba(10,10,30,0.95)] md:bg-[#0a0a1a] xl:bg-transparent xl:relative xl:transform-none transition-transform duration-300 ${showRightSidebar ? 'translate-x-0' : 'translate-x-full xl:translate-x-0 xl:hidden'}`}>
          <div className="absolute top-4 right-4 xl:hidden">
            <button onClick={() => setShowRightSidebar(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-300 hover:text-white">
              <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col items-center justify-center p-8 border-b border-transparent">
            <div className={`flex justify-center items-center w-[100px] h-[100px] rounded-full text-4xl font-bold mb-5 shadow-lg ${isGlobalActive ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" : "bg-neutral-800 text-gray-200 border border-white/10"}`}>
              {activeInitials}
            </div>
            <h2 className="text-[18px] font-bold text-gray-100 tracking-tight">{activeLabel}</h2>
            <p className="text-[13px] text-gray-500 font-medium mt-1">{isGlobalActive ? "Community channel" : activeOtherUser?.email}</p>
            
            <div className="flex items-center gap-3 mt-6 w-full justify-center">
              <button onClick={() => { const input = document.getElementById("message-search"); if(input) { input.focus(); } }} className="w-11 h-11 rounded-2xl bg-[rgba(10,10,30,0.6)] flex items-center justify-center text-gray-400 hover:text-indigo-400 hover:bg-white/5 transition shadow-sm" title="Search Message">
                <FontAwesomeIcon icon={faSearch} className="w-4 h-4" />
              </button>
              <button disabled={isGlobalActive} onClick={handleDeleteConversation} className={`w-11 h-11 rounded-2xl bg-[rgba(10,10,30,0.6)] flex items-center justify-center text-gray-400 hover:bg-white/5 transition shadow-sm ${isGlobalActive ? "opacity-50 cursor-not-allowed" : "hover:text-red-400"}`} title="Delete Conversation">
                <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
              </button>
              <button onClick={() => toast.info("Channel info")} className="w-11 h-11 rounded-2xl bg-[rgba(10,10,30,0.6)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition shadow-sm" title="Info">
                <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4" />
              </button>
              <button onClick={() => toast.success("Notifications muted")} className="w-11 h-11 rounded-2xl bg-[rgba(10,10,30,0.6)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition shadow-sm" title="Mute">
                <FontAwesomeIcon icon={faBellSlash} className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30 border-t border-white/5">
            <div>
              <div className="flex items-center justify-between cursor-pointer group mb-4">
                <h3 className="text-[14px] font-semibold text-gray-300 group-hover:text-white transition tracking-wide">Shared Media</h3>
                <FontAwesomeIcon icon={faChevronDown} className="text-gray-500 w-3.5 h-3.5 group-hover:text-gray-300 transition" />
              </div>
              
              {allMediaAttachments.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {allMediaAttachments.slice(0, showAllMedia ? undefined : 9).map((att, i) => (
                      <div key={i} className="aspect-square bg-neutral-900 rounded-xl overflow-hidden border border-transparent shadow-sm relative group cursor-pointer" onClick={() => setMediaViewer({ type: att.mimetype?.startsWith("video/") ? "video" : "image", url: att.public_url, filename: att.filename || "Media" })}>
                        {att.mimetype?.startsWith("video/") ? (
                          <>
                            <video
                              src={att.public_url}
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-300 pointer-events-none"
                              muted
                              playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                                <FontAwesomeIcon icon={faPlay} className="w-3 h-3 text-white ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <Image
                            src={att.public_url}
                            alt={att.filename || "Media"}
                            width={100}
                            height={100}
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-300 pointer-events-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {allMediaAttachments.length > 9 && !showAllMedia && (
                    <button 
                      onClick={() => setShowAllMedia(true)}
                      className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[13px] font-bold hover:from-indigo-400 hover:to-violet-400 transition shadow-sm"
                    >
                      View All ({allMediaAttachments.length})
                    </button>
                  )}
                  {showAllMedia && (
                    <button 
                      onClick={() => setShowAllMedia(false)}
                      className="w-full mt-4 py-2.5 rounded-xl bg-white/5 text-gray-300 text-[13px] font-bold hover:bg-white/10 transition shadow-sm"
                    >
                      Show Less
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 bg-white/[0.02] rounded-xl border border-indigo-500/15 border-dashed">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-2">
                    <FontAwesomeIcon icon={faFile} className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium">No media shared yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="glass-card w-[400px] p-6">
            <h3 className="text-lg font-bold text-white mb-4">New Message</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user..."
              className="w-full mb-4 px-4 py-2.5 input-field"
            />

            {allUsers.length == 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-gray-500 text-sm">No users found.</p>
              </div>
            )}

            <div className="space-y-1 max-h-60 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 pr-1">
              {allUsers
                .filter((u) =>
                  u.email.toLowerCase().includes(search.toLowerCase()),
                )
                .map((u, idx) => (
                  <div
                    key={idx}
                    onClick={() => createConversation(u)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition"
                  >
                    <div className="flex justify-center items-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold shadow-sm">
                      {u.email[0].toUpperCase()}
                    </div>
                    <div className="w-full flex flex-col">
                      <span className="text-sm font-semibold text-gray-200">{u.email.split("@")[0]}</span>
                      <span className="text-xs text-gray-500">{u.email}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex justify-end mt-5 pt-3 border-t border-white/5">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 text-sm font-semibold rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}



