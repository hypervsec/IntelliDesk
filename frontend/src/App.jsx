import { useState } from "react";

import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import Icon from "./components/Icon";
import NotificationsMenu from "./components/NotificationsMenu";
import Sidebar from "./components/Sidebar";
import ThemeToggle from "./components/ThemeToggle";

import AssignedTickets from "./pages/AssignedTickets";
import CreateTicket from "./pages/CreateTicket";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import SlaManagement from "./pages/SlaManagement";
import SystemLogs from "./pages/SystemLogs";
import TicketDetail from "./pages/TicketDetail";
import Tickets from "./pages/Tickets";
import UserManagement from "./pages/UserManagement";

function getPageMeta(pathname) {
  if (pathname === "/") {
    return {
      section: "Dashboard",
      title: "Genel Bakış",
    };
  }

  if (pathname === "/ai-support") {
    return {
      section: "AI Destek",
      title: "Yeni Ticket",
    };
  }

  if (pathname === "/tickets") {
    return {
      section: "Ticketlar",
      title: "Ticket Yönetimi",
    };
  }

  if (pathname === "/tickets/assigned") {
    return {
      section: "Ticketlar",
      title: "Bana Atananlar",
    };
  }

  if (pathname === "/sla") {
    return {
      section: "Operasyon",
      title: "SLA Yönetimi",
    };
  }

  if (pathname === "/system-logs") {
    return {
      section: "Yönetim",
      title: "Sistem Logları",
    };
  }

  if (/^\/tickets\/[^/]+$/.test(pathname)) {
    return {
      section: "Ticketlar",
      title: "Ticket Detayı",
    };
  }

  if (pathname === "/users") {
    return {
      section: "Yönetim",
      title: "Kullanıcılar",
    };
  }

  if (pathname === "/settings") {
    return {
      section: "Hesap",
      title: "Ayarlar",
    };
  }

  return {
    section: "IntelliDesk",
    title: "Çalışma Alanı",
  };
}

function StaffRoute({ children }) {
  const { account } = useAuth();

  if (account?.role !== "technician" && account?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { account } = useAuth();

  if (account?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedLayout() {
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageMeta = getPageMeta(location.pathname);

  const isAiSupportPage = location.pathname === "/ai-support";

  const showAiSupportButton = !isAiSupportPage;

  const pageRegionClassName = [
    "app-page-region",
    isAiSupportPage ? "ai-support-region" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ProtectedRoute>
      <div className="app-layout">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => {
            setSidebarOpen(false);
          }}
        />

        {sidebarOpen ? (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="Menüyü kapat"
            onClick={() => {
              setSidebarOpen(false);
            }}
          />
        ) : null}

        <div className="app-content">
          <header className="app-topbar">
            <div className="app-topbar-start">
              <button
                type="button"
                className="topbar-menu-button"
                aria-label="Menüyü aç"
                onClick={() => {
                  setSidebarOpen(true);
                }}
              >
                <Icon name="menu" size={20} />
              </button>

              <nav className="app-breadcrumb" aria-label="Sayfa yolu">
                <span>{pageMeta.section}</span>

                <Icon name="chevronRight" size={14} />

                <strong>{pageMeta.title}</strong>
              </nav>
            </div>

            <div className="app-topbar-actions">
              <ThemeToggle />

              <NotificationsMenu />

              {showAiSupportButton ? (
                <Link to="/ai-support" className="topbar-create-button">
                  <Icon name="plus" size={17} />

                  <span>AI Destek Al</span>
                </Link>
              ) : null}
            </div>
          </header>

          <main className={pageRegionClassName}>
            <Outlet />
          </main>
        </div>
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

          <Route path="/ai-support" element={<CreateTicket />} />

          <Route
            path="/tickets/new"
            element={<Navigate to="/ai-support" replace />}
          />

          <Route path="/tickets" element={<Tickets />} />

          <Route
            path="/tickets/assigned"
            element={
              <StaffRoute>
                <AssignedTickets />
              </StaffRoute>
            }
          />

          <Route
            path="/sla"
            element={
              <StaffRoute>
                <SlaManagement />
              </StaffRoute>
            }
          />

          <Route
            path="/system-logs"
            element={
              <AdminRoute>
                <SystemLogs />
              </AdminRoute>
            }
          />

          <Route path="/tickets/:ticketId" element={<TicketDetail />} />

          <Route
            path="/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />

          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
