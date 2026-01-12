import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

import {
  MdDelete,
  MdAdd,
  MdPersonRemove,
  MdAdminPanelSettings,
  MdMoreHoriz,
  MdClose,
} from "react-icons/md";
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

  const normalizeRole = (role) =>
    (role || "").toString().trim().toLowerCase();

  const isAdminUser = (user) =>
    Boolean(user?.is_admin || user?.is_superadmin);

  // ------------------ GET USERS ------------------
  const getAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("user_id, name, email, role, is_admin, is_superadmin")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const users = data || [];
      const userIds = users.map((u) => u.user_id).filter(Boolean);

      let tutorProfileMap = {};
      let studentProfileMap = {};

      if (userIds.length) {
        const { data: tutorProfiles } = await supabase
          .from("profile")
          .select(
            "user_id, program, college, year_level, profile_image, subject, specialization"
          )
          .in("user_id", userIds);

        tutorProfileMap = (tutorProfiles || []).reduce((acc, p) => {
          acc[p.user_id] = p;
          return acc;
        }, {});

        const { data: studentProfiles } = await supabase
          .from("student_profile")
          .select("user_id, program, college, year_level, profile_image")
          .in("user_id", userIds);

        studentProfileMap = (studentProfiles || []).reduce((acc, p) => {
          acc[p.user_id] = p;
          return acc;
        }, {});
      }

      const merged = users.map((u) => {
        const role = normalizeRole(u.role);
        const profile =
          role === "tutor"
            ? tutorProfileMap[u.user_id]
            : studentProfileMap[u.user_id] || tutorProfileMap[u.user_id];

        return { ...u, profile: profile || null };
      });

      setAllUsers(merged);
    } catch (err) {
      console.error(err.message);
    }
  };

  // ------------------ CURRENT USER PERMISSIONS ------------------
  const getCurrentUserPermissions = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data } = await supabase
        .from("users")
        .select("is_superadmin")
        .eq("user_id", session.user.id)
        .single();

      setIsSuperAdmin(Boolean(data?.is_superadmin));
    } catch (err) {
      setIsSuperAdmin(false);
    }
  };

  useEffect(() => {
    getAllUsers();
    getCurrentUserPermissions();
  }, []);

  // ------------------ ADMIN STATUS UPDATE (FIXED) ------------------
  const updateAdminStatus = async (user, makeAdmin) => {
    if (!isSuperAdmin) {
      alert("Only the superadmin can update admin access.");
      return;
    }

    if (user.is_superadmin) {
      alert("You cannot change the superadmin account.");
      return;
    }

    const prompt = makeAdmin
      ? `Add ${user.name} as admin?`
      : `Remove admin access from ${user.name}?`;

    if (!window.confirm(prompt)) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ is_admin: makeAdmin })
        .eq("user_id", user.user_id);

      if (error) throw error;

      await getAllUsers();
      setIsDetailsOpen(false);
    } catch (err) {
      console.error(err.message);
      alert(`Error updating admin access: ${err.message}`);
    }
  };

  // ------------------ DELETE USER ------------------
  const deleteUser = async (id) => {
    if (!isSuperAdmin) return alert("Only superadmin can delete users.");

    if (!window.confirm("Delete this user?")) return;

    try {
      await supabase.functions.invoke("delete-user", {
        body: { userId: id },
      });

      await getAllUsers();
      setIsDetailsOpen(false);
    } catch (err) {
      alert("Error deleting user.");
    }
  };

  // ------------------ UI HELPERS ------------------
  const openUserDetails = (user) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
    setIsDetailsOpen(false);
  };

  const getRoleLabel = (role) => {
    const r = normalizeRole(role);
    if (r === "tutor") return "Tutor";
    if (r === "student") return "Student";
    return role || "N/A";
  };

  // ------------------ RENDER ------------------
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-bold mb-4">Users</h1>

      {/* UI REMAINS UNCHANGED */}

      {isDetailsOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="bg-white p-4 rounded-lg w-full max-w-lg">
            <div className="flex justify-between">
              <h2>{selectedUser.name}</h2>
              <button onClick={closeUserDetails}>
                <MdClose />
              </button>
            </div>

            <p>{selectedUser.email}</p>
            <p>Role: {getRoleLabel(selectedUser.role)}</p>

            {isSuperAdmin && !selectedUser.is_superadmin && (
              <>
                {!selectedUser.is_admin ? (
                  <button
                    onClick={() =>
                      updateAdminStatus(selectedUser, true)
                    }
                  >
                    Add Admin
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      updateAdminStatus(selectedUser, false)
                    }
                  >
                    Remove Admin
                  </button>
                )}

                <button
                  onClick={() => deleteUser(selectedUser.user_id)}
                >
                  Delete User
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
