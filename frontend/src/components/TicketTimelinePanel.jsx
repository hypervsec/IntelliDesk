import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../api/api";

import "../styles/tickets/ticket-timeline.css";

const FIELD_LABELS = {
  status: "Durum",
  priority: "Öncelik",
  assigned_technician: "Atanan teknisyen",
  department: "Departman",
  category: "Kategori",
  subcategory: "Alt kategori",
  resolution: "Çözüm",
  attachment: "Dosya eki",
};

const STATUS_LABELS = {
  open: "Açık",
  assigned: "Atandı",
  in_progress: "İşlemde",
  waiting_user: "Kullanıcı Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapalı",
  cancelled: "İptal",
};

const PRIORITY_LABELS = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

function TicketTimelinePanel({ ticketId, onTimelineChanged }) {
  const [timelineEntries, setTimelineEntries] = useState([]);

  const [commentContent, setCommentContent] = useState("");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const loadTimeline = useCallback(
    async ({ showLoading = true } = {}) => {
      if (!ticketId) {
        setTimelineEntries([]);
        setLoading(false);
        return;
      }

      try {
        if (showLoading) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response = await api.get(`/tickets/${ticketId}/timeline`);

        const entries = Array.isArray(response.data) ? response.data : [];

        setTimelineEntries(entries);
      } catch (requestError) {
        console.error(requestError);

        setError(
          getApiErrorMessage(requestError, "Ticket işlem geçmişi alınamadı."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ticketId],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadTimeline();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [loadTimeline]);

  const sortedTimelineEntries = useMemo(
    () =>
      [...timelineEntries].sort(
        (firstEntry, secondEntry) =>
          getTimestamp(secondEntry.created_at) -
          getTimestamp(firstEntry.created_at),
      ),
    [timelineEntries],
  );

  async function submitComment(event) {
    event.preventDefault();

    const normalizedContent = commentContent.trim();

    if (!normalizedContent) {
      setError("Yorum içeriği boş olamaz.");

      return;
    }

    try {
      setCommentSubmitting(true);
      setError("");
      setMessage("");

      const response = await api.post(`/tickets/${ticketId}/comments`, {
        content: normalizedContent,
      });

      setTimelineEntries((currentEntries) => [
        ...currentEntries,
        response.data,
      ]);

      setCommentContent("");

      setMessage("Yorum zaman çizelgesine eklendi.");

      if (typeof onTimelineChanged === "function") {
        await onTimelineChanged();
      }
    } catch (requestError) {
      console.error(requestError);

      setError(getApiErrorMessage(requestError, "Yorum kaydedilemedi."));
    } finally {
      setCommentSubmitting(false);
    }
  }

  return (
    <section className="panel ticket-timeline-panel">
      <div className="panel-header ticket-timeline-header">
        <div>
          <span className="section-kicker">İLETİŞİM VE İŞLEM GEÇMİŞİ</span>

          <h2>Ticket Zaman Çizelgesi</h2>

          <p>
            Yorumlar, dosya işlemleri, durum değişiklikleri, atamalar ve diğer
            ticket işlemleri burada gösterilir.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button ticket-timeline-refresh"
          disabled={loading || refreshing}
          onClick={() => {
            void loadTimeline({
              showLoading: false,
            });
          }}
        >
          {refreshing ? "Yenileniyor..." : "Geçmişi Yenile"}
        </button>
      </div>

      <form className="ticket-comment-form" onSubmit={submitComment}>
        <div className="form-group">
          <label htmlFor="ticketComment">Yeni yorum</label>

          <textarea
            id="ticketComment"
            rows={4}
            maxLength={5000}
            value={commentContent}
            disabled={commentSubmitting}
            placeholder="Ticket ile ilgili açıklama, yapılan işlem veya kullanıcıya verilecek cevabı yaz..."
            onChange={(event) => {
              setCommentContent(event.target.value);
            }}
          />

          <div className="ticket-comment-meta">
            <span>Ticketı görüntüleyebilen kullanıcılar yorumu görebilir.</span>

            <span>
              {commentContent.length}
              /5000
            </span>
          </div>
        </div>

        <div className="ticket-comment-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={commentSubmitting || !commentContent.trim()}
          >
            {commentSubmitting ? "Gönderiliyor..." : "Yorum Ekle"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="error-message ticket-timeline-message">{error}</p>
      ) : null}

      {message ? (
        <p className="success-message ticket-timeline-message">{message}</p>
      ) : null}

      {loading ? (
        <div className="ticket-timeline-loading">
          <div className="loading-spinner" aria-hidden="true" />

          <span>İşlem geçmişi yükleniyor...</span>
        </div>
      ) : null}

      {!loading && sortedTimelineEntries.length === 0 ? (
        <div className="ticket-timeline-empty">
          <strong>Henüz işlem kaydı bulunmuyor.</strong>

          <span>
            İlk yorum, dosya işlemi veya ticket değişikliği burada görünecek.
          </span>
        </div>
      ) : null}

      {!loading && sortedTimelineEntries.length > 0 ? (
        <div className="ticket-timeline-list">
          {sortedTimelineEntries.map((entry) => (
            <TimelineEntry key={entry.entry_id} entry={entry} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TimelineEntry({ entry }) {
  const entryType = getEntryType(entry);

  const title = getEntryTitle(entry);

  const actorRole = getActorRoleLabel(entry.actor_role);

  const oldValue = formatTimelineValue(entry.field_name, entry.old_value);

  const newValue = formatTimelineValue(entry.field_name, entry.new_value);

  const renderedContent = getEntryContent(entry);

  const showsValueChange =
    entry.entry_type === "field_changed" &&
    (entry.old_value !== null || entry.new_value !== null);

  return (
    <article
      className={
        `ticket-timeline-entry ` + `ticket-timeline-entry-${entryType}`
      }
    >
      <div className="ticket-timeline-marker" aria-hidden="true">
        {getEntryMarker(entry.entry_type)}
      </div>

      <div className="ticket-timeline-card">
        <div className="ticket-timeline-card-header">
          <div>
            <strong>{title}</strong>

            <span className="ticket-timeline-actor">
              {entry.actor_name || "Sistem"}

              {actorRole ? (
                <>
                  {" · "}
                  {actorRole}
                </>
              ) : null}
            </span>
          </div>

          <time dateTime={entry.created_at || undefined}>
            {formatDate(entry.created_at)}
          </time>
        </div>

        {renderedContent ? (
          <p className="ticket-timeline-content">{renderedContent}</p>
        ) : null}

        {showsValueChange ? (
          <div className="ticket-timeline-change">
            <span className="ticket-timeline-value ticket-timeline-old-value">
              {oldValue}
            </span>

            <span className="ticket-timeline-arrow" aria-hidden="true">
              →
            </span>

            <span className="ticket-timeline-value ticket-timeline-new-value">
              {newValue}
            </span>
          </div>
        ) : null}

        {entry.field_name ? (
          <span className="ticket-timeline-field">
            {FIELD_LABELS[entry.field_name] || entry.field_name}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function getEntryContent(entry) {
  if (entry.entry_type !== "field_changed") {
    return entry.content || "";
  }

  const fieldLabel = FIELD_LABELS[entry.field_name] || "Ticket bilgisi";

  const oldValue = formatTimelineValue(entry.field_name, entry.old_value);

  const newValue = formatTimelineValue(entry.field_name, entry.new_value);

  if (entry.field_name === "resolution") {
    if (entry.old_value === null && entry.new_value !== null) {
      return "Çözüm bilgisi eklendi.";
    }

    if (entry.old_value !== null && entry.new_value === null) {
      return "Çözüm bilgisi kaldırıldı.";
    }

    return "Çözüm bilgisi güncellendi.";
  }

  return `${fieldLabel} değiştirildi: ` + `${oldValue} → ${newValue}.`;
}

function getEntryType(entry) {
  if (entry.entry_type === "comment") {
    return "comment";
  }

  if (
    entry.entry_type === "attachment_added" ||
    entry.entry_type === "attachment_removed"
  ) {
    return "attachment";
  }

  if (entry.entry_type === "field_changed") {
    return "change";
  }

  if (entry.entry_type === "ticket_created") {
    return "created";
  }

  return "system";
}

function getEntryTitle(entry) {
  if (entry.entry_type === "comment") {
    return "Yorum eklendi";
  }

  if (entry.entry_type === "attachment_added") {
    return "Dosya eklendi";
  }

  if (entry.entry_type === "attachment_removed") {
    return "Dosya kaldırıldı";
  }

  if (entry.entry_type === "ticket_created") {
    return "Ticket oluşturuldu";
  }

  if (entry.entry_type === "field_changed") {
    const fieldLabel = FIELD_LABELS[entry.field_name] || "Ticket bilgisi";

    return `${fieldLabel} değiştirildi`;
  }

  return "Ticket işlemi";
}

function getEntryMarker(entryType) {
  if (entryType === "comment") {
    return "Y";
  }

  if (entryType === "attachment_added" || entryType === "attachment_removed") {
    return "E";
  }

  if (entryType === "field_changed") {
    return "D";
  }

  if (entryType === "ticket_created") {
    return "O";
  }

  return "İ";
}

function getActorRoleLabel(role) {
  const roleLabels = {
    admin: "Yönetici",
    technician: "Teknisyen",
    user: "Kullanıcı",
  };

  return roleLabels[role] || "";
}

function formatTimelineValue(fieldName, value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Belirtilmemiş";
  }

  const normalizedValue = String(value).trim();

  if (fieldName === "status") {
    return STATUS_LABELS[normalizedValue] || normalizedValue;
  }

  if (fieldName === "priority") {
    return PRIORITY_LABELS[normalizedValue] || normalizedValue;
  }

  return shortenValue(normalizedValue, 120);
}

function shortenValue(value, maximumLength) {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength)}…`;
}

function getTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function formatDate(value) {
  if (!value) {
    return "Tarih belirtilmemiş";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tarih belirtilmemiş";
  }

  return date.toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getApiErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item?.msg === "string") {
          return item.msg;
        }

        if (typeof item === "string") {
          return item;
        }

        return null;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return fallbackMessage;
}

export default TicketTimelinePanel;
