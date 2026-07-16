import { BrowserRouter, Route, Routes } from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import CreateTicket from "./pages/CreateTicket";
import TicketDetail from "./pages/TicketDetail";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />

        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route path="/tickets" element={<Tickets />} />

            <Route path="/tickets/new" element={<CreateTicket />} />

            <Route path="/tickets/:ticketId" element={<TicketDetail />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
