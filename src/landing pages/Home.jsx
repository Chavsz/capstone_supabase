import React, { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

function Home() {
  const [landingData, setLandingData] = useState({
    home_image: "",
    home_title: "",
    home_description: "",
    home_more: "",
  });

  const getLandingData = async () => {
    try {
      const { data, error } = await supabase
        .from("landing")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setLandingData(data);
      }
      // console.log("Landing data:", data);
    } catch (error) {
      console.error("Error fetching landing data:", error);
    }
  };

  useEffect(() => {
    getLandingData();
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight"
              >
                <span className="bg-blue-600 bg-clip-text text-transparent">
                  {landingData.home_title || "Welcome to LAV"}
                </span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-xl lg:text-2xl text-gray-600 leading-relaxed"
              >
                {landingData.home_description || "Your learning journey starts here"}
              </motion.p>
              
              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-lg text-gray-500"
              >
                {landingData.home_more || "Discover more about our services"}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="space-y-6"
            >
              <p className="text-lg font-medium text-gray-700">
                Want to appoint a tutorial session?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full text-md transition-all duration-300 transform hover:scale-90 shadow-lg hover:shadow-xl"
                  to="/login"
                >
                  Get Started Today
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="relative">
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
                <img
                  src={
                    landingData.home_image || "/placeholder.png"
                  }
                  alt="Learning"
                  className="w-full h-auto object-cover rounded-3xl"
                  onError={(e) => {
                    // Prevent infinite loop by checking if we've already tried the fallback
                    if (e.target.dataset.fallbackAttempted === 'true') {
                      return;
                    }
                    // Only log error if we have a valid, non-empty image URL
                    const imageUrl = landingData.home_image;
                    if (imageUrl && 
                        imageUrl.trim() !== "" && 
                        imageUrl !== "/placeholder.png" &&
                        (imageUrl.startsWith("http") || imageUrl.startsWith("/"))) {
                    }
                    const fallbackUrl = "/placeholder.png";
                    e.target.dataset.fallbackAttempted = 'true';
                    e.target.src = fallbackUrl;
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default Home;
