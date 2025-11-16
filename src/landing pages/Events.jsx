import React, { useState, useEffect } from "react";
import { supabase } from "../supabase-client";
import { motion } from "framer-motion";

function Events() {
  const [events, setEvents] = useState([]);

  const fetchEvents = async () => {
    try {
      
      const { data, error } = await supabase
        .from("event")
        .select("*")
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });


      if (error) {
        throw error;
      }

      if (data && Array.isArray(data)) {
        // Filter for upcoming events only (events from today onwards)
        const today = new Date().toISOString().split('T')[0];
        const upcomingEvents = data.filter(event => {
          const eventDate = new Date(event.event_date).toISOString().split('T')[0];
          return eventDate >= today;
        });
        setEvents(upcomingEvents);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error("Error fetching events data:", error);
      setEvents([]);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <section className="py-20 bg-white relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Upcoming Events
          </h2>
          <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full mb-6"></div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join our exciting events and workshops to enhance your learning experience
          </p>
        </motion.div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.length > 0 ? (
            events.map((event, index) => {
              const formattedDate = new Date(event.event_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });

              return (
                <motion.div
                  key={event.event_id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100">
                    {/* Event Image */}
                    <div className="relative overflow-hidden">
                      <img
                        src={
                          event.event_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                        }
                        alt={event.event_title}
                        className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          // Prevent infinite loop by checking if we've already tried the fallback
                          if (e.target.dataset.fallbackAttempted === 'true') {
                            return;
                          }
                          const fallbackUrl = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80";
                          e.target.dataset.fallbackAttempted = 'true';
                          e.target.src = fallbackUrl;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                      
                      {/* Date Badge */}
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2">
                        <div className="text-sm font-semibold text-gray-900">
                          {formattedDate}
                        </div>
                      </div>
                    </div>

                    {/* Event Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-300">
                        {event.event_title}
                      </h3>
                      
                      <p className="text-gray-600 mb-6 line-clamp-3">
                        {event.event_description}
                      </p>

                      {/* Event Details */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-600">
                            <strong>Time:</strong> {event.event_time}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-600">
                            <strong>Location:</strong> {event.event_location}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="col-span-full text-center py-12"
            >
              <div className="bg-white rounded-3xl shadow-lg p-12 max-w-md mx-auto">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">No Events Available</h3>
                <p className="text-gray-600 mb-6">
                  Check back soon for exciting upcoming events and workshops!
                </p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300">
                  Stay Updated
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Events;
