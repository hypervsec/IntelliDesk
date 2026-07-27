export async function decodeImageBlob(imageBlob) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(
      imageBlob,
    );

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,

      close() {
        bitmap.close();
      },
    };
  }

  const temporaryUrl =
    URL.createObjectURL(imageBlob);

  try {
    const image = await loadHtmlImage(
      temporaryUrl,
    );

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

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Çözüm görseli PNG olarak oluşturulamadı.",
            ),
          );

          return;
        }

        resolve(blob);
      },
      "image/png",
      0.96,
    );
  });
}

function loadHtmlImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(
        new Error(
          "Görsel canvas için yüklenemedi.",
        ),
      );
    };

    image.src = source;
  });
}