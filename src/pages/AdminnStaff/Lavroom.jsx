import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { toast } from "react-hot-toast";

const Lavroom = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAppointments = async () => {
    try {
      // Fetch all appointments with tutor and student names
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

      // Format data to match expected structure
      const formattedData = (data || []).map(appointment => ({
        ...appointment,
        tutor_name: appointment.tutor?.name || null,
        student_name: appointment.student?.name || null
      }));

      setAppointments(formattedData);
    } catch (err) {
      console.error(err.message);
      toast.error("Error loading appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAppointments();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "declined":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDelete = async (appointmentId) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("appointment")
        .delete()
        .eq("appointment_id", appointmentId);

      if (error) throw error;

      getAppointments(); // Refresh the list
      toast.success("Appointment deleted successfully");
    } catch (err) {
      console.error(err.message);
      toast.error("Error deleting appointment");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <h1 className="text-blue-600 font-bold text-xl md:text-2xl">Schedules</h1>
        <div className="mt-4 md:mt-6 text-center text-sm md:text-base">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600 mb-4 md:mb-6">Lavroom</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {appointments.length > 0 ? appointments.map((appointment) => (
            <div
              key={appointment.appointment_id}
              className="bg-white p-4 md:p-5 rounded-lg shadow-md border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3 md:mb-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-600 flex-1 pr-2">
                  {appointment.subject}
                </h3>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                    appointment.status
                  )}`}
                >
                  {appointment.status}
                </span>
              </div>
              <div className="space-y-2 mb-4">
                <p className="text-sm md:text-base text-gray-600 break-words">
                  <span className="font-medium">Tutor:</span> {appointment.tutor_name || "N/A"}
                </p>
                <p className="text-sm md:text-base text-gray-600 break-words">
                  <span className="font-medium">Student:</span> {appointment.student_name || "N/A"}
                </p>
                <p className="text-sm md:text-base text-gray-600 break-words">
                  <span className="font-medium">Specialization:</span> {appointment.topic || "N/A"}
                </p>
                <p className="text-sm md:text-base text-gray-600 break-words">
                  <span className="font-medium">Mode:</span> {appointment.mode_of_session || "N/A"}
                </p>
                <p className="text-sm md:text-base text-gray-600">
                  <span className="font-medium">Date:</span> {formatDate(appointment.date)}
                </p>
                <p className="text-sm md:text-base text-gray-600">
                  <span className="font-medium">Time:</span> {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                </p>
              </div>

              <button 
                onClick={() => handleDelete(appointment.appointment_id)}
                className="w-full bg-red-500 text-white rounded-md px-4 py-2 text-sm hover:bg-red-400 transition duration-300 mt-2"
              >
                Delete
              </button>
            </div>
          )) : (
            <div className="col-span-full bg-white p-6 rounded-lg border border-gray-200 text-center">
              <p className="text-sm md:text-base text-gray-500">No appointments found</p>
            </div>
          )}
        </div>
      </div>
  );
};

export default Lavroom;
