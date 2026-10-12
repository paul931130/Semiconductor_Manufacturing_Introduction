// Wafer Quest level data — Part 0 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 0,
    part: 0,
    title: "The Big Picture",
    station: "Starting Gate",
    intro: "A brand-new blank wafer rests quietly in its carrier, about to begin a journey of hundreds of steps over several months. Study the map first so you know where it is headed.",
    path: "en/0-before-you-start/00-overview/README.md",
    challenges: [
      {
        type: "order",
        q: "Put the stages of a chip's journey in order",
        items: ["Design", "Mask making", "Wafer start", "Front end", "Wafer test", "Packaging"],
        explain: "The map reads: Design → Mask making → Wafer start → Front end → Wafer test → Packaging → Final test → Shipment."
      },
      {
        type: "match",
        q: "Match the three basic fab units to their meanings",
        pairs: [
          ["Lot", "Wafers that move and are processed together"],
          ["Route", "All steps a product goes through, in order"],
          ["Recipe", "Settings a tool uses for a step"]
        ],
        explain: "A lot is like a carton of eggs, a route like the steps of a cooking recipe, and a recipe like an oven's temperature and time settings."
      },
      {
        type: "quiz",
        q: "What is the main difference between a foundry and an IDM?",
        options: [
          "A foundry owns no fab",
          "An IDM only does packaging and test",
          "A foundry makes chips for others, while an IDM mainly makes its own products",
          "A foundry designs and sells its own chips"
        ],
        answer: 2,
        explain: "Both own fabs. An IDM mainly makes its own products, while a foundry makes products for customers."
      },
      {
        type: "truefalse",
        q: "When demand suddenly jumps, wafers started immediately will become chips very soon.",
        answer: false,
        explain: "From wafer start to shipment, front end plus back end often takes three or four months or more, so supply cannot recover quickly."
      }
    ]
  },
  {
    chapter: 1,
    part: 0,
    title: "How a Fab Works",
    station: "The Fab",
    intro: "The wafer is sealed into a FOUP and carried by an overhead vehicle through the ceiling of the cleanroom, arriving at a factory that never stops running.",
    path: "en/0-before-you-start/01-how-a-fab-works/README.md",
    challenges: [
      {
        type: "quiz",
        alarm: true,
        q: "A tool just finished maintenance: new parts, cleaned chamber. The line wants it back now. What do you do?",
        options: [
          "Release it for production right away to save time",
          "Run test wafers first, check particles and film thickness, then release it if they pass",
          "Run a lot of product wafers to see how it goes",
          "Just give it a quick visual check"
        ],
        answer: 1,
        explain: "Maintenance changes conditions inside the tool. Run test wafers (a \"qual\") first, or the first lot of product may be scrapped."
      },
      {
        type: "truefalse",
        q: "A cleanroom is a space with absolutely no dust.",
        answer: false,
        explain: "A cleanroom is classified by how many particles there are per unit volume; the smaller the class number, the cleaner the room."
      },
      {
        type: "match",
        q: "Match each handling item to its job",
        pairs: [
          ["FOUP", "Sealed box holding up to 25 wafers"],
          ["OHT", "Ceiling vehicle that carries FOUPs"],
          ["Stocker", "Temporary storage for waiting FOUPs"],
          ["Load port", "Platform where a FOUP sits at a tool"]
        ],
        explain: "Wafers ride in FOUPs, are carried by OHT, wait in stockers, and are placed on a tool's load port."
      },
      {
        type: "quiz",
        q: "What happens when there is more work in process (WIP) on the line?",
        options: [
          "Yield always goes up",
          "Wafers wait longer for tools, so cycle time gets longer",
          "Tools need less maintenance",
          "Output always increases"
        ],
        answer: 1,
        explain: "The more WIP, the longer each wafer waits in line, just as more cars make a highway more congested."
      }
    ]
  }
]);
