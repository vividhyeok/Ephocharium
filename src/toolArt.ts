/** Purpose-drawn illuminated game emblems; each action has a distinct silhouette. */
export function toolArt(name: string, size: number): string | undefined {
  const gold = "#e6c689",
    ink = "#344f50",
    light = "#f6e6bd",
    green = "#7fb198",
    blue = "#80b8c5";
  const path = (d: string, fill = gold) => `<path d="${d}" fill="${fill}"/>`;
  const circle = (x: number, y: number, r: number, fill = gold) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
  const person = (x: number) =>
    circle(x, 10, 4, light) +
    path(
      `M${x - 5} 17Q${x} 13 ${x + 5} 17L${x + 6} 26H${x + 2}V33H${x - 2}V26H${x - 6}Z`,
      green,
    );
  const wave =
    path("M3 25Q8 21 13 25T23 25T37 25V28Q30 24 25 28T13 28T3 28Z", blue) +
    path("M3 32Q8 28 13 32T23 32T37 32V34H3Z", "#548b9c");
  const leaf = path(
    "M19 32V20C5 23 3 13 5 7C18 7 22 12 20 19C21 8 29 5 36 5C37 17 30 23 22 21V32Z",
    green,
  );
  const shield =
    path("M7 7L20 3L33 7V20Q31 31 20 37Q9 31 7 20Z", gold) +
    path("M11 10L20 7V31Q12 25 11 18Z", green);
  const sword = path("M18 3L22 3L23 23H27V27H22V35H18V27H13V23H17Z", light);
  const book =
    path("M4 7Q13 4 20 9Q28 4 36 7V32Q27 29 20 34Q12 29 4 32Z", gold) +
    path(
      "M7 10Q14 8 18 11V28Q12 26 7 28ZM22 11Q28 8 33 10V28Q27 26 22 28Z",
      light,
    );
  const symbols: Record<string, string> = {
    health: path('M7 9H33V35H7Z',light)+path('M13 3H27V9H23V7H17V9H13Z',gold)+path('M18 14H23V20H29V25H23V31H18V25H12V20H18Z','#bc7866'),
    demography: person(10)+person(28)+path('M2 36H38V39H2Z',gold),
    research: path('M15 3H25V7H23V17L34 32Q35 37 30 37H10Q5 37 6 32L17 17V7H15Z',light)+path('M13 25H27L31 33H9Z',blue)+circle(18,29,2,light),
    air: path('M2 20L16 15L18 3Q20-1 22 3L24 15L38 20V24L24 21V31L29 34V37L20 35L11 37V34L16 31V21L2 24Z',light)+path('M18 6H22V13H18Z',blue),
    ship: path('M2 25L38 23L31 34H9Z','#947354')+path('M19 2H21V26H19Z',gold)+path('M17 4Q4 12 6 22L17 20Z',light)+path('M23 6Q33 13 34 20H23Z','#c9d5bf')+path('M7 35H33V38H7Z',blue),
    port: path('M18 3H22V26Q29 26 32 21H27L34 14L39 23H35Q31 35 20 37Q9 35 5 23H1L6 14L13 21H8Q11 26 18 26V12H11V8H18Z',gold)+circle(20,5,4,light)+circle(20,5,2,ink),
    road:path('M13 2H27L38 38H2Z','#879b91')+path('M19 3H21V10H19ZM18 15H22V23H18ZM17 29H23V38H17Z',light),
    rail:path('M11 2H15L10 38H5ZM25 2H29L35 38H30Z',light)+path('M9 9H31V12H9ZM8 19H32V22H8ZM6 30H34V33H6Z','#ac8c64'),
    industry:path('M3 18L14 11V18L25 11V18H37V36H3Z','#ac8b6c')+path('M28 3H34V18H28Z','#718783')+path('M7 23H12V28H7ZM17 23H22V28H17ZM27 23H32V28H27Z',light)+path('M17 31H24V36H17Z',ink),
    mine:path('M2 35L8 12L20 3L32 12L38 35Z','#8b9c90')+path('M10 35V21Q20 9 30 21V35Z',ink)+path('M8 18L20 10L32 18V22L20 15L8 23Z',gold)+path('M11 22H15V35H11ZM25 22H29V35H25Z','#a58b65'),
    inspect:
      circle(16, 16, 12, gold) +
      circle(16, 16, 8, blue) +
      path("M24 23L36 33L32 37L22 26Z", gold) +
      path("M11 15Q13 10 18 11V13Q14 12 13 16Z", light),
    eye:
      path("M2 20Q20 1 38 20Q20 39 2 20Z", light) +
      circle(20, 20, 8, green) +
      circle(20, 20, 4, ink),
    human: person(20),
    population: person(12) + person(28),
    life: leaf,
    nature: leaf,
    forest: leaf,
    erase:
      path("M7 23L23 5L37 18L21 36H13Z", gold) +
      path("M7 23L16 15L30 28L21 36H13Z", "#c58578") +
      path("M25 34H38V37H23Z", light),
    fire:
      path(
        "M21 2C23 14 34 14 33 25C32 40 7 40 6 25C5 18 11 13 13 9C12 17 16 20 18 17C22 12 17 7 21 2Z",
        "#d47d57",
      ) + path("M21 18C23 25 28 25 26 31C24 37 14 34 15 28Z", gold),
    meteor:
      path("M8 22L27 2L24 14L38 6L27 27Z", "#d88b56") +
      circle(14, 27, 10, "#8e8b80") +
      path("M7 23L14 19L20 23L16 26Z", gold) +
      circle(12, 30, 3, ink),
    plague:
      circle(20, 20, 11, green) +
      [0, 60, 120, 180, 240, 300]
        .map(
          (a) =>
            `<g transform="rotate(${a} 20 20)">${path("M18 2H22V10H18Z", green)}${circle(20, 3, 3, green)}</g>`,
        )
        .join("") +
      circle(16, 18, 3, ink) +
      circle(24, 23, 2, ink),
    flood: wave + path("M7 20V11L17 3L27 11V20H21V14H14V20Z", gold),
    rain:
      path("M5 18C-1 10 9 4 14 8C18-2 31 4 30 10C40 9 41 21 32 21H8Z", blue) +
      path(
        "M10 25L7 33H11L14 25ZM22 25L19 35H23L26 25ZM33 25L30 32H34L37 25Z",
        blue,
      ),
    ocean:
      wave +
      path("M3 15Q9 8 15 15T27 15T37 15V19Q30 12 24 19T12 19T3 19Z", blue),
    land:
      path("M2 30L11 18L19 25L28 10L38 30V35H2Z", green) +
      path("M23 19L28 10L32 19L28 17Z", light),
    mountain:
      path("M1 34L13 10L21 24L29 3L39 34Z", "#8ea59d") +
      path("M17 34L29 3L29 34Z", "#c4d0b9") +
      path("M25 13L29 3L33 15L29 12Z", light),
    resource:
      path("M3 25L11 6L21 12L27 3L37 25L29 35H10Z", blue) +
      path("M11 6L13 26L21 12ZM27 3L25 28L37 25Z", light) +
      path("M3 25L13 26L10 35ZM25 28L29 35L37 25Z", "#537f86"),
    war: `<g transform="rotate(-40 20 20)">${sword}</g><g transform="rotate(40 20 20)">${sword}</g>`,
    protect: shield,
    peace: leaf + path("M8 26L13 23L20 30L31 20L35 24L21 37Z", light),
    alliance:
      path("M2 16L10 10L20 18L30 10L38 16L24 31L17 31Z", gold) +
      path("M12 14L17 10L28 20L24 24L18 18L14 21L10 17Z", green),
    nation:
      path("M9 3H12V37H9Z", light) +
      path("M12 4Q22 0 34 6L29 13L34 20Q22 14 12 19Z", gold),
    revolt: path(
      "M11 35V21L7 16L10 12L15 16V5H19V14H21V3H25V14H27V7H31V23L26 28V35Z",
      "#ce9970",
    ),
    aid: shield + path("M18 11H23V18H30V23H23V30H18V23H11V18H18Z", light),
    history: book,
    help: book + path("M18 13H23V22H18ZM18 25H23V29H18Z", ink),
    settings:
      path(
        "M15 2H25L27 9L34 8L39 17L33 22L35 29L27 36L21 32L14 37L6 31L8 24L1 19L6 10L13 10Z",
        gold,
      ) +
      circle(20, 20, 8, ink) +
      circle(20, 20, 4, blue),
    world:
      circle(20, 20, 17, blue) +
      path(
        "M8 8L18 5L22 11L16 15L18 22L11 25L6 18ZM28 15L35 18L32 28L24 34L21 26L24 21Z",
        green,
      ),
    save:
      path("M5 3H29L36 10V37H5Z", gold) +
      path("M11 3H26V15H11ZM11 24H30V37H11Z", ink) +
      path("M16 5H22V12H16ZM14 27H27V30H14ZM14 32H27V34H14Z", light),
    compass:
      circle(20, 20, 17, gold) +
      circle(20, 20, 14, ink) +
      path("M27 8L22 23L13 32L18 17Z", light) +
      path("M27 8L22 23L18 17Z", "#d48d72"),
  };
  const aliases:Record<string,string>={plane:'air',transport:'ship',train:'rail'};
  name=aliases[name]||name;
  if (!symbols[name]) return;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${symbols[name]}</svg>`;
}
