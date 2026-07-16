import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      try {
        const response = await api.get("/tickets");
        setTickets(response.data);
      } catch (err) {
        console.error(err);
        setError("Ticketlar alınamadı.");
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  if (loading) {
    return (
      <main className="page">
        <p>Ticketlar yükleniyor...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <p className="error-message">{error}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Ticketlar</h1>
          <p>Sistemde kayıtlı destek talepleri</p>
        </div>
      </header>

      <section className="panel">
        {tickets.length === 0 ? (
          <p className="empty-message">Henüz ticket bulunmuyor.</p>
        ) : (
          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Konu</th>
                  <th>Kategori</th>
                  <th>Öncelik</th>
                  <th>Durum</th>
                  <th>AI Güveni</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket_id}>
                    <td>#{ticket.ticket_id}</td>

                    <td>
                      <div className="ticket-title-cell">
                        <strong>{ticket.title}</strong>
                        <span>
                          {ticket.requester_name || "Kullanıcı belirtilmemiş"}
                        </span>
                      </div>
                    </td>

                    <td>{ticket.category || "Belirtilmemiş"}</td>

                    <td>
                      <span className={`badge priority-${ticket.priority}`}>
                        {translatePriority(ticket.priority)}
                      </span>
                    </td>

                    <td>
                      <span className={`badge status-${ticket.status}`}>
                        {translateStatus(ticket.status)}
                      </span>
                    </td>

                    <td>
                      {ticket.ai_confidence_score
                        ? `%${(
                            Number(ticket.ai_confidence_score) * 100
                          ).toFixed(2)}`
                        : "-"}
                    </td>

                    <td>
                      <Link
                        className="detail-link"
                        to={`/tickets/${ticket.ticket_id}`}
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function translatePriority(priority) {
  const values = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  };

  return values[priority] || priority;
}

function translateStatus(status) {
  const values = {
    open: "Açık",
    assigned: "Atandı",
    in_progress: "İşlemde",
    waiting_user: "Kullanıcı Bekleniyor",
    resolved: "Çözüldü",
    closed: "Kapalı",
    cancelled: "İptal",
  };

  return values[status] || status;
}

export default Tickets;
