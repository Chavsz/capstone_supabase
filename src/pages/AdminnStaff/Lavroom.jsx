import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";
import { capitalizeWords } from "../../utils/text";
import useActionGuard from "../../hooks/useActionGuard";
import { useDataSync } from "../../contexts/DataSyncContext";
import LoadingButton from "../../components/LoadingButton";

const STATUS_META = {
  pending: { label: "Pending", badge: "bg-[#c9c7c9] text-[#323335]" },
  confirmed: { label: "Confirmed", badge: "bg-[#4766fe] text-white" },
  started: { label: "In Session", badge: "bg-[#76acf5] text-[#0f2d58]" },
  awaiting_feedback: { label: "Awaiting Feedback", badge: "bg-[#935226] text-white" },
  completed: { label: "Completed", badge: "bg-[#00a65a] text-white" },
  declined: { label: "Declined", badge: "bg-[#323335] text-white" },
  cancelled: { label: "Cancelled", badge: "bg-[#ff4b4b] text-white" },
};

const STATUS_FILTERS = ["all", ...Object.keys(STATUS_META)];

const Lavroom = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { run: runAction, busy: actionBusy } = useActionGuard();
  const { version } = useDataSync();

  const getAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("appointment")
        .select(`
          *,
          tutor:users!appointment_tutor_id_fkey(name),
          student:users!appointment_user_id_fkey(name)
        `)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((appointment) => ({
        ...appointment,
        tutor_name: appointment.tutor?.name || "Unknown tutor",
        student_name: appointment.student?.name || "Unknown student",
      }));

      setAppointments(formatted);
    } catch (err) {
      console.error(err.message);
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAppointments();
  }, [version]);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (timeString) =>
    new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const handleDelete = (appointmentId) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    runAction(async () => {
      const { error } = await supabase
        .from("appointment")
        .delete()
        .eq("appointment_id", appointmentId);

      if (error) throw error;
      toast.success("Appointment deleted successfully");
      getAppointments();
    }, "Unable to delete appointment.");
  };

  const summary = appointments.reduce(
    (acc, item) => {
      acc.total += 1;
      const key = item.status?.toLowerCase();
      if (key && acc.status[key] !== undefined) {
        acc.status[key] += 1;
      }
      return acc;
    },
    {
      total: 0,
      status: Object.keys(STATUS_META).reduce((map, key) => ({ ...map, [key]: 0 }), {}),
    }
  );

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesStatus =
      statusFilter === "all" ||
      appointment.status?.toLowerCase() === statusFilter;

    const searchable = [
      appointment.subject,
      appointment.topic,
      appointment.tutor_name,
      appointment.student_name,
      appointment.mode_of_session,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchable.includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-xl font-bold text-gray-700">Lavroom</h1>
        <p className="mt-4 text-gray-500 text-sm">Loading appointments…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">
            Admin control centre
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Lavroom
          </h1>
          <p className="text-sm text-gray-500">
            Browse, search, and manage every tutorial session in one place.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tutor, student, or subject…"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === status
                    ? "bg-blue-600 text-white shadow"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"
                }`}
              >
                {status === "all"
                  ? "All"
                  : STATUS_META[status]?.label || status.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryCard label="Total Sessions" value={summary.total} />
        {Object.entries(summary.status).map(([statusKey, value]) => (
          <SummaryCard
            key={statusKey}
            label={STATUS_META[statusKey]?.label || statusKey}
            value={value}
            accent={STATUS_META[statusKey]?.badge}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredAppointments.length ? (
          filteredAppointments.map((appointment) => {
            const statusKey = appointment.status?.toLowerCase();
            const statusMeta = STATUS_META[statusKey] || {};
            return (
              <article
                key={appointment.appointment_id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition"
              >
                <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase text-gray-400 tracking-wide">
                      {formatDate(appointment.date)}
                    </p>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {appointment.subject || "Untitled Session"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {appointment.topic
                        ? capitalizeWords(appointment.topic)
                        : "No specialization provided"}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      statusMeta.badge || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {statusMeta.label || appointment.status}
                  </span>
                </div>

                <div className="p-4 space-y-3 text-sm text-gray-700">
                  <DetailRow
                    label="Tutor"
                    value={capitalizeWords(appointment.tutor_name)}
                  />
                  <DetailRow
                    label="Student"
                    value={capitalizeWords(appointment.student_name)}
                  />
                  <DetailRow
                    label="Mode"
                    value={appointment.mode_of_session || "No mode specified"}
                  />
                  <DetailRow
                    label="Time"
                    value={`${formatTime(appointment.start_time)} – ${formatTime(
                      appointment.end_time
                    )}`}
                  />
                </div>

                <div className="p-4 pt-0">
                  <LoadingButton
                    onClick={() => handleDelete(appointment.appointment_id)}
                    disabled={actionBusy}
                    isLoading={actionBusy}
                    loadingText="Deleting..."
                    className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Appointment
                  </LoadingButton>
                </div>
              </article>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            <p className="text-base font-semibold">No sessions match your filters.</p>
            <p className="text-sm mt-1">Try a different keyword or status.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, accent = "bg-gray-100 text-gray-800" }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
  </div>
);

const DetailRow = ({ label, value }) => (
  <p className="flex justify-between gap-3 text-sm">
    <span className="text-gray-500 font-medium">{label}</span>
    <span className="text-gray-800 text-right">{value}</span>
  </p>
);

export default Lavroom;
