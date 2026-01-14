import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase-client";
import { FcGoogle } from "react-icons/fc";
import LAVLogo from "../assets/LAV_image.png";

const Register = ({ setAuth }) => {
  const [inputs, setInputs] = useState({
    name: "",
    email: "",
    password: "",
    role: "student", // default role
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loginPhoto, setLoginPhoto] = useState(null);
  const navigate = useNavigate();

  const { name, email, password, role } = inputs;

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    
    // Validate email domain and format
    const allowedDomain = "@g.msuiit.edu.ph";
    const emailLower = email.toLowerCase();
    
    if (!emailLower.endsWith(allowedDomain)) {
      setMessage(`Only ${allowedDomain} email addresses are allowed for registration.`);
      setMessageType("error");
      return;
    }
    
    // Extract the local part (before @) and check if it contains a dot
    const localPart = emailLower.split("@")[0];
    if (!localPart.includes(".")) {
      setMessage("Email must be in the format firstname.lastname@g.msuiit.edu.ph.");
      setMessageType("error");
      return;
    }
    
    try {
      // Sign up with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user record in users table with role
        // Password is handled by Supabase Auth (stored in auth.users), not in public.users
        const { error: userError } = await supabase
          .from("users")
          .insert([
            {
              user_id: authData.user.id,
              name: name,
              email: email,
              role: role,
            },
          ]);

        if (userError) {
          console.error("Error creating user record:", userError);
          setMessage(
            "Registration successful, but there was an issue creating your profile. Please try logging in."
          );
          setMessageType("error");
          return;
        }

        setMessage(
          "Registration successful! Please check your email inbox and verify your account before logging in."
        );
        setMessageType("success");
        setInputs({
          name: "",
          email: "",
          password: "",
          role: "student",
        });
        setAuth(false);
        return;
      }
    } catch (err) {
      console.error(err.message);
      const lowerMessage = (err?.message || "").toLowerCase();
      if (lowerMessage.includes("already registered") || lowerMessage.includes("already been registered")) {
        setMessage("Email already exists. Redirecting you to log in...");
        setMessageType("error");
        setTimeout(() => navigate("/login"), 1200);
      } else {
        setMessage(err.message || "Registration failed. Please try again.");
        setMessageType("error");
      }
    }
  };

  const handleGoogleSignUp = async () => {
    setMessage("");
    setMessageType("error");

    try {
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
      console.error("Google sign-up error:", err.message);
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
    <div className="min-h-screen bg-[#eeeeee] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-[1fr_1.2fr]">
        {/* Left Panel - Illustration */}
        <div className="relative bg-gradient-to-b from-[#e7ecff] via-[#eef1ff] to-[#ffffff] flex items-center justify-center p-6 md:p-10">
          <Link
            to="/"
            className="absolute top-4 left-4 flex items-center"
            aria-label="Go to LAV landing page"
          >
            <img src={LAVLogo} alt="LAV Logo" className="w-7 h-7 object-contain" />
            <span className="ml-2 text-[#3142a6] font-semibold text-sm">Home</span>
          </Link>

          <div className="flex flex-col items-center gap-4 text-center w-full">
            <div className="w-full max-w-xs rounded-2xl border border-blue-100 bg-white/70 shadow-md p-3">
              <img
                src={heroLogoSrc}
                alt="LAV"
                className="w-full h-56 object-contain"
              />
            </div>
            <p className="text-sm text-[#4b5aa9] max-w-xs">
              Join the learning community and book your first session.
            </p>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex flex-col items-center justify-center px-6 md:px-12 py-10 md:py-14 relative">
          <div className="max-w-md w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-[#3142a6] mb-2">
              Create an account
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Set up your details to start booking sessions.
            </p>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg border ${
                messageType === "success"
                  ? "bg-green-100 border-green-300"
                  : "bg-red-100 border-red-300"
              }`}
            >
              <p
                className={`text-sm ${
                  messageType === "success" ? "text-green-700" : "text-red-600"
                }`}
              >
                {message}
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-3">
            Sign up with your <strong>My.IIT</strong> Google account.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            <FcGoogle className="w-5 h-5" />
            <span>Sign up with <strong>My.IIT</strong> Google</span>
          </button>

          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-xs uppercase tracking-wide text-gray-400">
              or
            </span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={onSubmitForm} className="space-y-6">

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium lav-label mb-2">
                Name
              </label>
              <input
                className="lav-input w-full"
                type="text"
                name="name"
                placeholder="Name"
                value={name}
                onChange={(e) => onChange(e)}
                required
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium lav-label mb-2">
                Email
              </label>
              <input
                className="lav-input w-full"
                type="email"
                name="email"
                placeholder="firstname.lastname@g.msuiit.edu.ph"
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
            
            {/* Sign Up Button */}
            <button
              className="lav-btn lav-btn-primary w-full text-base"
              type="submit"
            >
              Sign up
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Log in
            </Link>
          </p>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
