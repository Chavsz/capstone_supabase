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
      { name: "Our Process", id: "our-process-section" },
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
    <footer className="bg-blue-500 text-white relative overflow-hidden">

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
                <h3
                  className="text-2xl font-extrabold text-white drop-shadow"
                  style={{ color: "#fff" }}
                >
                  LAV
                </h3>
                <p className="text-sm text-white">Learning Assistance Volunteer</p>
              </div>
            </div>
            <p className="text-white/90 leading-relaxed mb-6 max-w-sm">
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
            <h4 className="text-lg font-semibold mb-6 text-white" style={{ color: "#fff" }}>
              Organization
            </h4>
            <ul className="space-y-3">
              {footerLinks.organization.map((link, index) => (
                <li key={index}>
                  <a
                    href="#"
                    onClick={(e) => handleSectionClick(e, link.id)}
                    className="text-white hover:text-white transition-all duration-300 hover:translate-x-1 inline-block"
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
            <h4 className="text-lg font-semibold mb-6 text-white" style={{ color: "#fff" }}>
              Services
            </h4>
            <ul className="space-y-3">
              {footerLinks.services.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-white hover:text-white transition-all duration-300 hover:translate-x-1 inline-block"
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
            <h4 className="text-lg font-semibold mb-6 text-white" style={{ color: "#fff" }}>
              Support
            </h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    className="text-white hover:text-white transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

      </div>
      {/* Bottom Bar */}
      <motion.div
      
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        viewport={{ once: true }}
        className="bg-[#3853c2] text-white rounded-none px-4 py-4 md:px-8 w-full"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-white text-sm">
            © 2025 Learning Assistance Volunteer. All rights reserved.
          </p>
          <div className="flex space-x-6 text-sm">
            <a href="#" className="text-white/90 hover:text-white transition-colors duration-300">
              Privacy Policy
            </a>
            <a href="#" className="text-white/90 hover:text-white transition-colors duration-300">
              Terms of Service
            </a>
            <a href="#" className="text-white/90 hover:text-white transition-colors duration-300">
              Cookie Policy
            </a>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};

export default Footer;
