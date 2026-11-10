const hullPaths = new Map<string, Path2D>();

/** Small hand-drawn vessels with a readable bow, hull, rigging and era-specific equipment. */
export function vessel(
  ctx: CanvasRenderingContext2D,
  era: number,
  color: string,
  military: boolean,
) {
  const shape = (d: string, c: string) => {
    let path = hullPaths.get(d);
    if (!path) {
      path = new Path2D(d);
      hullPaths.set(d, path);
    }
    ctx.fillStyle = c;
    ctx.fill(path);
  };
  ctx.save();
  ctx.scale(0.64, 0.64);
  ctx.strokeStyle = "#c5e0d160";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, 6, 19, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  shape("M-18 0L19-2L14 7Q0 11-13 6Z", military ? "#495e61" : "#685348");
  shape("M-16 0L17-2L13 2L-12 4Z", "#c2a574");
  shape("M-12 5L13 3L11 6L-8 8Z", military ? "#718889" : "#947252");
  if (era < 3) {
    shape("M-13-2Q0-7 15-3L11 1H-9Z", "#c1a174");
    shape("M-8-7L-5-7L1 4L-1 5ZM1-7H3L9 4L7 5Z", color);
  } else if (era < 7) {
    shape("M-2-25H0V3H-2Z", "#796347");
    shape("M-1-24Q-12-17-12-5L-2-7Z", "#efe4c6");
    shape("M1-22Q12-17 13-6L1-7Z", "#d8cfb0");
    shape("M-1-27L9-25L-1-22Z", color);
    ctx.strokeStyle = "#625b4777";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1, -24);
    ctx.lineTo(-15, 1);
    ctx.moveTo(0, -22);
    ctx.lineTo(16, 0);
    ctx.stroke();
    shape("M-13-1H-6V2H-13Z", "#9b7d57");
  } else if (era >= 9) {
    shape("M-16-4L15-5L19-2L12 5H-14Z", era >= 11 ? "#8aa6a7" : "#536970");
    if (military) {
      shape(
        "M-9-12H-2V-4H-9ZM-5-18H-3V-11H-5ZM5-8H10V-4H5ZM8-9H17V-7H8Z",
        "#b0c6bf",
      );
      shape("M-15-5H-10V-3H-15Z", color);
    } else {
      shape("M-14-12H-7V-4H-14Z", "#dce1c9");
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? color : "#cba66d";
        ctx.fillRect(-5 + i * 5, -9 - (i % 2) * 2, 4, 5);
      }
      if (era >= 11) shape("M-2-13H11V-11H-2Z", "#b5e2db");
    }
  } else {
    shape("M-13-10H-3V0H-13Z", "#d8d7c3");
    shape("M-15-12H-2V-9H-15Z", "#718c8a");
    shape("M-12-8H-9V-5H-12ZM-7-8H-4V-5H-7Z", "#426775");
    shape("M-8-17H-5V-12H-8Z", "#5b5e55");
    shape("M0-5H7V0H0Z", color);
    shape("M8-6H15V-1H8Z", "#ba9973");
    if (military) shape("M4-8H8V-3H4ZM6-9H18V-7H6Z", "#7d9493");
    ctx.strokeStyle = "#c2c5af";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-14, -1);
    ctx.lineTo(16, -3);
    ctx.stroke();
  }
  ctx.restore();
}
