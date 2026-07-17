import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Icon from "./Icon";

import "./sidebar-account.css";

const navigationItems = [
  {
    to: "/",
    end: true,
    label: "Dashboard",
    icon: "dashboard",
  },
  {
    to: "/tickets",
    end: true,
    label: "Ticketlar",
    icon: "tickets",
  },
  {
    to: "/tickets/new",
    label: "Yeni Ticket",
    icon: "plus",
  },
];

const roleLabels = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

function getAccountInitials(fullName) {
  if (!fullName) {
    return "ID";
  }

  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) {
    return "ID";
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  }

  return (
    nameParts[0][0] + nameParts[nameParts.length - 1][0]
  ).toLocaleUpperCase("tr-TR");
}

function Sidebar() {
  const navigate = useNavigate();

  const { account, logout } = useAuth();

  function getLinkClass({ isActive }) {
    return isActive ? "sidebar-link active" : "sidebar-link";
  }

  function handleLogout() {
    logout();

    navigate("/login", {
      replace: true,
    });
  }

  const roleLabel = roleLabels[account?.role] || "Kullanıcı";

  const initials = getAccountInitials(account?.full_name);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">ID</div>

        <div>
          <div className="sidebar-logo">IntelliDesk</div>

          <span className="sidebar-subtitle">AI Service Desk</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Ana menü">
        <span className="sidebar-section-label">MENÜ</span>

        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={getLinkClass}
          >
            <Icon name={item.icon} size={19} />

            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-account-compact">
          <div className="sidebar-account-avatar">{initials}</div>

          <div className="sidebar-account-identity">
            <strong title={account?.full_name}>
              {account?.full_name || "Kullanıcı"}
            </strong>

            <span title={account?.email}>{roleLabel}</span>
          </div>

          <button
            type="button"
            className="sidebar-logout-icon"
            onClick={handleLogout}
            title="Çıkış Yap"
            aria-label="Çıkış Yap"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>

        <div className="sidebar-system-status">
          <span className="sidebar-system-dot" />

          <span>Sistem aktif</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
