// Homework marks are shown out of a fixed scale instead of raw counts: 1 right answer out of 2 -> 50 / 100.
// Change this to 10 if you prefer marks out of 10 (1 of 2 -> 5 / 10).
export const MARK_SCALE = 10;

const clean = (n) => String(Math.round(n * 10) / 10); // up to 1 decimal, no trailing .0

// The mark on the scale, as a number
export function scaled(score, total, scale = MARK_SCALE) {
  const tt = Number(total);
  return tt > 0 ? (Number(score) / tt) * scale : 0;
}

// "50 / 100"
export function formatMark(score, total, scale = MARK_SCALE) {
  return `${clean(scaled(score, total, scale))} / ${scale}`;
}

// worth of one question on the scale: "50"
export function questionWorth(total, scale = MARK_SCALE) {
  return Number(total) > 0 ? clean(scale / Number(total)) : '0';
}
