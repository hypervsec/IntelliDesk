import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../api/api";
import Icon from "../components/Icon";
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
        setLoading(true);
        setError("");

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
        setError("Dashboard verileri alınamadı. Backend bağlantısını kontrol et.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const maxDailyCount = useMemo(
    () => Math.max(1, ...dailyStats.map((item) => Number(item.ticket_count) || 0)),
    [dailyStats],
  );

  if (loading) {
    return (
      <main className="page">
        <div className="page-loading">
          <div className="loading-spinner" />
          <p>Dashboard hazırlanıyor...</p>
        </div>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="page">
        <p className="error-message">{error || "Dashboard verisi bulunamadı."}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header dashboard-header">
        <div>
          <span className="page-eyebrow">GENEL BAKIŞ</span>
          <h1>IntelliDesk Dashboard</h1>
          <p>Destek taleplerini, ekip yükünü ve AI performansını tek ekrandan izle.</p>
        </div>

        <Link className="primary-button button-with-icon" to="/tickets/new">
          <Icon name="plus" size={18} />
          Yeni Ticket
        </Link>
      </header>

      <section className="stats-grid">
        <StatCard title="Toplam Ticket" value={summary.total_tickets} description="Sistemdeki toplam kayıt" icon="tickets" tone="blue" />
        <StatCard title="Açık Ticket" value={summary.open_tickets} description="İşlem bekleyen kayıt" icon="open" tone="amber" />
        <StatCard title="Çözülmüş Ticket" value={summary.resolved_tickets} description="Çözüme ulaşan kayıt" icon="check" tone="green" />
        <StatCard title="Kapalı Ticket" value={summary.closed_tickets} description="Kapatılmış kayıt" icon="archive" tone="slate" />
        <StatCard title="AI Önerisi" value={summary.ai_recommendation_count} description="Öneri oluşturulan kayıt" icon="sparkles" tone="violet" />
        <StatCard
          title="Ortalama AI Güveni"
          value={`%${(Number(summary.average_ai_confidence || 0) * 100).toFixed(2)}`}
          description="Ortalama benzerlik puanı"
          icon="confidence"
          tone="cyan"
        />
      </section>

      <section className="dashboard-grid">
        <DashboardList title="Kategori Dağılımı" items={categories} labelKey="category" />
        <DashboardList title="Durum Dağılımı" items={statuses} labelKey="status" translateLabel={translateStatus} />
        <DashboardList title="Öncelik Dağılımı" items={priorities} labelKey="priority" translateLabel={translatePriority} />
        <DashboardList title="Departman Dağılımı" items={departments} labelKey="department" />
      </section>

      <section className="panel dashboard-activity-panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">AKTİVİTE</span>
            <h2>Son 7 Günlük Ticket Sayısı</h2>
            <p>Günlük açılan destek taleplerinin karşılaştırması</p>
          </div>
          <Link className="text-link" to="/tickets">
            Tüm ticketları görüntüle
            <Icon name="arrowRight" size={17} />
          </Link>
        </div>

        <div className="daily-chart" role="img" aria-label="Son 7 günlük ticket grafiği">
          {dailyStats.length === 0 ? (
            <p className="empty-message">Gösterilecek veri bulunamadı.</p>
          ) : (
            dailyStats.map((item) => {
              const count = Number(item.ticket_count) || 0;
              const height = Math.max(8, (count / maxDailyCount) * 100);

              return (
                <div className="daily-chart-item" key={item.date}>
                  <strong>{count}</strong>
                  <div className="daily-chart-track">
                    <div className="daily-chart-bar" style={{ height: `${height}%` }} />
                  </div>
                  <span>{formatShortDate(item.date)}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

function DashboardList({ title, items, labelKey, translateLabel = (value) => value }) {
  const maxCount = Math.max(1, ...items.map((item) => Number(item.ticket_count) || 0));

  return (
    <article className="panel distribution-panel">
      <div className="panel-title-row">
        <h2>{title}</h2>
        <span>{items.length} grup</span>
      </div>

      <div className="distribution-list">
        {items.length === 0 ? (
          <p className="empty-message">Gösterilecek veri bulunamadı.</p>
        ) : (
          items.map((item) => {
            const count = Number(item.ticket_count) || 0;
            const percentage = (count / maxCount) * 100;

            return (
              <div className="distribution-item" key={item[labelKey]}>
                <div className="distribution-item-head">
                  <span>{translateLabel(item[labelKey])}</span>
                  <strong>{count}</strong>
                </div>
                <div className="distribution-track">
                  <div className="distribution-fill" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}

function translatePriority(priority) {
  return { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" }[priority] || priority;
}

function translateStatus(status) {
  return {
    open: "Açık",
    assigned: "Atandı",
    in_progress: "İşlemde",
    waiting_user: "Kullanıcı Bekleniyor",
    resolved: "Çözüldü",
    closed: "Kapalı",
    cancelled: "İptal",
  }[status] || status;
}

function formatShortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

export default Dashboard;
