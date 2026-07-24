import {
  formatDate,
  formatSourceTicketId,
  getAssistantMessage,
  getConfidenceMeta,
  getSourceTicketIds,
  parseAiSolution,
  translateAiStatus,
  translatePriority,
  translateStatus,
} from "../utils/ticketDetailUtils";

const SERVICE_DESK_URL = (import.meta.env.VITE_SERVICE_DESK_URL || "").trim();

function UserTicketDetail({
  ticket,
  aiSession,
  aiSessionLoading,
  aiSessionError,
  resolutionLoading,
  pendingResolution,
  onResolved,
  onUnresolved,
  onNewIssue,
}) {
  const assistantMessage = getAssistantMessage(aiSession);

  const parsedSolution = parseAiSolution(assistantMessage?.content);

  const confidence = getConfidenceMeta(aiSession?.confidence_score);

  const sourceTicketIds = getSourceTicketIds(
    aiSession,
    parsedSolution.sourceTicketIds,
  );

  const resolutionStatus = aiSession?.resolution_status || null;

  return (
    <>
      <UserIssueSummary ticket={ticket} />

      {aiSessionLoading ? <AiSessionLoading /> : null}

      {aiSessionError ? <AiSessionError message={aiSessionError} /> : null}

      {!aiSessionLoading && aiSession && !assistantMessage ? (
        <section className="panel">
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
      ) : null}

      {assistantMessage ? (
        <AISolutionResult
          solution={parsedSolution}
          confidence={confidence}
          sourceTicketIds={sourceTicketIds}
          resolutionStatus={resolutionStatus}
          resolutionLoading={resolutionLoading}
          pendingResolution={pendingResolution}
          onResolved={onResolved}
          onUnresolved={onUnresolved}
        />
      ) : null}

      {resolutionStatus === "resolved" ? (
        <ResolutionResultCard type="resolved" onNewIssue={onNewIssue} />
      ) : null}

      {resolutionStatus === "unresolved" ? (
        <ResolutionResultCard type="unresolved" onNewIssue={onNewIssue} />
      ) : null}
    </>
  );
}

function UserIssueSummary({ ticket }) {
  return (
    <section className="panel ai-solution-panel">
      <header className="ai-solution-header">
        <div className="ai-solution-title-area">
          <span className="ai-solution-header-icon" aria-hidden="true">
            !
          </span>

          <div className="ai-solution-title-copy">
            <span className="ai-solution-eyebrow">TALEBİNİZ</span>

            <h2 className="ai-solution-title">Bildirdiğiniz Sorun</h2>
          </div>
        </div>
      </header>

      <div className="ai-solution-content">
        <section className="ai-evaluation-card">
          <div className="ai-evaluation-accent" aria-hidden="true" />

          <div className="ai-evaluation-body">
            <div className="ai-evaluation-heading">
              <span className="ai-evaluation-badge">AÇIKLAMA</span>

              <h3>{ticket.title}</h3>
            </div>

            <p>{ticket.description || "Açıklama belirtilmemiş."}</p>
          </div>
        </section>

        <div className="ai-solution-info-grid">
          <section className="ai-info-card ai-info-card-control">
            <span
              className="ai-info-card-icon ai-info-card-icon-control"
              aria-hidden="true"
            >
              i
            </span>

            <div>
              <span className="ai-info-card-label">SINIFLANDIRMA</span>

              <h3>{ticket.category || "Kategori belirtilmemiş"}</h3>

              <p>
                {[ticket.department, ticket.subcategory]
                  .filter(Boolean)
                  .join(" · ") || "Departman veya alt kategori belirtilmemiş."}
              </p>
            </div>
          </section>

          <section className="ai-info-card ai-info-card-next">
            <span
              className="ai-info-card-icon ai-info-card-icon-next"
              aria-hidden="true"
            >
              →
            </span>

            <div>
              <span className="ai-info-card-label">KAYIT BİLGİSİ</span>

              <h3>{translateStatus(ticket.status)}</h3>

              <p>
                {translatePriority(ticket.priority)} öncelik
                {" · "}
                {formatDate(ticket.created_at)}
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function AiSessionLoading() {
  return (
    <section className="panel ai-loading-panel" role="status">
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
    <section className="panel">
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

function AISolutionResult({
  solution,
  confidence,
  sourceTicketIds,
  resolutionStatus,
  resolutionLoading,
  pendingResolution,
  onResolved,
  onUnresolved,
}) {
  const hasStructuredContent =
    solution.evaluation ||
    solution.steps.length > 0 ||
    solution.solutionIntro ||
    solution.warning ||
    solution.control ||
    solution.nextAction;

  return (
    <section className="panel ai-solution-panel">
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
        <div className="ai-solution-fallback">{solution.fallback}</div>
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

      {!resolutionStatus ? (
        <section className="ai-feedback-box">
          <div className="ai-feedback-copy">
            <span className="ai-feedback-label">SONUÇ</span>

            <h3>Bu adımlar sorununuzu çözdü mü?</h3>

            <p>Çözülmediyse Service Desk bölümüne yönlendirileceksiniz.</p>
          </div>

          <div className="ai-feedback-actions">
            <button
              type="button"
              className={[
                "ai-feedback-button",
                "ai-feedback-button-secondary",
              ].join(" ")}
              onClick={onUnresolved}
              disabled={resolutionLoading}
            >
              {pendingResolution === "unresolved"
                ? "Kaydediliyor..."
                : "Sorunum Çözülmedi"}
            </button>

            <button
              type="button"
              className={[
                "ai-feedback-button",
                "ai-feedback-button-primary",
              ].join(" ")}
              onClick={onResolved}
              disabled={resolutionLoading}
            >
              {pendingResolution === "resolved"
                ? "Kaydediliyor..."
                : "Sorunum Çözüldü"}
            </button>
          </div>
        </section>
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

function ResolutionResultCard({ type, onNewIssue }) {
  const isResolved = type === "resolved";

  return (
    <section
      className={[
        "panel",
        "ai-resolution-card",
        isResolved
          ? "ai-resolution-card-success"
          : "ai-resolution-card-warning",
      ].join(" ")}
    >
      <span className="ai-resolution-icon" aria-hidden="true">
        {isResolved ? "✓" : "!"}
      </span>

      <div className="ai-resolution-copy">
        <span className="ai-resolution-kicker">
          {isResolved ? "GERİ BİLDİRİM ALINDI" : "IT DESTEĞİ GEREKİYOR"}
        </span>

        <h2>
          {isResolved
            ? "Sorun çözüldü olarak kaydedildi"
            : "Service Desk kaydı oluşturun"}
        </h2>

        <p>
          {isResolved
            ? "Teşekkürler. Yeni bir sorun için formu yeniden açabilirsiniz."
            : "Sorunun ayrıntılarını Service Desk bölümüne ileterek IT ekibinden destek alın."}
        </p>
      </div>

      <div className="ai-resolution-actions">
        <button
          type="button"
          className="ai-resolution-secondary-button"
          onClick={onNewIssue}
        >
          Yeni Sorun Bildir
        </button>

        {!isResolved && SERVICE_DESK_URL ? (
          <a
            href={SERVICE_DESK_URL}
            className="ai-resolution-primary-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            IT Destek Kaydı Aç
          </a>
        ) : null}
      </div>
    </section>
  );
}

export default UserTicketDetail;
