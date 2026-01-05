import { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import { motion } from "framer-motion";
import { capitalizeWords } from "../utils/text";

function OurTutors() {
  const [tutors, setTutors] = useState([]);

  const fetchTutors = async () => {
    try {
      const { data, error } = await supabase
        .from("profile")
        .select(`
          user_id,
          subject,
          specialization,
          profile_image,
          user:users (
            name,
            email,
            role
          )
        `)
        .eq("user.role", "tutor");

      if (error) throw error;

      const tutorsFromProfile = (data || [])
        .filter((record) => record.user?.role === "tutor")
        .map((record) => ({
          user_id: record.user_id,
          name: record.user?.name || "Tutor",
          email: record.user?.email || "",
          subject: record.subject,
          specialization: record.specialization,
          profile_image: record.profile_image,
        }));

      setTutors(tutorsFromProfile);
    } catch (error) {
      console.error("Error fetching tutors:", error);
    }
  };

  useEffect(() => {
    fetchTutors();
  }, []);

 const specializations = [
  {
    name: "Programming",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
  },
  {
    name: "Chemistry",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50",
  },
  {
    name: "Physics",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50",
  },
  {
    name: "Calculus and Statistics",
    color: "from-orange-500 to-red-500",
    bgColor: "bg-orange-50",
  },
  {
    name: "Psychology and Language",
    color: "from-teal-500 to-lime-500",
    bgColor: "bg-teal-50",
  },
  {
    name: "Engineering",
    color: "from-indigo-500 to-blue-600",
    bgColor: "bg-indigo-50",
  },
  {
    name: "Accountancy and Economics",
    color: "from-yellow-500 to-amber-500",
    bgColor: "bg-yellow-50",
  },
];


  return (
    <section className="py-20 bg-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Meet Our Expert Tutors
          </h2>
          <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full mb-6"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn from qualified and experienced educators who are passionate
            about teaching
          </p>
        </motion.div>

        <div className="space-y-16">
          {specializations.map((spec, specIndex) => {
            const filteredTutors = tutors.filter((tutor) => {
              const subjectKey = tutor.subject || tutor.specialization;
              return subjectKey === spec.name;
            });

            return (
              <motion.div
                key={spec.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: specIndex * 0.2 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                {/* Specialization Header */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold bg-black bg-clip-text text-transparent">
                    {spec.name}
                  </h3>
                </div>

                {/* Tutors Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                  {filteredTutors.map((tutor, index) => (
                    <motion.div
                      key={tutor.user_id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 overflow-hidden">
                        {/* Tutor Image */}
                        <div className="w-full h-[150px] bg-blue-300 flex items-center justify-center">
                          {tutor.profile_image ? (
                            <img
                              src={tutor.profile_image}
                              alt={tutor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-full h-full flex items-center justify-center text-white text-6xl font-bold ${
                              tutor.profile_image ? "hidden" : "flex"
                            }`}
                          >
                            {capitalizeWords(tutor.name).charAt(0) || "T"}
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-2">
                        {capitalizeWords(tutor.name)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default OurTutors;
