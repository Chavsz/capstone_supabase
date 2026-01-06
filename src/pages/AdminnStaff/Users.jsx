import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

import { MdDelete, MdAdd, MdPersonRemove, MdAdminPanelSettings } from "react-icons/md";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Get all users
  const getAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("user_id, name, email, role, is_admin, is_superadmin")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAllUsers(data || []);
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

  // Delete a user (and related records) from the database
  const deleteUser = async (id) => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can delete users.");
      return;
    }
    if (!window.confirm("Delete this user and all of their records? This cannot be undone.")) {
      return;
    }

    try {
      // Remove schedules tied to the tutor's profile first
      const { data: tutorProfiles, error: tutorProfileError } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", id);
      if (tutorProfileError && tutorProfileError.code !== "PGRST116") throw tutorProfileError;

      const profileIds = (tutorProfiles || [])
        .map((profile) => profile.profile_id)
        .filter(Boolean);

      if (profileIds.length > 0) {
        const { error: scheduleError } = await supabase
          .from("schedule")
          .delete()
          .in("profile_id", profileIds);
        if (scheduleError && scheduleError.code !== "PGRST116") throw scheduleError;
      }

      // Remove tutor/student profile entries
      const profileTables = ["profile", "student_profile"];
      for (const table of profileTables) {
        const { error } = await supabase.from(table).delete().eq("user_id", id);
        if (error && error.code !== "PGRST116") throw error;
      }

      // Remove appointments and evaluations referencing the user
      // Delete evaluations first to avoid foreign key violations on appointment_id
      const relationalDeletes = [
        {
          table: "evaluation",
          filter: (query) => query.or(`tutor_id.eq.${id},user_id.eq.${id}`),
        },
        {
          table: "appointment",
          filter: (query) => query.or(`tutor_id.eq.${id},user_id.eq.${id}`),
        },
      ];

      for (const { table, filter } of relationalDeletes) {
        const query = supabase.from(table).delete();
        const { error } = await filter(query);
        if (error && error.code !== "PGRST116") throw error;
      }

      // Finally delete the user row
      const { error: userError } = await supabase.from("users").delete().eq("user_id", id);
      if (userError) throw userError;

      // Attempt to remove from Supabase Auth (requires service role key)
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError) {
          console.warn("Unable to delete auth user:", authError.message);
        }
      } catch (authAdminError) {
        console.warn("Auth admin unavailable:", authAdminError.message);
      }

      await getAllUsers();
      alert("User deleted successfully.");
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
  const normalizeRole = (role) => (role || "").toString().trim().toLowerCase();

  const getFilteredUsers = () => {

    switch (selectedFilter) {
      case "Tutor":
        return allUsers.filter((user) => normalizeRole(user.role) === "tutor");
      case "Student":
        return allUsers.filter((user) => normalizeRole(user.role) === "student");
      default:
        return allUsers.filter((user) => normalizeRole(user.role) !== "admin");
    }
  };

  const filteredUsers = getFilteredUsers();

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
      ? `Grant admin access to ${user.name}?`
      : `Remove admin access from ${user.name}?`;
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
    } catch (err) {
      console.error(err.message);
      alert(`Error updating admin access: ${err.message}`);
    }
  };
  
  // Apply search filter
  const searchfilteredUsers = filteredUsers.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
    || user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <h1 className="text-[20px] md:text-[24px] font-bold text-gray-600 mb-4 md:mb-6">Users</h1>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-6">
        {/* Filter Buttons */}
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          {["All", "Tutor", "Student"].map((filter) => (
            <button
              key={filter}
              className={`px-3 md:px-4 py-2 font-medium transition-all duration-200 text-sm md:text-base text-gray-600 border-b-2 whitespace-nowrap ${
                selectedFilter === filter
                  ? "border-b-2 border-b-blue-600"
                  : " border-b-2 border-b-transparent"
              }`}
              onClick={() => {
                setSelectedFilter(filter);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by name or email"
            className="w-full sm:w-[250px] md:w-[300px] px-3 md:px-4 py-2 bg-gray-100 border-b-2 border-b-transparent outline-none focus:border-b-blue-600 focus:border-b-2 text-sm md:text-base"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentUsers.length > 0 ? currentUsers.map((user) => (
              <tr key={user.user_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>{getRoleLabel(user.role)}</span>
                    {user.is_superadmin && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                        Superadmin
                      </span>
                    )}
                    {!user.is_superadmin && user.is_admin && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                        Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    {normalizeRole(user.role) === "student" && (
                      <button
                        className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded-md"
                        onClick={() => promoteToTutor(user)}
                        title="Add as tutor"
                        aria-label="Add as tutor"
                      >
                        <MdAdd />
                      </button>
                    )}
                    {normalizeRole(user.role) === "tutor" && (
                      <button
                        className="text-gray-400 hover:text-orange-500 px-2 py-1 rounded-md"
                        onClick={() => demoteToStudent(user)}
                        title="Send back to student list"
                        aria-label="Demote to student"
                      >
                        <MdPersonRemove />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        className={`px-2 py-1 rounded-md ${
                          user.is_admin
                            ? "text-blue-600 hover:text-blue-700"
                            : "text-gray-400 hover:text-blue-500"
                        } ${user.is_superadmin ? "opacity-40 cursor-not-allowed" : ""}`}
                        onClick={() => updateAdminStatus(user, !user.is_admin)}
                        disabled={user.is_superadmin}
                        aria-label={user.is_admin ? "Remove admin access" : "Grant admin access"}
                        title={user.is_admin ? "Remove admin access" : "Grant admin access"}
                      >
                        <MdAdminPanelSettings />
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        className={`px-2 py-1 rounded-md ${
                          user.is_superadmin
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-400 hover:text-red-500"
                        }`}
                        onClick={() => deleteUser(user.user_id)}
                        disabled={user.is_superadmin}
                        aria-label="Delete user"
                      >
                        <MdDelete />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {currentUsers.length > 0 ? currentUsers.map((user) => (
          <div
            key={user.user_id}
            className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {user.name}
                </h3>
                <p className="text-sm text-gray-600 break-words mb-2">
                  {user.email}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                    {getRoleLabel(user.role)}
                  </span>
                  {user.is_superadmin && (
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700">
                      Superadmin
                    </span>
                  )}
                  {!user.is_superadmin && user.is_admin && (
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {normalizeRole(user.role) === "student" && (
                  <button
                    className="text-gray-400 hover:text-blue-500 p-2 rounded-md"
                    onClick={() => promoteToTutor(user)}
                    aria-label="Add as tutor"
                  >
                    <MdAdd className="w-5 h-5" />
                  </button>
                )}
                {normalizeRole(user.role) === "tutor" && (
                  <button
                    className="text-gray-400 hover:text-orange-500 p-2 rounded-md"
                    onClick={() => demoteToStudent(user)}
                    aria-label="Demote to student"
                  >
                    <MdPersonRemove className="w-5 h-5" />
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    className={`p-2 rounded-md ${
                      user.is_admin
                        ? "text-blue-600 hover:text-blue-700"
                        : "text-gray-400 hover:text-blue-500"
                    } ${user.is_superadmin ? "opacity-40 cursor-not-allowed" : ""}`}
                    onClick={() => updateAdminStatus(user, !user.is_admin)}
                    disabled={user.is_superadmin}
                    aria-label={user.is_admin ? "Remove admin access" : "Grant admin access"}
                  >
                    <MdAdminPanelSettings className="w-5 h-5" />
                  </button>
                )}
                {isSuperAdmin && (
                  <button
                    className={`p-2 rounded-md ${
                      user.is_superadmin
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-400 hover:text-red-500"
                    }`}
                    onClick={() => deleteUser(user.user_id)}
                    disabled={user.is_superadmin}
                    aria-label="Delete user"
                  >
                    <MdDelete className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
            <p className="text-sm text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 md:mt-6">
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
  );
};

export default Users;
