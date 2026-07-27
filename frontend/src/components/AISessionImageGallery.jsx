import { useEffect, useState } from "react";

import api from "../api/api";
import Icon from "./Icon";

import { createGuidedImageBlob } from "../utils/ai-visuals/solutionCanvas";

import "../styles/ai/ai-session-images.css";
import "../styles/ai/ai-visual-guidance.css";

const EMPTY_VISUAL_GUIDANCE = {
  version: 1,
  coordinateSystem: "normalized_0_1000",
  markers: [],
};

function AISessionImageGallery({ sessionId, compact = false }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activePreview, setActivePreview] = useState(null);

  useEffect(() => {
    const normalizedSessionId = Number(sessionId);

    if (
      !Number.isSafeInteger(normalizedSessionId) ||
      normalizedSessionId <= 0
    ) {
      setImages([]);
      setError("");
      setLoading(false);
      setActivePreview(null);
      return undefined;
    }

    let cancelled = false;
    const createdObjectUrls = [];

    async function loadImages() {
      try {
        setLoading(true);
        setError("");
        setImages([]);
        setActivePreview(null);

        const [attachmentListResult, sessionDetailResult] =
          await Promise.allSettled([
            api.get(`/ai/sessions/${normalizedSessionId}/attachments`),
            api.get(`/ai/sessions/${normalizedSessionId}`),
          ]);

        if (attachmentListResult.status !== "fulfilled") {
          throw attachmentListResult.reason;
        }

        const attachments = Array.isArray(attachmentListResult.value.data)
          ? attachmentListResult.value.data
          : [];

        const visualGuidance =
          sessionDetailResult.status === "fulfilled"
            ? extractSessionVisualGuidance(sessionDetailResult.value.data)
            : EMPTY_VISUAL_GUIDANCE;

        if (cancelled || attachments.length === 0) {
          return;
        }

        const imageResults = await Promise.allSettled(
          attachments.map(async (attachment, attachmentIndex) => {
            const imageIndex = attachmentIndex + 1;

            const contentResponse = await api.get(
              `/ai/sessions/${normalizedSessionId}/attachments/${attachment.attachment_id}/content`,
              {
                responseType: "blob",
              },
            );

            const imageBlob =
              contentResponse.data instanceof Blob
                ? contentResponse.data
                : new Blob([contentResponse.data], {
                    type: attachment.content_type,
                  });

            const previewUrl = URL.createObjectURL(imageBlob);

            if (cancelled) {
              URL.revokeObjectURL(previewUrl);
              return null;
            }

            createdObjectUrls.push(previewUrl);

            const markers = visualGuidance.markers.filter(
              (marker) => marker.imageIndex === imageIndex,
            );

            let solutionPreviewUrl = "";
            let solutionPreviewError = "";

            if (markers.length > 0) {
              try {
                const solutionBlob = await createGuidedImageBlob(
                  imageBlob,
                  markers,
                );

                if (cancelled) {
                  return null;
                }

                solutionPreviewUrl = URL.createObjectURL(solutionBlob);
                createdObjectUrls.push(solutionPreviewUrl);
              } catch (guidanceError) {
                console.error(
                  "AI çözüm görseli oluşturulamadı.",
                  guidanceError,
                );
                solutionPreviewError = "Çözüm görseli oluşturulamadı.";
              }
            }

            return {
              ...attachment,
              imageIndex,
              previewUrl,
              solutionPreviewUrl,
              solutionPreviewError,
              markers,
            };
          }),
        );

        if (cancelled) {
          return;
        }

        const loadedImages = imageResults
          .filter((result) => result.status === "fulfilled" && result.value)
          .map((result) => result.value);

        setImages(loadedImages);

        if (loadedImages.length === 0 && attachments.length > 0) {
          setError("Oturum görselleri görüntülenemedi.");
        }
      } catch (requestError) {
        console.error(requestError);

        if (!cancelled) {
          setError(
            getApiErrorMessage(requestError, "Oturum görselleri alınamadı."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadImages();

    return () => {
      cancelled = true;

      createdObjectUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
    };
  }, [sessionId]);

  useEffect(() => {
    if (!activePreview) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActivePreview(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePreview]);

  if (loading) {
    return (
      <section
        className={[
          "ai-session-images",
          "ai-session-images-comparison",
          compact ? "ai-session-images-compact" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-busy="true"
      >
        <div className="ai-session-images-heading">
          <div>
            <span className="ai-session-images-kicker">GÖRSEL ANALİZİ</span>
            <h3>Görseller</h3>
            <p>Ekran görüntüleri hazırlanıyor.</p>
          </div>
        </div>

        <div className="ai-session-images-loading" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          <span>Görseller yükleniyor...</span>
        </div>
      </section>
    );
  }

  if (images.length === 0 && !error) {
    return null;
  }

  return (
    <>
      <section
        className={[
          "ai-session-images",
          "ai-session-images-comparison",
          compact ? "ai-session-images-compact" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="ai-session-images-heading">
          <div>
            <span className="ai-session-images-kicker">GÖRSEL ANALİZİ</span>
            <h3>Görseller</h3>
            <p>
              Kullanıcının yüklediği ekran ile AI tarafından hazırlanan çözüm
              rehberini yan yana inceleyin.
            </p>
          </div>
        </div>

        {error ? <p className="ai-session-images-error">{error}</p> : null}

        {images.length > 0 ? (
          <div className="ai-image-comparison-list">
            {images.map((image) => (
              <ImagePair
                key={image.attachment_id}
                image={image}
                onOpenOriginal={() => {
                  setActivePreview({
                    image,
                    mode: "original",
                  });
                }}
                onOpenSolution={() => {
                  setActivePreview({
                    image,
                    mode: "solution",
                  });
                }}
              />
            ))}
          </div>
        ) : null}
      </section>

      {activePreview ? (
        <ImagePreviewModal
          preview={activePreview}
          onClose={() => {
            setActivePreview(null);
          }}
        />
      ) : null}
    </>
  );
}

function ImagePair({ image, onOpenOriginal, onOpenSolution }) {
  const markerCount = Array.isArray(image.markers) ? image.markers.length : 0;
  const hasSolutionImage = Boolean(image.solutionPreviewUrl);

  return (
    <div className="ai-image-pair">
      <div className="ai-image-comparison-grid">
        <button
          type="button"
          className="ai-comparison-card ai-comparison-card-original"
          onClick={onOpenOriginal}
        >
          <ComparisonCardHeader
            eyebrow="ORİJİNAL EKRAN"
            title="Kullanıcının yüklediği ekran"
            description="Sorunun bildirildiği işaretsiz ekran görüntüsü."
            icon="◫"
          />

          <span className="ai-comparison-image-stage">
            <img
              src={image.previewUrl}
              alt="Kullanıcının yüklediği ekran görüntüsü"
            />
            <span className="ai-comparison-open-label">Büyüt</span>
          </span>
        </button>

        {hasSolutionImage ? (
          <button
            type="button"
            className="ai-comparison-card ai-comparison-card-solution"
            onClick={onOpenSolution}
          >
            <ComparisonCardHeader
              eyebrow="AI ÇÖZÜM REHBERİ"
              title="İşaretlenmiş çözüm ekranı"
              description={
                markerCount === 1
                  ? "1 hedef alan çözüm adımıyla işaretlendi."
                  : `${markerCount} hedef alan çözüm adımlarıyla işaretlendi.`
              }
              icon="✦"
              badge={`${markerCount} adım`}
            />

            <span className="ai-comparison-image-stage">
              <img
                src={image.solutionPreviewUrl}
                alt="AI tarafından işaretlenmiş çözüm ekranı"
              />
              <span className="ai-comparison-open-label">Büyüt</span>
            </span>
          </button>
        ) : (
          <div className="ai-comparison-card ai-comparison-card-empty">
            <ComparisonCardHeader
              eyebrow="AI ÇÖZÜM REHBERİ"
              title="Görsel yönlendirme bulunamadı"
              description={
                image.solutionPreviewError ||
                "Bu ekranda güvenilir bir tıklama hedefi belirlenmedi."
              }
              icon="—"
            />

            <div className="ai-comparison-empty-state">
              <span aria-hidden="true">◎</span>
              <p>Çözüm adımlarını metin bölümünden uygulayın.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonCardHeader({
  eyebrow,
  title,
  description,
  icon,
  badge = "",
}) {
  return (
    <span className="ai-comparison-card-header">
      <span className="ai-comparison-card-icon">{icon}</span>

      <span className="ai-comparison-card-copy">
        <span className="ai-comparison-card-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      {badge ? <span className="ai-comparison-card-badge">{badge}</span> : null}
    </span>
  );
}

function ImagePreviewModal({ preview, onClose }) {
  const isSolution = preview.mode === "solution";
  const image = preview.image;

  const markers = Array.isArray(image.markers) ? image.markers : [];

  const imageUrl = isSolution ? image.solutionPreviewUrl : image.previewUrl;

  const modalTitle = isSolution
    ? "İşaretlenmiş çözüm ekranı"
    : "Kullanıcının yüklediği ekran";

  return (
    <div
      className="ai-image-modal"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={[
          "ai-image-modal-card",
          isSolution
            ? "ai-image-modal-card-guided"
            : "ai-image-modal-card-original",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="ai-image-modal-header">
          <div>
            <span className="ai-image-modal-kicker">
              {isSolution ? "AI ÇÖZÜM REHBERİ" : "ORİJİNAL EKRAN"}
            </span>
            <strong>{modalTitle}</strong>
          </div>

          <button
            type="button"
            className="ai-image-modal-close"
            onClick={onClose}
            aria-label="Görsel önizlemesini kapat"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div
          className={[
            "ai-image-modal-content",
            isSolution
              ? "ai-image-modal-content-guided"
              : "ai-image-modal-content-original",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isSolution ? (
            <div className="ai-guided-visual">
              <div className="ai-guided-image-stage">
                <img
                  src={imageUrl}
                  alt="AI tarafından işaretlenmiş çözüm ekranı"
                />
              </div>

              <VisualGuidancePanel markers={markers} />
            </div>
          ) : (
            <img src={imageUrl} alt="Kullanıcının yüklediği ekran görüntüsü" />
          )}
        </div>

        <footer className="ai-image-modal-footer">
          <span>{formatFileSize(image.size_bytes)}</span>
          <span>
            {isSolution
              ? markers.length === 1
                ? "1 işaretli yönlendirme"
                : `${markers.length} işaretli yönlendirme`
              : "Orijinal ekran görüntüsü"}
          </span>
        </footer>
      </div>
    </div>
  );
}

function VisualGuidancePanel({ markers }) {
  return (
    <section className="ai-visual-guidance-panel">
      <div className="ai-visual-guidance-heading">
        <span className="ai-visual-guidance-heading-icon" aria-hidden="true">
          ✦
        </span>

        <div>
          <span>GÖRSEL ÜZERİNDEKİ ADIMLAR</span>
          <h3>Numaralı alanları sırayla uygulayın</h3>
        </div>
      </div>

      <ol className="ai-visual-guidance-list">
        {markers.map((marker) => (
          <li key={`${marker.markerKey}-instruction`}>
            <span className="ai-visual-guidance-step">{marker.stepNumber}</span>

            <div>
              <strong>{marker.label}</strong>
              <p>{marker.instruction}</p>
              <small>
                Konum güveni: %{(marker.confidence * 100).toFixed(0)}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function extractSessionVisualGuidance(aiSession) {
  const assistantMessage = Array.isArray(aiSession?.messages)
    ? aiSession.messages.find((message) => message?.sender_type === "assistant")
    : null;

  return extractVisualGuidance(assistantMessage?.content);
}

function extractVisualGuidance(content) {
  if (typeof content !== "string") {
    return EMPTY_VISUAL_GUIDANCE;
  }

  const headingMatch = /görsel\s+yönlendirme\s+json\s*:\s*/i.exec(content);

  if (!headingMatch) {
    return EMPTY_VISUAL_GUIDANCE;
  }

  const contentAfterHeading = content.slice(
    headingMatch.index + headingMatch[0].length,
  );

  const jsonText = readFirstJsonObject(contentAfterHeading);

  if (!jsonText) {
    return EMPTY_VISUAL_GUIDANCE;
  }

  try {
    const parsedPayload = JSON.parse(jsonText);

    const rawMarkers = Array.isArray(parsedPayload?.markers)
      ? parsedPayload.markers
      : [];

    const markers = rawMarkers
      .map((marker, markerIndex) => normalizeVisualMarker(marker, markerIndex))
      .filter(Boolean);

    return {
      version: Number(parsedPayload?.version) || 1,
      coordinateSystem: String(
        parsedPayload?.coordinate_system || "normalized_0_1000",
      ),
      markers,
    };
  } catch (parseError) {
    console.error("Görsel yönlendirme JSON ayrıştırılamadı.", parseError);
    return EMPTY_VISUAL_GUIDANCE;
  }
}

function readFirstJsonObject(value) {
  const text = String(value || "");
  const objectStart = text.indexOf("{");

  if (objectStart < 0) {
    return "";
  }

  let depth = 0;
  let insideString = false;
  let escaped = false;

  for (let index = objectStart; index < text.length; index += 1) {
    const character = text[index];

    if (insideString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        insideString = false;
      }

      continue;
    }

    if (character === '"') {
      insideString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(objectStart, index + 1);
      }
    }
  }

  return "";
}

function normalizeVisualMarker(marker, markerIndex) {
  if (!marker || typeof marker !== "object") {
    return null;
  }

  const imageIndex = toSafeInteger(marker.image_index);
  const stepNumber = toSafeInteger(marker.step_number);

  const xMin = clampCoordinate(marker.x_min);
  const yMin = clampCoordinate(marker.y_min);
  const xMax = clampCoordinate(marker.x_max);
  const yMax = clampCoordinate(marker.y_max);

  const confidence = clampNumber(marker.confidence, 0, 1);

  if (imageIndex <= 0 || stepNumber <= 0 || xMin >= xMax || yMin >= yMax) {
    return null;
  }

  const label = cleanGuidanceText(marker.label, "Tıklanacak alan");
  const instruction = cleanGuidanceText(
    marker.instruction,
    "İşaretli alana tıklayın.",
  );

  return {
    markerKey: [
      imageIndex,
      stepNumber,
      xMin,
      yMin,
      xMax,
      yMax,
      markerIndex,
    ].join("-"),

    imageIndex,
    stepNumber,
    label,
    instruction,
    xMin,
    yMin,
    xMax,
    yMax,
    confidence,
  };
}

function cleanGuidanceText(value, fallback) {
  const normalizedValue = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedValue || fallback;
}

function toSafeInteger(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.trunc(numericValue);
}

function clampCoordinate(value) {
  return Math.round(clampNumber(value, 0, 1000));
}

function clampNumber(value, minimum, maximum) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return minimum;
  }

  return Math.min(Math.max(numericValue, minimum), maximum);
}

function formatFileSize(sizeBytes) {
  const numericSize = Number(sizeBytes);

  if (!Number.isFinite(numericSize) || numericSize <= 0) {
    return "0 KB";
  }

  if (numericSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(numericSize / 1024))} KB`;
  }

  return `${(numericSize / (1024 * 1024)).toFixed(2)} MB`;
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

export default AISessionImageGallery;
