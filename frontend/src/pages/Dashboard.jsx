import { useEffect, useState } from "react";

import api from "../api/api";
import StatCard from "../components/StatCard";

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const responses = await Promise.all([
          api.get("/tickets/dashboard/summary"),
          api.get("/tickets/dashboard/categories"),
          api.get("/tickets/dashboard/statuses"),
          api.get("/tickets/dashboard/priorities"),
          api.get("/tickets/dashboard/departments"),
          api.get("/tickets/dashboard/daily"),
        ]);

        setSummary(responses[0].data);
        setCategories(responses[1].data);
        setStatuses(responses[2].data);
        setPriorities(responses[3].data);
        setDepartments(responses[4].data);
        setDailyStats(responses[5].data);
      } catch (err) {
        console.error(err);
        setError(
          "Dashboard verileri alınamadı. Backend ve CORS ayarlarını kontrol et.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="page">
        <p>Dashboard yükleniyor...</p>
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
          <h1>IntelliDesk</h1>
          <p>Yapay zekâ destekli Service Desk dashboardu</p>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          title="Toplam Ticket"
          value={summary.total_tickets}
          description="Sistemdeki toplam kayıt"
        />

        <StatCard
          title="Açık Ticket"
          value={summary.open_tickets}
          description="İşlem bekleyen kayıt"
        />

        <StatCard
          title="Çözülmüş Ticket"
          value={summary.resolved_tickets}
          description="Çözüme ulaşan kayıt"
        />

        <StatCard
          title="Kapalı Ticket"
          value={summary.closed_tickets}
          description="Kapatılmış kayıt"
        />

        <StatCard
          title="AI Önerisi"
          value={summary.ai_recommendation_count}
          description="Öneri oluşturulan kayıt"
        />

        <StatCard
          title="Ortalama AI Güveni"
          value={`%${(summary.average_ai_confidence * 100).toFixed(2)}`}
          description="Ortalama benzerlik puanı"
        />
      </section>

      <section className="dashboard-grid">
        <DashboardList
          title="Kategori Dağılımı"
          items={categories}
          labelKey="category"
        />

        <DashboardList
          title="Durum Dağılımı"
          items={statuses}
          labelKey="status"
        />

        <DashboardList
          title="Öncelik Dağılımı"
          items={priorities}
          labelKey="priority"
        />

        <DashboardList
          title="Departman Dağılımı"
          items={departments}
          labelKey="department"
        />
      </section>

      <section className="panel">
        <h2>Son 7 Günlük Ticket Sayısı</h2>

        <div className="daily-list">
          {dailyStats.map((item) => (
            <div className="daily-item" key={item.date}>
              <span>{item.date}</span>
              <strong>{item.ticket_count}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function DashboardList({ title, items, labelKey }) {
  return (
    <div className="panel">
      <h2>{title}</h2>

      <div className="distribution-list">
        {items.length === 0 && (
          <p className="empty-message">Gösterilecek veri bulunamadı.</p>
        )}

        {items.map((item) => (
          <div className="distribution-item" key={item[labelKey]}>
            <span>{item[labelKey]}</span>
            <strong>{item.ticket_count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
