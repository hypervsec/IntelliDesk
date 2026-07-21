import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

import Icon from "./Icon";

const navigationSections = [
  {
    label: "GENEL",
    items: [
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
        end: false,
        label: "Yeni Ticket",
        icon: "plus",
        emphasis: true,
      },
    ],
  },
  {
    label: "OPERASYON",
    items: [
      {
        to: "/tickets/assigned",
        end: true,
        label: "Bana Atananlar",
        icon: "user",
        staffOnly: true,
      },
      {
        to: "/sla",
        end: true,
        label: "SLA Yönetimi",
        icon: "activity",
        staffOnly: true,
      },
    ],
  },
  {
    label: "YÖNETİM",
    items: [
      {
        to: "/users",
        end: true,
        label: "Kullanıcılar",
        icon: "user",
        adminOnly: true,
      },
      {
        to: "/system-logs",
        end: true,
        label: "Sistem Logları",
        icon: "logs",
        adminOnly: true,
      },
      {
        to: "/settings",
        end: true,
        label: "Ayarlar",
        icon: "activity",
      },
    ],
  },
];

const roleLabels = {
  admin: "Yönetici",
  technician: "Teknisyen",
  user: "Kullanıcı",
};

const staffRoles = new Set(["technician", "admin"]);

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

function Sidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate();

  const { account, logout } = useAuth();

  const visibleNavigationSections = navigationSections
    .map((section) => ({
      ...section,

      items: section.items.filter((item) => {
        if (item.adminOnly && account?.role !== "admin") {
          return false;
        }

        if (item.staffOnly && !staffRoles.has(account?.role)) {
          return false;
        }

        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  function getLinkClass(item) {
    return ({ isActive }) =>
      [
        "sidebar-link",
        item.emphasis ? "sidebar-link-emphasis" : "",
        isActive ? "active" : "",
      ]
        .filter(Boolean)
        .join(" ");
  }

  function handleNavigation() {
    if (onClose) {
      onClose();
    }
  }

  function handleLogout() {
    logout();

    if (onClose) {
      onClose();
    }

    navigate("/login", {
      replace: true,
    });
  }

  const roleLabel = roleLabels[account?.role] || "Kullanıcı";

  const initials = getAccountInitials(account?.full_name);

  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-glow" />

      <div className="sidebar-header">
        <Link to="/" className="sidebar-brand" onClick={handleNavigation}>
          <div className="sidebar-brand-mark">
            <span>ID</span>

            <i />
          </div>

          <div className="sidebar-brand-copy">
            <strong>IntelliDesk</strong>

            <span>AI Destek Operasyonları</span>
          </div>
        </Link>

        <button
          type="button"
          className="sidebar-close-button"
          aria-label="Menüyü kapat"
          onClick={onClose}
        >
          <Icon name="close" size={19} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Ana menü">
        {visibleNavigationSections.map((section) => (
          <div className="sidebar-nav-section" key={section.label}>
            <span className="sidebar-section-label">{section.label}</span>

            <div className="sidebar-nav-list">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={getLinkClass(item)}
                  onClick={handleNavigation}
                >
                  <span className="sidebar-link-icon">
                    <Icon name={item.icon} size={18} />
                  </span>

                  <span className="sidebar-link-label">{item.label}</span>

                  <Icon
                    name="chevronRight"
                    size={15}
                    className="sidebar-link-arrow"
                  />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom-area">
        <div className="sidebar-account-footer">
          <div className="sidebar-account-avatar">{initials}</div>

          <div className="sidebar-account-details">
            <strong title={account?.full_name}>
              {account?.full_name || "Kullanıcı"}
            </strong>

            <div className="sidebar-account-meta">
              <span className="sidebar-online-dot" />

              <span>{roleLabel}</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout-button"
            onClick={handleLogout}
            title="Çıkış yap"
            aria-label="Çıkış yap"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
