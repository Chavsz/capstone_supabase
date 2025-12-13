import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

import { MdDelete, MdAdd } from "react-icons/md";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get all users
  const getAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("user_id, name, email, role")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAllUsers(data || []);
    } catch (err) {
      console.error(err.message);
    }
  };

  //delete user
  const deleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        // Note: This will also delete the user from auth.users via cascade or trigger
        // You may need to handle auth user deletion separately if needed
        const { error } = await supabase
          .from("users")
          .delete()
          .eq("user_id", id);

        if (error) throw error;

        getAllUsers();
      } catch (err) {
        console.error(err.message);
        alert("Error deleting user. They may have related data that needs to be removed first.");
      }
    }
  };

  useEffect(() => {
    getAllUsers();
  }, []);

  // Filter users based on selected filter
  const getFilteredUsers = () => {
    switch (selectedFilter) {
      case "Tutor":
        return allUsers.filter((user) => user.role === "tutor");
      case "Student":
        return allUsers.filter((user) => user.role === "student");
      default:
        return allUsers.filter((user) => user.role !== "admin");
    }
  };

  const filteredUsers = getFilteredUsers();
  
  // Apply search filter
  const searchfilteredUsers = filteredUsers.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
    || user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const promoteToTutor = async (id) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: "tutor" })
        .eq("user_id", id);

      if (error) throw error;

      getAllUsers();
    } catch (err) {
      console.error(err.message);
      alert("Error promoting user to tutor.");
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
                  {user.role === "tutor" ? "Tutor" : "Student"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    {user.role === "student" && (
                      <button
                        className="text-gray-400 hover:text-blue-500 px-2 py-1 rounded-md"
                        onClick={() => promoteToTutor(user.user_id)}
                        title="Add as tutor"
                        aria-label="Add as tutor"
                      >
                        <MdAdd />
                      </button>
                    )}
                    <button
                      className="text-gray-400 hover:text-red-500 px-2 py-1 rounded-md"
                      onClick={() => deleteUser(user.user_id)}
                      aria-label="Delete user"
                    >
                      <MdDelete />
                    </button>
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
                <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                  {user.role === "tutor" ? "Tutor" : "Student"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {user.role === "student" && (
                  <button
                    className="text-gray-400 hover:text-blue-500 p-2 rounded-md"
                    onClick={() => promoteToTutor(user.user_id)}
                    aria-label="Add as tutor"
                  >
                    <MdAdd className="w-5 h-5" />
                  </button>
                )}
                <button
                  className="text-gray-400 hover:text-red-500 p-2 rounded-md"
                  onClick={() => deleteUser(user.user_id)}
                  aria-label="Delete user"
                >
                  <MdDelete className="w-5 h-5" />
                </button>
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
