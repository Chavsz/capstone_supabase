import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase-client";
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

  const { name, email, password, role } = inputs;

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
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
      setMessage(err.message || "Registration failed. Please try again.");
      setMessageType("error");
    }
  };

  return (
    <div className="flex h-screen p-0 md:p-3">
      {/* Left Panel - Blue Background with Logo (Hidden on Mobile) */}
      <div className="hidden md:flex w-1/3 bg-blue-600 flex-col items-center justify-center relative rounded-md">
        <Link to="/" className="absolute top-8 left-8 flex items-center ">
          <img src={LAVLogo} alt="LAV Logo" className="w-8 h-8" />
          <span className="ml-2 text-white font-semibold text-lg">
            LAV
          </span>
        </Link>

        {/* Large Centered Logo */}
        <div className="flex flex-col items-center">
          <img src={LAVLogo} alt="LAV Logo" className="w-50 h-50 mb-4" />
          <h1
            className="text-6xl font-bold text-white tracking-wider"
          >
          </h1>
        </div>
      </div>

      {/* Right Panel - White Background with Form */}
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-4 md:px-16 py-4 md:py-0 relative">
        {/* Small Logo and LAV Text - Visible on Mobile */}
        <Link to="/" className="absolute top-4 md:top-8 left-4 md:left-8 flex items-center md:hidden">
          <img src={LAVLogo} alt="LAV Logo" className="w-8 h-8" />
          <span className="ml-2 text-blue-600 font-semibold text-lg">LAV</span>
        </Link>

        <div className="max-w-md w-full mt-8 md:mt-0">
            <h2 className="text-2xl md:text-3xl font-bold text-[#4c4ba2] mb-6 md:mb-8 text-center">
              Create an Account
            </h2>

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
  );
};

export default Register;
