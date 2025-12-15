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

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const { email, password } = inputs;

  const onSubmitForm = async (e) => {
    e.preventDefault();

    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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
            setMessage("User profile not found. Please contact support.");
          }
        } else if (profileData) {
          if (profileData.role) {
            const role = profileData.role;
            // Dispatch role change event so App.jsx can pick it up immediately
            window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: role } }));
          } else {
            setMessage("User role not set. Please contact support.");
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
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
    const fetchLoginPhoto = async () => {
      try {
        const { data, error } = await supabase
          .from("landing")
          .select("login_photo")
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data?.login_photo) {
          setLoginPhoto(data.login_photo);
        }
      } catch (err) {
        console.error("Unable to load login photo:", err.message);
      }
    };

    fetchLoginPhoto();
  }, []);

  const heroLogoSrc = loginPhoto || LAVLogo;

  return (
    <div className="flex h-screen p-0 md:p-3">
      {/* Left Panel - Blue Background with Logo (Hidden on Mobile) */}
      <div className="hidden md:flex w-1/3 bg-gradient-to-b from-blue-600 to-blue-700 flex-col items-center justify-center relative rounded-md overflow-hidden">
        <Link to="/" className="absolute top-8 left-8 flex items-center ">
          <img src={LAVLogo} alt="LAV Logo" className="w-8 h-8 object-contain" />
          <span className="ml-2 text-white font-semibold text-lg">LAV</span>
        </Link>

        {/* Large Centered Logo */}
        <div className="flex flex-col items-center gap-4 px-6 text-center w-full">
          <div className="w-full max-w-xl rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm shadow-xl p-3">
            <img
              src={heroLogoSrc}
              alt="LAV"
              className="w-full aspect-[4/3] rounded-xl object-cover shadow-md border border-white/30"
            />
          </div>
          <p className="text-sm text-blue-100 max-w-xs">
            Peer tutoring support with a simple, welcoming experience.
          </p>
        </div>
      </div>

      {/* Right Panel - White Background with Form */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-4 md:px-16 py-4 md:py-0 relative">
        {/* Small Logo and LAV Text - Visible on Mobile */}
        <Link to="/" className="absolute top-4 md:top-8 left-4 md:left-8 flex items-center md:hidden">
          <img src={LAVLogo} alt="LAV Logo" className="w-8 h-8 object-contain" />
          <span className="ml-2 text-blue-600 font-semibold text-lg">LAV</span>
        </Link>

        <div className="max-w-md w-full mt-8 md:mt-0">
          <h2 className="text-2xl md:text-3xl font-bold text-blue-600 mb-6 md:mb-8 text-center">
            Welcome!
          </h2>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300">
              <p className="text-red-600 text-sm">{message}</p>
            </div>
          )}

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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">
              or
            </span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>
     

          {/* Sign Up Link */}
          <p className="mt-6 text-center text-gray-600">
            Don't have account?{" "}
            <Link
              to="/register"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
