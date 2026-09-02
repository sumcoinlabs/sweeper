export type OpticalMode = 'lens' | 'ir';

export type OpticalCandidate = {
  x: number;
  y: number;
  score: number;
  area: number;
  circularity: number;
  fill: number;
  aspect: number;
  peak: number;
  colorScore: number;
};

export type OpticalFrameAnalysis = {
  mode: OpticalMode;
  ambient: number;
  contours: number;
  rawCandidates: number;
  candidate: OpticalCandidate | null;
  tooBrightForIr: boolean;
};

function clamp01(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function luma(b: number, g: number, r: number): number {
  'worklet';
  return (r * 77 + g * 150 + b * 29) >> 8;
}

function pixelColorScore(
  b: number,
  g: number,
  r: number,
  mode: OpticalMode,
): number {
  'worklet';

  if (mode === 'lens') {
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    return clamp01(1 - (high - low) / 155);
  }

  const purpleExcess = ((r + b) / 2 - g) / 95;
  const white =
    Math.min(r, g, b) >= 205
      ? 0.78
      : Math.min(r, g, b) >= 175
        ? 0.42
        : 0;

  return Math.max(clamp01(purpleExcess), white);
}

/**
 * Lightweight on-device optical detector.
 *
 * This intentionally avoids a native OpenCV dependency. It uses the GPU
 * resizer upstream, then performs real connected-component/blob analysis on
 * the worklet thread:
 *
 *  - adaptive scene-relative brightness threshold
 *  - 2x2 max pooling so tiny glints are not skipped
 *  - 8-neighbour connected components
 *  - component area and bounding box
 *  - aspect ratio and fill/compactness
 *  - 4-neighbour perimeter and circularity
 *  - local brightness contrast
 *  - lens-neutral / IR purple-white color evidence
 *
 * Temporal persistence is handled by CameraAssistScreen.
 */
export function analyzeOpticalBgr(
  pixels: Uint8Array,
  width: number,
  height: number,
  mode: OpticalMode,
): OpticalFrameAnalysis {
  'worklet';

  const empty: OpticalFrameAnalysis = {
    mode,
    ambient: 0,
    contours: 0,
    rawCandidates: 0,
    candidate: null,
    tooBrightForIr: false,
  };

  if (
    width <= 4 ||
    height <= 4 ||
    pixels.length < width * height * 3
  ) {
    return empty;
  }

  const step = 2;
  const gridWidth = Math.floor(width / step);
  const gridHeight = Math.floor(height / step);
  const cellCount = gridWidth * gridHeight;

  const peaks = new Uint8Array(cellCount);
  const colorScores = new Uint8Array(cellCount);
  const mask = new Uint8Array(cellCount);
  const visited = new Uint8Array(cellCount);
  const queue = new Int32Array(cellCount);

  let ambientTotal = 0;
  let ambientSamples = 0;

  // First pass: 2x2 max pooling. The max keeps a one-pixel glint alive while
  // the average sample gives us a stable estimate of scene brightness.
  for (let gy = 0; gy < gridHeight; gy += 1) {
    const py = gy * step;

    for (let gx = 0; gx < gridWidth; gx += 1) {
      const px = gx * step;
      const cell = gy * gridWidth + gx;

      let maxLuma = 0;
      let bestB = 0;
      let bestG = 0;
      let bestR = 0;
      let localTotal = 0;
      let localCount = 0;

      for (let oy = 0; oy < step; oy += 1) {
        const y = py + oy;
        if (y >= height) continue;

        for (let ox = 0; ox < step; ox += 1) {
          const x = px + ox;
          if (x >= width) continue;

          const offset = (y * width + x) * 3;

          const b = pixels[offset] || 0;
          const g = pixels[offset + 1] || 0;
          const r = pixels[offset + 2] || 0;

          const value = luma(b, g, r);
          localTotal += value;
          localCount += 1;

          if (value >= maxLuma) {
            maxLuma = value;
            bestB = b;
            bestG = g;
            bestR = r;
          }
        }
      }

      peaks[cell] = maxLuma;
      colorScores[cell] = Math.round(
        pixelColorScore(bestB, bestG, bestR, mode) * 255,
      );

      if (localCount > 0) {
        ambientTotal += localTotal / localCount;
        ambientSamples += 1;
      }
    }
  }

  const ambient =
    ambientSamples > 0
      ? ambientTotal / ambientSamples
      : 0;

  if (mode === 'ir' && ambient > 108) {
    return {
      ...empty,
      ambient,
      tooBrightForIr: true,
    };
  }

  const threshold =
    mode === 'lens'
      ? Math.min(248, Math.max(166, ambient + 76))
      : Math.min(245, Math.max(145, ambient + 70));

  const roiLeft = Math.floor(gridWidth * 0.12);
  const roiRight = Math.ceil(gridWidth * 0.88);
  const roiTop = Math.floor(gridHeight * 0.14);
  const roiBottom = Math.ceil(gridHeight * 0.86);

  const roiCx = (roiLeft + roiRight) / 2;
  const roiCy = (roiTop + roiBottom) / 2;
  const roiRx = Math.max(1, (roiRight - roiLeft) / 2);
  const roiRy = Math.max(1, (roiBottom - roiTop) / 2);

  // Build a binary mask only inside the visible scanner ellipse.
  for (let gy = roiTop; gy < roiBottom; gy += 1) {
    for (let gx = roiLeft; gx < roiRight; gx += 1) {
      const dx = (gx + 0.5 - roiCx) / roiRx;
      const dy = (gy + 0.5 - roiCy) / roiRy;

      if (dx * dx + dy * dy > 1) continue;

      const cell = gy * gridWidth + gx;
      const peak = peaks[cell];

      if (peak < threshold) continue;

      if (mode === 'ir') {
        const color = colorScores[cell] / 255;
        if (color < 0.17) continue;
      }

      mask[cell] = 1;
    }
  }

  let components = 0;
  let rawCandidates = 0;
  let best: OpticalCandidate | null = null;

  const n8x = new Int8Array([-1, 0, 1, -1, 1, -1, 0, 1]);
  const n8y = new Int8Array([-1, -1, -1, 0, 0, 1, 1, 1]);

  // Connected-component analysis.
  for (let seedY = roiTop; seedY < roiBottom; seedY += 1) {
    for (let seedX = roiLeft; seedX < roiRight; seedX += 1) {
      const seed = seedY * gridWidth + seedX;

      if (mask[seed] === 0 || visited[seed] !== 0) {
        continue;
      }

      components += 1;

      let head = 0;
      let tail = 0;

      queue[tail] = seed;
      tail += 1;
      visited[seed] = 1;

      let cells = 0;
      let minX = seedX;
      let maxX = seedX;
      let minY = seedY;
      let maxY = seedY;
      let weightedX = 0;
      let weightedY = 0;
      let totalWeight = 0;
      let peak = 0;
      let colorTotal = 0;
      let perimeter = 0;

      while (head < tail) {
        const cell = queue[head];
        head += 1;

        const x = cell % gridWidth;
        const y = Math.floor(cell / gridWidth);
        const brightness = peaks[cell];
        const weight = Math.max(1, brightness - ambient);

        cells += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        weightedX += (x + 0.5) * weight;
        weightedY += (y + 0.5) * weight;
        totalWeight += weight;
        peak = Math.max(peak, brightness);
        colorTotal += colorScores[cell] / 255;

        // 4-neighbour boundary length gives a useful perimeter estimate.
        const left = x - 1;
        const right = x + 1;
        const up = y - 1;
        const down = y + 1;

        if (
          left < 0 ||
          mask[y * gridWidth + left] === 0
        ) {
          perimeter += 1;
        }
        if (
          right >= gridWidth ||
          mask[y * gridWidth + right] === 0
        ) {
          perimeter += 1;
        }
        if (
          up < 0 ||
          mask[up * gridWidth + x] === 0
        ) {
          perimeter += 1;
        }
        if (
          down >= gridHeight ||
          mask[down * gridWidth + x] === 0
        ) {
          perimeter += 1;
        }

        for (let n = 0; n < 8; n += 1) {
          const nx = x + n8x[n];
          const ny = y + n8y[n];

          if (
            nx < roiLeft ||
            nx >= roiRight ||
            ny < roiTop ||
            ny >= roiBottom
          ) {
            continue;
          }

          const next = ny * gridWidth + nx;

          if (
            mask[next] !== 0 &&
            visited[next] === 0
          ) {
            visited[next] = 1;
            queue[tail] = next;
            tail += 1;
          }
        }
      }

      // Reject huge glare patches. We want compact optical points.
      if (cells < 1 || cells > 95) continue;

      const bboxWidth = maxX - minX + 1;
      const bboxHeight = maxY - minY + 1;

      if (
        bboxWidth > 20 ||
        bboxHeight > 20
      ) {
        continue;
      }

      const bboxArea = bboxWidth * bboxHeight;
      const fill = cells / Math.max(1, bboxArea);
      const aspect =
        bboxWidth / Math.max(1, bboxHeight);

      if (
        fill < 0.16 ||
        aspect < 0.38 ||
        aspect > 2.65
      ) {
        continue;
      }

      const circularity = clamp01(
        (4 * Math.PI * cells) /
          Math.max(1, perimeter * perimeter),
      );

      if (circularity < 0.20) continue;

      const centerX =
        totalWeight > 0
          ? weightedX / totalWeight
          : (minX + maxX + 1) / 2;
      const centerY =
        totalWeight > 0
          ? weightedY / totalWeight
          : (minY + maxY + 1) / 2;

      const colorScore =
        colorTotal / Math.max(1, cells);

      const contrast = clamp01(
        (peak - ambient) / 155,
      );

      const shape = clamp01(
        circularity * 0.58 +
          Math.min(1, fill / 0.72) * 0.42,
      );

      const sizeScore =
        cells <= 14
          ? 1
          : clamp01(1 - (cells - 14) / 81);

      let score =
        contrast * 0.46 +
        shape * 0.29 +
        sizeScore * 0.15 +
        colorScore * 0.10;

      if (mode === 'ir') {
        const darkness = clamp01(
          (108 - ambient) / 90,
        );

        score =
          contrast * 0.39 +
          shape * 0.25 +
          sizeScore * 0.12 +
          colorScore * 0.16 +
          darkness * 0.08;

        if (colorScore < 0.25) {
          score *= 0.78;
        }
      }

      const minimum =
        mode === 'lens' ? 0.60 : 0.63;

      if (score < minimum) continue;

      rawCandidates += 1;

      const normalizedX = clamp01(
        (centerX - roiLeft) /
          Math.max(1, roiRight - roiLeft),
      );
      const normalizedY = clamp01(
        (centerY - roiTop) /
          Math.max(1, roiBottom - roiTop),
      );

      const candidate: OpticalCandidate = {
        x: normalizedX,
        y: normalizedY,
        score: clamp01(score),
        // Report approximate original-pixel area.
        area: cells * step * step,
        circularity,
        fill,
        aspect,
        peak,
        colorScore,
      };

      if (
        best == null ||
        candidate.score > best.score
      ) {
        best = candidate;
      }
    }
  }

  return {
    mode,
    ambient,
    contours: components,
    rawCandidates,
    candidate: best,
    tooBrightForIr: false,
  };
}
