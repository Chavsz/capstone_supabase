import React, { useEffect, useMemo, useState } from "react";
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
  const [appointmentInfo, setAppointmentInfo] = useState(null);
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
          }
          return;
        }

        const userId = session.user.id;
        if (active) setCurrentUserId(userId);

        const { data: messageRows, error: messageError } = await supabase
          .from("messages")
          .select("message_id, sender_id, receiver_id, body, created_at")
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order("created_at", { ascending: true });

        if (messageError) throw messageError;

        const rows = messageRows || [];
        if (!active) return;
        setMessages(rows);

        const otherIds = Array.from(
          new Set(
            rows
              .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
              .filter(Boolean)
          )
        );

        if (otherIds.length === 0) {
          setUserMap(new Map());
          setSelectedUserId(null);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("user_id, name")
          .in("user_id", otherIds);

        if (usersError) throw usersError;

        const map = new Map();
        (users || []).forEach((user) => {
          map.set(user.user_id, user.name || "User");
        });

        setUserMap(map);
        setSelectedUserId((prev) => prev || otherIds[0]);
      } catch (err) {
        console.error("Unable to load messages:", err.message);
        if (active) {
          setMessages([]);
          setUserMap(new Map());
          setSelectedUserId(null);
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

    const fetchAppointmentDetails = async () => {
      if (!currentUserId || !selectedUserId) {
        setAppointmentInfo(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("appointment")
          .select("appointment_id, subject, topic, date, start_time, end_time, user_id, tutor_id")
          .or(
            `and(user_id.eq.${currentUserId},tutor_id.eq.${selectedUserId}),and(user_id.eq.${selectedUserId},tutor_id.eq.${currentUserId})`
          );

        if (error) throw error;

        const rows = data || [];
        if (!active) return;

        if (rows.length === 0) {
          setAppointmentInfo(null);
          return;
        }

        const now = new Date();
        const toDateTime = (row, timeField = "start_time") => {
          if (!row?.date || !row?.[timeField]) return null;
          const stamp = new Date(`${row.date}T${row[timeField]}`);
          return Number.isNaN(stamp.getTime()) ? null : stamp;
        };

        const upcoming = rows
          .map((row) => ({ row, start: toDateTime(row) }))
          .filter((item) => item.start && item.start >= now)
          .sort((a, b) => a.start - b.start);

        const selected = upcoming.length
          ? upcoming[0].row
          : rows
              .map((row) => ({ row, start: toDateTime(row) }))
              .filter((item) => item.start)
              .sort((a, b) => b.start - a.start)[0]?.row;

        setAppointmentInfo(selected || null);
      } catch (err) {
        console.error("Unable to load appointment details:", err.message);
        if (active) setAppointmentInfo(null);
      }
    };

    fetchAppointmentDetails();
    return () => {
      active = false;
    };
  }, [currentUserId, selectedUserId]);

  const conversations = useMemo(() => {
    if (!currentUserId || messages.length === 0) return [];

    const map = new Map();
    messages.forEach((row) => {
      const otherId = row.sender_id === currentUserId ? row.receiver_id : row.sender_id;
      if (!otherId) return;
      const existing = map.get(otherId);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        map.set(otherId, row);
      }
    });

    const items = Array.from(map.entries()).map(([otherId, lastMessage]) => ({
      id: otherId,
      name: userMap.get(otherId) || "User",
      preview: lastMessage.body || "",
      timeLabel: formatTimestamp(lastMessage.created_at),
      createdAt: lastMessage.created_at,
    }));

    const filtered = items.filter((item) =>
      item.name.toLowerCase().includes(search.trim().toLowerCase())
    );

    return filtered.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }, [currentUserId, messages, userMap, search]);

  const threadMessages = useMemo(() => {
    if (!selectedUserId || !currentUserId) return [];
    return messages.filter(
      (row) =>
        (row.sender_id === currentUserId && row.receiver_id === selectedUserId) ||
        (row.sender_id === selectedUserId && row.receiver_id === currentUserId)
    );
  }, [messages, currentUserId, selectedUserId]);

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
            ) : conversations.length === 0 ? (
              <div className="text-sm text-gray-500">No conversations yet.</div>
            ) : (
              <div className="space-y-3">
                {conversations.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedUserId(item.id)}
                    className={`w-full text-left flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                      selectedUserId === item.id
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
                  {selectedUserId
                    ? userMap.get(selectedUserId) || "User"
                    : "Select a chat"}
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
              {appointmentInfo ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {appointmentInfo.subject || "Subject"}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span>{appointmentInfo.topic || "Topic"}</span>
                  <span className="text-gray-400">•</span>
                  <span>
                    {appointmentInfo.date} {appointmentInfo.start_time}
                    {appointmentInfo.end_time ? ` - ${appointmentInfo.end_time}` : ""}
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

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Message composer will be added here.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MessageSystem;
