import React, { useEffect, useMemo, useRef, useState } from "react";
import { MdMessage, MdSearch, MdMoreVert } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase-client";

const PAGE_SIZE = 3;

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const MessageSystem = ({ roleLabel = "Tutee" }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [archivedMessageIds, setArchivedMessageIds] = useState(new Set());
  const [userMap, setUserMap] = useState(new Map());
  const [profileMap, setProfileMap] = useState(new Map());
  const [confirmedAppointments, setConfirmedAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const channelRef = useRef(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeSessionMenuId, setActiveSessionMenuId] = useState(null);
  const [viewArchive, setViewArchive] = useState(false);
  const [conversationPage, setConversationPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);

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
            setProfileMap(new Map());
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
            "appointment_id, subject, topic, date, start_time, end_time, user_id, tutor_id, status, tutor_decline_reason, tutee_decline_reason"
          )
          .or(`user_id.eq.${userId},tutor_id.eq.${userId}`)
          .in("status", ["confirmed", "started", "awaiting_feedback", "completed", "cancelled"])
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

        const { data: archivedRows, error: archiveError } = await supabase
          .from("message_archive")
          .select("message_id")
          .eq("user_id", userId);

        if (archiveError) throw archiveError;

        const archivedSet = new Set(
          (archivedRows || []).map((row) => row.message_id).filter(Boolean)
        );
        if (active) setArchivedMessageIds(archivedSet);

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

        const { data: profiles, error: profilesError } = await supabase
          .from("profile")
          .select("user_id, profile_image")
          .in("user_id", confirmedPartnerIds);

        if (profilesError && profilesError.code !== "PGRST116") {
          throw profilesError;
        }

        const profileData = new Map();
        (profiles || []).forEach((profile) => {
          if (profile?.user_id) {
            profileData.set(profile.user_id, profile.profile_image || "");
          }
        });
        setProfileMap(profileData);
        if (active) {
          setSelectedUserId((prev) => prev || confirmedPartnerIds[0]);
        }
      } catch (err) {
        console.error("Unable to load messages:", err.message);
        if (active) {
          setMessages([]);
          setArchivedMessageIds(new Set());
          setUserMap(new Map());
          setProfileMap(new Map());
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
    const handleClickOutside = (event) => {
      const menuRoot = event.target.closest("[data-session-menu]");
      if (!menuRoot) {
        setActiveSessionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const setupRealtime = async () => {
      try {
        if (!currentUserId) return;

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        const channel = supabase
          .channel(`messages-${currentUserId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `sender_id=eq.${currentUserId}`,
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
              filter: `receiver_id=eq.${currentUserId}`,
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
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || confirmedAppointments.length === 0) {
      setSelectedAppointmentId(null);
      return;
    }

    const toDateTime = (row, timeField = "start_time") => {
      if (!row?.date || !row?.[timeField]) return null;
      const stamp = new Date(`${row.date}T${row[timeField]}`);
      return Number.isNaN(stamp.getTime()) ? null : stamp;
    };

    const latestByUser = new Map();
    confirmedAppointments.forEach((appointment) => {
      const otherId =
        appointment.user_id === currentUserId
          ? appointment.tutor_id
          : appointment.user_id;
      if (!otherId) return;
      const start = toDateTime(appointment);
      if (!start) return;
      const existing = latestByUser.get(otherId);
      if (!existing || start > existing.start) {
        latestByUser.set(otherId, { appointment, start });
      }
    });

    const latestAppointments = Array.from(latestByUser.values())
      .map((entry) => entry.appointment)
      .sort((a, b) => {
        const aTime = toDateTime(a)?.getTime() || 0;
        const bTime = toDateTime(b)?.getTime() || 0;
        return bTime - aTime;
      });

    const defaultAppointment = latestAppointments[0];
    if (defaultAppointment) {
      setSelectedUserId((prev) => {
        if (prev) return prev;
        return defaultAppointment.user_id === currentUserId
          ? defaultAppointment.tutor_id
          : defaultAppointment.user_id;
      });
    }
    setSelectedAppointmentId(null);
  }, [currentUserId, confirmedAppointments]);


  const messagesByAppointment = useMemo(() => {
    const map = new Map();
    messages.forEach((message) => {
      if (!message.appointment_id) return;
      if (!map.has(message.appointment_id)) {
        map.set(message.appointment_id, []);
      }
      map.get(message.appointment_id).push(message);
    });
    return map;
  }, [messages]);

  const archivedAppointmentIds = useMemo(() => {
    const ids = new Set();
    confirmedAppointments.forEach((appointment) => {
      if (!appointment.appointment_id) return;
      const list = messagesByAppointment.get(appointment.appointment_id) || [];
      if (list.length === 0) {
        ids.add(appointment.appointment_id);
        return;
      }
      const allArchived = list.every((item) => archivedMessageIds.has(item.message_id));
      if (allArchived) ids.add(appointment.appointment_id);
    });
    return ids;
  }, [messagesByAppointment, archivedMessageIds, confirmedAppointments]);

  const archivedAppointmentsList = useMemo(() => {
    return confirmedAppointments
      .filter((appointment) =>
        appointment.appointment_id
          ? archivedAppointmentIds.has(appointment.appointment_id)
          : false
      )
      .sort((a, b) => {
        const aTime = new Date(
          `${a.date}T${a.start_time || "00:00"}`
        ).getTime();
        const bTime = new Date(
          `${b.date}T${b.start_time || "00:00"}`
        ).getTime();
        return bTime - aTime;
      });
  }, [confirmedAppointments, archivedAppointmentIds]);

  const unarchivedAppointmentIds = useMemo(() => {
    const ids = new Set();
    confirmedAppointments.forEach((appointment) => {
      if (!appointment.appointment_id) return;
      const list = messagesByAppointment.get(appointment.appointment_id) || [];
      if (list.length === 0) {
        ids.add(appointment.appointment_id);
        return;
      }
      const hasUnarchived = list.some((item) => !archivedMessageIds.has(item.message_id));
      if (hasUnarchived) ids.add(appointment.appointment_id);
    });
    return ids;
  }, [messagesByAppointment, archivedMessageIds, confirmedAppointments]);

  const activeAppointmentIds = useMemo(() => {
    const ids = new Set();
    confirmedAppointments.forEach((appointment) => {
      if (!appointment.appointment_id) return;
      if (unarchivedAppointmentIds.has(appointment.appointment_id)) {
        ids.add(appointment.appointment_id);
      }
    });
    return ids;
  }, [confirmedAppointments, unarchivedAppointmentIds]);

  const conversations = useMemo(() => {
    if (!currentUserId || confirmedAppointments.length === 0) return [];

    const toDateTime = (row, timeField = "start_time") => {
      if (!row?.date || !row?.[timeField]) return null;
      const stamp = new Date(`${row.date}T${row[timeField]}`);
      return Number.isNaN(stamp.getTime()) ? null : stamp;
    };

    const latestByUser = new Map();
    confirmedAppointments.forEach((appointment) => {
      if (!appointment.appointment_id) return;
      const otherId =
        appointment.user_id === currentUserId
          ? appointment.tutor_id
          : appointment.user_id;
      if (!otherId) return;
      const start = toDateTime(appointment);
      if (!start) return;
      const existing = latestByUser.get(otherId);
      if (!existing || start > existing.start) {
        latestByUser.set(otherId, { appointment, start });
      }
    });

    const items = Array.from(latestByUser.entries()).map(([otherId, entry]) => {
      const displayName = userMap.get(otherId) || "User";
      const label = `${entry.appointment.subject || "Subject"}${
        entry.appointment.topic ? ` - ${entry.appointment.topic}` : ""
      }`;
      return {
        id: otherId,
        name: displayName,
        subjectLabel: label,
        latestTime: entry.start,
        profileImage: profileMap.get(otherId) || "",
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

    return filtered.sort(
      (a, b) => (b.latestTime?.getTime() || 0) - (a.latestTime?.getTime() || 0)
    );
  }, [
    currentUserId,
    userMap,
    profileMap,
    search,
    confirmedAppointments,
  ]);

  const totalConversationPages = Math.max(
    1,
    Math.ceil(conversations.length / PAGE_SIZE)
  );
  const pagedConversations = useMemo(
    () =>
      conversations.slice(
        (conversationPage - 1) * PAGE_SIZE,
        conversationPage * PAGE_SIZE
      ),
    [conversations, conversationPage]
  );

  const threadMessages = useMemo(() => {
    if (!selectedAppointmentId) return [];
    const list = messagesByAppointment.get(selectedAppointmentId) || [];
    const filtered = viewArchive
      ? list.filter((row) => archivedMessageIds.has(row.message_id))
      : list.filter((row) => !archivedMessageIds.has(row.message_id));
    return filtered.map((row) => ({
      ...row,
      senderProfile: profileMap.get(row.sender_id) || "",
    }));
  }, [messagesByAppointment, selectedAppointmentId, profileMap, archivedMessageIds, viewArchive]);

  const selectedUserAppointments = useMemo(() => {
    if (!selectedUserId || !currentUserId) return [];
    const rows = confirmedAppointments.filter(
      (appointment) =>
        (appointment.user_id === currentUserId &&
          appointment.tutor_id === selectedUserId) ||
        (appointment.user_id === selectedUserId &&
          appointment.tutor_id === currentUserId)
    );

    const filtered = rows.filter((appointment) => {
      if (!appointment.appointment_id) return false;
      return viewArchive
        ? archivedAppointmentIds.has(appointment.appointment_id)
        : activeAppointmentIds.has(appointment.appointment_id);
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(
        `${a.date}T${a.start_time || "00:00"}`
      ).getTime();
      const bTime = new Date(
        `${b.date}T${b.start_time || "00:00"}`
      ).getTime();
      return bTime - aTime;
    });
  }, [
    confirmedAppointments,
    selectedUserId,
    currentUserId,
    viewArchive,
    activeAppointmentIds,
    archivedAppointmentIds,
  ]);

  const totalArchivePages = Math.max(
    1,
    Math.ceil(archivedAppointmentsList.length / PAGE_SIZE)
  );
  const pagedArchivedAppointments = useMemo(
    () =>
      archivedAppointmentsList.slice(
        (archivePage - 1) * PAGE_SIZE,
        archivePage * PAGE_SIZE
      ),
    [archivedAppointmentsList, archivePage]
  );

  const totalSessionPages = Math.max(
    1,
    Math.ceil(selectedUserAppointments.length / PAGE_SIZE)
  );
  const pagedSelectedUserAppointments = useMemo(
    () =>
      selectedUserAppointments.slice(
        (sessionPage - 1) * PAGE_SIZE,
        sessionPage * PAGE_SIZE
      ),
    [selectedUserAppointments, sessionPage]
  );

  useEffect(() => {
    setConversationPage(1);
  }, [search, viewArchive]);

  useEffect(() => {
    setArchivePage(1);
  }, [archivedAppointmentsList.length, viewArchive]);

  useEffect(() => {
    setSessionPage(1);
  }, [selectedUserId, selectedUserAppointments.length, viewArchive]);

  useEffect(() => {
    if (conversationPage > totalConversationPages) {
      setConversationPage(totalConversationPages);
    }
  }, [conversationPage, totalConversationPages]);

  useEffect(() => {
    if (archivePage > totalArchivePages) {
      setArchivePage(totalArchivePages);
    }
  }, [archivePage, totalArchivePages]);

  useEffect(() => {
    if (sessionPage > totalSessionPages) {
      setSessionPage(totalSessionPages);
    }
  }, [sessionPage, totalSessionPages]);

  const selectedAppointment = useMemo(
    () =>
      confirmedAppointments.find(
        (appointment) => appointment.appointment_id === selectedAppointmentId
      ) || null,
    [confirmedAppointments, selectedAppointmentId]
  );

  const selectedUserProfile = useMemo(() => {
    if (!selectedUserId) return "";
    return profileMap.get(selectedUserId) || "";
  }, [selectedUserId, profileMap]);

  const selectedPartnerId = useMemo(() => {
    if (!selectedAppointment || !currentUserId) return null;
    return selectedAppointment.user_id === currentUserId
      ? selectedAppointment.tutor_id
      : selectedAppointment.user_id;
  }, [selectedAppointment, currentUserId]);

  const isSessionClosed = useMemo(() => {
    if (!selectedAppointment) return false;
    if (selectedAppointment.status === "cancelled") return true;
    if (!selectedAppointment.date || !selectedAppointment.end_time) return false;
    const endAt = new Date(`${selectedAppointment.date}T${selectedAppointment.end_time}`);
    if (Number.isNaN(endAt.getTime())) return false;
    return Date.now() > endAt.getTime();
  }, [selectedAppointment]);

  const sessionCancelReason = useMemo(() => {
    if (!selectedAppointment || selectedAppointment.status !== "cancelled") return "";
    return (
      selectedAppointment.tutor_decline_reason ||
      selectedAppointment.tutee_decline_reason ||
      "Session was cancelled."
    );
  }, [selectedAppointment]);

  const handleArchiveSession = async (appointmentId) => {
    if (!currentUserId) return;
    const sessionMessages = messagesByAppointment.get(appointmentId) || [];
    if (sessionMessages.length === 0) return;
    if (!window.confirm("Add this session to archive?")) return;

    const rows = sessionMessages.map((message) => ({
      user_id: currentUserId,
      message_id: message.message_id,
    }));

    const { error } = await supabase
      .from("message_archive")
      .upsert(rows, { onConflict: "user_id,message_id" });

    if (error) {
      console.error("Unable to archive messages:", error.message);
      return;
    }

    setArchivedMessageIds((prev) => {
      const next = new Set(prev);
      sessionMessages.forEach((message) => next.add(message.message_id));
      return next;
    });
    setActiveSessionMenuId(null);
    if (selectedAppointmentId === appointmentId) {
      setSelectedAppointmentId(null);
      setDraft("");
    }
  };

  const handleUnarchiveSession = async (appointmentId) => {
    if (!currentUserId) return;
    const sessionMessages = messagesByAppointment.get(appointmentId) || [];
    if (sessionMessages.length === 0) return;
    if (!window.confirm("Remove this session from archive?")) return;

    const messageIds = sessionMessages.map((message) => message.message_id);
    const { error } = await supabase
      .from("message_archive")
      .delete()
      .eq("user_id", currentUserId)
      .in("message_id", messageIds);

    if (error) {
      console.error("Unable to unarchive messages:", error.message);
      return;
    }

    setArchivedMessageIds((prev) => {
      const next = new Set(prev);
      messageIds.forEach((id) => next.delete(id));
      return next;
    });
    setActiveSessionMenuId(null);
    setViewArchive(false);
  };

  const handleSendMessage = async () => {
    const trimmed = draft.trim();
    if (
      !trimmed ||
      !currentUserId ||
      !selectedPartnerId ||
      !selectedAppointmentId ||
      isSessionClosed
    ) {
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

  const handleViewAppointmentDetails = (appointmentId) => {
    const targetPath = roleLabel === "Tutor" ? "/dashboard/schedule" : "/dashboard/schedules";
    const notification = {
      notification_id: `msg-${appointmentId}`,
      notification_content: `Appointment details [appointment_id:${appointmentId}]`,
    };
    navigate(targetPath, { state: { notification } });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <MdMessage />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Messages</h1>
              <p className="text-sm text-gray-500">
                Active chats for {roleLabel.toLowerCase()} accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewArchive((prev) => !prev);
              setSelectedAppointmentId(null);
              setActiveSessionMenuId(null);
              setDraft("");
            }}
            className="self-start rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition"
          >
            {viewArchive ? "Back to inbox" : "View archive"}
          </button>
        </header>

        <div className={`grid gap-6 ${viewArchive ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-[320px_1fr]"}`}>
          {!viewArchive && (
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
                <>
                  <div className="space-y-3">
                    {pagedConversations.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setSelectedUserId(item.id);
                          setSelectedAppointmentId(null);
                          setDraft("");
                        }}
                        className={`relative w-full text-left flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                          selectedUserId === item.id
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-100 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {item.profileImage ? (
                            <img
                              src={item.profileImage}
                              alt={item.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                              {item.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {item.name} - {item.subjectLabel}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {conversations.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                      <button
                        type="button"
                        onClick={() =>
                          setConversationPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={conversationPage === 1}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span>
                        Page {conversationPage} of {totalConversationPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConversationPage((prev) =>
                            Math.min(totalConversationPages, prev + 1)
                          )
                        }
                        disabled={conversationPage === totalConversationPages}
                        className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 flex flex-col gap-4">
            {viewArchive && !selectedAppointmentId ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-800">Archive</p>
                    <p className="text-xs text-gray-500">
                      All archived sessions across tutors.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {archivedAppointmentsList.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      No archived sessions yet.
                    </div>
                  ) : (
                    pagedArchivedAppointments.map((appointment) => {
                      const otherId =
                        appointment.user_id === currentUserId
                          ? appointment.tutor_id
                          : appointment.user_id;
                      const name = userMap.get(otherId) || "User";
                      const profileImage = profileMap.get(otherId) || "";
                      return (
                        <div
                          key={appointment.appointment_id}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {profileImage ? (
                                <img
                                  src={profileImage}
                                  alt={name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                                  {name
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {appointment.subject || "Subject"} -{" "}
                                  {appointment.topic || "Topic"}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {appointment.date} {appointment.start_time}
                                  {appointment.end_time
                                    ? ` - ${appointment.end_time}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <div className="relative" data-session-menu>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSessionMenuId((prev) =>
                                    prev === appointment.appointment_id
                                      ? null
                                      : appointment.appointment_id
                                  )
                                }
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="Session options"
                              >
                                <MdMoreVert />
                              </button>
                              {activeSessionMenuId === appointment.appointment_id && (
                                <div className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() =>
                                      handleUnarchiveSession(appointment.appointment_id)
                                    }
                                  >
                                    Unarchive chat
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAppointmentId(appointment.appointment_id);
                                setSelectedUserId(otherId);
                                setActiveSessionMenuId(null);
                              }}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              View this session
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {archivedAppointmentsList.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                    <button
                      type="button"
                      onClick={() => setArchivePage((prev) => Math.max(1, prev - 1))}
                      disabled={archivePage === 1}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span>
                      Page {archivePage} of {totalArchivePages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setArchivePage((prev) => Math.min(totalArchivePages, prev + 1))
                      }
                      disabled={archivePage === totalArchivePages}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : !selectedAppointmentId ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                  {selectedUserId && selectedUserProfile ? (
                    <img
                      src={selectedUserProfile}
                      alt={selectedUserId ? userMap.get(selectedUserId) || "User" : "User"}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {selectedUserId
                        ? (userMap.get(selectedUserId) || "User")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                        : "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-800">
                      {selectedUserId ? userMap.get(selectedUserId) || "User" : "Select a chat"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedUserAppointments.length > 0
                        ? `Latest subject: ${selectedUserAppointments[0].subject || "Subject"}`
                        : viewArchive
                          ? "No archived sessions yet"
                          : "No confirmed sessions yet"}
                    </p>
                  </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {pagedSelectedUserAppointments.map((appointment) => (
                    <div
                      key={appointment.appointment_id}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                          <span className="font-semibold">
                            {appointment.subject || "Subject"}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span>{appointment.topic || "Topic"}</span>
                          <span className="text-gray-400">•</span>
                          <span>
                            {appointment.date} {appointment.start_time}
                            {appointment.end_time
                              ? ` - ${appointment.end_time}`
                              : ""}
                          </span>
                        </div>
                        <div className="relative" data-session-menu>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSessionMenuId((prev) =>
                                prev === appointment.appointment_id
                                  ? null
                                  : appointment.appointment_id
                              )
                            }
                            className="text-gray-500 hover:text-gray-700"
                            aria-label="Session options"
                          >
                            <MdMoreVert />
                          </button>
                          {activeSessionMenuId === appointment.appointment_id && (
                            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setActiveSessionMenuId(null);
                                  handleViewAppointmentDetails(appointment.appointment_id);
                                }}
                              >
                                View appointment details
                              </button>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() =>
                                  viewArchive
                                    ? handleUnarchiveSession(appointment.appointment_id)
                                    : handleArchiveSession(appointment.appointment_id)
                                }
                              >
                                {viewArchive ? "Unarchive chat" : "Add to archive"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAppointmentId(appointment.appointment_id);
                            setActiveSessionMenuId(null);
                          }}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          View this session
                        </button>
                      </div>
                    </div>
                  ))}
                  {selectedUserAppointments.length === 0 && (
                    <div className="text-sm text-gray-500">
                      Select a user with a confirmed appointment to view sessions.
                    </div>
                  )}
                </div>
                {selectedUserAppointments.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                    <button
                      type="button"
                      onClick={() => setSessionPage((prev) => Math.max(1, prev - 1))}
                      disabled={sessionPage === 1}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span>
                      Page {sessionPage} of {totalSessionPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSessionPage((prev) =>
                          Math.min(totalSessionPages, prev + 1)
                        )
                      }
                      disabled={sessionPage === totalSessionPages}
                      className="px-2 py-1 rounded border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {selectedAppointment ? (
                    <div className="flex items-start justify-between gap-3">
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
                      {!viewArchive && (
                        <div className="relative" data-session-menu>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSessionMenuId((prev) =>
                                prev === "session-header" ? null : "session-header"
                              )
                            }
                            className="text-gray-500 hover:text-gray-700"
                            aria-label="Session options"
                          >
                            <MdMoreVert />
                          </button>
                          {activeSessionMenuId === "session-header" && (
                            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setActiveSessionMenuId(null);
                                  handleViewAppointmentDetails(selectedAppointmentId);
                                }}
                              >
                                View appointment details
                              </button>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => {
                                  setActiveSessionMenuId(null);
                                  handleArchiveSession(selectedAppointmentId);
                                }}
                              >
                                Add to archive
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span>No appointment details available.</span>
                  )}
                </div>
                {selectedAppointment?.status === "cancelled" && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Session cancelled. Reason: {sessionCancelReason}
                  </div>
                )}

                <div className="border-t border-gray-100" />

                <div className="flex-1 space-y-4">
                  {viewArchive ? (
                    <div className="text-sm text-gray-500">Empty chat.</div>
                  ) : loading ? (
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
                        <div className="flex items-end gap-2">
                          {message.sender_id !== currentUserId && (
                            message.senderProfile ? (
                              <img
                                src={message.senderProfile}
                                alt="Sender"
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600">
                                {(userMap.get(message.sender_id) || "U")
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)}
                              </div>
                            )
                          )}
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
                      </div>
                    ))
                  )}
                </div>

                {!viewArchive && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 flex items-end gap-2">
                    <textarea
                      rows={2}
                      className="w-full resize-none bg-transparent text-sm text-gray-700 focus:outline-none"
                      placeholder={
                        isSessionClosed
                          ? "Messaging closed after session end."
                          : "Type a message..."
                      }
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={!selectedAppointmentId || sending || isSessionClosed}
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={
                        !draft.trim() ||
                        !selectedAppointmentId ||
                        sending ||
                        isSessionClosed
                      }
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAppointmentId(null);
                    setDraft("");
                  }}
                  className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                >
                  Close this session
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default MessageSystem;



