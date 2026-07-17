import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute";

import Sidebar from "./components/Sidebar";

import CreateTicket from "./pages/CreateTicket";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TicketDetail from "./pages/TicketDetail";
import Tickets from "./pages/Tickets";

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <div className="app-layout">
        <Sidebar />

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedLayout />}>
          <Route index element={<Dashboard />} />

          <Route path="/tickets" element={<Tickets />} />

          <Route path="/tickets/new" element={<CreateTicket />} />

          <Route path="/tickets/:ticketId" element={<TicketDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
