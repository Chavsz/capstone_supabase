import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdMessage, MdSearch } from "react-icons/md";
import { supabase } from "../../supabase-client";

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const MessageSystem = ({ roleLabel = "Tutee" }) => {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userMap, setUserMap] = useState(new Map());
  const [confirmedAppointments, setConfirmedAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const channelRef = useRef(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (active) {
            setCurrentUserId(null);
            setMessages([]);
            setUserMap(new Map());
            setSelectedUserId(null);
            setConfirmedAppointments([]);
          }
          return;
        }

        const userId = session.user.id;
        if (active) setCurrentUserId(userId);

        const { data: appointmentRows, error: appointmentError } = await supabase
          .from("appointment")
          .select(
            "appointment_id, subject, topic, date, start_time, end_time, user_id, tutor_id, status"
          )
          .or(`user_id.eq.${userId},tutor_id.eq.${userId}`)
          .eq("status", "confirmed")
          .order("date", { ascending: true });

        if (appointmentError) throw appointmentError;

        const confirmedRows = appointmentRows || [];
        if (active) setConfirmedAppointments(confirmedRows);

        const confirmedIds = confirmedRows
          .map((row) => row.appointment_id)
          .filter(Boolean);

        let messageRows = [];
        if (confirmedIds.length > 0) {
          const { data, error } = await supabase
            .from("messages")
            .select(
              "message_id, appointment_id, sender_id, receiver_id, body, created_at"
            )
            .in("appointment_id", confirmedIds)
            .order("created_at", { ascending: true });
          if (error) throw error;
          messageRows = data || [];
        }

        const rows = messageRows || [];
        if (!active) return;
        setMessages(rows);

        const confirmedPartnerIds = Array.from(
          new Set(
            confirmedRows
              .map((row) => (row.user_id === userId ? row.tutor_id : row.user_id))
              .filter(Boolean)
          )
        );

        if (confirmedPartnerIds.length === 0) {
          setUserMap(new Map());
          setSelectedUserId(null);
          setSelectedAppointmentId(null);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("user_id, name")
          .in("user_id", confirmedPartnerIds);

        if (usersError) throw usersError;

        const map = new Map();
        (users || []).forEach((user) => {
          map.set(user.user_id, user.name || "User");
        });

        setUserMap(map);
        if (active) {
          setSelectedUserId((prev) => prev || confirmedPartnerIds[0]);
        }
      } catch (err) {
        console.error("Unable to load messages:", err.message);
        if (active) {
          setMessages([]);
          setUserMap(new Map());
          setSelectedUserId(null);
          setSelectedAppointmentId(null);
          setConfirmedAppointments([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMessages();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId || !selectedAppointmentId) return;

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`messages-${userId}-${selectedAppointmentId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `appointment_id=eq.${selectedAppointmentId},sender_id=eq.${userId}`,
            },
            (payload) => {
              if (!active) return;
              const next = payload?.new;
              if (!next) return;
              setMessages((prev) => {
                if (prev.some((row) => row.message_id === next.message_id)) {
                  return prev;
                }
                return [...prev, next];
              });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `appointment_id=eq.${selectedAppointmentId},receiver_id=eq.${userId}`,
            },
            (payload) => {
              if (!active) return;
              const next = payload?.new;
              if (!next) return;
              setMessages((prev) => {
                if (prev.some((row) => row.message_id === next.message_id)) {
                  return prev;
                }
                return [...prev, next];
              });
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.error("Unable to subscribe to messages:", err.message);
      }
    };

    setupRealtime();
    return () => {
      active = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedAppointmentId]);

  useEffect(() => {
    if (!currentUserId || confirmedAppointments.length === 0) {
      setSelectedAppointmentId(null);
      return;
    }

    const now = new Date();
    const toDateTime = (row, timeField = "start_time") => {
      if (!row?.date || !row?.[timeField]) return null;
      const stamp = new Date(`${row.date}T${row[timeField]}`);
      return Number.isNaN(stamp.getTime()) ? null : stamp;
    };

    const upcoming = confirmedAppointments
      .map((row) => ({ row, start: toDateTime(row) }))
      .filter((item) => item.start && item.start >= now)
      .sort((a, b) => a.start - b.start);

    const defaultAppointment = upcoming.length
      ? upcoming[0].row
      : confirmedAppointments
          .map((row) => ({ row, start: toDateTime(row) }))
          .filter((item) => item.start)
          .sort((a, b) => b.start - a.start)[0]?.row;

    setSelectedAppointmentId((prev) => prev || defaultAppointment?.appointment_id || null);
  }, [currentUserId, confirmedAppointments]);

  const conversations = useMemo(() => {
    if (!currentUserId || confirmedAppointments.length === 0) return [];

    const lastMessageByAppointment = new Map();
    messages.forEach((row) => {
      if (!row.appointment_id) return;
      const existing = lastMessageByAppointment.get(row.appointment_id);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        lastMessageByAppointment.set(row.appointment_id, row);
      }
    });

    const items = confirmedAppointments.map((appointment) => {
      const otherId =
        appointment.user_id === currentUserId
          ? appointment.tutor_id
          : appointment.user_id;
      const lastMessage = lastMessageByAppointment.get(appointment.appointment_id);
      const displayName = userMap.get(otherId) || "User";
      const label = `${appointment.subject || "Subject"}${
        appointment.topic ? ` - ${appointment.topic}` : ""
      }`;
      return {
        id: appointment.appointment_id,
        otherId,
        name: displayName,
        subjectLabel: label,
        preview: lastMessage?.body || "No messages yet.",
        timeLabel: lastMessage ? formatTimestamp(lastMessage.created_at) : "",
        createdAt: lastMessage?.created_at || "",
        appointment,
      };
    });

    const normalizedSearch = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (!normalizedSearch) return true;
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.subjectLabel.toLowerCase().includes(normalizedSearch)
      );
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(`${a.appointment.date}T${a.appointment.start_time || "00:00"}`).getTime();
      const bTime = new Date(`${b.appointment.date}T${b.appointment.start_time || "00:00"}`).getTime();
      return bTime - aTime;
    });
  }, [currentUserId, messages, userMap, search, confirmedAppointments]);

  const threadMessages = useMemo(() => {
    if (!selectedAppointmentId) return [];
    return messages.filter((row) => row.appointment_id === selectedAppointmentId);
  }, [messages, selectedAppointmentId]);

  const selectedAppointment = useMemo(
    () =>
      confirmedAppointments.find(
        (appointment) => appointment.appointment_id === selectedAppointmentId
      ) || null,
    [confirmedAppointments, selectedAppointmentId]
  );

  const selectedPartnerName = useMemo(() => {
    if (!selectedAppointment || !currentUserId) return "";
    const partnerId =
      selectedAppointment.user_id === currentUserId
        ? selectedAppointment.tutor_id
        : selectedAppointment.user_id;
    return userMap.get(partnerId) || "User";
  }, [selectedAppointment, currentUserId, userMap]);

  const selectedPartnerId = useMemo(() => {
    if (!selectedAppointment || !currentUserId) return null;
    return selectedAppointment.user_id === currentUserId
      ? selectedAppointment.tutor_id
      : selectedAppointment.user_id;
  }, [selectedAppointment, currentUserId]);

  const handleSendMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !currentUserId || !selectedPartnerId || !selectedAppointmentId) {
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            appointment_id: selectedAppointmentId,
            sender_id: currentUserId,
            receiver_id: selectedPartnerId,
            body: trimmed,
          },
        ])
        .select(
          "message_id, appointment_id, sender_id, receiver_id, body, created_at"
        )
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data]);
      setDraft("");
    } catch (err) {
      console.error("Unable to send message:", err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <MdMessage />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Messages</h1>
            <p className="text-sm text-gray-500">
              Active chats for {roleLabel.toLowerCase()} accounts.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search message"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <MdSearch className="absolute right-3 top-2.5 text-gray-400" />
            </div>

            {loading ? (
              <div className="text-sm text-gray-500">Loading messages...</div>
            ) : confirmedAppointments.length === 0 ? (
              <div className="text-sm text-gray-500">
                Messaging activates after the tutor confirms an appointment.
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-gray-500">No conversations yet.</div>
            ) : (
              <div className="space-y-3">
                {conversations.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setSelectedAppointmentId(item.id);
                      setSelectedUserId(item.otherId || null);
                    }}
                    className={`w-full text-left flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                      selectedAppointmentId === item.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-100 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {item.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {item.subjectLabel}
                        </p>
                        <p className="text-[11px] text-gray-400 line-clamp-1">
                          {item.preview}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {item.timeLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedAppointment ? selectedPartnerName : "Select a chat"}
                </p>
                <p className="text-xs text-gray-500">
                  {roleLabel === "Tutor" ? "Tutee" : "Tutor"}
                </p>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {roleLabel} view
              </span>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {selectedAppointment ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {selectedAppointment.subject || "Subject"}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span>{selectedAppointment.topic || "Topic"}</span>
                  <span className="text-gray-400">•</span>
                  <span>
                    {selectedAppointment.date} {selectedAppointment.start_time}
                    {selectedAppointment.end_time
                      ? ` - ${selectedAppointment.end_time}`
                      : ""}
                  </span>
                </div>
              ) : (
                <span>No appointment details available.</span>
              )}
            </div>

            <div className="border-t border-gray-100" />

            <div className="flex-1 space-y-4">
              {loading ? (
                <div className="text-sm text-gray-500">Loading thread...</div>
              ) : threadMessages.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No messages in this thread yet.
                </div>
              ) : (
                threadMessages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`flex ${
                      message.sender_id === currentUserId
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        message.sender_id === currentUserId
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      <p className="leading-relaxed">{message.body}</p>
                      <p
                        className={`mt-2 text-[11px] ${
                          message.sender_id === currentUserId
                            ? "text-blue-100"
                            : "text-gray-400"
                        }`}
                      >
                        {formatTimestamp(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 flex items-end gap-2">
              <textarea
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-gray-700 focus:outline-none"
                placeholder="Type a message..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!selectedAppointmentId || sending}
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!draft.trim() || !selectedAppointmentId || sending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MessageSystem;
