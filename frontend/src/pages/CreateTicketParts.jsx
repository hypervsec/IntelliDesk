import api from "../api/api";

const SERVICE_DESK_URL = (import.meta.env.VITE_SERVICE_DESK_URL || "").trim();

export const AI_LOADING_STEPS = [
  {
    title: "Sorun bilgileri değerlendiriliyor",
    detail: "Teknik detaylar analiz ediliyor",
    description:
      "Sorununuzun konusu, açıklaması ve seçtiğiniz kategoriler değerlendiriliyor.",
  },
  {
    title: "Benzer ticketlar aranıyor",
    detail: "Geçmiş kayıtlar taranıyor",
    description:
      "Geçmiş Service Desk kayıtlarında benzer sorunlar ve çözümler aranıyor.",
  },
  {
    title: "Çözümler karşılaştırılıyor",
    detail: "En uygun kaynaklar seçiliyor",
    description:
      "Bulunan geçmiş çözümler benzerlik ve kullanılabilirlik açısından karşılaştırılıyor.",
  },
  {
    title: "AI çözümü hazırlanıyor",
    detail: "Son kontroller yapılıyor",
    description:
      "Geçmiş kayıtlar ve teknik bilgiler kullanılarak çözüm adımları hazırlanıyor.",
  },
];

export const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Düşük",
    tone: "low",
  },
  {
    value: "medium",
    label: "Orta",
    tone: "medium",
  },
  {
    value: "high",
    label: "Yüksek",
    tone: "high",
  },
  {
    value: "critical",
    label: "Kritik",
    tone: "critical",
  },
];

export const initialFormData = {
  title: "",
  description: "",
  department: "",
  category: "",
  subcategory: "",
  priority: "medium",
};

export function AISolutionResult({
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

            <h2 className="ai-solution-title">Çözüm Önerisi</h2>
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

                  <h3>Kök neden analizi</h3>
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
                <section
                  className={["ai-info-card", "ai-info-card-control"].join(" ")}
                >
                  <span
                    className={[
                      "ai-info-card-icon",
                      "ai-info-card-icon-control",
                    ].join(" ")}
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
                <section
                  className={["ai-info-card", "ai-info-card-next"].join(" ")}
                >
                  <span
                    className={[
                      "ai-info-card-icon",
                      "ai-info-card-icon-next",
                    ].join(" ")}
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

            <p>Çözülmediyse gerçek IT desteğine yönlendirileceksiniz.</p>
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

export function ResolutionResultCard({ type, onNewIssue }) {
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
            : "Sorunun ayrıntılarını kurumunuzun Service Desk sistemine ileterek IT ekibinden destek alın."}
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

export function AISolutionLoading({ activeStep }) {
  const currentStep = AI_LOADING_STEPS[activeStep] || AI_LOADING_STEPS[0];

  return (
    <section
      className="panel ai-loading-panel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
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

            <h2>{currentStep.title}</h2>
          </div>
        </div>

        <p className="ai-loading-description">{currentStep.description}</p>

        <div className="ai-loading-progress" aria-hidden="true" />

        <div className="ai-loading-steps">
          {AI_LOADING_STEPS.map((step, index) => {
            const isDone = index < activeStep;

            const isActive = index === activeStep;

            const statusClass = isDone
              ? "ai-loading-step-done"
              : isActive
                ? "ai-loading-step-active"
                : "ai-loading-step-pending";

            return (
              <div
                className={`ai-loading-step ${statusClass}`}
                key={step.title}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="ai-loading-step-icon">
                  {isDone ? (
                    "✓"
                  ) : isActive ? (
                    <span className="ai-loading-step-pulse" />
                  ) : (
                    index + 1
                  )}
                </span>

                <span className="ai-loading-step-copy">
                  <strong>{step.title}</strong>

                  <span>{step.detail}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="ai-loading-footer">
          <span className="ai-loading-footer-dot" aria-hidden="true" />
          Bu işlem genellikle birkaç saniye sürer. Lütfen sayfayı kapatmayın.
        </p>
      </div>
    </section>
  );
}

export function FormField({ label, htmlFor, required = false, children }) {
  return (
    <div className="form-group">
      <label htmlFor={htmlFor}>
        {label}

        {required ? <span className="required-mark">*</span> : null}
      </label>

      {children}
    </div>
  );
}

export async function uploadSessionImages(sessionId, files) {
  const uploadedAttachmentIds = [];

  try {
    for (const file of files) {
      const uploadData = new FormData();

      uploadData.append("file", file);

      const response = await api.post(
        `/ai/sessions/${sessionId}/attachments`,
        uploadData,
      );

      const attachmentId = Number(response.data?.attachment_id);

      if (Number.isSafeInteger(attachmentId) && attachmentId > 0) {
        uploadedAttachmentIds.push(attachmentId);
      }
    }
  } catch (uploadError) {
    await Promise.allSettled(
      uploadedAttachmentIds.map((attachmentId) =>
        api.delete(`/ai/sessions/${sessionId}/attachments/${attachmentId}`),
      ),
    );

    throw uploadError;
  }
}

export function getAiSessionId(search) {
  const searchParams = new URLSearchParams(search);

  const sessionValue = searchParams.get("session");

  if (!sessionValue || !/^\d+$/.test(sessionValue)) {
    return null;
  }

  const sessionId = Number(sessionValue);

  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    return null;
  }

  return sessionId;
}

export function getAssistantMessage(aiSession) {
  if (!Array.isArray(aiSession?.messages)) {
    return null;
  }

  return (
    aiSession.messages.find((message) => message.sender_type === "assistant") ||
    null
  );
}

export function parseAiSolution(content) {
  const emptySolution = {
    evaluation: "",
    solutionIntro: "",
    steps: [],
    warning: "",
    control: "",
    nextAction: "",
    sourceTicketIds: [],
    fallback: "",
  };

  if (typeof content !== "string") {
    return emptySolution;
  }

  const normalizedContent = normalizeAiContent(content);

  const sections = {
    evaluation: [],
    solution: [],
    control: [],
    nextAction: [],
    metadata: [],
    other: [],
  };

  let currentSection = "other";

  normalizedContent.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    if (/^-{3,}$/.test(line)) {
      currentSection = "metadata";

      return;
    }

    const sectionMatch = matchAiSection(line);

    if (sectionMatch) {
      currentSection = sectionMatch.section;

      if (sectionMatch.value) {
        sections[currentSection].push(sectionMatch.value);
      }

      return;
    }

    sections[currentSection].push(line);
  });

  const parsedSteps = parseSolutionSteps(sections.solution);

  const metadataText = sections.metadata.join("\n");

  const sourceTicketIds = extractSourceTicketIds(metadataText);

  const fallback =
    cleanParagraph(sections.other.join(" ")) ||
    cleanParagraph(normalizedContent);

  return {
    evaluation:
      cleanParagraph(sections.evaluation.join(" ")) ||
      cleanParagraph(sections.other.join(" ")),

    solutionIntro: parsedSteps.intro,

    steps: parsedSteps.steps,

    warning: parsedSteps.warning,

    control: cleanParagraph(sections.control.join(" ")),

    nextAction: cleanParagraph(sections.nextAction.join(" ")),

    sourceTicketIds,
    fallback,
  };
}

function matchAiSection(line) {
  const sectionDefinitions = [
    {
      section: "evaluation",
      pattern: /^sorun\s+değerlendirmesi\s*:?\s*(.*)$/i,
    },
    {
      section: "solution",
      pattern: /^önerilen\s+çözüm\s*:?\s*(.*)$/i,
    },
    {
      section: "control",
      pattern: /^kontrol\s*:?\s*(.*)$/i,
    },
    {
      section: "nextAction",
      pattern: /^sonraki\s+işlem\s*:?\s*(.*)$/i,
    },
    {
      section: "metadata",
      pattern: /^rag\s+bilgileri\s*:?\s*(.*)$/i,
    },
  ];

  for (const definition of sectionDefinitions) {
    const match = line.match(definition.pattern);

    if (match) {
      return {
        section: definition.section,

        value: cleanTextLine(match[1] || ""),
      };
    }
  }

  return null;
}

function parseSolutionSteps(lines) {
  const steps = [];
  const introParts = [];
  const warningParts = [];

  let activeStepIndex = -1;

  lines.forEach((rawLine) => {
    const line = cleanTextLine(rawLine);

    if (!line) {
      return;
    }

    const warningMatch = line.match(/^(?:uyarı|önemli\s+uyarı)\s*:?\s*(.*)$/i);

    if (warningMatch) {
      warningParts.push(warningMatch[1] || line);

      return;
    }

    const numberedStep = line.match(/^\d+[.)]\s*(.+)$/);

    const bulletStep = line.match(/^[•-]\s*(.+)$/);

    const stepMatch = numberedStep || bulletStep;

    if (stepMatch) {
      steps.push(stepMatch[1].trim());

      activeStepIndex = steps.length - 1;

      return;
    }

    if (activeStepIndex >= 0) {
      steps[activeStepIndex] = `${steps[activeStepIndex]} ${line}`.trim();

      return;
    }

    introParts.push(line);
  });

  return {
    intro: cleanParagraph(introParts.join(" ")),

    steps,

    warning: cleanParagraph(warningParts.join(" ")),
  };
}

function extractSourceTicketIds(metadataText) {
  const sourceLine = metadataText
    .split("\n")
    .find((line) => /^kaynak\s+ticketlar\s*:/i.test(line.trim()));

  if (!sourceLine) {
    return [];
  }

  return sourceLine
    .replace(/^kaynak\s+ticketlar\s*:/i, "")
    .split(",")
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);
}

export function getSourceTicketIds(aiSession, parsedSourceIds) {
  const directSourceIds = Array.isArray(aiSession?.source_request_ids)
    ? aiSession.source_request_ids
    : [];

  const selectedSourceIds =
    directSourceIds.length > 0 ? directSourceIds : parsedSourceIds;

  return [
    ...new Set(
      selectedSourceIds
        .map((requestId) => String(requestId).replace(/^#/, "").trim())
        .filter(Boolean),
    ),
  ];
}

function formatSourceTicketId(requestId) {
  const normalizedId = String(requestId || "").replace(/^#/, "");

  return `#${normalizedId}`;
}

export function getConfidenceMeta(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const percentage =
    numericValue > 1
      ? clamp(numericValue, 0, 100)
      : clamp(numericValue, 0, 1) * 100;

  let tone = "low";
  let status = "Düşük eşleşme";

  if (percentage >= 80) {
    tone = "high";
    status = "Yüksek eşleşme";
  } else if (percentage >= 60) {
    tone = "medium";
    status = "Orta eşleşme";
  }

  return {
    value: percentage,

    label: `%${percentage.toFixed(2)}`,

    progress: percentage * 3.6,

    tone,
    status,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAiContent(content) {
  if (typeof content !== "string") {
    return "";
  }

  return content
    .replace(/\r\n/g, "\n")
    .replace(/\bBT\s+ekibi\b/gi, "IT ekibi")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .trim();
}

function cleanTextLine(value) {
  return String(value || "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
}

function cleanParagraph(value) {
  return cleanTextLine(value).replace(/\s+/g, " ").trim();
}

export function getApiErrorMessage(error, fallbackMessage) {
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

  if (
    typeof error?.message === "string" &&
    error.message === "Çözüm sonucu beklenen değerle eşleşmedi."
  ) {
    return error.message;
  }

  return fallbackMessage;
}
