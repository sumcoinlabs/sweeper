export type OpticalMode = 'lens' | 'ir';

export type OpticalCandidate = {
  // Full-frame normalized coordinates in the upright analysis image.
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
  candidates: OpticalCandidate[];
  sourceWidth: number;
  sourceHeight: number;
  tooBrightForIr: boolean;
};

const MAX_CANDIDATES = 12;

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
    return clamp01(1 - (high - low) / 145);
  }

  const purpleExcess = ((r + b) / 2 - g) / 85;
  const white =
    Math.min(r, g, b) >= 210
      ? 0.82
      : Math.min(r, g, b) >= 185
        ? 0.46
        : 0;

  return Math.max(clamp01(purpleExcess), white);
}

function insertCandidate(
  list: OpticalCandidate[],
  candidate: OpticalCandidate,
): void {
  'worklet';

  let insertAt = list.length;

  for (let index = 0; index < list.length; index += 1) {
    if (candidate.score > list[index].score) {
      insertAt = index;
      break;
    }
  }

  if (insertAt >= MAX_CANDIDATES && list.length >= MAX_CANDIDATES) {
    return;
  }

  if (list.length < MAX_CANDIDATES) {
    list.push(candidate);
  }

  const lastIndex = Math.min(list.length - 1, MAX_CANDIDATES - 1);

  for (let index = lastIndex; index > insertAt; index -= 1) {
    list[index] = list[index - 1];
  }

  if (insertAt < MAX_CANDIDATES) {
    list[insertAt] = candidate;
  }
}

function emptyAnalysis(
  mode: OpticalMode,
  sourceWidth: number,
  sourceHeight: number,
): OpticalFrameAnalysis {
  'worklet';

  return {
    mode,
    ambient: 0,
    contours: 0,
    rawCandidates: 0,
    candidate: null,
    candidates: [],
    sourceWidth,
    sourceHeight,
    tooBrightForIr: false,
  };
}

/**
 * Lens-mode detector that reads VisionCamera's Y plane directly.
 *
 * This intentionally bypasses the Metal resizer for Lens mode. The physical
 * iPhone test showed intermittent Metal resize failures, which can create
 * false "nothing found" gaps even when the camera is directly in view.
 *
 * The detector keeps multiple plausible glints so the temporal tracker can
 * stay locked to the same point instead of jumping to whichever reflection
 * happens to score highest in each frame.
 */
export function analyzeOpticalLumaPlane(
  pixels: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
): OpticalFrameAnalysis {
  'worklet';

  const mode: OpticalMode = 'lens';
  const empty = emptyAnalysis(mode, width, height);

  if (
    width <= 4 ||
    height <= 4 ||
    bytesPerRow < width ||
    pixels.length < bytesPerRow * height
  ) {
    return empty;
  }

  // About 120 cells across the short edge keeps enough spatial detail for a
  // tiny lens glint without doing full-resolution CPU work.
  const step = Math.max(
    2,
    Math.floor(Math.min(width, height) / 120),
  );
  const gridWidth = Math.floor(width / step);
  const gridHeight = Math.floor(height / step);
  const cellCount = gridWidth * gridHeight;

  const peaks = new Uint8Array(cellCount);
  const mask = new Uint8Array(cellCount);
  const visited = new Uint8Array(cellCount);
  const queue = new Int32Array(cellCount);

  let ambientTotal = 0;
  let ambientSamples = 0;

  for (let gy = 0; gy < gridHeight; gy += 1) {
    const py = gy * step;

    for (let gx = 0; gx < gridWidth; gx += 1) {
      const px = gx * step;
      const cell = gy * gridWidth + gx;

      let peak = 0;
      let localTotal = 0;
      let localCount = 0;

      for (let oy = 0; oy < step; oy += 1) {
        const y = py + oy;
        if (y >= height) continue;

        const row = y * bytesPerRow;

        for (let ox = 0; ox < step; ox += 1) {
          const x = px + ox;
          if (x >= width) continue;

          const value = pixels[row + x] || 0;

          localTotal += value;
          localCount += 1;
          peak = Math.max(peak, value);
        }
      }

      peaks[cell] = peak;

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

  // Lower than the prior BGR threshold because temporal persistence and local
  // contrast now do more of the false-positive rejection. This helps a real
  // camera lens remain detectable at a little more distance.
  const threshold = Math.min(
    250,
    Math.max(150, ambient + 58),
  );

  const edgeX = Math.max(1, Math.floor(gridWidth * 0.025));
  const edgeY = Math.max(1, Math.floor(gridHeight * 0.025));

  for (let gy = edgeY; gy < gridHeight - edgeY; gy += 1) {
    for (let gx = edgeX; gx < gridWidth - edgeX; gx += 1) {
      const cell = gy * gridWidth + gx;

      if (peaks[cell] >= threshold) {
        mask[cell] = 1;
      }
    }
  }

  const n8x = new Int8Array([-1, 0, 1, -1, 1, -1, 0, 1]);
  const n8y = new Int8Array([-1, -1, -1, 0, 0, 1, 1, 1]);

  let components = 0;
  let rawCandidates = 0;
  const candidates: OpticalCandidate[] = [];

  for (let seedY = edgeY; seedY < gridHeight - edgeY; seedY += 1) {
    for (let seedX = edgeX; seedX < gridWidth - edgeX; seedX += 1) {
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

        if (x <= 0 || mask[y * gridWidth + x - 1] === 0) {
          perimeter += 1;
        }
        if (
          x >= gridWidth - 1 ||
          mask[y * gridWidth + x + 1] === 0
        ) {
          perimeter += 1;
        }
        if (y <= 0 || mask[(y - 1) * gridWidth + x] === 0) {
          perimeter += 1;
        }
        if (
          y >= gridHeight - 1 ||
          mask[(y + 1) * gridWidth + x] === 0
        ) {
          perimeter += 1;
        }

        for (let n = 0; n < 8; n += 1) {
          const nx = x + n8x[n];
          const ny = y + n8y[n];

          if (
            nx < edgeX ||
            nx >= gridWidth - edgeX ||
            ny < edgeY ||
            ny >= gridHeight - edgeY
          ) {
            continue;
          }

          const next = ny * gridWidth + nx;

          if (mask[next] !== 0 && visited[next] === 0) {
            visited[next] = 1;
            queue[tail] = next;
            tail += 1;
          }
        }
      }

      // A one-cell glint is allowed as a *possible* clue because that is often
      // how a distant lens appears. Strong classification later requires more
      // evidence, so a hot pixel cannot become a red finding on size alone.
      if (cells < 1 || cells > 90) continue;

      const bboxWidth = maxX - minX + 1;
      const bboxHeight = maxY - minY + 1;

      if (bboxWidth > 22 || bboxHeight > 22) continue;

      const bboxArea = bboxWidth * bboxHeight;
      const fill = cells / Math.max(1, bboxArea);
      const aspect = bboxWidth / Math.max(1, bboxHeight);

      if (
        fill < 0.12 ||
        aspect < 0.30 ||
        aspect > 3.30
      ) {
        continue;
      }

      const circularity = clamp01(
        (4 * Math.PI * cells) /
          Math.max(1, perimeter * perimeter),
      );

      if (circularity < 0.15) continue;

      // Compare the blob with its immediate surroundings instead of relying
      // only on whole-scene brightness. Lens glints tend to have strong local
      // contrast even when the room itself is bright.
      const ringLeft = Math.max(edgeX, minX - 3);
      const ringRight = Math.min(gridWidth - edgeX - 1, maxX + 3);
      const ringTop = Math.max(edgeY, minY - 3);
      const ringBottom = Math.min(gridHeight - edgeY - 1, maxY + 3);

      let ringTotal = 0;
      let ringSamples = 0;

      for (let y = ringTop; y <= ringBottom; y += 1) {
        for (let x = ringLeft; x <= ringRight; x += 1) {
          if (
            x >= minX &&
            x <= maxX &&
            y >= minY &&
            y <= maxY
          ) {
            continue;
          }

          ringTotal += peaks[y * gridWidth + x];
          ringSamples += 1;
        }
      }

      const localBackground =
        ringSamples > 0
          ? ringTotal / ringSamples
          : ambient;

      const localContrast = clamp01(
        (peak - localBackground) / 105,
      );
      const globalContrast = clamp01(
        (peak - ambient) / 145,
      );
      const peakStrength = clamp01(
        (peak - 175) / 80,
      );

      const shape = clamp01(
        circularity * 0.58 +
          Math.min(1, fill / 0.72) * 0.42,
      );

      const sizeScore =
        cells <= 26
          ? 1
          : clamp01(1 - (cells - 26) / 64);

      const score =
        localContrast * 0.42 +
        globalContrast * 0.20 +
        shape * 0.22 +
        sizeScore * 0.10 +
        peakStrength * 0.06;

      if (score < 0.52) continue;

      rawCandidates += 1;

      const centerX =
        totalWeight > 0
          ? weightedX / totalWeight
          : (minX + maxX + 1) / 2;
      const centerY =
        totalWeight > 0
          ? weightedY / totalWeight
          : (minY + maxY + 1) / 2;

      const candidate: OpticalCandidate = {
        x: clamp01(centerX / gridWidth),
        y: clamp01(centerY / gridHeight),
        score: clamp01(score),
        area: cells * step * step,
        circularity,
        fill,
        aspect,
        peak,
        colorScore: 1,
      };

      insertCandidate(candidates, candidate);
    }
  }

  return {
    mode,
    ambient,
    contours: components,
    rawCandidates,
    candidate: candidates.length > 0 ? candidates[0] : null,
    candidates,
    sourceWidth: width,
    sourceHeight: height,
    tooBrightForIr: false,
  };
}

/**
 * BGR detector retained for IR mode, where color evidence matters.
 */
export function analyzeOpticalBgr(
  pixels: Uint8Array,
  width: number,
  height: number,
  mode: OpticalMode,
): OpticalFrameAnalysis {
  'worklet';

  const empty = emptyAnalysis(mode, width, height);

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

  if (mode === 'ir' && ambient > 75) {
    return {
      ...empty,
      ambient,
      tooBrightForIr: true,
    };
  }

  const threshold =
    mode === 'lens'
      ? Math.min(248, Math.max(166, ambient + 70))
      : Math.min(248, Math.max(158, ambient + 78));

  const roiLeft = Math.floor(gridWidth * 0.06);
  const roiRight = Math.ceil(gridWidth * 0.94);
  const roiTop = Math.floor(gridHeight * 0.06);
  const roiBottom = Math.ceil(gridHeight * 0.94);

  for (let gy = roiTop; gy < roiBottom; gy += 1) {
    for (let gx = roiLeft; gx < roiRight; gx += 1) {
      const cell = gy * gridWidth + gx;
      const peak = peaks[cell];

      if (peak < threshold) continue;

      if (mode === 'ir') {
        const color = colorScores[cell] / 255;
        if (color < 0.30) continue;
      }

      mask[cell] = 1;
    }
  }

  let components = 0;
  let rawCandidates = 0;
  const candidates: OpticalCandidate[] = [];

  const n8x = new Int8Array([-1, 0, 1, -1, 1, -1, 0, 1]);
  const n8y = new Int8Array([-1, -1, -1, 0, 0, 1, 1, 1]);

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

        if (x <= 0 || mask[y * gridWidth + x - 1] === 0) {
          perimeter += 1;
        }
        if (
          x >= gridWidth - 1 ||
          mask[y * gridWidth + x + 1] === 0
        ) {
          perimeter += 1;
        }
        if (y <= 0 || mask[(y - 1) * gridWidth + x] === 0) {
          perimeter += 1;
        }
        if (
          y >= gridHeight - 1 ||
          mask[(y + 1) * gridWidth + x] === 0
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

          if (mask[next] !== 0 && visited[next] === 0) {
            visited[next] = 1;
            queue[tail] = next;
            tail += 1;
          }
        }
      }

      if (cells < 2 || cells > 70) continue;

      const bboxWidth = maxX - minX + 1;
      const bboxHeight = maxY - minY + 1;

      if (bboxWidth > 18 || bboxHeight > 18) continue;

      const bboxArea = bboxWidth * bboxHeight;
      const fill = cells / Math.max(1, bboxArea);
      const aspect = bboxWidth / Math.max(1, bboxHeight);

      if (
        fill < 0.20 ||
        aspect < 0.42 ||
        aspect > 2.35
      ) {
        continue;
      }

      const circularity = clamp01(
        (4 * Math.PI * cells) /
          Math.max(1, perimeter * perimeter),
      );

      if (circularity < 0.25) continue;

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
        (peak - ambient) / 150,
      );

      const shape = clamp01(
        circularity * 0.60 +
          Math.min(1, fill / 0.72) * 0.40,
      );

      const sizeScore =
        cells <= 18
          ? 1
          : clamp01(1 - (cells - 18) / 52);

      let score =
        contrast * 0.47 +
        shape * 0.31 +
        sizeScore * 0.14 +
        colorScore * 0.08;

      if (mode === 'ir') {
        const darkness = clamp01(
          (75 - ambient) / 65,
        );

        score =
          contrast * 0.38 +
          shape * 0.25 +
          sizeScore * 0.11 +
          colorScore * 0.20 +
          darkness * 0.06;

        if (colorScore < 0.38) {
          score *= 0.76;
        }
      }

      const minimum =
        mode === 'lens' ? 0.62 : 0.70;

      if (score < minimum) continue;

      rawCandidates += 1;

      const candidate: OpticalCandidate = {
        x: clamp01(centerX / gridWidth),
        y: clamp01(centerY / gridHeight),
        score: clamp01(score),
        area: cells * step * step,
        circularity,
        fill,
        aspect,
        peak,
        colorScore,
      };

      insertCandidate(candidates, candidate);
    }
  }

  return {
    mode,
    ambient,
    contours: components,
    rawCandidates,
    candidate: candidates.length > 0 ? candidates[0] : null,
    candidates,
    sourceWidth: width,
    sourceHeight: height,
    tooBrightForIr: false,
  };
}
