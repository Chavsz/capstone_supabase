import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase-client";
import { UserProvider, useUserDetails } from "./contexts/UserContext";
import { DataSyncProvider } from "./contexts/DataSyncContext";

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
import TuteeMyClasses from "./pages/Tutee/MyClasses";
import TuteeSwitch from "./pages/Tutee/Switch";

// Tutor Pages
import TutorDashboard from "./pages/Tutor/TutorDashboard";
import TutorProfile from "./pages/Tutor/Profile";
import TutorSchedule from "./pages/Tutor/Schedule";
import TutorSwitch from "./pages/Tutor/Switch";
import TutorComments from "./pages/Tutor/Comments";
import TutorReports from "./pages/Tutor/Reports";
import TutorMyClasses from "./pages/Tutor/MyClasses";

// Admin Pages
import AdminDashboard from "./pages/AdminnStaff/Dashboard";
import AdminLanding from "./pages/AdminnStaff/Landing";
import AdminLavRoomCalendar from "./pages/AdminnStaff/LavRoomCalendar";
import AdminReports from "./pages/AdminnStaff/Reports";
import AdminEvent from "./pages/AdminnStaff/Event";
import AdminAnnouncments from "./pages/AdminnStaff/Announcments";
import AdminUsers from "./pages/AdminnStaff/Users";
import AdminSwitch from "./pages/AdminnStaff/Switch";

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
  const loadingScreen = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-blue-600">Loading...</div>
    </div>
  );

  return (
    <Routes>
      <Route exact path="/" element={<LandingPage />} />
      <Route
        exact
        path="/login"
        element={
          loading ? (
            loadingScreen
          ) : !isAuthenticated ? (
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
          loading ? (
            loadingScreen
          ) : !isAuthenticated ? (
            <Register setAuth={setAuth} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          loading ? (
            loadingScreen
          ) : isAuthenticated ? (
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
          path="classes"
          element={
            loading
              ? null
              : currentRole === "tutor"
                ? <Navigate to="/dashboard/tutor-classes" replace />
                : (
                    <RoleRoute
                      allowedRoles={["student"]}
                      currentRole={currentRole}
                      loading={loading}
                      element={<TuteeMyClasses />}
                    />
                  )
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
        <Route
          path="tutor-classes"
          element={
            <RoleRoute
              allowedRoles={["tutor"]}
              currentRole={currentRole}
              loading={loading}
              element={<TutorMyClasses />}
            />
          }
        />
          <Route
            path="comments"
            element={
              <RoleRoute
                allowedRoles={["tutor"]}
                currentRole={currentRole}
                loading={loading}
                element={<TutorComments />}
              />
            }
          />
          <Route
            path="reports"
            element={
              <RoleRoute
                allowedRoles={["admin", "tutor"]}
                currentRole={currentRole}
                loading={loading}
                element={currentRole === "admin" ? <AdminReports /> : <TutorReports />}
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
          path="switch-admin"
          element={
            <RoleRoute
              allowedRoles={["admin"]}
              currentRole={currentRole}
              loading={loading}
              element={<AdminSwitch />}
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

function AppWithUser() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const { setUserDetails, clearUserDetails } = useUserDetails();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminAccess, setAdminAccess] = useState(false);
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
  const sessionCheckTimer = useRef(null);

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

  const safeOverride = roleOverride === "admin" && !adminAccess ? null : roleOverride;
  const effectiveRole = safeOverride || currentRole;
  const clearAuthState = () => {
    setSession(null);
    setIsAuthenticated(false);
    setCurrentRole(null);
    clearUserDetails();
    setLoading(false);
    setAdminAccess(false);
    isFetching.current = false;
    hasRole.current = false;
    setStoredRoleOverride(null);
    setRoleOverride(null);
  };

  const fetchUserDetails = async (userId, userEmail) => {
    try {
      let { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116" && userEmail) {
          const { data: emailData, error: emailError } = await supabase
            .from("users")
            .select("*")
            .ilike("email", userEmail)
            .single();

          if (emailError && emailError.code !== "PGRST116") {
            throw emailError;
          }

          if (emailData) {
            if (emailData.user_id !== userId) {
              const { data: updatedData, error: updateError } = await supabase
                .from("users")
                .update({ user_id: userId })
                .ilike("email", userEmail)
                .select("*")
                .single();

              if (updateError) {
                throw updateError;
              }

              data = updatedData || emailData;
            } else {
              data = emailData;
            }
          }
        } else {
          throw error;
        }
      }

      if (data) {
        setUserDetails(data);
      }

      return data || null;
    } catch (err) {
      console.error("Error fetching user details:", err.message);
      return null;
    }
  };

  // Single function to fetch role
  const fetchUserRole = async (userId) => {
    // Don't fetch if already fetching
    if (isFetching.current) {
      return;
    }

    isFetching.current = true;

    try {
      // Get current user to access metadata (for OAuth users)
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      // If we already have a role in state, don't fetch again
      if (currentRole) {
        await fetchUserDetails(userId, user?.email);
        setLoading(false);
        hasRole.current = true; // Sync the ref
        return;
      }
      
      const { data, error } = await supabase
        .from("users")
        .select("role, is_admin, is_superadmin")
        .eq("user_id", userId)
        .single();

      if (error) {
        // User not found in users table - match by email for OAuth
        if (error.code === 'PGRST116') {
          const userEmail = user?.email || "";
          const allowedDomain = "@g.msuiit.edu.ph";
          const emailLower = userEmail.toLowerCase();

          const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("user_id, role, is_admin, is_superadmin")
            .ilike("email", userEmail)
            .single();

          if (existingUserError && existingUserError.code !== "PGRST116") {
            console.error("Role fetch error:", existingUserError);
            setLoading(false);
            isFetching.current = false;
            return;
          }

          if (!emailLower || !emailLower.endsWith(allowedDomain)) {
            if (!existingUser) {
              console.error(`OAuth sign-in rejected: Email domain not allowed. Only ${allowedDomain} emails are permitted.`);
              await supabase.auth.signOut();
              try {
              sessionStorage.setItem("oauth_error", "Please use your My.IIT account.");
              } catch (e) {
                // Ignore storage errors
              }
              clearAuthState();
              window.location.href = "/login";
              return;
            }
          }

          let linkedData = existingUser;
          if (!existingUser) {
            const userName = user?.user_metadata?.full_name ||
              user?.user_metadata?.name ||
              user?.user_metadata?.user_name ||
              userEmail.split("@")[0] ||
              "User";

            const { data: createdUser, error: insertError } = await supabase
              .from("users")
              .insert([
                {
                  user_id: userId,
                  name: userName,
                  email: userEmail,
                  role: "student",
                },
              ])
              .select("role, is_admin, is_superadmin")
              .single();

            if (insertError) {
              console.error("Error creating user record:", insertError);
              setLoading(false);
              isFetching.current = false;
              return;
            }

            linkedData = createdUser;
          } else if (existingUser.user_id !== userId) {
            const { data: updatedUser, error: linkError } = await supabase
              .from("users")
              .update({ user_id: userId })
              .ilike("email", userEmail)
              .select("role, is_admin, is_superadmin")
              .single();

            if (linkError) {
              console.error("Error linking OAuth user:", linkError);
              setLoading(false);
              isFetching.current = false;
              return;
            }

            linkedData = updatedUser || existingUser;
          }
          const isSuperAdmin = Boolean(linkedData?.is_superadmin);
          setAdminAccess(Boolean(linkedData?.is_admin || isSuperAdmin));
          if (isSuperAdmin) {
            setStoredRoleOverride(null);
            setRoleOverride(null);
            setCurrentRole("admin");
            hasRole.current = true;
            await fetchUserDetails(userId, userEmail);
            setLoading(false);
            isFetching.current = false;
            return;
          }

          if (linkedData?.role) {
            setCurrentRole(linkedData.role);
            hasRole.current = true;
            await fetchUserDetails(userId, userEmail);
            setLoading(false);
            isFetching.current = false;
            return;
          }
        } else {
          console.error("Role fetch error:", error);
          setLoading(false);
          isFetching.current = false;
          return;
        }
      }

      if (data) {
        const isSuperAdmin = Boolean(data.is_superadmin);
        setAdminAccess(Boolean(data.is_admin || isSuperAdmin));
        if (isSuperAdmin) {
          setStoredRoleOverride(null);
          setRoleOverride(null);
          setCurrentRole("admin");
          hasRole.current = true;
          await fetchUserDetails(userId, user?.email);
          setLoading(false);
          isFetching.current = false;
          return;
        }
      }

      if (data && data.role) {
        setCurrentRole(data.role);
        hasRole.current = true; // Mark that we have a role
        await fetchUserDetails(userId, user?.email);
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
          setAdminAccess(false);
          initialized = true;
          return;
        }

        if (session) {
          setSession(session);
          setIsAuthenticated(true);
          await fetchUserRole(session.user.id);
        } else {
          setIsAuthenticated(false);
          setLoading(false);
          setAdminAccess(false);
        }
        initialized = true;
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (mounted) {
          setIsAuthenticated(false);
          setLoading(false);
          setAdminAccess(false);
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
        clearAuthState();
        return;
      }

      // For TOKEN_REFRESHED, just update session but don't refetch role
      if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        // If we already have a role, ensure loading is false
        if (hasRole.current && currentRole) {
          setLoading(false);
        }
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

  useEffect(() => {
    if (!loading && roleOverride === "admin" && !adminAccess) {
      setStoredRoleOverride(null);
      setRoleOverride(null);
    }
  }, [adminAccess, loading, roleOverride]);

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

function App() {
  return (
    <UserProvider>
      <DataSyncProvider>
        <AppWithUser />
      </DataSyncProvider>
    </UserProvider>
  );
}

export default App;
