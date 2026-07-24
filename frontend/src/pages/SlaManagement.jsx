import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../api/api";

import Icon from "../components/Icon";

import "../styles/sla-management.css";

const EMPTY_SUMMARY = {
  total_sessions: 0,

  completed_sessions: 0,
  failed_sessions: 0,

  resolved_count: 0,
  unresolved_count: 0,
  awaiting_feedback_count: 0,

  success_rate: null,

  average_confidence_score: null,
  average_solution_time_seconds: null,

  source_supported_sessions: 0,
  source_supported_feedback_count: 0,

  source_supported_resolved_count: 0,
  source_supported_unresolved_count: 0,

  source_supported_success_rate: null,

  high_confidence_unresolved_count: 0,

  confidence_bands: [],
};

const CONFIDENCE_BAND_META = {
  high: {
    title: "Yüksek Güven",
    description: "%80 ve üzeri benzerlik",
    icon: "check",
  },

  medium: {
    title: "Orta Güven",
    description: "%60 - %79 benzerlik",
    icon: "confidence",
  },

  low: {
    title: "Düşük Güven",
    description: "%60 altı benzerlik",
    icon: "open",
  },
};

function SlaManagement() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const loadSummary = useCallback(async (showMainLoading = true) => {
    try {
      if (showMainLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get("/ai/analytics/summary");

      setSummary({
        ...EMPTY_SUMMARY,
        ...(response.data || {}),
      });
    } catch (err) {
      console.error(err);

      setError(getApiErrorMessage(err, "AI performans verileri alınamadı."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const calculatedMetrics = useMemo(() => {
    const completedSessions = safeNumber(summary.completed_sessions);

    const failedSessions = safeNumber(summary.failed_sessions);

    const resolvedCount = safeNumber(summary.resolved_count);

    const unresolvedCount = safeNumber(summary.unresolved_count);

    const feedbackCount = resolvedCount + unresolvedCount;

    const processedCount = completedSessions + failedSessions;

    return {
      feedbackCount,

      operationSuccessRate: calculateRate(completedSessions, processedCount),

      feedbackCoverageRate: calculateRate(feedbackCount, completedSessions),

      sourceCoverageRate: calculateRate(
        summary.source_supported_sessions,
        completedSessions,
      ),
    };
  }, [summary]);

  const confidenceBands = useMemo(() => {
    const bands = Array.isArray(summary.confidence_bands)
      ? summary.confidence_bands
      : [];

    return ["high", "medium", "low"].map((bandName) => {
      const bandData = bands.find((item) => item.band === bandName);

      return {
        band: bandName,

        ...CONFIDENCE_BAND_META[bandName],

        feedback_count: safeNumber(bandData?.feedback_count),

        resolved_count: safeNumber(bandData?.resolved_count),

        unresolved_count: safeNumber(bandData?.unresolved_count),

        success_rate: bandData?.success_rate ?? null,
      };
    });
  }, [summary.confidence_bands]);

  if (loading) {
    return (
      <main className="page sla-page">
        <section className="panel ai-sla-loading">
          <span className="loading-spinner" />

          <strong>AI performans verileri hazırlanıyor</strong>

          <p>Çözüm sonuçları ve benzer ticket istatistikleri hesaplanıyor.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page sla-page">
      <header className="page-header ai-sla-header">
        <div>
          <span className="page-eyebrow">AI OPERASYON YÖNETİMİ</span>

          <h1>AI SLA ve Çözüm Performansı</h1>

          <p>
            Yapay zekânın çözüm üretme süresini, kullanıcı doğrulamalı
            başarısını ve benzer ticket kullanım performansını takip edin.
          </p>
        </div>

        <button
          type="button"
          className="ai-sla-refresh"
          disabled={refreshing}
          onClick={() => {
            loadSummary(false);
          }}
        >
          <Icon name="activity" size={17} />

          <span>{refreshing ? "Yenileniyor..." : "Verileri Yenile"}</span>
        </button>
      </header>

      {error ? (
        <div className="error-message" role="alert">
          {error}
        </div>
      ) : null}

      <section className="ai-summary-section" aria-label="AI operasyon özeti">
        <div className="ai-group-heading">
          <div>
            <span className="section-kicker">TEMEL GÖSTERGELER</span>

            <h2>AI operasyon özeti</h2>
          </div>

          <span className="ai-group-count">
            {safeNumber(summary.total_sessions)} oturum
          </span>
        </div>

        <div className="ai-sla-summary-grid">
          <MetricCard
            label="AI Çözüm Başarısı"
            value={formatPercent(summary.success_rate)}
            description={
              calculatedMetrics.feedbackCount > 0
                ? `${calculatedMetrics.feedbackCount} kullanıcı geri bildirimi üzerinden`
                : "Henüz kullanıcı geri bildirimi bulunmuyor"
            }
            tone="success"
            icon="confidence"
          />

          <MetricCard
            label="AI ile Çözülen"
            value={safeNumber(summary.resolved_count)}
            description="Kullanıcının çözüldü olarak doğruladığı sorunlar"
            tone="success"
            icon="check"
          />

          <MetricCard
            label="Çözülemeyen"
            value={safeNumber(summary.unresolved_count)}
            description="AI çözümünün yeterli olmadığı sorunlar"
            tone="danger"
            icon="close"
          />

          <MetricCard
            label="Geri Bildirim Bekleyen"
            value={safeNumber(summary.awaiting_feedback_count)}
            description="Çözüm üretildi, kullanıcı sonucu bekleniyor"
            tone="warning"
            icon="open"
          />

          <MetricCard
            label="AI İşlem Hatası"
            value={safeNumber(summary.failed_sessions)}
            description="Çözüm üretimi tamamlanamayan oturumlar"
            tone="danger"
            icon="logs"
          />

          <MetricCard
            label="Ortalama Çözüm Süresi"
            value={formatDuration(summary.average_solution_time_seconds)}
            description="Oturum başlangıcından AI çözümüne kadar"
            tone="info"
            icon="activity"
          />
        </div>
      </section>

      <section className="ai-sla-main-grid">
        <article className="panel ai-performance-panel">
          <SectionHeading
            eyebrow="GÜNCEL PERFORMANS"
            title="Güncel AI performans özeti"
            description="Oturumların çözüm üretme ve kullanıcı doğrulama aşamalarındaki dağılımı."
            icon="activity"
          />

          <div className="ai-operation-overview">
            <OperationStat
              label="Toplam AI Oturumu"
              value={summary.total_sessions}
              detail="Başlatılan tüm işlemler"
            />

            <OperationStat
              label="Tamamlanan İşlem"
              value={summary.completed_sessions}
              detail={`${formatPercent(
                calculatedMetrics.operationSuccessRate,
              )} işlem tamamlama oranı`}
            />

            <OperationStat
              label="Kullanıcı Sonucu Alınan"
              value={calculatedMetrics.feedbackCount}
              detail={`${formatPercent(
                calculatedMetrics.feedbackCoverageRate,
              )} geri bildirim kapsamı`}
            />

            <OperationStat
              label="Ortalama Güven"
              value={formatConfidence(summary.average_confidence_score)}
              detail="En benzer geçmiş ticket puanı"
            />
          </div>

          <div className="ai-process-flow">
            <ProcessStep
              index="01"
              label="AI Oturumu"
              value={summary.total_sessions}
            />

            <Icon name="chevronRight" size={16} className="ai-process-arrow" />

            <ProcessStep
              index="02"
              label="Çözüm Üretildi"
              value={summary.completed_sessions}
            />

            <Icon name="chevronRight" size={16} className="ai-process-arrow" />

            <ProcessStep
              index="03"
              label="Sonuç Bildirildi"
              value={calculatedMetrics.feedbackCount}
            />

            <Icon name="chevronRight" size={16} className="ai-process-arrow" />

            <ProcessStep
              index="04"
              label="Sorun Çözüldü"
              value={summary.resolved_count}
              highlight
            />
          </div>
        </article>

        <article className="panel ai-quality-panel">
          <SectionHeading
            eyebrow="KALİTE KONTROLÜ"
            title="Aksiyon gerektiren durumlar"
            description="AI doğruluğunu ve veri kalitesini etkileyen güncel göstergeler."
            icon="logs"
          />

          <div className="ai-quality-list">
            <QualityItem
              title="Yüksek güvenle çözülemeyen"
              value={summary.high_confidence_unresolved_count}
              description="AI güveni %80 üzerindeyken kullanıcı çözülmedi dedi."
              tone={
                safeNumber(summary.high_confidence_unresolved_count) > 0
                  ? "danger"
                  : "success"
              }
              icon="close"
            />

            <QualityItem
              title="AI servis hataları"
              value={summary.failed_sessions}
              description="Model, bağlantı veya kayıt işlemi tamamlanamadı."
              tone={
                safeNumber(summary.failed_sessions) > 0 ? "warning" : "success"
              }
              icon="logs"
            />

            <QualityItem
              title="Geri bildirim bekleyen"
              value={summary.awaiting_feedback_count}
              description="Başarı hesabına henüz dahil edilmeyen çözümler."
              tone="info"
              icon="open"
            />

            <QualityItem
              title="Kaynak kayıt kapsamı"
              value={formatPercent(calculatedMetrics.sourceCoverageRate)}
              description={`${safeNumber(
                summary.source_supported_sessions,
              )} AI oturumunda kaynak ticketlar kalıcı olarak saklandı.`}
              tone="info"
              icon="archive"
            />
          </div>
        </article>
      </section>

      <section className="panel ai-rag-panel">
        <SectionHeading
          eyebrow="BENZER TICKET PERFORMANSI"
          title="Benzer ticket destekli çözüm başarısı"
          description="Geçmiş ticketlardan yararlanan çözümlerin kullanıcı doğrulamalı sonuçları."
          badge={`${safeNumber(
            summary.source_supported_sessions,
          )} kaynak destekli oturum`}
          icon="sparkles"
          infoText="RAG, geçmiş ticketları bularak AI çözümünü bu kayıtlarla destekleyen yapıdır."
        />

        <div className="ai-rag-grid">
          <RagMetric
            label="Kaynak Destekli Oturum"
            value={summary.source_supported_sessions}
            icon="archive"
          />

          <RagMetric
            label="Sonucu Bildirilen"
            value={summary.source_supported_feedback_count}
            icon="open"
          />

          <RagMetric
            label="Çözülen"
            value={summary.source_supported_resolved_count}
            tone="success"
            icon="check"
          />

          <RagMetric
            label="Çözülemeyen"
            value={summary.source_supported_unresolved_count}
            tone="danger"
            icon="close"
          />

          <RagMetric
            label="RAG Başarı Oranı"
            value={formatPercent(summary.source_supported_success_rate)}
            tone="primary"
            icon="confidence"
          />
        </div>

        {summary.source_supported_success_rate === null ? (
          <div className="ai-rag-notice">
            <Icon name="open" size={18} />

            <div>
              <strong>RAG başarı oranı henüz oluşmadı.</strong>

              <p>
                Kaynak ticketları saklanan yeni AI çözümlerinden kullanıcı geri
                bildirimi geldiğinde oran otomatik hesaplanacak.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel ai-confidence-panel">
        <SectionHeading
          eyebrow="GÜVEN ANALİZİ"
          title="Güven seviyesine göre çözüm başarısı"
          description="AI güven puanı arttıkça gerçek çözüm başarısının nasıl değiştiğini gösterir."
          icon="confidence"
        />

        <div className="ai-confidence-grid">
          {confidenceBands.map((band) => (
            <ConfidenceCard key={band.band} band={band} />
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, description, tone, icon }) {
  return (
    <article className={`ai-metric-card ai-metric-${tone}`}>
      <div className="ai-metric-card-top">
        <span className="ai-metric-icon">
          <Icon name={icon} size={18} />
        </span>

        <span className="ai-metric-label">{label}</span>
      </div>

      <strong>{value}</strong>

      <p>{description}</p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  badge,
  icon,
  infoText,
}) {
  return (
    <div className="ai-section-heading">
      <div className="ai-section-heading-main">
        <span className="ai-section-heading-icon">
          <Icon name={icon} size={18} />
        </span>

        <div>
          <span className="section-kicker">{eyebrow}</span>

          <div className="ai-section-title-row">
            <h2>{title}</h2>

            {infoText ? (
              <span
                className="ai-info-badge"
                title={infoText}
                aria-label={infoText}
              >
                ?
              </span>
            ) : null}
          </div>

          <p>{description}</p>
        </div>
      </div>

      {badge ? <span className="ai-section-badge">{badge}</span> : null}
    </div>
  );
}

function OperationStat({ label, value, detail }) {
  return (
    <div className="ai-operation-stat">
      <span>{label}</span>

      <strong>{value}</strong>

      <small>{detail}</small>
    </div>
  );
}

function ProcessStep({ index, label, value, highlight = false }) {
  return (
    <div
      className={
        highlight
          ? "ai-process-step ai-process-step-highlight"
          : "ai-process-step"
      }
    >
      <span>{index}</span>

      <strong>{value}</strong>

      <small>{label}</small>
    </div>
  );
}

function QualityItem({ title, value, description, tone, icon }) {
  return (
    <div className={`ai-quality-item ai-quality-${tone}`}>
      <span className="ai-quality-icon">
        <Icon name={icon} size={17} />
      </span>

      <div className="ai-quality-content">
        <strong>{title}</strong>

        <p>{description}</p>
      </div>

      <span className="ai-quality-value">{value}</span>
    </div>
  );
}

function RagMetric({ label, value, tone = "default", icon }) {
  return (
    <div className={`ai-rag-metric ai-rag-${tone}`}>
      <div className="ai-rag-metric-label">
        <Icon name={icon} size={15} />

        <span>{label}</span>
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function ConfidenceCard({ band }) {
  const rate = safeNumber(band.success_rate);

  const progressWidth = Math.max(0, Math.min(rate, 100));

  return (
    <article className={`ai-confidence-card ai-confidence-${band.band}`}>
      <div className="ai-confidence-card-header">
        <div className="ai-confidence-title">
          <span className="ai-confidence-icon">
            <Icon name={band.icon} size={17} />
          </span>

          <div>
            <span>{band.title}</span>

            <small>{band.description}</small>
          </div>
        </div>

        <strong>{formatPercent(band.success_rate)}</strong>
      </div>

      <div className="ai-confidence-progress">
        <span
          style={{
            width: `${progressWidth}%`,
          }}
        />
      </div>

      <dl>
        <div>
          <dt>Geri bildirim</dt>
          <dd>{band.feedback_count}</dd>
        </div>

        <div>
          <dt>Çözülen</dt>
          <dd>{band.resolved_count}</dd>
        </div>

        <div>
          <dt>Çözülemeyen</dt>
          <dd>{band.unresolved_count}</dd>
        </div>
      </dl>
    </article>
  );
}

function safeNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function calculateRate(part, total) {
  const safePart = safeNumber(part);
  const safeTotal = safeNumber(total);

  if (safeTotal <= 0) {
    return null;
  }

  return Number(((safePart / safeTotal) * 100).toFixed(2));
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return `%${numericValue.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatConfidence(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return formatPercent(numericValue * 100);
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "—";
  }

  const totalSeconds = Math.max(0, Math.round(Number(seconds)));

  if (!Number.isFinite(totalSeconds)) {
    return "—";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds} sn`;
  }

  const minutes = Math.floor(totalSeconds / 60);

  const remainingSeconds = totalSeconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes} dk ${remainingSeconds} sn`
      : `${minutes} dk`;
  }

  const hours = Math.floor(minutes / 60);

  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} sa ${remainingMinutes} dk`
    : `${hours} sa`;
}

function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(", ");
  }

  return fallbackMessage;
}

export default SlaManagement;
