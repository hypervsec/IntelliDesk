import { NavLink } from "react-router-dom";

import Icon from "./Icon";

const navigationItems = [
  { to: "/", end: true, label: "Dashboard", icon: "dashboard" },
  { to: "/tickets", end: true, label: "Ticketlar", icon: "tickets" },
  { to: "/tickets/new", label: "Yeni Ticket", icon: "plus" },
];

function Sidebar() {
  function getLinkClass({ isActive }) {
    return isActive ? "sidebar-link active" : "sidebar-link";
  }

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

      <div className="sidebar-footer">
        <div className="sidebar-status-dot" />
        <div>
          <strong>Sistem aktif</strong>
          <span>Backend bağlantısı hazır</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
