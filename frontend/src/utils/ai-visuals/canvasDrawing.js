import {
  clampNumber,
  createDisplayMarkerGeometry,
  createTargetCropRect,
  mapTargetToZoomRect,
} from "./canvasGeometry";

export function drawSolutionBoardBackground(
  context,
  layout,
) {
  const backgroundGradient =
    context.createLinearGradient(
      0,
      0,
      layout.boardWidth,
      layout.boardHeight,
    );

  backgroundGradient.addColorStop(
    0,
    "#071126",
  );

  backgroundGradient.addColorStop(
    0.52,
    "#0d1b35",
  );

  backgroundGradient.addColorStop(
    1,
    "#111c38",
  );

  context.fillStyle = backgroundGradient;

  context.fillRect(
    0,
    0,
    layout.boardWidth,
    layout.boardHeight,
  );

  const glowGradient =
    context.createRadialGradient(
      layout.boardWidth * 0.76,
      layout.boardHeight * 0.17,
      0,
      layout.boardWidth * 0.76,
      layout.boardHeight * 0.17,
      layout.boardWidth * 0.52,
    );

  glowGradient.addColorStop(
    0,
    "rgba(59, 130, 246, 0.20)",
  );

  glowGradient.addColorStop(
    0.45,
    "rgba(79, 70, 229, 0.08)",
  );

  glowGradient.addColorStop(
    1,
    "rgba(15, 23, 42, 0)",
  );

  context.fillStyle = glowGradient;

  context.fillRect(
    0,
    0,
    layout.boardWidth,
    layout.boardHeight,
  );
}

export function drawSolutionBoardHeader(
  context,
  layout,
  markers,
) {
  const scaleReference =
    layout.boardWidth;

  const kickerFontSize = clampNumber(
    scaleReference * 0.012,
    16,
    25,
  );

  const titleFontSize = clampNumber(
    scaleReference * 0.026,
    34,
    58,
  );

  const descriptionFontSize = clampNumber(
    scaleReference * 0.013,
    18,
    29,
  );

  const startX = layout.outerPadding;

  const startY =
    layout.outerPadding * 0.72;

  const pillWidth = clampNumber(
    scaleReference * 0.16,
    230,
    355,
  );

  const pillHeight = clampNumber(
    scaleReference * 0.032,
    44,
    66,
  );

  context.save();

  context.fillStyle =
    "rgba(59, 130, 246, 0.14)";

  context.strokeStyle =
    "rgba(96, 165, 250, 0.55)";

  context.lineWidth = Math.max(
    2,
    scaleReference * 0.0014,
  );

  drawRoundedRectangle(
    context,
    startX,
    startY,
    pillWidth,
    pillHeight,
    pillHeight / 2,
  );

  context.fill();
  context.stroke();

  context.fillStyle = "#93c5fd";

  context.font =
    `800 ${kickerFontSize}px Arial, sans-serif`;

  context.textAlign = "left";
  context.textBaseline = "middle";

  context.fillText(
    "✦  AI ÇÖZÜM REHBERİ",
    startX + pillHeight * 0.36,
    startY + pillHeight / 2,
  );

  const titleY =
    startY +
    pillHeight +
    layout.outerPadding * 0.22;

  context.fillStyle = "#f8fafc";

  context.font =
    `800 ${titleFontSize}px Arial, sans-serif`;

  context.textBaseline = "top";

  context.fillText(
    markers.length === 1
      ? "Sorunun çözümünde uygulanacak adım"
      : "Sorunun çözümünde uygulanacak adımlar",
    startX,
    titleY,
  );

  context.fillStyle = "#94a3b8";

  context.font =
    `500 ${descriptionFontSize}px Arial, sans-serif`;

  context.fillText(
    `${markers.length} hedef alan • Görsel ve açıklamalı yönlendirme`,
    startX,
    titleY + titleFontSize * 1.2,
  );

  context.restore();
}

export function drawSourceImagePanel(
  context,
  source,
  layout,
  markers,
) {
  const panel = layout.sourcePanel;
  const imageRect = layout.imageRect;
  const scaleReference = layout.boardWidth;

  const panelRadius = clampNumber(
    scaleReference * 0.014,
    18,
    34,
  );

  context.save();

  context.shadowColor =
    "rgba(0, 0, 0, 0.38)";

  context.shadowBlur =
    scaleReference * 0.018;

  context.fillStyle =
    "rgba(15, 28, 54, 0.94)";

  drawRoundedRectangle(
    context,
    panel.x,
    panel.y,
    panel.width,
    panel.height,
    panelRadius,
  );

  context.fill();

  context.shadowBlur = 0;

  context.strokeStyle =
    "rgba(100, 116, 139, 0.34)";

  context.lineWidth = Math.max(
    2,
    scaleReference * 0.0012,
  );

  context.stroke();

  context.fillStyle = "#60a5fa";

  context.font =
    `800 ${clampNumber(
      scaleReference * 0.011,
      15,
      23,
    )}px Arial, sans-serif`;

  context.textAlign = "left";
  context.textBaseline = "middle";

  context.fillText(
    "ORİJİNAL EKRAN VE TESPİT EDİLEN HEDEFLER",
    panel.x + layout.previewInnerPadding,
    panel.y + layout.previewHeaderHeight / 2,
  );

  context.restore();

  drawRoundedImage(
    context,
    source,
    imageRect,
    clampNumber(
      scaleReference * 0.009,
      12,
      22,
    ),
  );

  const geometries = markers.map(
    (marker) =>
      createDisplayMarkerGeometry(
        marker,
        imageRect,
      ),
  );

  drawSourceImageFocusOverlay(
    context,
    source,
    imageRect,
    geometries,
  );

  geometries.forEach((geometry) => {
    drawSourceTarget(
      context,
      geometry,
      layout,
    );
  });

  return geometries;
}

export function drawBoardConnector(
  context,
  geometry,
  cardArea,
  connectorIndex,
) {
  const startX =
    geometry.x + geometry.width;

  const startY = geometry.centerY;

  const endX = cardArea.x;

  const endY =
    cardArea.y +
    Math.min(
      cardArea.height * 0.32,
      150,
    );

  const controlOffset = Math.max(
    50,
    (endX - startX) * 0.44,
  );

  context.save();

  context.strokeStyle =
    connectorIndex % 2 === 0
      ? "rgba(34, 211, 238, 0.72)"
      : "rgba(129, 140, 248, 0.72)";

  context.lineWidth = 4;

  context.setLineDash([10, 8]);
  context.lineCap = "round";

  context.beginPath();

  context.moveTo(startX, startY);

  context.bezierCurveTo(
    startX + controlOffset,
    startY,
    endX - controlOffset,
    endY,
    endX,
    endY,
  );

  context.stroke();

  context.setLineDash([]);

  drawArrowHead(
    context,
    endX,
    endY,
    0,
    15,
  );

  context.restore();
}

export function drawZoomStepCard(
  context,
  source,
  sourceWidth,
  sourceHeight,
  marker,
  cardArea,
  layout,
) {
  const scaleReference = layout.boardWidth;

  const cardRadius = clampNumber(
    scaleReference * 0.014,
    18,
    34,
  );

  const cardPadding = clampNumber(
    scaleReference * 0.013,
    18,
    30,
  );

  context.save();

  context.shadowColor =
    "rgba(0, 0, 0, 0.38)";

  context.shadowBlur =
    scaleReference * 0.015;

  const cardGradient =
    context.createLinearGradient(
      cardArea.x,
      cardArea.y,
      cardArea.x + cardArea.width,
      cardArea.y + cardArea.height,
    );

  cardGradient.addColorStop(
    0,
    "rgba(24, 42, 78, 0.98)",
  );

  cardGradient.addColorStop(
    1,
    "rgba(16, 30, 59, 0.98)",
  );

  context.fillStyle = cardGradient;

  drawRoundedRectangle(
    context,
    cardArea.x,
    cardArea.y,
    cardArea.width,
    cardArea.height,
    cardRadius,
  );

  context.fill();

  context.shadowBlur = 0;

  context.strokeStyle =
    "rgba(96, 165, 250, 0.38)";

  context.lineWidth = 2;
  context.stroke();

  context.restore();

  const headerHeight = clampNumber(
    cardArea.height * 0.16,
    62,
    92,
  );

  const badgeRadius = clampNumber(
    headerHeight * 0.34,
    19,
    31,
  );

  drawStepNumberBadge(
    context,
    cardArea.x +
      cardPadding +
      badgeRadius,

    cardArea.y +
      headerHeight / 2,

    badgeRadius,
    marker.stepNumber,
  );

  const headerTextX =
    cardArea.x +
    cardPadding +
    badgeRadius * 2 +
    cardPadding * 0.72;

  const stepFontSize = clampNumber(
    scaleReference * 0.009,
    13,
    20,
  );

  const titleFontSize = clampNumber(
    scaleReference * 0.016,
    21,
    34,
  );

  context.save();

  context.textAlign = "left";
  context.textBaseline = "top";

  context.fillStyle = "#67e8f9";

  context.font =
    `800 ${stepFontSize}px Arial, sans-serif`;

  context.fillText(
    `ADIM ${marker.stepNumber}`,
    headerTextX,
    cardArea.y + cardPadding * 0.72,
  );

  context.fillStyle = "#f8fafc";

  context.font =
    `800 ${titleFontSize}px Arial, sans-serif`;

  const titleLines = wrapCanvasText(
    context,
    marker.label,
    cardArea.width -
      (headerTextX - cardArea.x) -
      cardPadding,
    2,
  );

  titleLines.forEach((line, lineIndex) => {
    context.fillText(
      line,
      headerTextX,
      cardArea.y +
        cardPadding * 0.72 +
        stepFontSize * 1.35 +
        lineIndex *
          titleFontSize *
          1.12,
    );
  });

  context.restore();

  const zoomTop =
    cardArea.y +
    headerHeight +
    cardPadding * 0.4;

  const bottomTextReserve = clampNumber(
    cardArea.height * 0.25,
    90,
    170,
  );

  const zoomHeight = Math.max(
    88,
    cardArea.height -
      headerHeight -
      bottomTextReserve -
      cardPadding * 1.7,
  );

  const zoomRect = {
    x: cardArea.x + cardPadding,
    y: zoomTop,

    width:
      cardArea.width -
      cardPadding * 2,

    height: zoomHeight,
  };

  drawZoomTargetImage(
    context,
    source,
    sourceWidth,
    sourceHeight,
    marker,
    zoomRect,
    layout,
  );

  const instructionFontSize = clampNumber(
    scaleReference * 0.011,
    15,
    23,
  );

  const instructionY =
    zoomRect.y +
    zoomRect.height +
    cardPadding * 0.62;

  context.save();

  context.fillStyle = "#cbd5e1";

  context.font =
    `500 ${instructionFontSize}px Arial, sans-serif`;

  context.textAlign = "left";
  context.textBaseline = "top";

  const instructionLines = wrapCanvasText(
    context,
    marker.instruction,
    zoomRect.width,
    3,
  );

  instructionLines.forEach(
    (line, lineIndex) => {
      context.fillText(
        line,
        zoomRect.x,
        instructionY +
          lineIndex *
            instructionFontSize *
            1.4,
      );
    },
  );

  context.fillStyle = "#64748b";

  context.font =
    `700 ${clampNumber(
      scaleReference * 0.008,
      11,
      18,
    )}px Arial, sans-serif`;

  context.textAlign = "right";
  context.textBaseline = "bottom";

  context.fillText(
    `Konum güveni: %${Math.round(
      marker.confidence * 100,
    )}`,

    cardArea.x +
      cardArea.width -
      cardPadding,

    cardArea.y +
      cardArea.height -
      cardPadding * 0.65,
  );

  context.restore();
}

export function drawSolutionBoardFooter(
  context,
  layout,
  markerCount,
) {
  const footerFontSize = clampNumber(
    layout.boardWidth * 0.008,
    12,
    18,
  );

  context.save();

  context.fillStyle = "#64748b";

  context.font =
    `600 ${footerFontSize}px Arial, sans-serif`;

  context.textAlign = "right";
  context.textBaseline = "bottom";

  context.fillText(
    `IntelliDesk AI • ${markerCount} görsel yönlendirme`,
    layout.boardWidth - layout.outerPadding,
    layout.boardHeight -
      layout.outerPadding * 0.32,
  );

  context.restore();
}

function drawRoundedImage(
  context,
  source,
  imageRect,
  radius,
) {
  context.save();

  drawRoundedRectangle(
    context,
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height,
    radius,
  );

  context.clip();

  context.drawImage(
    source,
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height,
  );

  context.restore();

  context.save();

  context.strokeStyle =
    "rgba(148, 163, 184, 0.34)";

  context.lineWidth = 2;

  drawRoundedRectangle(
    context,
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height,
    radius,
  );

  context.stroke();
  context.restore();
}

function drawSourceImageFocusOverlay(
  context,
  source,
  imageRect,
  geometries,
) {
  context.save();

  drawRoundedRectangle(
    context,
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height,
    18,
  );

  context.clip();

  context.fillStyle =
    "rgba(2, 6, 23, 0.50)";

  context.fillRect(
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height,
  );

  geometries.forEach((geometry) => {
    context.save();

    drawRoundedRectangle(
      context,
      geometry.x,
      geometry.y,
      geometry.width,
      geometry.height,
      14,
    );

    context.clip();

    context.drawImage(
      source,
      imageRect.x,
      imageRect.y,
      imageRect.width,
      imageRect.height,
    );

    context.restore();
  });

  context.restore();
}

function drawSourceTarget(
  context,
  geometry,
  layout,
) {
  const scaleReference = layout.boardWidth;

  const strokeWidth = clampNumber(
    scaleReference * 0.003,
    4,
    8,
  );

  const radius = clampNumber(
    scaleReference * 0.012,
    17,
    32,
  );

  context.save();

  context.fillStyle =
    "rgba(34, 211, 238, 0.12)";

  context.strokeStyle = "#22d3ee";
  context.lineWidth = strokeWidth;

  context.shadowColor =
    "rgba(34, 211, 238, 0.88)";

  context.shadowBlur =
    strokeWidth * 3;

  drawRoundedRectangle(
    context,
    geometry.x,
    geometry.y,
    geometry.width,
    geometry.height,
    14,
  );

  context.fill();
  context.stroke();

  context.restore();

  drawStepNumberBadge(
    context,

    clampNumber(
      geometry.x,
      radius + 5,
      layout.boardWidth - radius - 5,
    ),

    clampNumber(
      geometry.y,
      radius + 5,
      layout.boardHeight - radius - 5,
    ),

    radius,
    geometry.marker.stepNumber,
  );
}

function drawZoomTargetImage(
  context,
  source,
  sourceWidth,
  sourceHeight,
  marker,
  zoomRect,
  layout,
) {
  const cropRect = createTargetCropRect(
    sourceWidth,
    sourceHeight,
    marker,
    zoomRect.width / zoomRect.height,
  );

  const zoomRadius = clampNumber(
    layout.boardWidth * 0.009,
    12,
    22,
  );

  context.save();

  drawRoundedRectangle(
    context,
    zoomRect.x,
    zoomRect.y,
    zoomRect.width,
    zoomRect.height,
    zoomRadius,
  );

  context.clip();

  context.drawImage(
    source,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    zoomRect.x,
    zoomRect.y,
    zoomRect.width,
    zoomRect.height,
  );

  context.fillStyle =
    "rgba(2, 6, 23, 0.15)";

  context.fillRect(
    zoomRect.x,
    zoomRect.y,
    zoomRect.width,
    zoomRect.height,
  );

  const targetRect = mapTargetToZoomRect(
    marker,
    cropRect,
    zoomRect,
    sourceWidth,
    sourceHeight,
  );

  context.fillStyle =
    "rgba(34, 211, 238, 0.10)";

  context.strokeStyle = "#22d3ee";

  context.lineWidth = clampNumber(
    layout.boardWidth * 0.003,
    4,
    8,
  );

  context.shadowColor =
    "rgba(34, 211, 238, 0.95)";

  context.shadowBlur = 18;

  drawRoundedRectangle(
    context,
    targetRect.x,
    targetRect.y,
    targetRect.width,
    targetRect.height,
    14,
  );

  context.fill();
  context.stroke();

  context.restore();

  context.save();

  context.strokeStyle =
    "rgba(148, 163, 184, 0.42)";

  context.lineWidth = 2;

  drawRoundedRectangle(
    context,
    zoomRect.x,
    zoomRect.y,
    zoomRect.width,
    zoomRect.height,
    zoomRadius,
  );

  context.stroke();

  drawActionPill(
    context,
    zoomRect,
    layout,
  );

  context.restore();
}

function drawActionPill(
  context,
  zoomRect,
  layout,
) {
  const fontSize = clampNumber(
    layout.boardWidth * 0.009,
    13,
    20,
  );

  const pillHeight =
    fontSize * 2.25;

  const pillWidth =
    fontSize * 10.5;

  const pillX =
    zoomRect.x +
    zoomRect.width -
    pillWidth -
    fontSize;

  const pillY =
    zoomRect.y + fontSize;

  context.fillStyle =
    "rgba(8, 145, 178, 0.94)";

  context.shadowColor =
    "rgba(2, 6, 23, 0.55)";

  context.shadowBlur =
    fontSize * 0.7;

  drawRoundedRectangle(
    context,
    pillX,
    pillY,
    pillWidth,
    pillHeight,
    pillHeight / 2,
  );

  context.fill();

  context.shadowBlur = 0;

  context.fillStyle = "#ecfeff";

  context.font =
    `800 ${fontSize}px Arial, sans-serif`;

  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillText(
    "BURAYA TIKLAYIN",
    pillX + pillWidth / 2,
    pillY + pillHeight / 2,
  );
}

function drawStepNumberBadge(
  context,
  centerX,
  centerY,
  radius,
  stepNumber,
) {
  context.save();

  context.beginPath();

  context.arc(
    centerX,
    centerY,
    radius,
    0,
    Math.PI * 2,
  );

  const badgeGradient =
    context.createLinearGradient(
      centerX - radius,
      centerY - radius,
      centerX + radius,
      centerY + radius,
    );

  badgeGradient.addColorStop(
    0,
    "#22d3ee",
  );

  badgeGradient.addColorStop(
    1,
    "#4f46e5",
  );

  context.fillStyle = badgeGradient;

  context.shadowColor =
    "rgba(2, 6, 23, 0.75)";

  context.shadowBlur =
    radius * 0.85;

  context.fill();

  context.lineWidth = Math.max(
    2,
    radius * 0.13,
  );

  context.strokeStyle = "#ffffff";
  context.stroke();

  context.shadowBlur = 0;
  context.fillStyle = "#ffffff";

  context.font =
    `800 ${Math.round(
      radius * 0.92,
    )}px Arial, sans-serif`;

  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillText(
    String(stepNumber),
    centerX,
    centerY + 1,
  );

  context.restore();
}

function drawArrowHead(
  context,
  x,
  y,
  angle,
  length,
) {
  context.save();

  context.fillStyle =
    context.strokeStyle;

  context.beginPath();

  context.moveTo(x, y);

  context.lineTo(
    x -
      length *
        Math.cos(
          angle - Math.PI / 6,
        ),

    y -
      length *
        Math.sin(
          angle - Math.PI / 6,
        ),
  );

  context.lineTo(
    x -
      length *
        Math.cos(
          angle + Math.PI / 6,
        ),

    y -
      length *
        Math.sin(
          angle + Math.PI / 6,
        ),
  );

  context.closePath();
  context.fill();

  context.restore();
}

function wrapCanvasText(
  context,
  value,
  maximumWidth,
  maximumLines,
) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim() || "İşaretli alanı kullanın.";

  const words = text.split(" ");
  const lines = [];

  let currentLine = "";

  words.forEach((word) => {
    const candidateLine =
      currentLine
        ? `${currentLine} ${word}`
        : word;

    if (
      currentLine &&
      context.measureText(candidateLine).width >
        maximumWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidateLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= maximumLines) {
    return lines;
  }

  const visibleLines = lines.slice(
    0,
    maximumLines,
  );

  let finalLine =
    visibleLines[maximumLines - 1];

  while (
    finalLine.length > 3 &&
    context.measureText(
      `${finalLine}…`,
    ).width > maximumWidth
  ) {
    finalLine = finalLine.slice(0, -1);
  }

  visibleLines[maximumLines - 1] =
    `${finalLine.trim()}…`;

  return visibleLines;
}

function drawRoundedRectangle(
  context,
  x,
  y,
  width,
  height,
  radius,
) {
  const safeRadius = Math.min(
    radius,
    width / 2,
    height / 2,
  );

  context.beginPath();

  context.moveTo(
    x + safeRadius,
    y,
  );

  context.lineTo(
    x + width - safeRadius,
    y,
  );

  context.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius,
  );

  context.lineTo(
    x + width,
    y + height - safeRadius,
  );

  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );

  context.lineTo(
    x + safeRadius,
    y + height,
  );

  context.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - safeRadius,
  );

  context.lineTo(
    x,
    y + safeRadius,
  );

  context.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y,
  );

  context.closePath();
}