import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

import { MdDelete, MdAdd, MdPersonRemove, MdAdminPanelSettings, MdMoreHoriz, MdClose } from "react-icons/md";
import { FaUserTie, FaChalkboardTeacher, FaUserAlt } from "react-icons/fa";
import { FiSearch } from "react-icons/fi";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const normalizeRole = (role) => (role || "").toString().trim().toLowerCase();
  const isAdminUser = (user) => Boolean(user?.is_admin || user?.is_superadmin);

  // Get all users
  const getAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("user_id, name, email, role, is_admin, is_superadmin")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const users = data || [];
      const userIds = users.map((user) => user.user_id).filter(Boolean);
      let tutorProfileMap = {};
      let studentProfileMap = {};

      if (userIds.length) {
        const { data: tutorProfiles, error: tutorProfileError } = await supabase
          .from("profile")
          .select("user_id, program, college, year_level, profile_image, subject, specialization")
          .in("user_id", userIds);
        if (tutorProfileError && tutorProfileError.code !== "PGRST116") {
          throw tutorProfileError;
        }
        tutorProfileMap = (tutorProfiles || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {});

        const { data: studentProfiles, error: studentProfileError } = await supabase
          .from("student_profile")
          .select("user_id, program, college, year_level, profile_image")
          .in("user_id", userIds);
        if (studentProfileError && studentProfileError.code !== "PGRST116") {
          throw studentProfileError;
        }
        studentProfileMap = (studentProfiles || []).reduce((acc, profile) => {
          acc[profile.user_id] = profile;
          return acc;
        }, {});
      }

      const mergedUsers = users.map((user) => {
        const role = normalizeRole(user.role);
        const tutorProfile = tutorProfileMap[user.user_id];
        const studentProfile = studentProfileMap[user.user_id];
        const profile = role === "tutor" ? tutorProfile : studentProfile || tutorProfile;
        return { ...user, profile: profile || null };
      });

      setAllUsers(mergedUsers);
    } catch (err) {
      console.error(err.message);
    }
  };

  const getCurrentUserPermissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("users")
        .select("is_superadmin")
        .eq("user_id", session.user.id)
        .single();
      if (error) throw error;
      setIsSuperAdmin(Boolean(data?.is_superadmin));
    } catch (err) {
      console.error("Error fetching admin permissions:", err.message);
      setIsSuperAdmin(false);
    }
  };

  // Delete only the user row (superadmin only)
  const deleteUser = async (id) => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can delete users.");
      return;
    }
    if (!window.confirm("Delete this user account? Related records will be kept.")) {
      return;
    }

    try {
      const { error: userError } = await supabase.from("users").delete().eq("user_id", id);
      if (userError) throw userError;

      await getAllUsers();
      alert("User deleted successfully.");
      closeUserDetails();
    } catch (err) {
      console.error(err);
      alert("Error deleting user. Please remove related records first or contact support.");
    }
  };

  useEffect(() => {
    getAllUsers();
    getCurrentUserPermissions();
  }, []);

  // Filter users based on selected filter
  const getFilteredUsers = () => {
    switch (selectedFilter) {
      case "Tutor":
        return allUsers.filter((user) => normalizeRole(user.role) === "tutor");
      case "Student":
        return allUsers.filter((user) => normalizeRole(user.role) === "student");
      case "Admin":
        return allUsers.filter((user) => isAdminUser(user));
      default:
        return allUsers.filter((user) => normalizeRole(user.role) !== "admin");
    }
  };

  const filteredUsers = getFilteredUsers();
  const adminCount = allUsers.filter((user) => isAdminUser(user)).length;
  const tutorCount = allUsers.filter((user) => normalizeRole(user.role) === "tutor").length;
  const studentCount = allUsers.filter((user) => normalizeRole(user.role) === "student").length;

  const getRoleLabel = (role) => {
    const normalized = normalizeRole(role);
    if (normalized === "tutor") return "Tutor";
    if (normalized === "student") return "Student";
    return role || "N/A";
  };

  const updateAdminStatus = async (user, nextValue) => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can update admin access.");
      return;
    }
    if (user.is_superadmin) {
      alert("You cannot change the superadmin account.");
      return;
    }
    const prompt = nextValue
      ? `Add ${user.name} as admin? This will set is_admin = true.`
      : `Remove admin access from ${user.name}? This will set is_admin = false.`;
    if (!window.confirm(prompt)) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ is_admin: nextValue })
        .eq("user_id", user.user_id)
        .select("user_id, is_admin");
      if (error) throw error;
      if (data?.length) {
        setAllUsers((prev) =>
          prev.map((item) =>
            item.user_id === data[0].user_id
              ? { ...item, is_admin: data[0].is_admin }
              : item
          )
        );
      }
      await getAllUsers();
      closeUserDetails();
    } catch (err) {
      console.error(err.message);
      alert(`Error updating admin access: ${err.message}`);
    }
  };

  const verifyUserUpdate = async (userId, message) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role, is_admin, is_superadmin")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error(err.message);
      alert(message || "Unable to verify changes. Check your RLS policies.");
      return null;
    }
  };

  const openUserDetails = (user) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setIsDetailsOpen(false);
  };
  
  // Apply search filter
  const searchfilteredUsers = filteredUsers.filter((user) => {
    const name = (user.name || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const yearLevel = (user.profile?.year_level || "").toLowerCase();
    const program = (user.profile?.program || "").toLowerCase();
    const subject = (user.profile?.subject || "").toLowerCase();
    const specialization = (user.profile?.specialization || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return (
      name.includes(term)
      || email.includes(term)
      || yearLevel.includes(term)
      || program.includes(term)
      || subject.includes(term)
      || specialization.includes(term)
    );
  });

  const promoteToTutor = async (user) => {
    if (!window.confirm(`Add ${user.name} as tutor?`)) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ role: "tutor" })
        .eq("user_id", user.user_id)
        .select("user_id, role");

      if (error) throw error;

      if (data?.length) {
        setAllUsers((prev) =>
          prev.map((item) =>
            item.user_id === data[0].user_id ? { ...item, role: data[0].role } : item
          )
        );
      }

      await getAllUsers();
      closeUserDetails();
      const verify = await verifyUserUpdate(user.user_id, "Unable to verify tutor update.");
      if (verify && normalizeRole(verify.role) !== "tutor") {
        alert("Update did not apply. Check your users table RLS policies.");
      }
    } catch (err) {
      console.error(err.message);
      alert(`Error promoting user to tutor: ${err.message}`);
    }
  };

  const demoteToStudent = async (user) => {
    if (!window.confirm(`Move ${user.name} back to student?`)) return;
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ role: "student" })
        .eq("user_id", user.user_id)
        .select("user_id, role");

      if (error) throw error;

      if (data?.length) {
        setAllUsers((prev) =>
          prev.map((item) =>
            item.user_id === data[0].user_id ? { ...item, role: data[0].role } : item
          )
        );
      }

      await getAllUsers();
      closeUserDetails();
      const verify = await verifyUserUpdate(user.user_id, "Unable to verify student update.");
      if (verify && normalizeRole(verify.role) !== "student") {
        alert("Update did not apply. Check your users table RLS policies.");
      }
    } catch (err) {
      console.error(err.message);
      alert(`Error moving user back to student: ${err.message}`);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(searchfilteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = searchfilteredUsers.slice(startIndex, endIndex);
  const allSelectedOnPage =
    currentUsers.length > 0 && currentUsers.every((user) => selectedIds.has(user.user_id));
  const selectedUsers = allUsers.filter((user) => selectedIds.has(user.user_id));
  const canPromoteSelected = selectedUsers.some(
    (user) => normalizeRole(user.role) !== "tutor"
  );
  const canDemoteSelected = selectedUsers.some(
    (user) => normalizeRole(user.role) !== "student"
  );
  const canAddAdminSelected = selectedUsers.some(
    (user) => !user.is_admin && !user.is_superadmin
  );

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSelectFilter = (filter) => {
    setSelectedFilter(filter);
    setCurrentPage(1);
    setShowLanding(false);
  };

  const handleShowLanding = () => {
    setShowLanding(true);
    setSelectedFilter("All");
    setSearchTerm("");
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        currentUsers.forEach((user) => next.delete(user.user_id));
      } else {
        currentUsers.forEach((user) => next.add(user.user_id));
      }
      return next;
    });
  };

  const toggleSelectUser = (userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const bulkMoveToStudent = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one user.");
      return;
    }
    if (!window.confirm(`Move ${ids.length} user(s) to student?`)) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: "student" })
        .in("user_id", ids);
      if (error) throw error;
      await getAllUsers();
      setSelectedIds(new Set());
      closeUserDetails();
    } catch (err) {
      console.error(err.message);
      alert(`Error moving users to student: ${err.message}`);
    }
  };

  const bulkPromoteToTutor = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one user.");
      return;
    }
    if (!window.confirm(`Promote ${ids.length} user(s) to tutor?`)) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: "tutor" })
        .in("user_id", ids);
      if (error) throw error;
      await getAllUsers();
      setSelectedIds(new Set());
      closeUserDetails();
    } catch (err) {
      console.error(err.message);
      alert(`Error promoting users to tutor: ${err.message}`);
    }
  };

  const bulkAddAdmin = async () => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can add admin access.");
      return;
    }
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      alert("Select at least one user.");
      return;
    }
    if (!window.confirm(`Add admin access for ${ids.length} user(s)?`)) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_admin: true })
        .in("user_id", ids);
      if (error) throw error;
      await getAllUsers();
      setSelectedIds(new Set());
      closeUserDetails();
    } catch (err) {
      console.error(err.message);
      alert(`Error updating admin access: ${err.message}`);
    }
  };

  const bulkDeleteUsers = async () => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can delete users.");
      return;
    }
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} user(s) and all of their records?`)) return;
    try {
      for (const id of ids) {
        await deleteUser(id);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err.message);
      alert("Error deleting users.");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600 mb-4 md:mb-6">Users</h1>

      <div className="relative overflow-hidden">
        <div
          className={`flex w-[200%] ${
            showLanding ? "translate-x-0" : "-translate-x-1/2"
          }`}
        >
          <div className="w-1/2 flex flex-col items-center justify-center py-10">
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <button
                type="button"
                onClick={() => handleSelectFilter("Admin")}
                className="flex flex-col items-center gap-4 transition-none focus:outline-none"
              >
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                    <FaUserTie className="text-[#4766fe] text-5xl md:text-6xl" />
                  </div>
                  <span className="text-3xl md:text-4xl font-bold text-[#132c91]">
                    {adminCount}
                  </span>
                <span className="text-lg md:text-xl font-semibold text-[#1f2b5b]">Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectFilter("Tutor")}
                className="flex flex-col items-center gap-4 transition-none focus:outline-none"
              >
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                    <FaChalkboardTeacher className="text-[#4766fe] text-5xl md:text-6xl" />
                  </div>
                  <span className="text-3xl md:text-4xl font-bold text-[#132c91]">
                    {tutorCount}
                  </span>
                <span className="text-lg md:text-xl font-semibold text-[#1f2b5b]">Tutors</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectFilter("Student")}
                className="flex flex-col items-center gap-4 transition-none focus:outline-none"
              >
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                    <FaUserAlt className="text-[#4766fe] text-5xl md:text-6xl" />
                  </div>
                  <span className="text-3xl md:text-4xl font-bold text-[#132c91]">
                    {studentCount}
                  </span>
                <span className="text-lg md:text-xl font-semibold text-[#1f2b5b]">Tutees</span>
              </button>
            </div>
          </div>

          <div className="w-1/2 flex flex-col lg:flex-row gap-3 sm:gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-[28px] border border-[#8a5a2b] p-3 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 border border-[#4766fe] rounded-full px-3 py-2 w-full max-w-[260px]">
                  <FiSearch className="text-[#4766fe]" />
                  <input
                    type="text"
                    placeholder="Search name, year, program..."
                    className="w-full outline-none text-sm text-gray-600 placeholder-gray-400"
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={toggleSelectAll}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  onClick={handleShowLanding}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
              </div>
              <div className="max-h-[220px] sm:max-h-[360px] overflow-y-auto pr-2">
                {currentUsers.length > 0 ? currentUsers.map((user) => {
                  const profile = user.profile || {};
                  const yearLabel = profile.year_level ? profile.year_level : "Year not set";
                  const subjectLabel = profile.subject || profile.specialization || "";
                  const initials = (user.name || "U").charAt(0).toUpperCase();
                  const isChecked = selectedIds.has(user.user_id);

                  return (
                    <div
                      key={user.user_id}
                      className="grid grid-cols-[32px_64px_1fr_32px] items-center gap-4 py-3 sm:py-4 border-b border-blue-200 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectUser(user.user_id)}
                        className="justify-self-start"
                      />
                      <div className="flex items-center justify-center">
                        {profile.profile_image ? (
                          <img
                            src={profile.profile_image}
                            alt={user.name}
                            className="w-14 h-14 rounded-full object-cover border border-blue-200"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full border border-blue-200 flex items-center justify-center text-blue-700 font-semibold">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-gray-500">{yearLabel}</p>
                        {normalizeRole(user.role) === "tutor" && (
                          <p className="text-xs text-gray-500">
                            {subjectLabel || "No subject"}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-blue-700 hover:text-blue-900 p-2"
                        onClick={() => openUserDetails(user)}
                        aria-label="View user details"
                      >
                        <MdMoreHoriz className="text-2xl" />
                      </button>
                  </div>
                );
              }) : (
                <div className="py-10 text-center text-sm text-gray-500">
                  No users found
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-blue-100">
              <div className="text-xs text-gray-500">
                Selected: {selectedIds.size}
              </div>
              <div className="flex flex-wrap gap-2">
                {canPromoteSelected && (
                  <button
                    type="button"
                    onClick={bulkPromoteToTutor}
                    className="px-3 py-1.5 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                    disabled={selectedIds.size === 0}
                  >
                    Promote to Tutor
                  </button>
                )}
                {canDemoteSelected && (
                  <button
                    type="button"
                    onClick={bulkMoveToStudent}
                    className="px-3 py-1.5 text-xs rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100"
                    disabled={selectedIds.size === 0}
                  >
                    Move to Student
                  </button>
                )}
                {isSuperAdmin && canAddAdminSelected && (
                  <button
                    type="button"
                    onClick={bulkAddAdmin}
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    disabled={selectedIds.size === 0}
                  >
                    Add as Admin
                  </button>
                )}
                {isSuperAdmin && selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={bulkDeleteUsers}
                    className="px-3 py-1.5 text-xs rounded-md bg-red-50 text-red-700 hover:bg-red-100"
                    disabled={selectedIds.size === 0}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

          <div className="w-full lg:w-44 flex lg:flex-col gap-1 lg:gap-4 items-center justify-center -mt-6 lg:mt-0">
            <button
              type="button"
              onClick={() => handleSelectFilter("Admin")}
              className="flex flex-col items-center gap-2"
            >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                  <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-[#dfecff] text-[#132c91] text-xs sm:text-sm font-bold flex items-center justify-center shadow-sm">
                    {adminCount}
                  </span>
                  <FaUserTie className="text-[#4766fe] text-2xl sm:text-3xl" />
                </div>
              <span className="text-sm font-semibold text-gray-700">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectFilter("Tutor")}
              className="flex flex-col items-center gap-2"
            >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                  <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-[#dfecff] text-[#132c91] text-xs sm:text-sm font-bold flex items-center justify-center shadow-sm">
                    {tutorCount}
                  </span>
                  <FaChalkboardTeacher className="text-[#4766fe] text-2xl sm:text-3xl" />
                </div>
              <span className="text-sm font-semibold text-gray-700">Tutors</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectFilter("Student")}
              className="flex flex-col items-center gap-2"
            >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-[#cfd8f6] bg-[#f2f7ff] flex items-center justify-center">
                  <span className="absolute -top-2 -right-2 min-w-[28px] h-7 px-2 rounded-full bg-[#dfecff] text-[#132c91] text-xs sm:text-sm font-bold flex items-center justify-center shadow-sm">
                    {studentCount}
                  </span>
                  <FaUserAlt className="text-[#4766fe] text-2xl sm:text-3xl" />
                </div>
              <span className="text-sm font-semibold text-gray-700">Tutees</span>
            </button>
          
          </div>
        </div>
        </div>
      </div>

      {!showLanding && (
      <div>
      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-1 -mt-1 md:mt-6">
        <div className="text-xs md:text-sm text-gray-700 order-2 sm:order-1">
          Showing {searchfilteredUsers.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, searchfilteredUsers.length)} of{" "}
          {searchfilteredUsers.length} entries
        </div>
        <div className="flex gap-2 order-1 sm:order-2">
          <button
            className={`px-3 py-1.5 rounded border text-sm ${
              currentPage === 1
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          <button
            className={`px-3 py-1.5 rounded border text-sm ${
              currentPage === totalPages || totalPages === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next →
          </button>
        </div>
      </div>
      </div>
      )}

      {isDetailsOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-gray-200 shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {selectedUser.profile?.profile_image ? (
                  <img
                    src={selectedUser.profile.profile_image}
                    alt={selectedUser.name}
                    className="w-12 h-12 rounded-full object-cover border border-blue-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border border-blue-200 flex items-center justify-center text-blue-700 font-semibold">
                    {(selectedUser.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold text-gray-800">{selectedUser.name || "Unnamed"}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email || "No email"}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700"
                onClick={closeUserDetails}
                aria-label="Close details"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm text-gray-700">
              <div className="flex justify-between">
                <span className="font-medium">Role</span>
                <span>{getRoleLabel(selectedUser.role)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Year Level</span>
                <span>{selectedUser.profile?.year_level || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Program</span>
                <span>{selectedUser.profile?.program || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">College</span>
                <span>{selectedUser.profile?.college || "Not set"}</span>
              </div>
              {normalizeRole(selectedUser.role) === "tutor" && (
                <>
                  <div className="flex justify-between">
                    <span className="font-medium">Subject</span>
                    <span>{selectedUser.profile?.subject || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Specialization</span>
                    <span>{selectedUser.profile?.specialization || "Not set"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
              {normalizeRole(selectedUser.role) === "student" && (
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => promoteToTutor(selectedUser)}
                >
                  Promote to Tutor
                </button>
              )}
              {normalizeRole(selectedUser.role) === "tutor" && (
                <button
                  className="px-3 py-1.5 text-sm rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100"
                  onClick={() => demoteToStudent(selectedUser)}
                >
                  Move to Student
                </button>
              )}
                {isSuperAdmin && !selectedUser.is_admin && !selectedUser.is_superadmin && (
                  <button
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    } ${selectedUser.is_superadmin ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => updateAdminStatus(selectedUser, true)}
                  >
                    Add as Admin
                  </button>
                )}
                {isSuperAdmin && selectedUser.is_admin && !selectedUser.is_superadmin && (
                  <button
                    className="px-3 py-1.5 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    onClick={() => updateAdminStatus(selectedUser, false)}
                  >
                    Remove as Admin
                  </button>
                )}
              {isSuperAdmin && (
                <button
                  className={`px-3 py-1.5 text-sm rounded-md bg-red-50 text-red-700 hover:bg-red-100 ${
                    selectedUser.is_superadmin ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => deleteUser(selectedUser.user_id)}
                  disabled={selectedUser.is_superadmin}
                >
                  Delete User
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
