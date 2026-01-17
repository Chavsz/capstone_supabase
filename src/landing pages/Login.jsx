import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase-client";
import { FcGoogle } from "react-icons/fc";
import LAVLogo from "../assets/LAV_image.png";

const Login = ({ setAuth }) => {
  const [inputs, setInputs] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [loginPhoto, setLoginPhoto] = useState(null);
  const [sidebarLogo, setSidebarLogo] = useState(null);

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const { email, password } = inputs;

  const onSubmitForm = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const normalizedInput = email.trim().toLowerCase();
      const isEmailFormat = normalizedInput.includes("@");

      let lookupMatches = [];
      if (isEmailFormat) {
        const { data, error } = await supabase
          .from("users")
          .select("user_id, role, name, email")
          .ilike("email", normalizedInput);
        if (error) throw error;
        lookupMatches = data || [];
      } else {
        const escapedInput = normalizedInput.replace(/"/g, '\\"');
        const exactFilter = `"${escapedInput}"`;
        const likeFilter = `"${escapedInput}@%"`;
        const { data, error } = await supabase
          .from("users")
          .select("user_id, role, name, email")
          .or(`email.eq.${exactFilter},email.ilike.${likeFilter}`)
          .limit(2);
        if (error) throw error;
        lookupMatches = data || [];
      }

      if (!lookupMatches.length) {
        setMessage("Account not found. Please contact support.");
        return;
      }

      if (lookupMatches.length > 1) {
        setMessage("Multiple accounts match. Please use your full email.");
        return;
      }

      const resolvedEmail = lookupMatches[0].email || normalizedInput;
      if (!resolvedEmail) {
        setMessage("Account email is missing. Please contact support.");
        return;
      }

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) throw error;

      // Get user role from users table
      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("user_id, role, name, email")
          .eq("user_id", data.user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            await supabase.auth.signOut();
            setMessage("User profile not found. Please contact support.");
            return;
          }
        } else if (profileData) {
          if (profileData.role) {
            const role = profileData.role;
            // Dispatch role change event so App.jsx can pick it up immediately
            window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: role } }));
          } else {
            setMessage("User role not set. Please contact support.");
            return;
          }
        }
      }

      setAuth(true);
    } catch (err) {
      console.error(err.message);
      setMessage("Incorrect email or password");
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage("");

    try {
      // Get the current origin (works for both localhost and production)
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error("Google sign-in error:", err.message);
      if (err?.message?.includes("Unsupported provider")) {
        setMessage(
          "Google sign-in is not enabled in Supabase yet. Enable the Google provider in Auth > Providers (PostgreSQL backend) or continue with email."
        );
      } else {
        setMessage("Unable to continue with Google right now. Please try again.");
      }
    }
  };

  useEffect(() => {
    // Check for OAuth error message from sessionStorage
    try {
      const oauthError = sessionStorage.getItem("oauth_error");
      if (oauthError) {
        setMessage(oauthError);
        // Clear the error from sessionStorage after displaying
        sessionStorage.removeItem("oauth_error");
      }
    } catch (e) {
      // Ignore storage errors
    }

    const fetchLoginPhoto = async () => {
      try {
        const { data, error } = await supabase
          .from("landing")
          .select("login_photo, sidebar_logo")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data?.login_photo) {
          setLoginPhoto(data.login_photo);
        }

        if (data?.sidebar_logo) {
          setSidebarLogo(data.sidebar_logo);
        }
      } catch (err) {
        console.error("Unable to load login photo:", err.message);
      }
    };

    fetchLoginPhoto();
  }, []);

  const heroLogoSrc = loginPhoto || LAVLogo;

  return (
    <div className="min-h-screen bg-[#eeeeee] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-[1fr_1.2fr]">
        {/* Left Panel - Illustration */}
        <div className="relative bg-gradient-to-b from-[#e7ecff] via-[#eef1ff] to-[#ffffff] flex items-center justify-center p-6 md:p-10">
          <Link
            to="/"
            className="absolute top-4 left-4 flex items-center"
            aria-label="Go to LAV landing page"
          >
            <img
              src={sidebarLogo || LAVLogo}
              alt="Logo"
              className="w-7 h-7 object-contain"
            />
            <span className="ml-2 text-[#3142a6] font-semibold text-sm">Home</span>
          </Link>

          <div className="flex flex-col items-center gap-4 text-center w-full">
            <div className="w-full max-w-xs rounded-2xl border border-blue-100 bg-white/70 shadow-md p-3">
              <img
                src={heroLogoSrc}
                alt="Logo"
                className="w-full h-56 object-contain"
              />
            </div>
            <p className="text-sm text-[#4b5aa9] max-w-xs">
              Peer tutoring support with a simple, welcoming experience.
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex flex-col items-center justify-center px-6 md:px-12 py-10 md:py-14 relative">
          <div className="max-w-md w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-[#3142a6] mb-2">
              Hello, welcome back
            </h2>
            <p className="text-sm text-gray-500 mb-6">
             Sign in with your 'My.IIT' account to continue your tutoring journey.
            </p>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300">
              <p className="text-red-600 text-sm">{message}</p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            <FcGoogle className="w-5 h-5" />
            <span>Sign in with <strong>My.IIT</strong> Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">
              or
            </span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={onSubmitForm} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium lav-label mb-2">
                Email
              </label>
              <input
                className="lav-input w-full"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => onChange(e)}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium lav-label mb-2">
                Password
              </label>
              <input
                className="lav-input w-full"
                type="password"
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => onChange(e)}
                required
              />
            </div>

            {/* Log In Button */}
            <button
              className="lav-btn lav-btn-primary w-full text-base"
              type="submit"
            >
              Log in
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-gray-600">
            Don't have account?{" "}
            <Link
              to="/register"
              className="text-[#4c4ba2] hover:text-blue-700 font-medium"
            >
              Sign up
            </Link>
          </p>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
