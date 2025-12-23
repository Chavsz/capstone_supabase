import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";
import { FaEdit, FaTimes, FaTrash } from "react-icons/fa";

const Profile = () => {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState({
    program: "",
    college: "",
    year_level: "",
    profile_image: "",
  });
  const [stats, setStats] = useState({
    completed: 0,
    cancelled: 0,
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState(profile);

  async function getName() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("user_id", session.user.id)
        .single();

      if (error) throw error;
      if (data) setName(data.name);
    } catch (err) {
      console.error(err.message);
    }
  }

  async function getProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("student_profile")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (error && error.code !== 'PGRST116' && error.status !== 406) {
        throw error;
      }

      const profileData = data || {
        program: "",
        college: "",
        year_level: "",
        profile_image: "",
      };

      setProfile(profileData);
      setForm(profileData);
    } catch (err) {
      console.error(err.message);
    }
  }

  useEffect(() => {
    getName();
    getProfile();
    getStats();
  }, []);

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("student_profile")
        .select("profile_id")
        .eq("user_id", session.user.id)
        .single();

      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from("student_profile")
          .update({
            program: form.program,
            college: form.college,
            year_level: form.year_level,
            profile_image: form.profile_image,
          })
          .eq("user_id", session.user.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from("student_profile")
          .insert([
            {
              user_id: session.user.id,
              program: form.program,
              college: form.college,
              year_level: form.year_level,
              profile_image: form.profile_image,
            },
          ]);

        if (error) throw error;
      }

      setProfile(form);
      setShowEditModal(false);
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('capstone')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('capstone')
        .getPublicUrl(filePath);

      // Update the profile with the new image URL
      setProfile((prev) => ({
        ...prev,
        profile_image: publicUrl,
      }));
      setForm((prev) => ({ ...prev, profile_image: publicUrl }));
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, profile_image: "" }));
  };

  async function getStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { count: completedCount, error: completedError } = await supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "completed");

      if (completedError) throw completedError;

      const { count: cancelledCount, error: cancelledError } = await supabase
        .from("appointment")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("status", "cancelled");

      if (cancelledError) throw cancelledError;

      setStats({
        completed: completedCount || 0,
        cancelled: cancelledCount || 0,
      });
    } catch (err) {
      console.error("Error loading stats:", err.message);
    }
  }

  return (
    <div className="py-6 px-6 bg-[#f4ece6] min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[#323335] mb-6">My Profile</h1>

        <div className="bg-white rounded-lg shadow-sm border border-[#e6e7ea] p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
            <div className="flex-shrink-0">
              <div className="w-40 h-40 md:w-44 md:h-44 rounded-full bg-[#f0f0f7] flex items-center justify-center overflow-hidden shadow-sm">
                {profile.profile_image ? (
                  <img
                    src={profile.profile_image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[#4c4ba2] text-5xl font-bold">
                    {name ? name.charAt(0).toUpperCase() : "-"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 w-full bg-[#fbfbfd] border border-[#e6e7ea] rounded-lg p-4 relative">
              <button
                onClick={handleEdit}
                className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1 text-sm border border-[#d5d7dc] rounded-md text-[#323335] hover:bg-[#f2f3f6] transition"
              >
                <span>Edit</span>
                <FaEdit size={12} />
              </button>
              <div className="space-y-3 text-[#323335]">
                <p className="text-lg">
                  <span className="font-semibold">Name:</span> {name || "-"}
                </p>
                <p className="text-lg">
                  <span className="font-semibold">Year:</span>{" "}
                  {profile.year_level || "-"}
                </p>
                <p className="text-lg">
                  <span className="font-semibold">Program Course:</span>{" "}
                  {profile.program || "-"}
                </p>
                <p className="text-lg">
                  <span className="font-semibold">College:</span>{" "}
                  {profile.college || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#d8def7] shadow-sm p-4 text-center">
              <p className="text-sm font-semibold text-[#4c4ba2]">Total Sessions Attended</p>
              <p className="text-4xl font-bold text-[#4c4ba2] mt-2">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#d8def7] shadow-sm p-4 text-center">
              <p className="text-sm font-semibold text-[#4c4ba2]">Total Cancelled Sessions</p>
              <p className="text-4xl font-bold text-[#4c4ba2] mt-2">{stats.cancelled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Information Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Information
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Profile Image Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Image
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center">
                    {form.profile_image ? (
                      <img
                        src={form.profile_image}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      name="profile_image"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-sm text-gray-500 ml-2">
                        Upload a new profile picture
                      </p>
                      {form.profile_image && (
                        <button
                          onClick={handleRemoveImage}
                          className="flex items-center gap-1 px-3 py-1 text-sm border border-red-300 rounded-md text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <FaTrash size={12} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={name}
                    disabled
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year Level
                  </label>
                  <select
                    name="year_level"
                    value={form.year_level || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select Year Level</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program/Course
                  </label>
                  <input
                    type="text"
                    name="program"
                    value={form.program || ""}
                    onChange={handleChange}
                    placeholder="BSIT"
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    College
                  </label>
                  <select
                    name="college"
                    value={form.college || ""}
                    onChange={handleChange}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select College</option>
                    <option value="College of Engineering">
                      College of Engineering
                    </option>
                    <option value="College of Arts and Social Sciences">
                      College of Arts and Social Sciences
                    </option>
                    <option value="College of Computer Studies">
                      College of Computer Studies
                    </option>
                    <option value="College of Education">
                      College of Education
                    </option>
                    <option value="College of Health and Sciences">
                      College of Health and Sciences
                    </option>
                    <option value="College of Economics, Business, and Accountancy">
                      College of Economics, Business, and Accountancy
                    </option>
                    <option value="College of Science and Mathematics">
                      College of Science and Mathematics
                    </option>
                  </select>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
