import React from "react";
import LAV_image from "../assets/LAV_image.png";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Footer = () => {
  const navigate = useNavigate();

  const handleSectionClick = (e, sectionId) => {
    e.preventDefault();
    navigate("/");
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const footerLinks = {
    organization: [
      { name: "Home", id: "home-section" },
      { name: "About", id: "about-section" },
      { name: "Events", id: "events-section" },
      { name: "Our Tutors", id: "our-tutors-section" },
      { name: "Contact Us", id: "contact-us-section" }
    ],
    services: [
      { name: "Online Tutoring", href: "#" },
      { name: "Group Sessions", href: "#" },
      { name: "Study Materials", href: "#" },
      { name: "Progress Tracking", href: "#" }
    ],
    support: [
      { name: "Help Center", href: "#" },
      { name: "FAQ", href: "#" },
      { name: "Contact Support", href: "#" },
      { name: "Privacy Policy", href: "#" }
    ]
  };

  return (
    <footer className="bg-gradient-to-br from-blue-200 via-blue-800 to-purple-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="lg:col-span-1"
          >
            <div className="flex items-center space-x-3 mb-6">
              <img src={LAV_image} alt="LAV Logo" className="w-12 h-12" />
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  LAV
                </h3>
                <p className="text-sm text-blue-200">Learning Assistance Volunteer</p>
              </div>
            </div>
            <p className="text-blue-100 leading-relaxed mb-6">
              Empowering students through quality education and personalized learning experiences.
            </p>
            
          </motion.div>

          {/* Organization Links */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <h4 className="text-lg font-semibold mb-6 text-white">Organization</h4>
            <ul className="space-y-3">
              {footerLinks.organization.map((link, index) => (
                <li key={index}>
                  <a
                    href="#"
                    onClick={(e) => handleSectionClick(e, link.id)}
                    className="text-blue-200 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Services Links */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h4 className="text-lg font-semibold mb-6 text-white">Services</h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-blue-200 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Support Links */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <h4 className="text-lg font-semibold mb-6 text-white">Support</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-blue-200 hover:text-white transition-colors duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Newsletter Signup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-12"
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Stay Updated</h3>
            <p className="text-blue-200 mb-6">Subscribe to our newsletter for the latest updates and educational content.</p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105">
                Subscribe
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="border-t border-white/20 pt-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-blue-200 text-sm">
              © 2025 Learning Assistance Volunteer. All rights reserved.
            </p>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-blue-200 hover:text-white transition-colors duration-300">
                Privacy Policy
              </a>
              <a href="#" className="text-blue-200 hover:text-white transition-colors duration-300">
                Terms of Service
              </a>
              <a href="#" className="text-blue-200 hover:text-white transition-colors duration-300">
                Cookie Policy
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
