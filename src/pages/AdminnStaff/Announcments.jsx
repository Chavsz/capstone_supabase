import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

const Announcments = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);

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
  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    try {
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
    } catch (error) {
      console.error("Error submitting announcement:", error);
      alert("Failed to submit announcement.");
    }
  };

  // Announcement delete
  const handleAnnouncementDelete = async () => {
    if (!announcement) return;
    if (window.confirm("Are you sure you want to delete this announcement?")) {
      try {
        const { error } = await supabase
          .from("announcement")
          .delete()
          .eq("announcement_id", announcement.announcement_id);

        if (error) throw error;

        setAnnouncement(null);
        setAnnouncementContent("");
        setIsEditingAnnouncement(false);
        alert("Announcement deleted successfully.");
      } catch (error) {
        console.error("Error deleting announcement:", error);
        alert("Failed to delete announcement.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans p-4 md:p-6">
      {/* Announcement Section */}
      <aside className="flex flex-col items-center">
        <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600 mb-4 md:mb-0">Announcements</h1>

        {announcement ? (
          <div className="bg-white p-4 md:p-6 rounded-md border border-gray-300 mb-4 md:mb-6 mt-4 w-full max-w-3xl text-center">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
              Current Announcement
            </h2>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {announcement.announcement_content}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
              <button
                onClick={() => setIsEditingAnnouncement(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-300 focus:ring-offset-2 text-sm md:text-base"
              >
                Edit
              </button>
              <button
                onClick={handleAnnouncementDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-300 focus:ring-offset-2 text-sm md:text-base"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-md mb-4 md:mb-6 text-center mt-4 w-full max-w-3xl">
            <p className="text-sm md:text-base text-gray-600 italic">No announcement found.</p>
          </div>
        )}

        <form
          onSubmit={handleAnnouncementSubmit}
          className="bg-white p-4 md:p-6 rounded-md border border-gray-300 flex flex-col w-full max-w-3xl text-center"
        >
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
            {isEditingAnnouncement
              ? "Edit Announcement"
              : "Create New Announcement"}
          </h2>
          <input
            type="text"
            value={announcementContent}
            onChange={(e) => setAnnouncementContent(e.target.value)}
            placeholder="Enter your announcement here..."
            className="w-full p-2 md:p-3 border border-gray-300 rounded-md mb-3 text-sm md:text-base text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
            required
            maxLength={100}
          />
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300 text-sm md:text-base"
            >
              {isEditingAnnouncement
                ? "Update Announcement"
                : "Publish Announcement"}
            </button>
            {isEditingAnnouncement && (
              <button
                type="button"
                onClick={() => setIsEditingAnnouncement(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition duration-300 text-sm md:text-base"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
};

export default Announcments;
