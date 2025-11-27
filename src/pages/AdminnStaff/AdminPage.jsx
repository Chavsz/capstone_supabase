import { Routes, Route } from "react-router-dom";

import Sidebar from "./Sidebar";
import Dashboard from "./Dashboard";
import Landing from "./Landing";
import Lavroom from "./Lavroom";
import Users from "./Users";
import Event from "./Event";
import Announcments from "./Announcments";

function AdminPage({ setAuth }) {
  // #f0f3f7

  return (
    <div className="grid grid-cols-[80px_1fr] md:grid-cols-[240px_1fr] transition-width duration-300 bg-[#f8fcff] min-h-screen">
      <div>
        <Sidebar setAuth={setAuth} />
      </div>
      <div className="">
        <Routes>
          <Route
            exact
            path="/"
            element={<Dashboard setAuth={setAuth} />}
          />
          <Route exact path="/landingadmin" element={<Landing />} />
          <Route exact path="/lavroom" element={<Lavroom />} />
          <Route exact path="/event" element={<Event />} />
          <Route exact path="/announcments" element={<Announcments />} />
          <Route exact path="/users" element={<Users />} />
        </Routes>
      </div>
    </div>
  );
}

export default AdminPage;
