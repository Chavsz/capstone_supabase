import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const OurProcess = () => {
  return (
    <section className="bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
            How it works
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            A streamlined journey from booking to mastery.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8}}
            viewport={{ once: true }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-all duration-500 group hover:translate-y-[-5px]"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
              1
            </div>
            <h3 className="text-xl font-bold mb-3">Book & Filter</h3>
            <p className="text-slate-600 leading-relaxed">
              Choose your subject and specialization. Our system{" "}
              <strong>auto-filters</strong> available tutors based on your specific
              schedule and needs.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8}}
            viewport={{ once: true }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-all duration-500 group hover:translate-y-[-5px]"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              2
            </div>
            <h3 className="text-xl font-bold mb-3">Confirm & Prepare</h3>
            <p className="text-slate-600 leading-relaxed">
              Tutors review your request. Once <strong>Confirmed</strong>, you can
              share resource links or notes. If declined, tutors provide a specific
              reason.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8}}
            viewport={{ once: true }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-all duration-500 group hover:translate-y-[-5px]"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
              3
            </div>
            <h3 className="text-xl font-bold mb-3">Live Session</h3>
            <p className="text-slate-600 leading-relaxed">
              Your tutor manages the session clock. Track your progress in
              real-time on your dashboard as the status updates to{" "}
              <strong>In Session</strong>.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8}}
            viewport={{ once: true }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-all duration-500 group hover:translate-y-[-5px]"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
              4
            </div>
            <h3 className="text-xl font-bold mb-3">Rate & Unlock</h3>
            <p className="text-slate-600 leading-relaxed">
              Submit a <strong>mandatory anonymous evaluation</strong> to complete
              the session. This feedback unlocks your ability to book your next
              lesson.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <Link
            to="/register"
            className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Start Learning Now
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default OurProcess;
