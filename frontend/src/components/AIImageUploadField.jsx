import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import Icon from "./Icon";

import "../styles/tickets/ticket-attachments.css";

const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE_MB = 10;

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

const AIImageUploadField = forwardRef(function AIImageUploadField(
  { disabled = false, onValidationError },
  ref,
) {
  const inputRef = useRef(null);
  const selectedImagesRef = useRef([]);

  const [selectedImages, setSelectedImages] = useState([]);

  const [isDragging, setIsDragging] = useState(false);

  const [validationError, setValidationError] = useState("");

  const clearValidationError = useCallback(() => {
    setValidationError("");

    if (typeof onValidationError === "function") {
      onValidationError("");
    }
  }, [onValidationError]);

  const clearSelectedImages = useCallback(() => {
    const currentImages = selectedImagesRef.current;

    currentImages.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
    });

    selectedImagesRef.current = [];
    setSelectedImages([]);
    setIsDragging(false);
    clearValidationError();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [clearValidationError]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });

      selectedImagesRef.current = [];
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getFiles() {
        return selectedImagesRef.current.map((image) => image.file);
      },

      clear() {
        clearSelectedImages();
      },

      getCount() {
        return selectedImagesRef.current.length;
      },
    }),
    [clearSelectedImages],
  );

  function reportValidationError(message) {
    setValidationError(message);

    if (typeof onValidationError === "function") {
      onValidationError(message);
    }
  }

  function addFiles(fileList) {
    if (disabled) {
      return;
    }

    const incomingFiles = Array.from(fileList || []);

    if (incomingFiles.length === 0) {
      return;
    }

    const currentImages = selectedImagesRef.current;

    if (currentImages.length + incomingFiles.length > MAX_IMAGE_COUNT) {
      reportValidationError(
        `En fazla ${MAX_IMAGE_COUNT} görsel seçebilirsiniz.`,
      );

      return;
    }

    const knownFileKeys = new Set(
      currentImages.map((image) => getFileKey(image.file)),
    );

    for (const file of incomingFiles) {
      const fileError = validateImageFile(file);

      if (fileError) {
        reportValidationError(fileError);

        return;
      }

      const fileKey = getFileKey(file);

      if (knownFileKeys.has(fileKey)) {
        reportValidationError(`${file.name} zaten seçildi.`);

        return;
      }

      knownFileKeys.add(fileKey);
    }

    const newImages = incomingFiles.map((file) => ({
      id: createImageId(file),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    const nextImages = [...currentImages, ...newImages];

    /*
     * Ref, React render işlemini beklemeden
     * hemen güncellenir. Kullanıcı doğrudan
     * gönder butonuna bassa bile getFiles()
     * güncel dosyaları döndürür.
     */
    selectedImagesRef.current = nextImages;

    setSelectedImages(nextImages);
    clearValidationError();
  }

  function removeImage(imageId) {
    if (disabled) {
      return;
    }

    const currentImages = selectedImagesRef.current;

    const removedImage = currentImages.find((image) => image.id === imageId);

    if (removedImage) {
      URL.revokeObjectURL(removedImage.previewUrl);
    }

    const nextImages = currentImages.filter((image) => image.id !== imageId);

    selectedImagesRef.current = nextImages;

    setSelectedImages(nextImages);
    clearValidationError();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleInputChange(event) {
    addFiles(event.target.files);

    event.target.value = "";
  }

  function handleDragEnter(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    }
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    if (disabled) {
      return;
    }

    addFiles(event.dataTransfer?.files);
  }

  const remainingCount = MAX_IMAGE_COUNT - selectedImages.length;

  return (
    <section
      className={["ticket-attachments-section", "ai-image-upload-section"].join(
        " ",
      )}
    >
      <div className="ticket-attachments-heading">
        <div>
          <span className="ticket-attachments-kicker">İSTEĞE BAĞLI</span>

          <h3>Hata ekranı veya cihaz görseli</h3>

          <p>
            AI analizini desteklemek için en fazla {MAX_IMAGE_COUNT} görsel
            ekleyebilirsiniz.
          </p>
        </div>

        <span className="ticket-attachments-count">
          {selectedImages.length}/{MAX_IMAGE_COUNT}
        </span>
      </div>

      <label
        className={[
          "ticket-file-selector",
          "ai-image-dropzone",

          isDragging ? "ai-image-dropzone-active" : "",

          disabled ? "ai-image-dropzone-disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={IMAGE_ACCEPT}
          multiple
          onChange={handleInputChange}
          disabled={disabled || remainingCount <= 0}
        />

        <span className="ticket-file-selector-icon">
          <Icon name="plus" size={18} />
        </span>

        <span className="ticket-file-selector-text">
          <strong>
            {remainingCount > 0
              ? "Görsel seçin veya buraya sürükleyin"
              : "Görsel sınırına ulaşıldı"}
          </strong>

          <small>
            PNG, JPG, JPEG veya WEBP
            {" · "}
            Görsel başına en fazla {MAX_IMAGE_SIZE_MB} MB
          </small>
        </span>
      </label>

      {validationError ? (
        <p className={["error-message", "ticket-attachment-message"].join(" ")}>
          {validationError}
        </p>
      ) : null}

      {selectedImages.length > 0 ? (
        <div
          className={["ticket-attachments-list", "ai-image-preview-list"].join(
            " ",
          )}
        >
          {selectedImages.map((image) => (
            <article className="ticket-attachment-card" key={image.id}>
              <img
                className="ticket-attachment-type"
                src={image.previewUrl}
                width="38"
                height="38"
                alt={`${image.file.name} önizlemesi`}
              />

              <div className="ticket-attachment-info">
                <strong title={image.file.name}>{image.file.name}</strong>

                <span>{formatFileSize(image.file.size)}</span>

                <small>AI çözümü oluşturulmadan önce yüklenecek</small>
              </div>

              <div className="ticket-attachment-actions">
                <button
                  type="button"
                  className={[
                    "secondary-button",
                    "ticket-attachment-delete-button",
                  ].join(" ")}
                  onClick={() => {
                    removeImage(image.id);
                  }}
                  disabled={disabled}
                  aria-label={`${image.file.name} görselini kaldır`}
                >
                  <Icon name="close" size={15} />
                  Kaldır
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
});

function validateImageFile(file) {
  if (!(file instanceof File)) {
    return "Geçerli bir görsel " + "seçilemedi.";
  }

  if (file.size <= 0) {
    return `${file.name || "Görsel"} ` + "boş olamaz.";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `${file.name} en fazla ` + `${MAX_IMAGE_SIZE_MB} MB ` + "olabilir.";
  }

  const extension = getFileExtension(file.name);

  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return `${file.name} desteklenen ` + "bir görsel türü değil.";
  }

  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `${file.name} desteklenen ` + "bir görsel türü değil.";
  }

  return "";
}

function getFileExtension(filename) {
  const normalizedName = String(filename || "")
    .trim()
    .toLowerCase();

  const lastDotIndex = normalizedName.lastIndexOf(".");

  if (lastDotIndex < 0) {
    return "";
  }

  return normalizedName.slice(lastDotIndex);
}

function getFileKey(file) {
  return [file.name, file.size, file.lastModified].join("-");
}

function createImageId(file) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-` + Math.random().toString(16).slice(2);

  return `${getFileKey(file)}-` + randomPart;
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

export default AIImageUploadField;
