import {useState} from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
} from "recharts";

// Pie Chart
export const CollegePieChart = ({ collegeData }) => {
  // Prepare data for pie chart: students by college
  const collegeMapping = {
    "College of Engineering": "COE",
    "College of Arts and Social Sciences": "CASS",
    "College of Computer Studies": "CCS",
    "College of Education": "CED",
    "College of Health and Sciences": "CHS",
    "College of Economics, Business, and Accountancy": "CEBA",
    "College of Science and Mathematics": "CSM",
  };

  const collegeColors = [
    "#FF6B6B", // COE - Red
    "#4ECDC4", // CASS - Teal
    "#45B7D1", // CCS - Blue
    "#96CEB4", // COED - Green
    "#FFEAA7", // CHS - Yellow
    "#DDA0DD", // CEBA - Plum
    "#98D8C8", // CSM - Mint
  ];

  // Process college data for pie chart
  let pieChartData = [];

  pieChartData = collegeData.map((item, index) => {
    const shortName = collegeMapping[item.college] || item.college;
    const value =
      parseInt(item.student_count ?? item.count ?? item.value, 10) || 0;
    return {
      name: shortName,
      value,
      color: collegeColors[index % collegeColors.length],
    };
  });

  return (
    <div>
      <p className="text-blue-600 font-semibold mb-4">Students by College</p>
      {pieChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieChartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          <p>No college data available</p>
        </div>
      )}
    </div>
  );
};

// Bar chart to display the session dates
export const SessionBarChart = ({ appointmentsData }) => {
  const barColors = [
    "#ea5545", // Mon
    "#ef9b20", // Tue
    "#edbf33", // Wed
    "#bdcf32", // Thu
    "#27aeef", // Fri
  ];

  // Helper: Get weekday name from date string
  function getWeekday(dateString) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const date = new Date(dateString);
    return days[date.getDay()];
  }

  // Prepare data for bar chart: confirmed appointments per weekday
  const confirmedAppointments = appointmentsData.filter(
    (a) =>
      a.status === "confirmed" ||
      a.status === "started" ||
      a.status === "completed"
  );
  const weekdayCounts = confirmedAppointments.reduce((acc, appt) => {
    const weekday = getWeekday(appt.date);
    acc[weekday] = (acc[weekday] || 0) + 1;
    return acc;
  }, {});
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const barChartData = weekdays.map((day) => ({
    weekday: day,
    count: weekdayCounts[day] || 0,
  }));
  return (
    <div>
      {" "}
      <p className="text-blue-600 font-semibold">Confirmed Sessions</p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={barChartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="weekday" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count">
            {barChartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barColors[index % barColors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

//Appointments Area Chart
export const AppointmentsAreaChart = ({appointmentsData}) => {
  const [areaRange, setAreaRange] = useState("7d");

  // Helper: Filter appointments by date range
  function filterByRange(appts, range) {
    const now = new Date();
    let startDate;
    if (range === "7d") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
    } else if (range === "30d") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
    } else if (range === "3m") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
    }
    return appts.filter(
      (a) => new Date(a.date) >= startDate && new Date(a.date) <= now
    );
  }

  // Helper: Format date as 'Mon DD'
  function formatShortDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Prepare area chart data
  const filteredAppointments = filterByRange(appointmentsData, areaRange);
  // Get all unique dates in range
  const dateSet = new Set(filteredAppointments.map((a) => a.date));
  const sortedDates = Array.from(dateSet).sort();
  // Build data for each date
  const areaChartData = sortedDates.map((date) => {
    const booked = filteredAppointments.filter((a) => a.date === date).length;
    const completed = filteredAppointments.filter(
      (a) => a.date === date && a.status === "completed"
    ).length;
    const cancelled = filteredAppointments.filter(
      (a) => a.date === date && a.status === "cancelled"
    ).length;
    return { date, booked, completed, cancelled };
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-blue-600 font-semibold">Appointments Overview</p>
        <select
          value={areaRange}
          onChange={(e) => setAreaRange(e.target.value)}
          className="bg-white border-0 outline-0 text-blue-600 text-sm rounded-md p-[2px]"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="3m">Last 3 Months</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          data={areaChartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatShortDate} />
          <YAxis allowDecimals={false} />
          <Tooltip labelFormatter={formatShortDate} />
          <Legend />
          <Area
            type="monotone"
            dataKey="booked"
            stroke="#27aeef"
            fill="#27aeef33"
            name="Booked"
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke="#bdcf32"
            fill="#bdcf3233"
            name="Completed"
          />
          <Area
            type="monotone"
            dataKey="cancelled"
            stroke="#ea5545"
            fill="#ea554533"
            name="Cancelled"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
