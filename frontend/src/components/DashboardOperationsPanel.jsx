import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

import "../styles/dashboard-operations.css";

const SLA_CHART_ITEMS = [
  {
    key: "breached",
    label: "İhlal",
    tone: "danger",
  },
  {
    key: "approaching",
    label: "Yaklaşan",
    tone: "warning",
  },
  {
    key: "onTrack",
    label: "Normal",
    tone: "success",
  },
  {
    key: "met",
    label: "Karşılandı",
    tone: "violet",
  },
];

export function DashboardTicketDensityPanel() {
  const { account } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewSlaPage =
    account?.role === "admin" || account?.role === "technician";

  useEffect(() => {
    async function loadSlaTickets() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/tickets");

        setTickets(Array.isArray(response.data) ? response.data : []);
      } catch (requestError) {
        console.error(requestError);

        setTickets([]);

        setError(getApiErrorMessage(requestError, "SLA verileri alınamadı."));
      } finally {
        setLoading(false);
      }
    }

    loadSlaTickets();
  }, []);

  const slaPerformance = useMemo(() => buildSlaPerformance(tickets), [tickets]);

  return (
    <article className="dashboard-v2-panel dashboard-ops-sla-panel">
      <div className="dashboard-v2-panel-header">
        <div>
          <span className="dashboard-v2-section-label">SLA PERFORMANSI</span>

          <h2>SLA Performans Görünümü</h2>

          <p>Aktif ticketların SLA durumlarına göre dağılımı ve başarı oranı</p>
        </div>

        {canViewSlaPage ? (
          <Link to="/sla" className="dashboard-ops-sla-link">
            Tümünü gör
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="dashboard-ops-sla-loading">
          <span />

          <p>SLA performansı yükleniyor...</p>
        </div>
      ) : null}

      {!loading && error ? (
        <p className="dashboard-ops-sla-error">{error}</p>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="dashboard-ops-sla-chart">
            <div className="dashboard-ops-sla-axis">
              <span>{slaPerformance.maxValue}</span>

              <span>{Math.round(slaPerformance.maxValue / 2)}</span>

              <span>0</span>
            </div>

            <div className="dashboard-ops-sla-chart-body">
              <div className="dashboard-ops-sla-grid-lines">
                <span />
                <span />
                <span />
              </div>

              <div className="dashboard-ops-sla-columns">
                {slaPerformance.items.map((item) => (
                  <div className="dashboard-ops-sla-column" key={item.key}>
                    <div className="dashboard-ops-sla-bar-area">
                      <div
                        className={
                          `dashboard-ops-sla-bar ` +
                          `dashboard-ops-sla-bar-${item.tone}`
                        }
                        style={{
                          height: `${item.height}%`,
                        }}
                        title={`${item.label}: ` + `${item.value} ticket`}
                      >
                        <span>{item.value}</span>
                      </div>
                    </div>

                    <strong>{item.label}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dashboard-ops-sla-footer">
            <div className="dashboard-ops-sla-legend">
              {slaPerformance.items.map((item) => (
                <span key={item.key}>
                  <i
                    className={
                      `dashboard-ops-sla-dot ` +
                      `dashboard-ops-sla-dot-${item.tone}`
                    }
                  />

                  {item.label}
                </span>
              ))}
            </div>

            <div className="dashboard-ops-sla-score">
              <span>SLA başarı oranı</span>

              <strong>%{slaPerformance.successRate}</strong>

              <small>{slaPerformance.total} ticket takipte</small>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function DashboardDistributionPanels({ departments, categories }) {
  return (
    <section className="dashboard-ops-distributions-grid">
      <DistributionPanel
        label="DEPARTMANLAR"
        title="Departman Yoğunluğu"
        description="Ticketların departmanlara göre dağılımı"
        items={departments}
        labelKey="department"
        tone="blue"
      />

      <DistributionPanel
        label="KATEGORİLER"
        title="Kategori Dağılımı"
        description="Ticketların kategorilere göre dağılımı"
        items={categories}
        labelKey="category"
        tone="violet"
      />
    </section>
  );
}

function DistributionPanel({
  label,
  title,
  description,
  items,
  labelKey,
  tone,
}) {
  const visibleItems = Array.isArray(items) ? items.slice(0, 6) : [];

  const maxCount = Math.max(
    1,
    ...visibleItems.map((item) => Number(item.ticket_count) || 0),
  );

  return (
    <article className="dashboard-v2-panel dashboard-ops-distribution-panel">
      <div className="dashboard-v2-panel-header dashboard-v2-panel-header-compact">
        <div>
          <span className="dashboard-v2-section-label">{label}</span>

          <h2>{title}</h2>

          <p>{description}</p>
        </div>

        <span className="dashboard-v2-count-label">
          {visibleItems.length} grup
        </span>
      </div>

      {visibleItems.length === 0 ? (
        <p className="dashboard-v2-empty">Gösterilecek veri bulunamadı.</p>
      ) : (
        <div className="dashboard-ops-aligned-list">
          {visibleItems.map((item, index) => {
            const count = Number(item.ticket_count) || 0;

            const percentage = Math.min(
              Math.max((count / maxCount) * 100, 0),
              100,
            );

            const itemLabel = item[labelKey] || "Belirtilmemiş";

            return (
              <div
                className="dashboard-ops-aligned-row"
                key={`${itemLabel}-${index}`}
              >
                <span className="dashboard-ops-aligned-label" title={itemLabel}>
                  {itemLabel}
                </span>

                <div className="dashboard-ops-aligned-track">
                  <span
                    className={
                      `dashboard-ops-aligned-fill ` +
                      `dashboard-ops-aligned-fill-${tone}`
                    }
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>

                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function buildSlaPerformance(tickets) {
  const summary = (Array.isArray(tickets) ? tickets : [])
    .filter((ticket) => ticket.status !== "cancelled")
    .reduce(
      (result, ticket) => {
        const status = getCombinedSlaStatus(ticket);

        if (status === "not_set") {
          return result;
        }

        result.total += 1;

        if (status === "breached") {
          result.breached += 1;
        }

        if (status === "approaching") {
          result.approaching += 1;
        }

        if (status === "on_track") {
          result.onTrack += 1;
        }

        if (status === "met") {
          result.met += 1;
        }

        return result;
      },
      {
        total: 0,
        breached: 0,
        approaching: 0,
        onTrack: 0,
        met: 0,
      },
    );

  const values = SLA_CHART_ITEMS.map((item) => summary[item.key]);

  const maxValue = Math.max(1, ...values);

  const successfulCount = summary.onTrack + summary.met;

  const successRate =
    summary.total > 0 ? Math.round((successfulCount / summary.total) * 100) : 0;

  const items = SLA_CHART_ITEMS.map((item) => {
    const value = summary[item.key];

    return {
      ...item,
      value,
      height: value > 0 ? Math.max((value / maxValue) * 100, 5) : 0,
    };
  });

  return {
    items,
    total: summary.total,
    successRate,
    maxValue,
  };
}

function getCombinedSlaStatus(ticket) {
  const statuses = [
    ticket.first_response_sla_status,
    ticket.resolution_sla_status,
  ].filter((status) => status && status !== "not_set");

  if (statuses.length === 0) {
    return "not_set";
  }

  if (statuses.includes("breached")) {
    return "breached";
  }

  if (statuses.includes("approaching")) {
    return "approaching";
  }

  if (statuses.every((status) => status === "met")) {
    return "met";
  }

  return "on_track";
}

function getApiErrorMessage(requestError, fallbackMessage) {
  const detail = requestError?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return fallbackMessage;
}
