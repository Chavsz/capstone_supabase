import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase-client";

// Landing Pages
import LandingPage from "./LandingPage";
import Login from "./landing pages/Login";
import Register from "./landing pages/Register";

// Dashboards
import TuteePage from "./pages/Tutee/TuteePage"; // role = student
import TutorPage from "./pages/Tutor/TutorPage"; // role = tutor
import AdminPage from "./pages/AdminnStaff/AdminPage"; // role = admin

// Tutee Pages
import TuteeDashboard from "./pages/Tutee/TuteeDashboard";
import TuteeProfile from "./pages/Tutee/Profile";
import TuteeSchedules from "./pages/Tutee/Schedules";
import TuteeAppointment from "./pages/Tutee/Appointment";
import TuteeSwitch from "./pages/Tutee/Switch";

// Tutor Pages
import TutorDashboard from "./pages/Tutor/TutorDashboard";
import TutorProfile from "./pages/Tutor/Profile";
import TutorSchedule from "./pages/Tutor/Schedule";
import TutorSwitch from "./pages/Tutor/Switch";

// Admin Pages
import AdminDashboard from "./pages/AdminnStaff/Dashboard";
import AdminLanding from "./pages/AdminnStaff/Landing";
import AdminLavRoomCalendar from "./pages/AdminnStaff/LavRoomCalendar";
import AdminReports from "./pages/AdminnStaff/Reports";
import AdminEvent from "./pages/AdminnStaff/Event";
import AdminAnnouncments from "./pages/AdminnStaff/Announcments";
import AdminUsers from "./pages/AdminnStaff/Users";

// Role-based dashboard component
function RoleBasedLayout({ setAuth, currentRole, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-blue-600">Loading...</div>
      </div>
    );
  }

  const role = currentRole;

  switch (role) {
    case "admin":
      return <AdminPage setAuth={setAuth} />;
    case "tutor":
      return <TutorPage setAuth={setAuth} />;
    case "student":
      return <TuteePage setAuth={setAuth} />;
    default:
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-600">
            Unable to determine user role. Current role: {currentRole || "null"}. Please contact support.
          </div>
        </div>
      );
  }
}

function RoleRoute({ allowedRoles, currentRole, loading, element }) {
  if (loading) return null;
  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return element;
}

function RoleIndex({ currentRole, loading, setAuth }) {
  if (loading) return null;
  switch (currentRole) {
    case "student":
      return <TuteeDashboard setAuth={setAuth} />;
    case "tutor":
      return <TutorDashboard setAuth={setAuth} />;
    case "admin":
      return <AdminDashboard setAuth={setAuth} />;
    default:
      return null;
  }
}

function RoleProfile({ currentRole, loading }) {
  if (loading) return null;
  if (currentRole === "tutor") return <TutorProfile />;
  if (currentRole === "student") return <TuteeProfile />;
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes({ isAuthenticated, setAuth, currentRole, loading }) {
  return (
    <Routes>
      <Route exact path="/" element={<LandingPage />} />
      <Route
        exact
        path="/login"
        element={
          !isAuthenticated ? (
            <Login setAuth={setAuth} />
          ) : (
            <Navigate to="/dashboard" />
          )
        }
      />
      <Route
        exact
        path="/register"
        element={
          !isAuthenticated ? (
            <Register setAuth={setAuth} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <RoleBasedLayout
              setAuth={setAuth}
              currentRole={currentRole}
              loading={loading}
            />
          ) : (
            <Navigate to="/login" />
          )
        }
      >
        {/* Tutee routes */}
        <Route
          index
          element={
            <RoleIndex
              currentRole={currentRole}
              loading={loading}
              setAuth={setAuth}
            />
          }
        />
        <Route
          path="profile"
          element={
            <RoleProfile currentRole={currentRole} loading={loading} />
          }
        />
        <Route
          path="appointment"
          element={
            <RoleRoute
              allowedRoles={["student"]}
              currentRole={currentRole}
              loading={loading}
              element={<TuteeAppointment />}
            />
          }
        />
        <Route
          path="schedules"
          element={
            <RoleRoute
              allowedRoles={["student"]}
              currentRole={currentRole}
              loading={loading}
              element={<TuteeSchedules />}
            />
          }
        />
        <Route
          path="switch"
          element={
            <RoleRoute
              allowedRoles={["student", "tutor"]}
              currentRole={currentRole}
              loading={loading}
              element={
                currentRole === "tutor" ? <TutorSwitch /> : <TuteeSwitch />
              }
            />
          }
        />

        {/* Tutor routes */}
        <Route
          path="schedule"
          element={
            <RoleRoute
              allowedRoles={["tutor"]}
              currentRole={currentRole}
              loading={loading}
              element={<TutorSchedule />}
            />
          }
        />
        {/* Admin routes */}
        <Route
          path="landingadmin"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminLanding />}
            />
          }
        />
        <Route
          path="lav-room"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminLavRoomCalendar />}
            />
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminReports />}
            />
          }
        />
        <Route
          path="event"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminEvent />}
            />
          }
        />
        <Route
          path="announcments"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminAnnouncments />}
            />
          }
        />
        <Route
          path="users"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminUsers />}
            />
          }
        />
      </Route>
    </Routes>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleOverride, setRoleOverride] = useState(() => {
    try {
      return localStorage.getItem("lav.roleOverride") || null;
    } catch (err) {
      return null;
    }
  });
  
  // Track if we're currently fetching to prevent duplicates
  const isFetching = useRef(false);
  const hasRole = useRef(false); // Track if we already have a role
  const ROLE_OVERRIDE_KEY = "lav.roleOverride";

  const setAuth = (boolean) => {
    setIsAuthenticated(boolean);
  };

  const getStoredRoleOverride = () => {
    try {
      const stored = localStorage.getItem(ROLE_OVERRIDE_KEY);
      return stored || null;
    } catch (err) {
      return null;
    }
  };

  const setStoredRoleOverride = (role) => {
    try {
      if (role) {
        localStorage.setItem(ROLE_OVERRIDE_KEY, role);
      } else {
        localStorage.removeItem(ROLE_OVERRIDE_KEY);
      }
      setRoleOverride(role || null);
    } catch (err) {
      // Ignore storage errors (e.g. privacy mode)
    }
  };

  const effectiveRole = roleOverride || currentRole;

  // Single function to fetch role
  const fetchUserRole = async (userId) => {
    // Don't fetch if already fetching
    if (isFetching.current) {
      return;
    }

    const storedRole = getStoredRoleOverride();
    if (storedRole) {
      setCurrentRole(storedRole);
      setLoading(false);
      hasRole.current = true;
      return;
    }

    // If we already have a role in state, don't fetch again
    if (currentRole) {
      setLoading(false);
      hasRole.current = true; // Sync the ref
      return;
    }

    isFetching.current = true;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Role fetch error:", error);
        if (error.code === 'PGRST116') {
          console.error("User not found in users table");
        }
        setLoading(false);
        isFetching.current = false;
        return;
      }

      if (data && data.role) {
        setCurrentRole(data.role);
        hasRole.current = true; // Mark that we have a role
        setLoading(false);
      } else {
        console.warn("WARNING: No role found for user");
        setLoading(false);
      }
    } catch (err) {
      console.error("CATCH: Error fetching user role:", err);
      setLoading(false);
    } finally {
      isFetching.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    // Initial session check
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error("Session error:", error);
          setIsAuthenticated(false);
          setLoading(false);
          initialized = true;
          return;
        }

        if (session) {
          setSession(session);
          setIsAuthenticated(true);
          const storedRole = getStoredRoleOverride();
          if (storedRole) {
            setCurrentRole(storedRole);
            hasRole.current = true;
            setLoading(false);
          } else {
            await fetchUserRole(session.user.id);
          }
        } else {
          setIsAuthenticated(false);
          setLoading(false);
        }
        initialized = true;
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (mounted) {
          setIsAuthenticated(false);
          setLoading(false);
          initialized = true;
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Ignore INITIAL_SESSION - already handled above
      if (event === 'INITIAL_SESSION') {
        return;
      }

      // Wait for initialization to complete before handling other events
      if (!initialized) {
        return;
      }

      // Handle sign in
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        setIsAuthenticated(true);
        
        // If we already have a role, this is likely a tab switch, not a real login
        // Check the ref because state might not be updated yet
        if (hasRole.current) {
          setLoading(false);
          return;
        }
        
        // Real login - fetch role
        setLoading(true);
        isFetching.current = false; // Reset fetch flag for new login
        await fetchUserRole(session.user.id);
        return;
      }

      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setIsAuthenticated(false);
        setCurrentRole(null);
        setLoading(false);
        isFetching.current = false;
        hasRole.current = false; // Reset role flag on logout
        setStoredRoleOverride(null);
        setRoleOverride(null);
        return;
      }

      // For TOKEN_REFRESHED, just update session but don't refetch role
      if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        // If we already have a role, ensure loading is false
        if (hasRole.current && currentRole) {
          setLoading(false);
        }
        // Don't fetch role again, we already have it
        return;
      }

      // For USER_UPDATED, just update session
      if (event === 'USER_UPDATED' && session) {
        setSession(session);
        return;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Listen for role changes from external events
  useEffect(() => {
    const handleRoleChange = (event) => {
      const newRole = event.detail?.newRole;
      if (newRole) {
        setCurrentRole(newRole);
        hasRole.current = true; // Mark that we have a role
        setLoading(false);
        setStoredRoleOverride(newRole);
        setRoleOverride(newRole);
      }
    };

    window.addEventListener('roleChanged', handleRoleChange);
    
    return () => {
      window.removeEventListener('roleChanged', handleRoleChange);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === ROLE_OVERRIDE_KEY) {
        setRoleOverride(event.newValue || null);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <div>
      <AppRoutes
        isAuthenticated={isAuthenticated}
        setAuth={setAuth}
        currentRole={effectiveRole}
        loading={loading}
      />
    </div>
  );
}

export default App;
