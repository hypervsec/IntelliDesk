import {
  createSolutionBoardLayout,
  createStepCardAreas,
} from "./canvasLayout";

import {
  drawBoardConnector,
  drawSolutionBoardBackground,
  drawSolutionBoardFooter,
  drawSolutionBoardHeader,
  drawSourceImagePanel,
  drawZoomStepCard,
} from "./canvasDrawing";

import {
  canvasToBlob,
  decodeImageBlob,
} from "./imageDecoder";

export async function createGuidedImageBlob(
  imageBlob,
  markers,
) {
  const decodedImage =
    await decodeImageBlob(imageBlob);

  try {
    const orderedMarkers = [
      ...markers,
    ].sort(
      (firstMarker, secondMarker) =>
        firstMarker.stepNumber -
        secondMarker.stepNumber,
    );

    const canvas =
      createSolutionBoardCanvas(
        decodedImage,
        orderedMarkers,
      );

    return await canvasToBlob(canvas);
  } finally {
    decodedImage.close();
  }
}

function createSolutionBoardCanvas(
  decodedImage,
  markers,
) {
  const layout = createSolutionBoardLayout(
    decodedImage.width,
    decodedImage.height,
    markers.length,
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = layout.boardWidth;
  canvas.height = layout.boardHeight;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Canvas bağlamı oluşturulamadı.",
    );
  }

  drawSolutionBoardBackground(
    context,
    layout,
  );

  drawSolutionBoardHeader(
    context,
    layout,
    markers,
  );

  const markerGeometries =
    drawSourceImagePanel(
      context,
      decodedImage.source,
      layout,
      markers,
    );

  const cardAreas = createStepCardAreas(
    layout,
    markers.length,
  );

  markerGeometries.forEach(
    (geometry, markerIndex) => {
      const cardArea =
        cardAreas[markerIndex];

      if (!cardArea) {
        return;
      }

      drawBoardConnector(
        context,
        geometry,
        cardArea,
        markerIndex,
      );
    },
  );

  markers.forEach(
    (marker, markerIndex) => {
      const cardArea =
        cardAreas[markerIndex];

      if (!cardArea) {
        return;
      }

      drawZoomStepCard(
        context,
        decodedImage.source,
        decodedImage.width,
        decodedImage.height,
        marker,
        cardArea,
        layout,
      );
    },
  );

  drawSolutionBoardFooter(
    context,
    layout,
    markers.length,
  );

  return canvas;
}