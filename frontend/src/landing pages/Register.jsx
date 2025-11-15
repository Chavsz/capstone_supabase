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
          setMessage("Registration successful, but there was an issue creating your profile. Please try logging in.");
        } else {
          // Dispatch role change event so App.jsx can pick it up immediately
          window.dispatchEvent(new CustomEvent('roleChanged', { detail: { newRole: role } }));
        }

        setAuth(true);
      }
    } catch (err) {
      console.error(err.message);
      setMessage(err.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="flex h-screen p-3">
      {/* Left Panel - Blue Background with Logo (Less Wide) */}
      <div className="w-1/3 bg-blue-600 flex flex-col items-center justify-center relative rounded-md">
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
      <div className="flex-1 bg-white flex flex-col items-center justify-center px-16">
        <div className="max-w-md w-full">
          <h2 className="text-3xl font-bold text-blue-600 mb-8 text-center">
            Create an Account
          </h2>

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-300">
              <p className="text-red-600 text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={onSubmitForm} className="space-y-6">

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
