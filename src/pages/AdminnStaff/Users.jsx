import { useState, useEffect } from "react";
import { supabase } from "../../supabase-client";

import { MdDelete } from "react-icons/md";

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
    <div className="min-h-screen bg-white p-6">
      <h1 className="text-[24px] font-bold text-blue-600 mb-6">Users</h1>

      <div className="flex justify-between items-center">
        {/* Filter Buttons */}
        <div className="flex gap-2">
          {["All", "Tutor", "Student"].map((filter) => (
            <button
              key={filter}
              className={`px-4 py-2 font-medium transition-all duration-200 text-gray-600 border-b-2  ${
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
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by name or email"
            className="w-[300px] px-4 py-2 bg-gray-100 border-b-2 border-b-transparent outline-none focus:border-b-blue-600 focus:border-b-2"
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white overflow-hidden">
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
                  <button
                    className=" text-gray-400 hover:text-red-500 px-2 py-1 rounded-md"
                    onClick={() => deleteUser(user.user_id)}
                  >
                    <MdDelete />
                  </button>
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

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-700">
          Showing {searchfilteredUsers.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, searchfilteredUsers.length)} of{" "}
          {searchfilteredUsers.length} entries
        </div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded border ${
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
            className={`px-3 py-1 rounded border ${
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
