import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import api from "../api/api";
import {
  DashboardDistributionPanels,
  DashboardTicketDensityPanel,
} from "../components/DashboardOperationsPanel";
import Icon from "../components/Icon";

import "../styles/dashboard-v2.css";

const statusColors = {
  open: "#38bdf8",
  assigned: "#818cf8",
  in_progress: "#a78bfa",
  waiting_user: "#fbbf24",
  resolved: "#2dd4bf",
  closed: "#64748b",
  cancelled: "#f87171",
};

function Dashboard() {
  const [summary, setSummary] = useState(null);

  const [categories, setCategories] = useState([]);

  const [statuses, setStatuses] = useState([]);

  const [departments, setDepartments] = useState([]);

  const [dailyStats, setDailyStats] = useState([]);

  const [recentTickets, setRecentTickets] = useState([]);

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
          api.get("/tickets/dashboard/departments"),
          api.get("/tickets/dashboard/daily"),
          api.get("/tickets/paged", {
            params: {
              page: 1,
              page_size: 5,
              sort: "newest",
            },
          }),
        ]);

        setSummary(responses[0].data);

        setCategories(
          Array.isArray(responses[1].data) ? responses[1].data : [],
        );

        setStatuses(Array.isArray(responses[2].data) ? responses[2].data : []);

        setDepartments(
          Array.isArray(responses[3].data) ? responses[3].data : [],
        );

        setDailyStats(
          Array.isArray(responses[4].data) ? responses[4].data : [],
        );

        setRecentTickets(
          Array.isArray(responses[5].data?.items)
            ? responses[5].data.items
            : [],
        );
      } catch (requestError) {
        console.error(requestError);

        setError(
          getApiErrorMessage(requestError, "Dashboard verileri alınamadı."),
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const dashboardMetrics = useMemo(() => {
    const totalTickets = Number(summary?.total_tickets) || 0;

    const openTickets = Number(summary?.open_tickets) || 0;

    const resolvedTickets = Number(summary?.resolved_tickets) || 0;

    const closedTickets = Number(summary?.closed_tickets) || 0;

    const aiRecommendationCount = Number(summary?.ai_recommendation_count) || 0;

    const averageAiConfidence = normalizePercentage(
      Number(summary?.average_ai_confidence) * 100,
    );

    const completedTickets = resolvedTickets + closedTickets;

    const resolutionRate =
      totalTickets > 0
        ? normalizePercentage((completedTickets / totalTickets) * 100)
        : 0;

    const openRate =
      totalTickets > 0
        ? normalizePercentage((openTickets / totalTickets) * 100)
        : 0;

    const aiCoverage =
      totalTickets > 0
        ? normalizePercentage((aiRecommendationCount / totalTickets) * 100)
        : 0;

    return {
      totalTickets,
      openTickets,
      aiRecommendationCount,
      averageAiConfidence,
      completedTickets,
      resolutionRate,
      openRate,
      aiCoverage,
    };
  }, [summary]);

  const lineChart = useMemo(() => buildLineChart(dailyStats), [dailyStats]);

  const statusTotal = useMemo(
    () =>
      statuses.reduce(
        (total, item) => total + (Number(item.ticket_count) || 0),
        0,
      ),
    [statuses],
  );

  const donutBackground = useMemo(
    () => buildDonutGradient(statuses, statusTotal),
    [statuses, statusTotal],
  );

  if (loading) {
    return (
      <main className="dashboard-v2-page">
        <div className="dashboard-v2-loading">
          <div className="dashboard-v2-spinner" />

          <div>
            <strong>Operasyon merkezi hazırlanıyor</strong>

            <span>Canlı veriler yükleniyor...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !summary) {
    return (
      <main className="dashboard-v2-page">
        <div className="dashboard-v2-error">
          <Icon name="activity" size={22} />

          <div>
            <strong>Dashboard yüklenemedi</strong>

            <span>{error || "Dashboard verisi bulunamadı."}</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-v2-page">
      <section className="dashboard-v2-metrics">
        <MetricCard
          title="Toplam Ticket"
          value={dashboardMetrics.totalTickets}
          description="Sistemdeki toplam kayıt"
          progress={100}
          progressLabel="Toplam hacim"
          icon="tickets"
          tone="blue"
        />

        <MetricCard
          title="Açık Ticket"
          value={dashboardMetrics.openTickets}
          description="İşlem bekleyen ticket"
          progress={dashboardMetrics.openRate}
          progressLabel={`Toplamın %${dashboardMetrics.openRate.toFixed(0)}'i`}
          icon="open"
          tone="amber"
        />

        <MetricCard
          title="Çözülme Oranı"
          value={`%${dashboardMetrics.resolutionRate.toFixed(0)}`}
          description={`${dashboardMetrics.completedTickets} kayıt tamamlandı`}
          progress={dashboardMetrics.resolutionRate}
          progressLabel="Çözülen ve kapanan"
          icon="check"
          tone="green"
        />

        <MetricCard
          title="AI Güven Skoru"
          value={`%${dashboardMetrics.averageAiConfidence.toFixed(1)}`}
          description={`${dashboardMetrics.aiRecommendationCount} AI önerisi`}
          progress={dashboardMetrics.averageAiConfidence}
          progressLabel={`Kapsama %${dashboardMetrics.aiCoverage.toFixed(0)}`}
          icon="sparkles"
          tone="violet"
        />
      </section>

      <section className="dashboard-v2-primary-grid">
        <article className="dashboard-v2-panel dashboard-v2-activity-panel">
          <div className="dashboard-v2-panel-header">
            <div>
              <span className="dashboard-v2-section-label">
                TICKET AKTİVİTESİ
              </span>

              <h2>Son 7 Günlük Hareket</h2>

              <p>Günlük açılan ticket sayılarının değişimi</p>
            </div>

            <div className="dashboard-v2-chart-legend">
              <span>
                <i />
                Yeni ticket
              </span>
            </div>
          </div>

          <div className="dashboard-v2-line-chart">
            <div className="dashboard-v2-y-axis">
              <span>{lineChart.maxValue}</span>

              <span>{Math.round(lineChart.maxValue / 2)}</span>

              <span>0</span>
            </div>

            <div className="dashboard-v2-chart-canvas">
              <svg
                viewBox={`0 0 ${lineChart.width} ${lineChart.height}`}
                preserveAspectRatio="none"
                aria-label="Son 7 günlük ticket grafiği"
              >
                <defs>
                  <linearGradient
                    id="dashboardAreaGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />

                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>

                  <filter
                    id="dashboardLineGlow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="4" result="blur" />

                    <feMerge>
                      <feMergeNode in="blur" />

                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {[0.25, 0.5, 0.75].map((value) => (
                  <line
                    key={value}
                    x1="0"
                    y1={lineChart.height * value}
                    x2={lineChart.width}
                    y2={lineChart.height * value}
                    stroke="rgba(148, 163, 184, 0.15)"
                    strokeDasharray="6 8"
                  />
                ))}

                <path
                  d={lineChart.areaPath}
                  fill="url(#dashboardAreaGradient)"
                />

                <polyline
                  points={lineChart.polyline}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#dashboardLineGlow)"
                />

                {lineChart.points.map((point, index) => (
                  <g key={point.key}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill="#111a31"
                      stroke="#a5b4fc"
                      strokeWidth="4"
                    />

                    <circle cx={point.x} cy={point.y} r="2" fill="#ffffff" />

                    <text
                      x={point.x}
                      y={point.y - 18}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="16"
                      fontWeight="700"
                    >
                      {point.value}
                    </text>

                    <text
                      x={point.x}
                      y={lineChart.height - 5}
                      textAnchor="middle"
                      fill="#71809a"
                      fontSize="14"
                    >
                      {lineChart.labels[index]}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="dashboard-v2-chart-summary">
            <div>
              <span>7 günlük toplam</span>

              <strong>{lineChart.totalCount}</strong>
            </div>

            <div>
              <span>Günlük ortalama</span>

              <strong>{lineChart.averageCount}</strong>
            </div>

            <div>
              <span>En yoğun gün</span>

              <strong>{lineChart.peakLabel}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-v2-panel dashboard-v2-status-panel">
          <div className="dashboard-v2-panel-header">
            <div>
              <span className="dashboard-v2-section-label">DURUM DAĞILIMI</span>

              <h2>Açık Operasyonlar</h2>

              <p>Ticket durumlarının anlık dağılımı</p>
            </div>
          </div>

          <div className="dashboard-v2-donut-layout">
            <div
              className="dashboard-v2-donut"
              style={{
                background: donutBackground,
              }}
              role="img"
              aria-label="Ticket durum dağılımı"
            >
              <div className="dashboard-v2-donut-center">
                <span>Toplam</span>

                <strong>{statusTotal}</strong>

                <small>ticket</small>
              </div>
            </div>

            <div className="dashboard-v2-status-list">
              {statuses.length === 0 ? (
                <p className="dashboard-v2-empty">Durum verisi yok.</p>
              ) : (
                statuses.map((item) => {
                  const count = Number(item.ticket_count) || 0;

                  const percentage =
                    statusTotal > 0 ? (count / statusTotal) * 100 : 0;

                  const color = statusColors[item.status] || "#64748b";

                  return (
                    <div className="dashboard-v2-status-item" key={item.status}>
                      <span
                        className="dashboard-v2-status-color"
                        style={{
                          background: color,
                        }}
                      />

                      <span className="dashboard-v2-status-name">
                        {translateStatus(item.status)}
                      </span>

                      <strong>{count}</strong>

                      <small>%{percentage.toFixed(0)}</small>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-ops-overview-grid">
        <article className="dashboard-v2-panel dashboard-v2-recent-panel">
          <div className="dashboard-v2-panel-header">
            <div>
              <span className="dashboard-v2-section-label">SON HAREKETLER</span>

              <h2>Güncel Ticketlar</h2>

              <p>Sisteme en son eklenen destek talepleri</p>
            </div>

            <Link to="/tickets" className="dashboard-v2-link">
              Tümünü gör
              <Icon name="arrowRight" size={16} />
            </Link>
          </div>

          <div className="dashboard-v2-ticket-list">
            {recentTickets.length === 0 ? (
              <p className="dashboard-v2-empty">Henüz ticket bulunmuyor.</p>
            ) : (
              recentTickets.map((ticket) => (
                <Link
                  key={ticket.ticket_id}
                  to={`/tickets/${ticket.ticket_id}`}
                  className="dashboard-v2-ticket-row"
                >
                  <span className="dashboard-v2-ticket-number">
                    #{ticket.ticket_id}
                  </span>

                  <div className="dashboard-v2-ticket-main">
                    <strong>{ticket.title}</strong>

                    <span>
                      {ticket.requester_name || "Talep sahibi belirtilmemiş"}
                    </span>
                  </div>

                  <div className="dashboard-v2-ticket-category">
                    {ticket.category || "Kategori yok"}
                  </div>

                  <div className="dashboard-v2-ticket-department">
                    {ticket.department || "Departman yok"}
                  </div>

                  <span
                    className={
                      `dashboard-v2-priority ` + `priority-${ticket.priority}`
                    }
                  >
                    {translatePriority(ticket.priority)}
                  </span>

                  <span
                    className={
                      `dashboard-v2-status ` + `status-${ticket.status}`
                    }
                  >
                    {translateStatus(ticket.status)}
                  </span>

                  <time>{formatRelativeDate(ticket.created_at)}</time>

                  <Icon
                    name="chevronRight"
                    size={16}
                    className="dashboard-v2-ticket-arrow"
                  />
                </Link>
              ))
            )}
          </div>
        </article>

        <DashboardTicketDensityPanel dailyStats={dailyStats} />
      </section>

      <DashboardDistributionPanels
        departments={departments}
        categories={categories}
      />
    </main>
  );
}

function MetricCard({
  title,
  value,
  description,
  progress,
  progressLabel,
  icon,
  tone,
}) {
  const safeProgress = normalizePercentage(progress);

  return (
    <article className={`dashboard-v2-metric ` + `dashboard-v2-metric-${tone}`}>
      <div className="dashboard-v2-metric-top">
        <span className="dashboard-v2-metric-icon">
          <Icon name={icon} size={19} />
        </span>
      </div>

      <div className="dashboard-v2-metric-copy">
        <span>{title}</span>

        <strong>{value}</strong>

        <p>{description}</p>
      </div>

      <div className="dashboard-v2-metric-progress">
        <div>
          <span>{progressLabel}</span>

          <strong>%{safeProgress.toFixed(0)}</strong>
        </div>

        <div className="dashboard-v2-metric-track">
          <span
            style={{
              width: `${safeProgress}%`,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function buildLineChart(dailyStats) {
  const width = 760;
  const height = 250;
  const paddingX = 32;
  const paddingTop = 34;
  const paddingBottom = 42;

  const normalizedData = Array.isArray(dailyStats) ? dailyStats : [];

  const values = normalizedData.map((item) => Number(item.ticket_count) || 0);

  const maxValue = Math.max(1, ...values);

  const usableWidth = width - paddingX * 2;

  const usableHeight = height - paddingTop - paddingBottom;

  const stepX =
    normalizedData.length > 1 ? usableWidth / (normalizedData.length - 1) : 0;

  const points = normalizedData.map((item, index) => {
    const value = Number(item.ticket_count) || 0;

    const x = paddingX + index * stepX;

    const y = paddingTop + usableHeight - (value / maxValue) * usableHeight;

    return {
      key: item.date || index,
      x,
      y,
      value,
    };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  const bottomY = height - paddingBottom;

  let areaPath = "";

  if (points.length > 0) {
    areaPath = [
      `M ${points[0].x} ${bottomY}`,
      ...points.map((point) => `L ${point.x} ${point.y}`),
      `L ${points[points.length - 1].x} ${bottomY}`,
      "Z",
    ].join(" ");
  }

  const totalCount = values.reduce((total, value) => total + value, 0);

  const averageCount =
    values.length > 0 ? (totalCount / values.length).toFixed(1) : "0.0";

  const peakIndex =
    values.length > 0 ? values.indexOf(Math.max(...values)) : -1;

  const labels = normalizedData.map((item) => formatChartDate(item.date));

  const peakLabel = peakIndex >= 0 ? labels[peakIndex] : "—";

  return {
    width,
    height,
    points,
    polyline,
    areaPath,
    maxValue,
    totalCount,
    averageCount,
    peakLabel,
    labels,
  };
}

function buildDonutGradient(statuses, total) {
  if (!Array.isArray(statuses) || statuses.length === 0 || total <= 0) {
    return "conic-gradient(" + "#26334d 0% 100%" + ")";
  }

  let cursor = 0;

  const segments = statuses.map((item) => {
    const count = Number(item.ticket_count) || 0;

    const percentage = (count / total) * 100;

    const start = cursor;

    const end = cursor + percentage;

    cursor = end;

    const color = statusColors[item.status] || "#64748b";

    return `${color} ` + `${start}% ` + `${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function normalizePercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(Math.max(numericValue, 0), 100);
}

function translatePriority(priority) {
  const values = {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  };

  return values[priority] || priority || "Belirtilmemiş";
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

  return values[status] || status || "Belirtilmemiş";
}

function formatChartDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    weekday: "short",
  });
}

function formatRelativeDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();

  const difference = now.getTime() - date.getTime();

  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) {
    return "Şimdi";
  }

  if (minutes < 60) {
    return `${minutes} dk`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} sa`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} gün`;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

function getApiErrorMessage(requestError, fallbackMessage) {
  const detail = requestError?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallbackMessage;
}

export default Dashboard;
