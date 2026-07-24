import { Link } from "react-router-dom";

import TicketTimelinePanel from "./TicketTimelinePanel";

import {
  createStaffOptions,
  formatDate,
  formatSourceTicketId,
  getAssistantMessage,
  getConfidenceLabel,
  getConfidenceLevel,
  getConfidenceMeta,
  getSourceTicketIds,
  getStaffRoleLabel,
  normalizeConfidence,
  parseAiSolution,
  translateAiStatus,
  translatePriority,
  translateStatus,
} from "../utils/ticketDetailUtils";

function StaffTicketDetail({
  ticket,
  aiSession,
  aiSessionLoading,
  aiSessionError,

  recommendation,
  recommendationLoading,
  onCreateRecommendation,

  updateForm,
  staffAccounts,
  departmentOptions,
  categoryOptions,
  subcategoryOptions,

  formOptionsLoading,
  staffLoading,
  updateLoading,

  staffError,
  formOptionsError,

  feedback,
  feedbackNote,
  feedbackLoading,

  onUpdateChange,
  onDepartmentChange,
  onCategoryChange,
  onUpdateTicket,

  onFeedbackChange,
  onFeedbackNoteChange,
  onSubmitFeedback,

  onTimelineChanged,
}) {
  const technicianOptions = createStaffOptions(
    staffAccounts,
    updateForm.assigned_technician,
  );

  const assistantMessage = getAssistantMessage(aiSession);

  const parsedSolution = parseAiSolution(assistantMessage?.content);

  const aiConfidence = getConfidenceMeta(aiSession?.confidence_score);

  const sourceTicketIds = getSourceTicketIds(
    aiSession,
    parsedSolution.sourceTicketIds,
  );

  const legacyConfidenceScore = normalizeConfidence(
    recommendation?.confidence_score,
  );

  const legacyConfidencePercentage = legacyConfidenceScore * 100;

  const legacyConfidenceLevel = getConfidenceLevel(legacyConfidenceScore);

  const legacyConfidenceLabel = getConfidenceLabel(legacyConfidenceLevel);

  const timelineRefreshKey = [
    ticket.ticket_id,
    ticket.updated_at,
    ticket.first_responded_at,
  ].join("-");

  return (
    <>
      <section className="staff-top-layout">
        <UnifiedOverviewPanel ticket={ticket} />

        <StaffAiPanel
          aiSession={aiSession}
          aiSessionLoading={aiSessionLoading}
          aiSessionError={aiSessionError}
          assistantMessage={assistantMessage}
          parsedSolution={parsedSolution}
          confidence={aiConfidence}
          sourceTicketIds={sourceTicketIds}
          recommendation={recommendation}
          recommendationLoading={recommendationLoading}
          legacyConfidencePercentage={legacyConfidencePercentage}
          legacyConfidenceLevel={legacyConfidenceLevel}
          legacyConfidenceLabel={legacyConfidenceLabel}
          onCreateRecommendation={onCreateRecommendation}
        />
      </section>

      <section className="panel management-panel management-panel-compact">
        <div className="panel-header">
          <div>
            <span className="section-kicker">OPERASYON VE ATAMA</span>

            <h2>Ticket Yönetimi</h2>

            <p>Durum, atama, sınıflandırma ve çözüm bilgisini güncelle.</p>
          </div>
        </div>

        {staffError ? <p className="error-message">{staffError}</p> : null}

        {formOptionsError ? (
          <p className="error-message">{formOptionsError}</p>
        ) : null}

        <form className="ticket-form" onSubmit={onUpdateTicket}>
          <div className="form-grid compact-management-grid">
            <FormField label="Durum" htmlFor="status">
              <select
                id="status"
                name="status"
                value={updateForm.status}
                disabled={updateLoading}
                onChange={onUpdateChange}
              >
                <option value="open">Açık</option>
                <option value="assigned">Atandı</option>
                <option value="in_progress">İşlemde</option>
                <option value="waiting_user">Kullanıcı Bekleniyor</option>
                <option value="resolved">Çözüldü</option>
                <option value="closed">Kapalı</option>
                <option value="cancelled">İptal</option>
              </select>
            </FormField>

            <FormField label="Atanan teknisyen" htmlFor="assigned_technician">
              <select
                id="assigned_technician"
                name="assigned_technician"
                value={updateForm.assigned_technician}
                disabled={updateLoading || staffLoading}
                onChange={onUpdateChange}
              >
                <option value="">
                  {staffLoading
                    ? "Teknik personel yükleniyor..."
                    : "Teknik personel seç"}
                </option>

                {technicianOptions.map((staffAccount) => (
                  <option
                    key={staffAccount.optionKey}
                    value={staffAccount.full_name}
                  >
                    {staffAccount.full_name}
                    {" — "}
                    {getStaffRoleLabel(staffAccount)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Öncelik" htmlFor="priority">
              <select
                id="priority"
                name="priority"
                value={updateForm.priority}
                disabled={updateLoading}
                onChange={onUpdateChange}
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
            </FormField>

            <FormField label="Departman" htmlFor="department">
              <select
                id="department"
                name="department"
                value={updateForm.department}
                disabled={updateLoading || formOptionsLoading}
                onChange={onDepartmentChange}
              >
                <option value="">
                  {formOptionsLoading && departmentOptions.length === 0
                    ? "Departmanlar yükleniyor..."
                    : "Departman seç"}
                </option>

                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Kategori" htmlFor="category">
              <select
                id="category"
                name="category"
                value={updateForm.category}
                disabled={
                  updateLoading || formOptionsLoading || !updateForm.department
                }
                onChange={onCategoryChange}
              >
                <option value="">
                  {!updateForm.department
                    ? "Önce departman seç"
                    : formOptionsLoading
                      ? "Kategoriler yükleniyor..."
                      : "Kategori seç"}
                </option>

                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Alt kategori" htmlFor="subcategory">
              <select
                id="subcategory"
                name="subcategory"
                value={updateForm.subcategory}
                disabled={
                  updateLoading || formOptionsLoading || !updateForm.category
                }
                onChange={onUpdateChange}
              >
                <option value="">
                  {!updateForm.category
                    ? "Önce kategori seç"
                    : formOptionsLoading
                      ? "Alt kategoriler yükleniyor..."
                      : "Alt kategori seç"}
                </option>

                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Teknisyen çözümü" htmlFor="resolution">
            <textarea
              id="resolution"
              name="resolution"
              rows={5}
              value={updateForm.resolution}
              disabled={updateLoading}
              placeholder="Uygulanan teknik çözümü yazın..."
              onChange={onUpdateChange}
            />
          </FormField>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={updateLoading || formOptionsLoading || staffLoading}
            >
              {updateLoading ? "Güncelleniyor..." : "Ticketı Güncelle"}
            </button>
          </div>
        </form>
      </section>

      <TicketTimelinePanel
        key={timelineRefreshKey}
        ticketId={ticket.ticket_id}
        onTimelineChanged={onTimelineChanged}
      />

      <CompactFeedbackPanel
        ticket={ticket}
        recommendation={recommendation}
        feedback={feedback}
        feedbackNote={feedbackNote}
        feedbackLoading={feedbackLoading}
        onFeedbackChange={onFeedbackChange}
        onFeedbackNoteChange={onFeedbackNoteChange}
        onSubmitFeedback={onSubmitFeedback}
      />
    </>
  );
}

function UnifiedOverviewPanel({ ticket }) {
  return (
    <section className="panel staff-overview-panel">
      <div className="panel-header">
        <div>
          <span className="section-kicker">TICKET ÖZETİ</span>

          <h2>Kullanıcı Bildirimi ve Kayıt Bilgileri</h2>

          <p>
            Kullanıcının girdiği sorun bilgileri ile ticketın temel özet durumu.
          </p>
        </div>
      </div>

      <div className="staff-overview-content">
        <div className="staff-problem-user">
          <span className="staff-problem-avatar" aria-hidden="true">
            {getInitials(ticket.requester_name)}
          </span>

          <div>
            <span>Talep sahibi</span>
            <strong>
              {ticket.requester_name || "Kullanıcı belirtilmemiş"}
            </strong>
          </div>
        </div>

        <article className="staff-problem-description">
          <span className="staff-info-label">AÇIKLAMA</span>
          <h3>{ticket.title}</h3>
          <p>{ticket.description || "Açıklama belirtilmemiş."}</p>
        </article>

        <div className="staff-overview-grid">
          <OverviewCard label="Durum" value={translateStatus(ticket.status)} />
          <OverviewCard
            label="Öncelik"
            value={translatePriority(ticket.priority)}
          />
          <OverviewCard
            label="Atanan teknisyen"
            value={ticket.assigned_technician || "Henüz atanmadı"}
          />
          <OverviewCard
            label="Departman"
            value={ticket.department || "Belirtilmemiş"}
          />
          <OverviewCard
            label="Kategori"
            value={ticket.category || "Belirtilmemiş"}
          />
          <OverviewCard
            label="Alt kategori"
            value={ticket.subcategory || "Belirtilmemiş"}
          />
          <OverviewCard
            label="Oluşturulma"
            value={formatDate(ticket.created_at)}
          />
          <OverviewCard
            label="Son güncelleme"
            value={formatDate(ticket.updated_at)}
          />
        </div>
      </div>
    </section>
  );
}

function StaffAiPanel({
  aiSession,
  aiSessionLoading,
  aiSessionError,
  assistantMessage,
  parsedSolution,
  confidence,
  sourceTicketIds,

  recommendation,
  recommendationLoading,
  legacyConfidencePercentage,
  legacyConfidenceLevel,
  legacyConfidenceLabel,

  onCreateRecommendation,
}) {
  if (aiSessionLoading) {
    return (
      <section className="panel staff-ai-panel ai-loading-panel" role="status">
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
              <h2>AI oturumu yükleniyor</h2>
            </div>
          </div>

          <p className="ai-loading-description">
            Kullanıcıya sunulan AI çözümü getiriliyor.
          </p>

          <div className="ai-loading-progress" aria-hidden="true" />
        </div>
      </section>
    );
  }

  if (aiSession && assistantMessage) {
    return (
      <LinkedAiSolutionPanel
        aiSession={aiSession}
        solution={parsedSolution}
        confidence={confidence}
        sourceTicketIds={sourceTicketIds}
      />
    );
  }

  if (aiSession && !assistantMessage) {
    return (
      <section className="panel staff-ai-panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">KULLANICI AI OTURUMU</span>
            <h2>AI çözümü henüz hazır değil</h2>
            <p>
              Oturum durumu:{" "}
              <strong>{translateAiStatus(aiSession.status)}</strong>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <LegacyRecommendationPanel
      aiSessionError={aiSessionError}
      recommendation={recommendation}
      recommendationLoading={recommendationLoading}
      confidencePercentage={legacyConfidencePercentage}
      confidenceLevel={legacyConfidenceLevel}
      confidenceLabel={legacyConfidenceLabel}
      onCreateRecommendation={onCreateRecommendation}
    />
  );
}

function LinkedAiSolutionPanel({
  aiSession,
  solution,
  confidence,
  sourceTicketIds,
}) {
  const hasStructuredContent =
    solution.evaluation ||
    solution.solutionIntro ||
    solution.steps.length > 0 ||
    solution.warning ||
    solution.control ||
    solution.nextAction;

  return (
    <section className="panel ai-solution-panel staff-ai-panel">
      <header className="ai-solution-header">
        <div className="ai-solution-title-area">
          <span className="ai-solution-header-icon" aria-hidden="true">
            ✦
          </span>

          <div className="ai-solution-title-copy">
            <span className="ai-solution-eyebrow">
              KULLANICIYA SUNULAN ÇÖZÜM
            </span>

            <h2 className="ai-solution-title">IntelliDesk AI Çözümü</h2>
          </div>
        </div>

        {confidence ? <StaffConfidenceCard confidence={confidence} /> : null}
      </header>

      <div className="staff-ai-status-row">
        <div className="staff-ai-status-item">
          <span>AI oturum durumu</span>
          <strong>{translateAiStatus(aiSession.status)}</strong>
        </div>

        <div className="staff-ai-status-item">
          <span>Kullanıcı sonucu</span>
          <strong>
            {translateResolutionStatus(aiSession.resolution_status)}
          </strong>
        </div>
      </div>

      {hasStructuredContent ? (
        <div className="ai-solution-content">
          {solution.evaluation ? (
            <section className="ai-evaluation-card">
              <div className="ai-evaluation-accent" aria-hidden="true" />

              <div className="ai-evaluation-body">
                <div className="ai-evaluation-heading">
                  <span className="ai-evaluation-badge">
                    AI DEĞERLENDİRMESİ
                  </span>

                  <h3>Sorun analizi</h3>
                </div>

                <p>{solution.evaluation}</p>
              </div>
            </section>
          ) : null}

          {solution.solutionIntro || solution.steps.length > 0 ? (
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
                  <h3>Kullanıcıya önerilen adımlar</h3>

                  <span className="ai-section-description">
                    AI tarafından kullanıcıya gösterilen çözüm planı.
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
                    <span className="ai-info-card-label">ÇÖZÜLMEDİYSE</span>
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

            <p>AI çözümünde kullanılan geçmiş Service Desk kayıtları</p>
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

function LegacyRecommendationPanel({
  aiSessionError,
  recommendation,
  recommendationLoading,
  confidencePercentage,
  confidenceLevel,
  confidenceLabel,
  onCreateRecommendation,
}) {
  return (
    <section className="panel staff-ai-panel">
      <div className="panel-header">
        <div>
          <span className="section-kicker">TEKNİSYEN AI DESTEĞİ</span>

          <h2>AI Çözüm Önerisi</h2>

          <p>
            Bu ticketa bağlı kullanıcı AI oturumu olmadığında geçmiş
            ticketlardan teknik öneri oluşturulur.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onCreateRecommendation}
          disabled={recommendationLoading}
        >
          {recommendationLoading
            ? "Oluşturuluyor..."
            : recommendation
              ? "Öneriyi Yenile"
              : "Öneri Oluştur"}
        </button>
      </div>

      {aiSessionError ? (
        <p className="empty-message">{aiSessionError}</p>
      ) : null}

      {recommendation ? (
        <div
          className={[
            "recommendation-box",
            `confidence-${confidenceLevel}`,
          ].join(" ")}
        >
          <p className="recommendation-text">
            {recommendation.recommendation ||
              "AI tarafından çözüm önerisi oluşturulamadı."}
          </p>

          <div className="confidence-row">
            <div className="confidence-title">
              <span>AI güven puanı</span>

              <span
                className={[
                  "confidence-badge",
                  `confidence-badge-${confidenceLevel}`,
                ].join(" ")}
              >
                {confidenceLabel}
              </span>
            </div>

            <strong>%{confidencePercentage.toFixed(2)}</strong>
          </div>

          <div
            className="confidence-track"
            role="progressbar"
            aria-label="AI güven puanı"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(confidencePercentage)}
          >
            <div
              className="confidence-fill"
              style={{
                width: `${confidencePercentage}%`,
              }}
            />
          </div>

          {recommendation.source_request_ids?.length > 0 ? (
            <div className="source-list">
              <span>Kaynak ticketlar:</span>

              <div>
                {recommendation.source_request_ids.map((requestId) => (
                  <Link
                    className="source-badge"
                    key={requestId}
                    to={`/tickets/${requestId}`}
                  >
                    #{requestId}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="empty-message">
          Henüz teknisyen AI önerisi oluşturulmadı.
        </p>
      )}
    </section>
  );
}

function CompactFeedbackPanel({
  ticket,
  recommendation,
  feedback,
  feedbackNote,
  feedbackLoading,
  onFeedbackChange,
  onFeedbackNoteChange,
  onSubmitFeedback,
}) {
  return (
    <section className="panel feedback-panel feedback-panel-compact">
      <div className="panel-header">
        <div>
          <span className="section-kicker">AI GERİ BİLDİRİMİ</span>

          <h2>Teknisyen Geri Bildirimi</h2>

          <p>Teknik önerinin faydalı olup olmadığını kısa şekilde kaydedin.</p>
        </div>
      </div>

      {ticket.ai_feedback ? (
        <div
          className={[
            "saved-feedback",
            ticket.ai_feedback === "accepted"
              ? "feedback-accepted"
              : "feedback-rejected",
          ].join(" ")}
        >
          <strong>
            Mevcut geri bildirim:{" "}
            {ticket.ai_feedback === "accepted" ? "Kabul edildi" : "Reddedildi"}
          </strong>

          {ticket.ai_feedback_note ? <p>{ticket.ai_feedback_note}</p> : null}

          <span>{formatDate(ticket.ai_feedback_at)}</span>
        </div>
      ) : null}

      <form
        className="feedback-form compact-feedback-form"
        onSubmit={onSubmitFeedback}
      >
        <div className="compact-feedback-top">
          <FormField label="Geri bildirim" htmlFor="feedback">
            <select
              id="feedback"
              value={feedback}
              disabled={feedbackLoading || !recommendation}
              onChange={onFeedbackChange}
            >
              <option value="accepted">Kabul et</option>
              <option value="rejected">Reddet</option>
            </select>
          </FormField>
        </div>

        <FormField label="Kısa açıklama" htmlFor="feedbackNote">
          <textarea
            id="feedbackNote"
            rows={3}
            value={feedbackNote}
            disabled={feedbackLoading || !recommendation}
            maxLength={1000}
            placeholder={
              recommendation
                ? "Kısa not yazın..."
                : "Önce teknisyen AI önerisi oluşturulmalıdır."
            }
            onChange={onFeedbackNoteChange}
          />
        </FormField>

        <div className="form-actions">
          <button
            type="submit"
            className="primary-button"
            disabled={feedbackLoading || !recommendation}
          >
            {feedbackLoading ? "Kaydediliyor..." : "Geri Bildirimi Kaydet"}
          </button>
        </div>
      </form>
    </section>
  );
}

function StaffConfidenceCard({ confidence }) {
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

function OverviewCard({ label, value }) {
  return (
    <article className="staff-overview-card">
      <span>{label}</span>
      <strong>{value || "Belirtilmemiş"}</strong>
    </article>
  );
}

function FormField({ label, htmlFor, children }) {
  return (
    <div className="form-group">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "?";
  }

  return words
    .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR"))
    .join("");
}

function translateResolutionStatus(value) {
  const values = {
    resolved: "Sorun çözüldü",
    unresolved: "Sorun çözülmedi",
  };

  return values[value] || "Henüz geri bildirim yok";
}

export default StaffTicketDetail;
