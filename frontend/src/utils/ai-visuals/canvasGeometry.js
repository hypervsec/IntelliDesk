export function createDisplayMarkerGeometry(marker, imageRect) {
  const targetX =
    imageRect.x +
    (marker.xMin / 1000) * imageRect.width;

  const targetY =
    imageRect.y +
    (marker.yMin / 1000) * imageRect.height;

  const targetWidth =
    ((marker.xMax - marker.xMin) / 1000) *
    imageRect.width;

  const targetHeight =
    ((marker.yMax - marker.yMin) / 1000) *
    imageRect.height;

  const padding = clampNumber(
    Math.min(imageRect.width, imageRect.height) * 0.014,
    6,
    18,
  );

  const x = clampNumber(
    targetX - padding,
    imageRect.x,
    imageRect.x + imageRect.width,
  );

  const y = clampNumber(
    targetY - padding,
    imageRect.y,
    imageRect.y + imageRect.height,
  );

  const width = clampNumber(
    targetWidth + padding * 2,
    1,
    imageRect.x + imageRect.width - x,
  );

  const height = clampNumber(
    targetHeight + padding * 2,
    1,
    imageRect.y + imageRect.height - y,
  );

  return {
    marker,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

export function createTargetCropRect(
  sourceWidth,
  sourceHeight,
  marker,
  targetAspectRatio,
) {
  const targetX =
    (marker.xMin / 1000) * sourceWidth;

  const targetY =
    (marker.yMin / 1000) * sourceHeight;

  const targetWidth =
    ((marker.xMax - marker.xMin) / 1000) *
    sourceWidth;

  const targetHeight =
    ((marker.yMax - marker.yMin) / 1000) *
    sourceHeight;

  const centerX = targetX + targetWidth / 2;
  const centerY = targetY + targetHeight / 2;

  let cropWidth = Math.max(
    targetWidth * 5.4,
    sourceWidth * 0.27,
  );

  let cropHeight = Math.max(
    targetHeight * 5.4,
    sourceHeight * 0.24,
  );

  const safeAspectRatio = Math.max(
    0.1,
    Number(targetAspectRatio) || 1,
  );

  const cropAspectRatio =
    cropWidth / cropHeight;

  if (cropAspectRatio > safeAspectRatio) {
    cropHeight = cropWidth / safeAspectRatio;
  } else {
    cropWidth = cropHeight * safeAspectRatio;
  }

  cropWidth = Math.min(
    cropWidth,
    sourceWidth,
  );

  cropHeight = Math.min(
    cropHeight,
    sourceHeight,
  );

  return {
    x: clampNumber(
      centerX - cropWidth / 2,
      0,
      sourceWidth - cropWidth,
    ),

    y: clampNumber(
      centerY - cropHeight / 2,
      0,
      sourceHeight - cropHeight,
    ),

    width: cropWidth,
    height: cropHeight,
  };
}

export function mapTargetToZoomRect(
  marker,
  cropRect,
  zoomRect,
  sourceWidth,
  sourceHeight,
) {
  const targetX =
    (marker.xMin / 1000) * sourceWidth;

  const targetY =
    (marker.yMin / 1000) * sourceHeight;

  const targetWidth =
    ((marker.xMax - marker.xMin) / 1000) *
    sourceWidth;

  const targetHeight =
    ((marker.yMax - marker.yMin) / 1000) *
    sourceHeight;

  const scaleX =
    zoomRect.width / cropRect.width;

  const scaleY =
    zoomRect.height / cropRect.height;

  const padding = clampNumber(
    Math.min(zoomRect.width, zoomRect.height) * 0.025,
    5,
    15,
  );

  const rawX =
    zoomRect.x +
    (targetX - cropRect.x) * scaleX -
    padding;

  const rawY =
    zoomRect.y +
    (targetY - cropRect.y) * scaleY -
    padding;

  const x = clampNumber(
    rawX,
    zoomRect.x,
    zoomRect.x + zoomRect.width - 1,
  );

  const y = clampNumber(
    rawY,
    zoomRect.y,
    zoomRect.y + zoomRect.height - 1,
  );

  const width = clampNumber(
    targetWidth * scaleX + padding * 2,
    1,
    zoomRect.x + zoomRect.width - x,
  );

  const height = clampNumber(
    targetHeight * scaleY + padding * 2,
    1,
    zoomRect.y + zoomRect.height - y,
  );

  return {
    x,
    y,
    width,
    height,
  };
}

export function clampNumber(value, minimum, maximum) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return minimum;
  }

  return Math.min(
    Math.max(numericValue, minimum),
    maximum,
  );
}