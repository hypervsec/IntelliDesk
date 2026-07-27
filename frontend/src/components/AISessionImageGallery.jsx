import { useEffect, useState } from "react";

import api from "../api/api";
import Icon from "./Icon";

import "../styles/ai-session-images.css";

function AISessionImageGallery({ sessionId, compact = false }) {
  const [images, setImages] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [activeImage, setActiveImage] = useState(null);

  useEffect(() => {
    const normalizedSessionId = Number(sessionId);

    if (
      !Number.isSafeInteger(normalizedSessionId) ||
      normalizedSessionId <= 0
    ) {
      setImages([]);
      setError("");
      setLoading(false);
      setActiveImage(null);

      return undefined;
    }

    let cancelled = false;

    const createdObjectUrls = [];

    async function loadImages() {
      try {
        setLoading(true);
        setError("");
        setImages([]);
        setActiveImage(null);

        const listResponse = await api.get(
          `/ai/sessions/${normalizedSessionId}/attachments`,
        );

        const attachments = Array.isArray(listResponse.data)
          ? listResponse.data
          : [];

        if (cancelled || attachments.length === 0) {
          return;
        }

        const imageResults = await Promise.allSettled(
          attachments.map(async (attachment) => {
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

            return {
              ...attachment,
              previewUrl,
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
    if (!activeImage) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeImage]);

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
          compact ? "ai-session-images-compact" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="ai-session-images-heading">
          <div>
            <span className="ai-session-images-kicker">GÖRSEL ANALİZİ</span>

            <h3>AI tarafından değerlendirilen görseller</h3>

            <p>
              Çözüm hazırlanırken bu görseller sorun açıklamasıyla birlikte
              incelendi.
            </p>
          </div>

          {images.length > 0 ? (
            <span className="ai-session-images-count">
              {images.length} görsel
            </span>
          ) : null}
        </div>

        {error ? <p className="ai-session-images-error">{error}</p> : null}

        {images.length > 0 ? (
          <div className="ai-session-images-grid">
            {images.map((image) => (
              <button
                type="button"
                className="ai-session-image-card"
                key={image.attachment_id}
                onClick={() => {
                  setActiveImage(image);
                }}
                aria-label={`${image.original_filename} görselini büyüt`}
              >
                <span className="ai-session-image-preview">
                  <img src={image.previewUrl} alt={image.original_filename} />

                  <span className="ai-session-image-overlay">
                    <span>Büyüt</span>
                  </span>
                </span>

                <span className="ai-session-image-info">
                  <strong title={image.original_filename}>
                    {image.original_filename}
                  </strong>

                  <small>{formatFileSize(image.size_bytes)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {activeImage ? (
        <div
          className="ai-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.original_filename}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveImage(null);
            }
          }}
        >
          <div className="ai-image-modal-card">
            <header className="ai-image-modal-header">
              <div>
                <span className="ai-image-modal-kicker">YÜKLENEN GÖRSEL</span>

                <strong title={activeImage.original_filename}>
                  {activeImage.original_filename}
                </strong>
              </div>

              <button
                type="button"
                className="ai-image-modal-close"
                onClick={() => {
                  setActiveImage(null);
                }}
                aria-label="Görsel önizlemesini kapat"
              >
                <Icon name="close" size={20} />
              </button>
            </header>

            <div className="ai-image-modal-content">
              <img
                src={activeImage.previewUrl}
                alt={activeImage.original_filename}
              />
            </div>

            <footer className="ai-image-modal-footer">
              <span>{formatFileSize(activeImage.size_bytes)}</span>

              <span>{activeImage.content_type}</span>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
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
