export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

const GAP = 14;
const MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Where the tour tooltip goes so it does not cover what it points at: below
 *  the target, else above, else beside it. A target too big for any of those
 *  (a whole form on a phone) gets the tooltip docked to the opposite half of
 *  the screen. Without a target the tooltip is centred. */
export function placeTooltip(
  target: Box | null,
  tooltip: Size,
  viewport: Size,
): { top: number; left: number } {
  const maxLeft = viewport.width - tooltip.width - MARGIN;
  const maxTop = viewport.height - tooltip.height - MARGIN;

  if (!target) {
    return {
      top: clamp((viewport.height - tooltip.height) / 2, MARGIN, maxTop),
      left: clamp((viewport.width - tooltip.width) / 2, MARGIN, maxLeft),
    };
  }

  const bottom = target.top + target.height;
  const right = target.left + target.width;
  const centredLeft = clamp(target.left + target.width / 2 - tooltip.width / 2, MARGIN, maxLeft);
  const centredTop = clamp(target.top + target.height / 2 - tooltip.height / 2, MARGIN, maxTop);

  if (bottom + GAP + tooltip.height <= viewport.height - MARGIN) {
    return { top: bottom + GAP, left: centredLeft };
  }
  if (target.top - GAP - tooltip.height >= MARGIN) {
    return { top: target.top - GAP - tooltip.height, left: centredLeft };
  }
  if (right + GAP + tooltip.width <= viewport.width - MARGIN) {
    return { top: centredTop, left: right + GAP };
  }
  if (target.left - GAP - tooltip.width >= MARGIN) {
    return { top: centredTop, left: target.left - GAP - tooltip.width };
  }

  const targetInLowerHalf = target.top + target.height / 2 > viewport.height / 2;
  return {
    top: targetInLowerHalf ? MARGIN : Math.max(MARGIN, maxTop),
    left: centredLeft,
  };
}
