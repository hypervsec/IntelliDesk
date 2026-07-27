import { clampNumber } from "./canvasGeometry";

export function createSolutionBoardLayout(
  sourceWidth,
  sourceHeight,
  markerCount,
) {
  const boardWidth = Math.round(
    clampNumber(
      sourceWidth * 1.55,
      1500,
      2400,
    ),
  );

  const outerPadding = Math.round(
    clampNumber(
      boardWidth * 0.035,
      44,
      82,
    ),
  );

  const columnGap = Math.round(
    clampNumber(
      boardWidth * 0.027,
      34,
      66,
    ),
  );

  const headerHeight = Math.round(
    clampNumber(
      boardWidth * 0.112,
      165,
      235,
    ),
  );

  const contentWidth =
    boardWidth -
    outerPadding * 2 -
    columnGap;

  const leftPanelWidth = Math.round(
    contentWidth * 0.605,
  );

  const rightPanelWidth =
    contentWidth - leftPanelWidth;

  const previewHeaderHeight = Math.round(
    clampNumber(
      boardWidth * 0.036,
      52,
      76,
    ),
  );

  const previewInnerPadding = Math.round(
    clampNumber(
      boardWidth * 0.013,
      18,
      32,
    ),
  );

  const maximumPreviewHeight = clampNumber(
    sourceHeight,
    650,
    980,
  );

  const initialPreviewScale = Math.min(
    (
      leftPanelWidth -
      previewInnerPadding * 2
    ) / sourceWidth,

    maximumPreviewHeight / sourceHeight,
  );

  const initialPreviewHeight =
    sourceHeight * initialPreviewScale;

  const cardGap = Math.round(
    clampNumber(
      boardWidth * 0.015,
      20,
      36,
    ),
  );

  const minimumCardHeight =
    markerCount <= 1
      ? Math.round(
          clampNumber(
            boardWidth * 0.31,
            520,
            720,
          ),
        )
      : Math.round(
          clampNumber(
            boardWidth * 0.155,
            265,
            390,
          ),
        );

  const stackHeight =
    Math.max(1, markerCount) *
      minimumCardHeight +
    Math.max(0, markerCount - 1) *
      cardGap;

  const bodyHeight = Math.round(
    Math.max(
      initialPreviewHeight +
        previewHeaderHeight +
        previewInnerPadding * 2,

      stackHeight,
    ),
  );

  const boardHeight =
    headerHeight +
    bodyHeight +
    outerPadding;

  const sourcePanel = {
    x: outerPadding,
    y: headerHeight,
    width: leftPanelWidth,
    height: bodyHeight,
  };

  const stepsPanel = {
    x:
      outerPadding +
      leftPanelWidth +
      columnGap,

    y: headerHeight,
    width: rightPanelWidth,
    height: bodyHeight,
  };

  const availableImageWidth =
    sourcePanel.width -
    previewInnerPadding * 2;

  const availableImageHeight =
    sourcePanel.height -
    previewHeaderHeight -
    previewInnerPadding * 2;

  const previewScale = Math.min(
    availableImageWidth / sourceWidth,
    availableImageHeight / sourceHeight,
  );

  const previewWidth =
    sourceWidth * previewScale;

  const previewHeight =
    sourceHeight * previewScale;

  const imageRect = {
    x:
      sourcePanel.x +
      (sourcePanel.width - previewWidth) / 2,

    y:
      sourcePanel.y +
      previewHeaderHeight +
      (
        availableImageHeight -
        previewHeight
      ) /
        2,

    width: previewWidth,
    height: previewHeight,
  };

  return {
    boardWidth,
    boardHeight,
    outerPadding,
    columnGap,
    cardGap,
    headerHeight,
    sourcePanel,
    stepsPanel,
    imageRect,
    previewHeaderHeight,
    previewInnerPadding,
  };
}

export function createStepCardAreas(
  layout,
  markerCount,
) {
  if (markerCount <= 0) {
    return [];
  }

  const totalGap =
    layout.cardGap *
    Math.max(0, markerCount - 1);

  const cardHeight =
    (
      layout.stepsPanel.height -
      totalGap
    ) /
    markerCount;

  return Array.from(
    { length: markerCount },
    (_, cardIndex) => ({
      x: layout.stepsPanel.x,

      y:
        layout.stepsPanel.y +
        cardIndex *
          (
            cardHeight +
            layout.cardGap
          ),

      width: layout.stepsPanel.width,
      height: cardHeight,
    }),
  );
}