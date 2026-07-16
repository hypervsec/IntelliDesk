import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api/api";

function TicketDetail() {
  const { ticketId } = useParams();

  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);

  const [recommendation, setRecommendation] = useState(null);

  const [feedback, setFeedback] = useState("accepted");

  const [feedbackNote, setFeedbackNote] = useState("");

  const [updateForm, setUpdateForm] = useState({
    status: "open",
    assigned_technician: "",
    category: "",
    subcategory: "",
    priority: "medium",
    resolution: "",
  });

  const [loading, setLoading] = useState(true);

  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [updateLoading, setUpdateLoading] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const loadTicket = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        setError("");

        const response = await api.get(`/tickets/${ticketId}`);

        const ticketData = response.data;

        setTicket(ticketData);

        setUpdateForm({
          status: ticketData.status || "open",

          assigned_technician: ticketData.assigned_technician || "",

          category: ticketData.category || "",

          subcategory: ticketData.subcategory || "",

          priority: ticketData.priority || "medium",

          resolution: ticketData.resolution || "",
        });

        if (ticketData.ai_recommendation) {
          setRecommendation((currentRecommendation) => ({
            ticket_id: ticketData.ticket_id,

            recommendation: ticketData.ai_recommendation,

            confidence_score: Number(ticketData.ai_confidence_score || 0),

            source_request_ids: currentRecommendation?.source_request_ids || [],
          }));
        } else {
          setRecommendation(null);
        }

        if (ticketData.ai_feedback) {
          setFeedback(ticketData.ai_feedback);
        }
      } catch (err) {
        console.error(err);

        setError(err.response?.data?.detail || "Ticket bilgileri alınamadı.");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [ticketId],
  );

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  function handleUpdateChange(event) {
    const { name, value } = event.target;

    setUpdateForm((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function updateTicket(event) {
    event.preventDefault();

    try {
      setUpdateLoading(true);
      setError("");
      setMessage("");

      const requestData = {
        status: updateForm.status,

        assigned_technician: updateForm.assigned_technician.trim() || null,

        category: updateForm.category.trim() || null,

        subcategory: updateForm.subcategory.trim() || null,

        priority: updateForm.priority,

        resolution: updateForm.resolution.trim() || null,
      };

      await api.put(`/tickets/${ticketId}`, requestData);

      setMessage("Ticket bilgileri güncellendi.");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.detail || "Ticket güncellenemedi.");
    } finally {
      setUpdateLoading(false);
    }
  }

  async function createRecommendation() {
    try {
      setRecommendationLoading(true);
      setError("");
      setMessage("");

      const response = await api.post(`/tickets/${ticketId}/recommendation`);

      setRecommendation(response.data);

      setMessage("AI çözüm önerisi oluşturuldu.");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.detail || "AI önerisi oluşturulamadı.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function submitFeedback(event) {
    event.preventDefault();

    if (!recommendation) {
      setError("Geri bildirim göndermeden önce AI önerisi oluştur.");
      return;
    }

    try {
      setFeedbackLoading(true);
      setError("");
      setMessage("");

      await api.post(`/tickets/${ticketId}/feedback`, {
        feedback,
        note: feedbackNote.trim() || null,
      });

      setMessage("Geri bildirim kaydedildi.");

      setFeedbackNote("");

      await loadTicket(false);
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.detail || "Geri bildirim kaydedilemedi.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p>Ticket yükleniyor...</p>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="page">
        <p className="error-message">{error || "Ticket bulunamadı."}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate(-1)}
          >
            ← Ticketlara dön
          </button>

          <h1>
            #{ticket.ticket_id} {ticket.title}
          </h1>

          <p>{ticket.requester_name || "Kullanıcı belirtilmemiş"}</p>
        </div>

        <div className="header-actions">
          <span className={`badge priority-${ticket.priority}`}>
            {translatePriority(ticket.priority)}
          </span>

          <span className={`badge status-${ticket.status}`}>
            {translateStatus(ticket.status)}
          </span>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      {message && <p className="success-message">{message}</p>}

      <section className="detail-grid">
        <div className="panel">
          <h2>Ticket Bilgileri</h2>

          <DetailRow label="Açıklama" value={ticket.description} />

          <DetailRow label="Departman" value={ticket.department} />

          <DetailRow label="Kategori" value={ticket.category} />

          <DetailRow label="Alt kategori" value={ticket.subcategory} />

          <DetailRow
            label="Atanan teknisyen"
            value={ticket.assigned_technician}
          />

          <DetailRow label="Mevcut çözüm" value={ticket.resolution} />

          <DetailRow
            label="Oluşturulma zamanı"
            value={formatDate(ticket.created_at)}
          />

          <DetailRow
            label="Güncellenme zamanı"
            value={formatDate(ticket.updated_at)}
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>AI Çözüm Önerisi</h2>

              <p>Geçmiş benzer ticketlar kullanılır.</p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={createRecommendation}
              disabled={recommendationLoading}
            >
              {recommendationLoading
                ? "Oluşturuluyor..."
                : recommendation
                  ? "Öneriyi Yenile"
                  : "Öneri Oluştur"}
            </button>
          </div>

          {recommendation ? (
            <div className="recommendation-box">
              <p className="recommendation-text">
                {recommendation.recommendation}
              </p>

              <div className="confidence-row">
                <span>AI güven puanı</span>

                <strong>
                  %{(recommendation.confidence_score * 100).toFixed(2)}
                </strong>
              </div>

              <div className="confidence-track">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${Math.min(
                      recommendation.confidence_score * 100,
                      100,
                    )}%`,
                  }}
                />
              </div>

              {recommendation.source_request_ids?.length > 0 && (
                <div className="source-list">
                  <span>Kaynak ticketlar:</span>

                  <div>
                    {recommendation.source_request_ids.map((requestId) => (
                      <span className="source-badge" key={requestId}>
                        #{requestId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="empty-message">
              Henüz AI çözüm önerisi oluşturulmadı.
            </p>
          )}
        </div>
      </section>

      <section className="panel management-panel">
        <h2>Ticket Yönetimi</h2>

        <form className="ticket-form" onSubmit={updateTicket}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="status">Durum</label>

              <select
                id="status"
                name="status"
                value={updateForm.status}
                onChange={handleUpdateChange}
              >
                <option value="open">Açık</option>

                <option value="assigned">Atandı</option>

                <option value="in_progress">İşlemde</option>

                <option value="waiting_user">Kullanıcı Bekleniyor</option>

                <option value="resolved">Çözüldü</option>

                <option value="closed">Kapalı</option>

                <option value="cancelled">İptal</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assigned_technician">Atanan teknisyen</label>

              <input
                id="assigned_technician"
                name="assigned_technician"
                type="text"
                value={updateForm.assigned_technician}
                onChange={handleUpdateChange}
                maxLength={150}
                placeholder="Teknisyen adı"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Kategori</label>

              <input
                id="category"
                name="category"
                type="text"
                value={updateForm.category}
                onChange={handleUpdateChange}
                maxLength={150}
              />
            </div>

            <div className="form-group">
              <label htmlFor="subcategory">Alt kategori</label>

              <input
                id="subcategory"
                name="subcategory"
                type="text"
                value={updateForm.subcategory}
                onChange={handleUpdateChange}
                maxLength={150}
              />
            </div>

            <div className="form-group">
              <label htmlFor="priority">Öncelik</label>

              <select
                id="priority"
                name="priority"
                value={updateForm.priority}
                onChange={handleUpdateChange}
              >
                <option value="low">Düşük</option>

                <option value="medium">Orta</option>

                <option value="high">Yüksek</option>

                <option value="critical">Kritik</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="resolution">Uygulanan çözüm</label>

            <textarea
              id="resolution"
              name="resolution"
              rows={5}
              value={updateForm.resolution}
              onChange={handleUpdateChange}
              placeholder="Teknisyen tarafından uygulanan çözümü yaz..."
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={updateLoading}
            >
              {updateLoading ? "Güncelleniyor..." : "Ticketı Güncelle"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel feedback-panel">
        <h2>Teknisyen Geri Bildirimi</h2>

        {ticket.ai_feedback && (
          <div
            className={`saved-feedback ${
              ticket.ai_feedback === "accepted"
                ? "feedback-accepted"
                : "feedback-rejected"
            }`}
          >
            <strong>
              Mevcut geri bildirim:{" "}
              {ticket.ai_feedback === "accepted"
                ? "Kabul edildi"
                : "Reddedildi"}
            </strong>

            {ticket.ai_feedback_note && <p>{ticket.ai_feedback_note}</p>}

            <span>{formatDate(ticket.ai_feedback_at)}</span>
          </div>
        )}

        <form className="feedback-form" onSubmit={submitFeedback}>
          <div className="form-group">
            <label htmlFor="feedback">Geri bildirim</label>

            <select
              id="feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            >
              <option value="accepted">Kabul et</option>

              <option value="rejected">Reddet</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="feedbackNote">Açıklama</label>

            <textarea
              id="feedbackNote"
              rows={4}
              value={feedbackNote}
              maxLength={1000}
              placeholder="Önerinin neden kabul veya reddedildiğini yaz..."
              onChange={(event) => setFeedbackNote(event.target.value)}
            />
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={feedbackLoading || !recommendation}
          >
            {feedbackLoading ? "Kaydediliyor..." : "Geri Bildirimi Kaydet"}
          </button>
        </form>
      </section>
    </main>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>

      <strong>{value || "Belirtilmemiş"}</strong>
    </div>
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

function formatDate(value) {
  if (!value) {
    return "Belirtilmemiş";
  }

  return new Date(value).toLocaleString("tr-TR");
}

export default TicketDetail;
