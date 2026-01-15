import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import useActionGuard from "../../hooks/useActionGuard";

const Announcments = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const { run: runAction, busy: actionBusy } = useActionGuard();

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const { data, error } = await supabase
          .from("announcement")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = no rows returned
          throw error;
        }

        if (data) {
          setAnnouncement(data);
          setAnnouncementContent(data.announcement_content);
        }
      } catch (error) {
        console.error("Error fetching announcement:", error);
      }
    };
    fetchAnnouncement();
  }, []);

  // Announcement submit
  const handleAnnouncementSubmit = (e) => {
    e.preventDefault();
    runAction(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        alert("You must be logged in to create/update announcements");
        return;
      }

      if (announcement && isEditingAnnouncement) {
        const { data, error } = await supabase
          .from("announcement")
          .update({
            announcement_content: announcementContent,
            updated_at: new Date().toISOString(),
          })
          .eq("announcement_id", announcement.announcement_id)
          .select()
          .single();

        if (error) throw error;

        setAnnouncement(data);
        alert("Announcement updated successfully.");
      } else {
        const { data, error } = await supabase
          .from("announcement")
          .insert([
            {
              user_id: session.user.id,
              announcement_content: announcementContent,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setAnnouncement(data);
        alert("Announcement created successfully.");
      }
      setIsEditingAnnouncement(false);
    }, "Unable to save announcement.");
  };

  // Announcement delete
  const handleAnnouncementDelete = () => {
    if (!announcement) return;
    if (window.confirm("Are you sure you want to delete this announcement?")) {
      runAction(async () => {
        const { error } = await supabase
          .from("announcement")
          .delete()
          .eq("announcement_id", announcement.announcement_id);

        if (error) throw error;

        setAnnouncement(null);
        setAnnouncementContent("");
        setIsEditingAnnouncement(false);
        alert("Announcement deleted successfully.");
      }, "Unable to delete announcement.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans p-4 md:p-6">
      {/* Announcement Section */}
      <aside className="flex flex-col items-center">
        <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600 mb-4 md:mb-0">Announcements</h1>
        <div className="w-full max-w-3xl mt-4 space-y-4">
          {announcement ? (
            <div className="bg-white p-5 md:p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
                Current Announcement
              </h2>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                {announcement.announcement_content}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setIsEditingAnnouncement(true)}
                  disabled={actionBusy}
                  className="px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition duration-300 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit
                </button>
                <button
                  onClick={handleAnnouncementDelete}
                  disabled={actionBusy}
                  className="px-5 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-300 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-gray-200 text-center">
              <p className="text-sm md:text-base text-gray-600 italic">No announcement found.</p>
            </div>
          )}

          <form
            onSubmit={handleAnnouncementSubmit}
            className="bg-white p-5 md:p-6 rounded-xl border border-gray-200 shadow-sm"
          >
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
              {isEditingAnnouncement
                ? "Edit Announcement"
                : "Create New Announcement"}
            </h2>
            <textarea
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              placeholder="Text Announcement"
              className="w-full min-h-[140px] p-3 border border-gray-300 rounded-lg mb-3 text-sm md:text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={200}
            />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="submit"
                disabled={actionBusy}
                className="px-5 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition duration-300 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditingAnnouncement
                  ? "Update Announcement"
                  : "Publish Announcement"}
              </button>
              {isEditingAnnouncement && (
                <button
                  type="button"
                  onClick={() => setIsEditingAnnouncement(false)}
                  disabled={actionBusy}
                  className="px-5 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition duration-300 text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
};

export default Announcments;
