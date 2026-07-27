import { useEffect, useState } from "react";

import api from "../api/api";
import Icon from "./Icon";

import "../styles/ai-session-images.css";
import "../styles/ai-visual-guidance.css";

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
              `/ai/sessions/${normalizedSessionId}` +
                `/attachments/${attachment.attachment_id}` +
                "/content",
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

  const markerCount = images.reduce(
    (total, image) =>
      total + (Array.isArray(image.markers) ? image.markers.length : 0),
    0,
  );

  if (loading) {
    return (
      <section
        className={[
          "ai-session-images",

          compact ? "ai-session-images-compact" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-busy="true"
      >
        <div className="ai-session-images-heading">
          <div>
            <span className="ai-session-images-kicker">GÖRSEL ANALİZİ</span>

            <h3>Eklenen görseller</h3>
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

            <h3>Sorun ve AI çözüm görselleri</h3>

            <p>
              Orijinal ekran görüntüsü ile işaretlenmiş çözüm görselini
              karşılaştırın.
            </p>
          </div>

          <div className="ai-session-images-summary">
            {images.length > 0 ? (
              <span className="ai-session-images-count">
                {images.length} görsel
              </span>
            ) : null}

            {markerCount > 0 ? (
              <span className="ai-session-guidance-count">
                {markerCount} yönlendirme
              </span>
            ) : null}
          </div>
        </div>

        {error ? <p className="ai-session-images-error">{error}</p> : null}

        {images.length > 0 ? (
          <div className="ai-image-comparison-list">
            {images.map((image) => (
              <ImageComparison
                image={image}
                key={image.attachment_id}
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

function ImageComparison({ image, onOpenOriginal, onOpenSolution }) {
  const markerCount = Array.isArray(image.markers) ? image.markers.length : 0;

  const hasSolutionImage = Boolean(image.solutionPreviewUrl);

  return (
    <article className="ai-image-comparison">
      <header className="ai-image-comparison-header">
        <div>
          <span>GÖRSEL {image.imageIndex}</span>

          <strong title={image.original_filename}>
            {image.original_filename}
          </strong>
        </div>

        <small>{formatFileSize(image.size_bytes)}</small>
      </header>

      <div className="ai-image-comparison-grid">
        <button
          type="button"
          className={["ai-comparison-card", "ai-comparison-card-original"].join(
            " ",
          )}
          onClick={onOpenOriginal}
        >
          <ComparisonCardHeader
            eyebrow="ORİJİNAL GÖRSEL"
            title="Kullanıcının yüklediği ekran"
            description={"Herhangi bir işaretleme " + "uygulanmamış görüntü."}
            icon="◫"
          />

          <span className="ai-comparison-image-stage">
            <img src={image.previewUrl} alt={image.original_filename} />

            <span className="ai-comparison-open-label">Orijinali büyüt</span>
          </span>
        </button>

        {hasSolutionImage ? (
          <button
            type="button"
            className={[
              "ai-comparison-card",
              "ai-comparison-card-solution",
            ].join(" ")}
            onClick={onOpenSolution}
          >
            <ComparisonCardHeader
              eyebrow="AI ÇÖZÜM GÖRSELİ"
              title="İşaretlenmiş çözüm ekranı"
              description={
                `${markerCount} hedef alan ` + "görsel üzerine işlendi."
              }
              icon="✦"
              badge={`${markerCount} adım`}
            />

            <span className="ai-comparison-image-stage">
              <img
                src={image.solutionPreviewUrl}
                alt={`${image.original_filename} ` + "AI çözüm görseli"}
              />

              <span className="ai-comparison-open-label">
                Çözüm görselini aç
              </span>
            </span>
          </button>
        ) : (
          <div
            className={["ai-comparison-card", "ai-comparison-card-empty"].join(
              " ",
            )}
          >
            <ComparisonCardHeader
              eyebrow="AI ÇÖZÜM GÖRSELİ"
              title="Görsel yönlendirme bulunamadı"
              description={
                image.solutionPreviewError ||
                "Bu görselde güvenilir bir " + "tıklama hedefi belirlenmedi."
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
    </article>
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

  return (
    <div
      className="ai-image-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isSolution ? "AI çözüm görseli" : image.original_filename}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={[
          "ai-image-modal-card",

          isSolution ? "ai-image-modal-card-guided" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="ai-image-modal-header">
          <div>
            <span className="ai-image-modal-kicker">
              {isSolution ? "AI ÇÖZÜM GÖRSELİ" : "ORİJİNAL GÖRSEL"}
            </span>

            <strong title={image.original_filename}>
              {image.original_filename}
            </strong>
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

            isSolution ? "ai-image-modal-content-guided" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isSolution ? (
            <div className="ai-guided-visual">
              <div className="ai-guided-image-stage">
                <img
                  src={imageUrl}
                  alt={`${image.original_filename} ` + "AI çözüm görseli"}
                />
              </div>

              <VisualGuidancePanel markers={markers} />
            </div>
          ) : (
            <img src={imageUrl} alt={image.original_filename} />
          )}
        </div>

        <footer className="ai-image-modal-footer">
          <span>{formatFileSize(image.size_bytes)}</span>

          <span>
            {isSolution
              ? `${markers.length} ` + "işaretli yönlendirme"
              : image.content_type}
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

async function createGuidedImageBlob(imageBlob, markers) {
  const decodedImage = await decodeImageBlob(imageBlob);

  try {
    const canvas = document.createElement("canvas");

    canvas.width = decodedImage.width;

    canvas.height = decodedImage.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas bağlamı oluşturulamadı.");
    }

    context.drawImage(decodedImage.source, 0, 0, canvas.width, canvas.height);

    markers.forEach((marker) => {
      drawVisualMarker(context, canvas.width, canvas.height, marker);
    });

    return await canvasToBlob(canvas);
  } finally {
    decodedImage.close();
  }
}

async function decodeImageBlob(imageBlob) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(imageBlob);

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,

      close() {
        bitmap.close();
      },
    };
  }

  const temporaryUrl = URL.createObjectURL(imageBlob);

  try {
    const image = await loadHtmlImage(temporaryUrl);

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,

      close() {},
    };
  } finally {
    URL.revokeObjectURL(temporaryUrl);
  }
}

function loadHtmlImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Görsel canvas için yüklenemedi."));
    };

    image.src = source;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Çözüm görseli PNG olarak oluşturulamadı."));

          return;
        }

        resolve(blob);
      },
      "image/png",
      0.96,
    );
  });
}

function drawVisualMarker(context, canvasWidth, canvasHeight, marker) {
  const targetX = (marker.xMin / 1000) * canvasWidth;

  const targetY = (marker.yMin / 1000) * canvasHeight;

  const targetWidth = ((marker.xMax - marker.xMin) / 1000) * canvasWidth;

  const targetHeight = ((marker.yMax - marker.yMin) / 1000) * canvasHeight;

  const scaleReference = Math.min(canvasWidth, canvasHeight);

  const strokeWidth = clampNumber(scaleReference * 0.007, 3, 10);

  const cornerRadius = clampNumber(scaleReference * 0.018, 8, 24);

  const markerRadius = clampNumber(scaleReference * 0.035, 18, 42);

  const paddedX = Math.max(0, targetX - strokeWidth);

  const paddedY = Math.max(0, targetY - strokeWidth);

  const paddedWidth = Math.min(
    canvasWidth - paddedX,
    targetWidth + strokeWidth * 2,
  );

  const paddedHeight = Math.min(
    canvasHeight - paddedY,
    targetHeight + strokeWidth * 2,
  );

  context.save();

  context.fillStyle = "rgba(244, 63, 94, 0.10)";

  context.strokeStyle = "#f43f5e";

  context.lineWidth = strokeWidth;

  context.shadowColor = "rgba(244, 63, 94, 0.65)";

  context.shadowBlur = strokeWidth * 3;

  drawRoundedRectangle(
    context,
    paddedX,
    paddedY,
    paddedWidth,
    paddedHeight,
    cornerRadius,
  );

  context.fill();
  context.stroke();

  context.restore();

  const markerCenterX = clampNumber(
    paddedX,
    markerRadius + 4,
    canvasWidth - markerRadius - 4,
  );

  const markerCenterY = clampNumber(
    paddedY,
    markerRadius + 4,
    canvasHeight - markerRadius - 4,
  );

  drawMarkerNumber(
    context,
    markerCenterX,
    markerCenterY,
    markerRadius,
    marker.stepNumber,
  );

  drawMarkerLabel(
    context,
    canvasWidth,
    canvasHeight,
    paddedX,
    paddedY,
    paddedWidth,
    paddedHeight,
    marker,
    strokeWidth,
  );
}

function drawMarkerNumber(context, centerX, centerY, radius, stepNumber) {
  context.save();

  context.beginPath();

  context.arc(centerX, centerY, radius, 0, Math.PI * 2);

  context.fillStyle = "#f43f5e";

  context.shadowColor = "rgba(159, 18, 57, 0.55)";

  context.shadowBlur = radius * 0.75;

  context.fill();

  context.lineWidth = Math.max(2, radius * 0.13);

  context.strokeStyle = "#ffffff";

  context.stroke();

  context.shadowBlur = 0;

  context.fillStyle = "#ffffff";

  context.font = `800 ${Math.round(radius * 0.95)}px Arial, sans-serif`;

  context.textAlign = "center";

  context.textBaseline = "middle";

  context.fillText(String(stepNumber), centerX, centerY + 1);

  context.restore();
}

function drawMarkerLabel(
  context,
  canvasWidth,
  canvasHeight,
  targetX,
  targetY,
  targetWidth,
  targetHeight,
  marker,
  strokeWidth,
) {
  const fontSize = clampNumber(
    Math.min(canvasWidth, canvasHeight) * 0.025,
    15,
    30,
  );

  const titleFontSize = Math.max(11, fontSize * 0.65);

  const horizontalPadding = fontSize * 0.72;

  const verticalPadding = fontSize * 0.55;

  context.save();

  context.font = `700 ${fontSize}px Arial, sans-serif`;

  const labelText = truncateCanvasText(
    context,
    marker.label,
    canvasWidth * 0.28,
  );

  const labelWidth =
    Math.max(context.measureText(labelText).width, fontSize * 4.2) +
    horizontalPadding * 2;

  const labelHeight = fontSize + titleFontSize + verticalPadding * 2.5;

  const placeOnLeft = targetX + targetWidth + labelWidth + 30 > canvasWidth;

  const proposedX = placeOnLeft
    ? targetX - labelWidth - strokeWidth * 3
    : targetX + targetWidth + strokeWidth * 3;

  const labelX = clampNumber(proposedX, 8, canvasWidth - labelWidth - 8);

  const labelY = clampNumber(
    targetY + targetHeight / 2 - labelHeight / 2,
    8,
    canvasHeight - labelHeight - 8,
  );

  const connectorStartX = placeOnLeft ? targetX : targetX + targetWidth;

  const connectorEndX = placeOnLeft ? labelX + labelWidth : labelX;

  const connectorY = targetY + targetHeight / 2;

  context.strokeStyle = "#f43f5e";

  context.lineWidth = Math.max(2, strokeWidth * 0.55);

  context.beginPath();

  context.moveTo(connectorStartX, connectorY);

  context.lineTo(connectorEndX, connectorY);

  context.stroke();

  context.shadowColor = "rgba(2, 6, 23, 0.45)";

  context.shadowBlur = fontSize * 0.7;

  context.fillStyle = "rgba(15, 23, 42, 0.95)";

  drawRoundedRectangle(
    context,
    labelX,
    labelY,
    labelWidth,
    labelHeight,
    fontSize * 0.45,
  );

  context.fill();

  context.shadowBlur = 0;

  context.fillStyle = "#fda4af";

  context.font = `800 ${titleFontSize}px Arial, sans-serif`;

  context.textAlign = "left";

  context.textBaseline = "top";

  context.fillText(
    `ADIM ${marker.stepNumber}`,
    labelX + horizontalPadding,
    labelY + verticalPadding * 0.65,
  );

  context.fillStyle = "#ffffff";

  context.font = `700 ${fontSize}px Arial, sans-serif`;

  context.fillText(
    labelText,
    labelX + horizontalPadding,
    labelY + titleFontSize + verticalPadding * 1.05,
  );

  context.restore();
}

function truncateCanvasText(context, value, maximumWidth) {
  const text = cleanGuidanceText(value, "Tıklanacak alan");

  if (context.measureText(text).width <= maximumWidth) {
    return text;
  }

  let shortenedText = text;

  while (
    shortenedText.length > 3 &&
    context.measureText(`${shortenedText}…`).width > maximumWidth
  ) {
    shortenedText = shortenedText.slice(0, -1);
  }

  return `${shortenedText.trim()}…`;
}

function drawRoundedRectangle(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();

  context.moveTo(x + safeRadius, y);

  context.lineTo(x + width - safeRadius, y);

  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);

  context.lineTo(x + width, y + height - safeRadius);

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );

  context.lineTo(x + safeRadius, y + height);

  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);

  context.lineTo(x, y + safeRadius);

  context.quadraticCurveTo(x, y, x + safeRadius, y);

  context.closePath();
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
