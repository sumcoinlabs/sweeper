import type {ChecklistItem} from '../types';

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'ceiling-walls',
    title: 'Ceiling & wall fixtures',
    guidance: [
      'Check smoke detectors, vents and sensors for an unusual pinhole or lens-like opening.',
      'Pay extra attention to anything aimed toward the bed or bathroom.',
    ],
    status: 'pending',
  },
  {
    id: 'electronics',
    title: 'Electronics & chargers',
    guidance: [
      'Check clocks, speakers, USB chargers, TVs and router-area devices for unexpected openings.',
      'Look for an extra device or dark glass window that does not seem to belong.',
    ],
    status: 'pending',
  },
  {
    id: 'decor-furniture',
    title: 'Decor & furniture',
    guidance: [
      'Check mirrors, frames, lamps, shelves and decorative objects with a clear view of the room.',
      'Do not damage or dismantle property; mark anything questionable for review.',
    ],
    status: 'pending',
  },
  {
    id: 'private-areas',
    title: 'Bed & bathroom sightlines',
    guidance: [
      'Stand where privacy matters most and look back for small objects pointed directly at you.',
      'If something looks credible, photograph it rather than handling or dismantling it.',
    ],
    status: 'pending',
  },
];
