import React from "react";
import {
  MdMessage,
  MdSearch,
  MdAccessTime,
  MdEventAvailable,
  MdLock,
  MdNotificationsActive,
} from "react-icons/md";

const conversations = [
  {
    id: "conv-1",
    name: "Alex Dela Cruz",
    role: "Tutor",
    preview: "I'll confirm the Feb 7 session today.",
    time: "2 min",
    unread: 2,
  },
  {
    id: "conv-2",
    name: "Jamie Mendoza",
    role: "Tutee",
    preview: "Thanks! I'll prepare the worksheet.",
    time: "11 min",
    unread: 0,
  },
  {
    id: "conv-3",
    name: "Rina Santos",
    role: "Tutor",
    preview: "We can review algebra on Feb 7.",
    time: "1 hr",
    unread: 1,
  },
  {
    id: "conv-4",
    name: "Paolo Reyes",
    role: "Tutee",
    preview: "Can I share a draft before the session?",
    time: "1 day",
    unread: 0,
  },
];

const sampleMessages = [
  {
    id: "msg-1",
    sender: "tutor",
    text: "Confirmed your appointment for February 7. Messaging is now open.",
    time: "Feb 3 · 9:10 AM",
  },
  {
    id: "msg-2",
    sender: "tutee",
    text: "Thank you! I'll send the reviewer and questions today.",
    time: "Feb 3 · 9:12 AM",
  },
  {
    id: "msg-3",
    sender: "tutor",
    text: "Perfect. Reminder: we start at 3:00 PM on Feb 7.",
    time: "Feb 6 · 2:55 PM",
  },
  {
    id: "msg-4",
    sender: "system",
    text: "Messaging window closes after the session ends on Feb 7.",
    time: "Feb 7 · 4:30 PM",
  },
];

const rules = [
  {
    stage: "Session Confirmation",
    timing: "Tutor confirms a future date (e.g., Feb 7).",
    details:
      "Clicking Confirm Appointment opens messaging from the confirmation time (e.g., Feb 3).",
  },
  {
    stage: "Message Activation",
    timing: "Feb 3 → Feb 7",
    details:
      "Tutor and tutee can exchange messages during the active window.",
  },
  {
    stage: "Session Reminder",
    timing: "Feb 6 (24 hours before)",
    details:
      "System sends a reminder notification to both users.",
  },
  {
    stage: "Message Expiry",
    timing: "After the session ends on Feb 7",
    details:
      "Messaging deactivates; no new or editable messages allowed.",
  },
];

const MessageSystem = ({ roleLabel = "Tutee" }) => {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <MdMessage />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Messages</h1>
            <p className="text-sm text-gray-500">
              Sample messaging view for {roleLabel.toLowerCase()} accounts.
            </p>
          </div>
        </header>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                <MdAccessTime />
                Messaging Active: Feb 3 → Feb 7
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                <MdEventAvailable />
                Session: Feb 7 · 3:00 PM
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                <MdNotificationsActive />
                Reminder: Feb 6
              </span>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              <MdLock />
              Closes after session ends
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search message"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                disabled
              />
              <MdSearch className="absolute right-3 top-2.5 text-gray-400" />
            </div>

            <div className="space-y-3">
              {conversations.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                    index === 0
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {item.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500">{item.preview}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-gray-400">
                      {item.time}
                    </span>
                    {item.unread > 0 && (
                      <span className="text-[10px] font-semibold text-white bg-blue-600 rounded-full px-2 py-0.5">
                        {item.unread}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Alex Dela Cruz
                </p>
                <p className="text-xs text-gray-500">Active now</p>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {roleLabel} view
              </span>
            </div>

            <div className="border-t border-gray-100" />

            <div className="flex-1 space-y-4">
              {sampleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "tutee"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.sender === "tutee"
                        ? "bg-blue-600 text-white"
                        : message.sender === "system"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <p className="leading-relaxed">{message.text}</p>
                    <p
                      className={`mt-2 text-[11px] ${
                        message.sender === "tutee"
                          ? "text-blue-100"
                          : "text-gray-400"
                      }`}
                    >
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Sample message composer (disabled after session ends).
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Message System Rules
              </h2>
              <p className="text-sm text-gray-500">
                Summary of the messaging window and lifecycle.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
                  <th className="py-3 pr-4">Stage</th>
                  <th className="py-3 pr-4">Timing</th>
                  <th className="py-3">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.stage} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-semibold text-gray-700">
                      {rule.stage}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {rule.timing}
                    </td>
                    <td className="py-3 text-gray-600">{rule.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MessageSystem;
