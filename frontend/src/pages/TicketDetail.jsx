import { useState } from "react";

import api from "../api/api";

import {
  formatDate,
  formatSourceTicketId,
  getApiErrorMessage,
  getAssistantMessage,
  getConfidenceMeta,
  getSourceTicketIds,
  parseAiSolution,
  translateAiStatus,
  translatePriority,
  translateStatus,
} from "../utils/ticketDetailUtils";

function UserTicketDetail({
  ticket,
  aiSession,
  aiSessionLoading,
  aiSessionError,
}) {
  const assistantMessage = getAssistantMessage(aiSession);

  const parsedSolution = parseAiSolution(assistantMessage?.content);

  const confidence = getConfidenceMeta(aiSession?.confidence_score);

  const sourceTicketIds = getSourceTicketIds(
    aiSession,
    parsedSolution.sourceTicketIds,
  );

  return (
    <section className="user-ticket-detail-layout">
      <UserIssueSummary ticket={ticket} />

      <div className="user-ticket-ai-column">
        {aiSessionLoading ? <AiSessionLoading /> : null}

        {!aiSessionLoading && aiSessionError ? (
          <AiSessionError message={aiSessionError} />
        ) : null}

        {!aiSessionLoading &&
        !aiSessionError &&
        aiSession &&
        !assistantMessage ? (
          <AiSessionPending aiSession={aiSession} />
        ) : null}

        {!aiSessionLoading && !aiSessionError && assistantMessage ? (
          <AISolutionResult
            solution={parsedSolution}
            confidence={confidence}
            sourceTicketIds={sourceTicketIds}
          />
        ) : null}
      </div>
    </section>
  );
}

function UserIssueSummary({ ticket }) {
  return (
    <section className="panel user-issue-panel">
      <header className="user-issue-header">
        <div className="user-issue-title-area">
          <span className="user-issue-header-icon" aria-hidden="true">
            !
          </span>

          <div className="user-issue-title-copy">
            <span className="user-issue-eyebrow">TALEBİNİZ</span>

            <h2 className="user-issue-title">Bildirdiğiniz Sorun</h2>
          </div>
        </div>
      </header>

      <div className="user-issue-content">
        <section className="user-issue-description-card">
          <span className="user-issue-description-accent" aria-hidden="true" />

          <div className="user-issue-description-body">
            <div className="user-issue-description-heading">
              <span className="user-issue-description-badge">AÇIKLAMA</span>

              <h3>{ticket.title}</h3>
            </div>

            <p>{ticket.description || "Açıklama belirtilmemiş."}</p>
          </div>
        </section>

        <div className="user-issue-info-grid">
          <section className="user-issue-info-card user-issue-info-card-category">
            <span
              className="user-issue-info-icon user-issue-info-icon-category"
              aria-hidden="true"
            >
              i
            </span>

            <div>
              <span className="user-issue-info-label">SINIFLANDIRMA</span>

              <h3>{ticket.category || "Kategori belirtilmemiş"}</h3>

              <p>
                {[ticket.department, ticket.subcategory]
                  .filter(Boolean)
                  .join(" · ") || "Departman veya alt kategori belirtilmemiş."}
              </p>
            </div>
          </section>

          <section className="user-issue-info-card user-issue-info-card-record">
            <span
              className="user-issue-info-icon user-issue-info-icon-record"
              aria-hidden="true"
            >
              →
            </span>

            <div>
              <span className="user-issue-info-label">KAYIT BİLGİSİ</span>

              <h3>{translateStatus(ticket.status)}</h3>

              <p>
                {translatePriority(ticket.priority)} öncelik
                {" · "}
                {formatDate(ticket.created_at)}
              </p>
            </div>
          </section>
        </div>

        <UserSupportTools ticketId={ticket.ticket_id} />
      </div>
    </section>
  );
}

function UserSupportTools({ ticketId }) {
  const [commentContent, setCommentContent] = useState("");

  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [commentError, setCommentError] = useState("");

  const [commentMessage, setCommentMessage] = useState("");

  async function submitComment(event) {
    event.preventDefault();

    const normalizedContent = commentContent.trim();

    if (!normalizedContent) {
      setCommentError("Teknisyene göndermek istediğiniz mesajı yazın.");

      return;
    }

    try {
      setCommentSubmitting(true);
      setCommentError("");
      setCommentMessage("");

      await api.post(`/tickets/${ticketId}/comments`, {
        content: normalizedContent,
      });

      setCommentContent("");

      setCommentMessage("Mesajınız teknisyene iletildi.");
    } catch (requestError) {
      console.error(requestError);

      setCommentError(
        getApiErrorMessage(requestError, "Mesaj teknisyene iletilemedi."),
      );
    } finally {
      setCommentSubmitting(false);
    }
  }

  function handleCommentChange(event) {
    setCommentContent(event.target.value);

    if (commentError) {
      setCommentError("");
    }

    if (commentMessage) {
      setCommentMessage("");
    }
  }

  return (
    <section className="user-support-tools">
      <div className="user-support-tools-heading">
        <span className="user-support-tools-kicker">TICKET İLETİŞİMİ</span>

        <h3>Teknisyenle İletişim</h3>

        <p>Ticket ile ilgili ek bilgi veya açıklamanızı teknisyene iletin.</p>
      </div>

      <form className="user-technician-message-form" onSubmit={submitComment}>
        <div className="user-technician-message-heading">
          <span className="user-technician-message-icon" aria-hidden="true">
            ✎
          </span>

          <div>
            <strong>Teknisyene mesaj bırak</strong>

            <span>Mesajınız ticket zaman çizelgesine eklenecek.</span>
          </div>
        </div>

        <textarea
          rows={3}
          maxLength={5000}
          value={commentContent}
          disabled={commentSubmitting}
          placeholder="Ek açıklamanızı veya teknisyene iletmek istediğiniz bilgiyi yazın..."
          onChange={handleCommentChange}
        />

        <div className="user-technician-message-meta">
          <span>Bu mesajı ticketı görüntüleyen teknik ekip görebilir.</span>

          <span>
            {commentContent.length}
            /5000
          </span>
        </div>

        {commentError ? (
          <p className="user-support-error">{commentError}</p>
        ) : null}

        {commentMessage ? (
          <p className="user-support-success">{commentMessage}</p>
        ) : null}

        <div className="user-technician-message-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={commentSubmitting || !commentContent.trim()}
          >
            {commentSubmitting ? "Gönderiliyor..." : "Mesajı Gönder"}
          </button>
        </div>
      </form>
    </section>
  );
}

function AiSessionLoading() {
  return (
    <section
      className={["panel", "ai-loading-panel", "user-ai-state-panel"].join(" ")}
      role="status"
    >
      <div className="ai-loading-glow" aria-hidden="true" />

      <div className="ai-loading-content">
        <div className="ai-loading-heading">
          <div className="ai-loading-orb" aria-hidden="true">
            <div className="ai-loading-orb-ring" />

            <div className="ai-loading-orb-core">
              <span>✦</span>
            </div>
          </div>

          <div className="ai-loading-heading-copy">
            <span className="ai-loading-brand">IntelliDesk AI</span>

            <h2>AI çözümü yükleniyor</h2>
          </div>
        </div>

        <p className="ai-loading-description">
          Talebiniz için oluşturulan çözüm bilgileri hazırlanıyor.
        </p>

        <div className="ai-loading-progress" aria-hidden="true" />
      </div>
    </section>
  );
}

function AiSessionError({ message }) {
  return (
    <section className="panel user-ai-state-panel">
      <div className="panel-header">
        <div>
          <span className="section-kicker">AI ÇÖZÜMÜ</span>

          <h2>Çözüm bilgisi alınamadı</h2>

          <p>{message}</p>
        </div>
      </div>
    </section>
  );
}

function AiSessionPending({ aiSession }) {
  return (
    <section className="panel user-ai-state-panel">
      <div className="panel-header">
        <div>
          <span className="section-kicker">INTELLIDESK AI</span>

          <h2>Çözüm henüz hazır değil</h2>

          <p>
            AI oturumunun mevcut durumu:{" "}
            <strong>{translateAiStatus(aiSession.status)}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

function AISolutionResult({ solution, confidence, sourceTicketIds }) {
  const hasStructuredContent =
    solution.evaluation ||
    solution.steps.length > 0 ||
    solution.solutionIntro ||
    solution.warning ||
    solution.control ||
    solution.nextAction;

  return (
    <section className="panel ai-solution-panel user-ai-solution-panel">
      <header className="ai-solution-header">
        <div className="ai-solution-title-area">
          <span className="ai-solution-header-icon" aria-hidden="true">
            ✦
          </span>

          <div className="ai-solution-title-copy">
            <span className="ai-solution-eyebrow">ÇÖZÜM PLANI</span>

            <h2 className="ai-solution-title">AI Çözüm Önerisi</h2>
          </div>
        </div>

        {confidence ? <ConfidenceIndicator confidence={confidence} /> : null}
      </header>

      {hasStructuredContent ? (
        <div className="ai-solution-content">
          {solution.evaluation ? (
            <section className="ai-evaluation-card">
              <div className="ai-evaluation-accent" aria-hidden="true" />

              <div className="ai-evaluation-body">
                <div className="ai-evaluation-heading">
                  <span className="ai-evaluation-badge">AI ÖZETİ</span>

                  <h3>Sorun değerlendirmesi</h3>
                </div>

                <p>{solution.evaluation}</p>
              </div>
            </section>
          ) : null}

          {solution.steps.length > 0 || solution.solutionIntro ? (
            <section className="ai-solution-main-section">
              <div className="ai-section-heading">
                <span
                  className={[
                    "ai-section-heading-icon",
                    "ai-section-heading-icon-primary",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  ✦
                </span>

                <div>
                  <h3>Uygulanacak adımlar</h3>

                  <span className="ai-section-description">
                    İşlemleri sırayla uygulayın.
                  </span>
                </div>
              </div>

              {solution.solutionIntro ? (
                <p className="ai-solution-intro">{solution.solutionIntro}</p>
              ) : null}

              {solution.steps.length > 0 ? (
                <ol className="ai-solution-timeline">
                  {solution.steps.map((step, index) => {
                    const isLastStep = index === solution.steps.length - 1;

                    return (
                      <li
                        className={[
                          "ai-solution-timeline-item",

                          isLastStep ? "ai-solution-timeline-item-last" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={`${index}-${step}`}
                      >
                        <div className="ai-solution-timeline-rail">
                          <span className="ai-solution-timeline-number">
                            {index + 1}
                          </span>

                          {!isLastStep ? (
                            <span
                              className="ai-solution-timeline-line"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>

                        <div className="ai-solution-timeline-content">
                          <p>{step}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </section>
          ) : null}

          {solution.warning ? (
            <aside className="ai-solution-warning">
              <span className="ai-solution-warning-icon" aria-hidden="true">
                !
              </span>

              <div>
                <strong>Önemli uyarı</strong>

                <p>{solution.warning}</p>
              </div>
            </aside>
          ) : null}

          {solution.control || solution.nextAction ? (
            <div className="ai-solution-info-grid">
              {solution.control ? (
                <section className="ai-info-card ai-info-card-control">
                  <span
                    className="ai-info-card-icon ai-info-card-icon-control"
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <div>
                    <span className="ai-info-card-label">DOĞRULAMA</span>

                    <h3>Kontrol</h3>

                    <p>{solution.control}</p>
                  </div>
                </section>
              ) : null}

              {solution.nextAction ? (
                <section className="ai-info-card ai-info-card-next">
                  <span
                    className="ai-info-card-icon ai-info-card-icon-next"
                    aria-hidden="true"
                  >
                    →
                  </span>

                  <div>
                    <span className="ai-info-card-label">DEVAM EDİYORSA</span>

                    <h3>Sonraki işlem</h3>

                    <p>{solution.nextAction}</p>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ai-solution-fallback">
          {solution.fallback || "AI çözüm içeriği bulunamadı."}
        </div>
      )}

      {sourceTicketIds.length > 0 ? (
        <footer className="ai-solution-sources">
          <div>
            <span className="ai-solution-sources-label">Benzer kayıtlar</span>

            <p>Çözümle ilişkili geçmiş Service Desk kayıtları</p>
          </div>

          <div className="ai-source-ticket-list">
            {sourceTicketIds.map((requestId) => (
              <span
                className="ai-source-ticket"
                title={`Kaynak ticket ${formatSourceTicketId(requestId)}`}
                key={requestId}
              >
                <span aria-hidden="true">#</span>

                {String(requestId).replace(/^#/, "")}
              </span>
            ))}
          </div>
        </footer>
      ) : null}
    </section>
  );
}

function ConfidenceIndicator({ confidence }) {
  const style = {
    "--confidence-progress": `${confidence.progress}deg`,
  };

  return (
    <div
      className={[
        "ai-confidence-card",
        `ai-confidence-card-${confidence.tone}`,
      ].join(" ")}
      style={style}
      aria-label={`Güven puanı yüzde ${confidence.value.toFixed(2)}`}
    >
      <span className="ai-confidence-ring" aria-hidden="true">
        <span className="ai-confidence-ring-center">
          {Math.round(confidence.value)}
        </span>
      </span>

      <span className="ai-confidence-copy">
        <span className="ai-confidence-label">Güven puanı</span>

        <strong className="ai-confidence-value">{confidence.label}</strong>

        <span className="ai-confidence-status">{confidence.status}</span>
      </span>
    </div>
  );
}

export default UserTicketDetail;
