import React from "react";
import { Link } from "react-router-dom";

const OurProcess = () => {
  return (
    <section className="bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-blue-600 font-semibold tracking-wide uppercase text-sm mb-3">
            Our Process
          </h2>
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
            How it works
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            A streamlined journey from booking to mastery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-colors group">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
              1
            </div>
            <h3 className="text-xl font-bold mb-3">Book & Filter</h3>
            <p className="text-slate-600 leading-relaxed">
              Choose your subject and specialization. Our system{" "}
              <strong>auto-filters</strong> available tutors based on your specific
              schedule and needs.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-colors group">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              2
            </div>
            <h3 className="text-xl font-bold mb-3">Confirm & Prepare</h3>
            <p className="text-slate-600 leading-relaxed">
              Tutors review your request. Once <strong>Confirmed</strong>, you can
              share resource links or notes. If declined, tutors provide a specific
              reason.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-colors group">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-xl mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all">
              3
            </div>
            <h3 className="text-xl font-bold mb-3">Live Session</h3>
            <p className="text-slate-600 leading-relaxed">
              Your tutor manages the session clock. Track your progress in
              real-time on your dashboard as the status updates to{" "}
              <strong>In Session</strong>.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 transition-colors group">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold text-xl mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              4
            </div>
            <h3 className="text-xl font-bold mb-3">Rate & Unlock</h3>
            <p className="text-slate-600 leading-relaxed">
              Submit a <strong>mandatory anonymous evaluation</strong> to complete
              the session. This feedback unlocks your ability to book your next
              lesson.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/register"
            className="bg-slate-900 text-white px-8 py-3 rounded-full font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 inline-flex"
          >
            Start Learning Now
          </Link>
        </div>
      </div>
    </section>
  );
};

export default OurProcess;
