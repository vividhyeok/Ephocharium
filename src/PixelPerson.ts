/** Close-range sprites use a 20 × 26 logical pixel grid, anchored to real agents. */
export function pixelPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  role: string,
  era: number,
  frame: number,
  working: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.3, 0.3);
  const rect = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  rect("#153b3d55", -7, 0, 15, 3);
  rect("#293d43", -5, -7, 4, 7 + (frame ? 1 : 0));
  rect("#293d43", 2, -7, 4, 8 - (frame ? 1 : 0));
  rect("#172f32", -6, 0, 5, 2);
  rect("#172f32", 2, -(frame ? 1 : 0), 5, 2);
  rect(role === "ruler" ? "#9d4f65" : color, -6, -17, 13, 11);
  rect("#e2cca0", -8, -16, 3, 8);
  rect("#bd9576", 7, -15, 3, 7);
  rect("#c79978", -5, -25, 11, 9);
  rect("#f0cf9f", -4, -24, 9, 7);
  rect("#493e35", -5, -26, 11, 3);
  rect("#493e35", -5, -24, 2, 5);
  rect("#263d3c", 3, -22, 1, 2);
  rect("#c18c6d", 3, -18, 3, 1);
  rect("#cfb675", -6, -8, 13, 2);
  rect("#f4dd9a", 0, -8, 2, 2);
  if (role === "ruler") {
    rect("#edc55f", -6, -27, 13, 3);
    for (let i = 0; i < 3; i++) rect("#ffe6a0", -6 + i * 5, -30, 3, 4);
  }
  if (role === "farmer") {
    rect("#c9a760", -7, -27, 15, 3);
    rect("#e4ca85", -4, -30, 9, 4);
  }
  if (
    role === "miner" ||
    role === "builder" ||
    (role === "soldier" && era >= 3)
  ) {
    rect("#718d8e", -6, -27, 13, 4);
    rect("#a2b4a6", -4, -29, 9, 3);
  }
  if (role === "merchant") {
    rect("#806343", -10, -17, 4, 10);
    rect("#c3a76d", -10, -16, 2, 8);
  }
  const toolY = working && frame ? -5 : 0;
  ctx.translate(0, toolY);
  if (["farmer", "woodcutter", "miner", "builder"].includes(role)) {
    rect("#805c3e", 10, -19, 2, 20);
    const steel = "#d7e1d0";
    if (role === "farmer") {
      rect(steel, 7, -22, 7, 2);
      rect(steel, 6, -21, 2, 5);
      rect(steel, 7, -17, 4, 2);
    }
    if (role === "woodcutter") {
      rect(steel, 7, -21, 7, 5);
      rect("#9bac9f", 13, -20, 2, 4);
    }
    if (role === "miner") {
      rect(steel, 5, -22, 13, 2);
      rect(steel, 5, -20, 2, 3);
      rect(steel, 16, -20, 2, 3);
    }
    if (role === "builder") rect(steel, 7, -21, 9, 4);
  }
  if (role === "soldier") {
    if (era < 3) {
      rect("#776146", 10, -22, 2, 22);
      rect("#e3e5c9", 9, -27, 4, 6);
      if (era === 2) {
        rect("#e3e5c9", 10, -28, 2, 21);
        rect("#d5ba6d", 7, -8, 8, 2);
      }
      rect("#776146", -11, -16, 7, 11);
      rect(color, -10, -15, 5, 9);
      rect("#dac382", -8, -14, 1, 7);
    } else {
      rect("#72583e", 6, -12, 11, 3);
      rect("#c4d3c6", 13, -14, 9, 2);
      rect("#203d3e", 10, -11, 2, 5);
      if (era >= 4) {
        rect("#294748", 7, -16, 10, 4);
        rect("#203d3e", 16, -18, 3, 3);
      }
    }
  }
  ctx.restore();
}
