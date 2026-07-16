import { NavLink } from "react-router-dom";

function Sidebar() {
  function getLinkClass({ isActive }) {
    return isActive ? "sidebar-link active" : "sidebar-link";
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">IntelliDesk</div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={getLinkClass}>
          Dashboard
        </NavLink>

        <NavLink to="/tickets" end className={getLinkClass}>
          Ticketlar
        </NavLink>

        <NavLink to="/tickets/new" className={getLinkClass}>
          Yeni Ticket
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
