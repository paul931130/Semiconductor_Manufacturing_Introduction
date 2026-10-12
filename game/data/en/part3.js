// Wafer Quest level data — Part 3 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 11,
    part: 3,
    title: "A Complete CMOS Process Flow",
    station: "Integration Hub",
    intro: "You have passed through every module. Now the wafer is strung into one complete CMOS flow, from blank wafer to finished chip.",
    path: "en/3-integration/11-cmos-process-flow/README.md",
    challenges: [
      {
        type: "order",
        q: "Put the FEOL transistor-building steps in order",
        items: ["Isolation", "Wells", "Gate", "Light doping", "Sidewall spacers", "Source and drain"],
        explain: "Isolate with STI first, then wells, gate and light doping, then spacers, and only then the deep, heavy source and drain implant and anneal."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["FEOL", "Builds the transistors"],
          ["MOL", "Connects transistors to wiring"],
          ["BEOL", "Builds multilevel metal wiring"],
          ["STI", "Insulating trenches between transistors"]
        ],
        explain: "FEOL, MOL and BEOL build the transistors, the contacts and the multilevel wiring in turn; STI is one of the earliest isolation structures in FEOL."
      },
      {
        type: "quiz",
        alarm: true,
        q: "The dispatch board shows lots of wafers piling up in front of the lithography tools, and cycle time keeps growing. What is the most likely reason?",
        options: [
          "There are too few mask layers, so the flow is too short",
          "Wafers pass through the litho area only once",
          "Wafers keep returning to the same tools, and new and nearly finished wafers compete for them",
          "The BEOL copper wires are too thick"
        ],
        answer: 2,
        explain: "A wafer returns to lithography dozens of times. This re-entrant flow makes scheduling especially complex, and wafers pile up in front of bottleneck tools."
      },
      {
        type: "truefalse",
        q: "Advanced processes first build a dummy polysilicon gate because a metal gate cannot withstand the high temperature of the source and drain anneal.",
        answer: true,
        explain: "The dummy gate holds the place until the high-temperature steps are done, then it is removed and replaced with the metal gate. This \"fake first, real later\" thinking is common in advanced processes."
      }
    ]
  },
  {
    chapter: 12,
    part: 3,
    title: "Advanced Transistor Structures",
    station: "3D Transistor Bay",
    intro: "Planar transistors have hit their limit. Your wafer heads to a new line where the channel stands up and the gate wraps all the way around it.",
    path: "en/3-integration/12-advanced-transistors/README.md",
    challenges: [
      {
        type: "quiz",
        q: "Why does leakage get worse when a planar transistor is shrunk?",
        options: [
          "The gate is too thick for current to pass",
          "The gate controls the channel only from above, so current slips through deeper down",
          "The wafer material was changed to germanium",
          "The source and drain end up too far apart"
        ],
        answer: 1,
        explain: "When source and drain get too close, the gate controls only from above and current sneaks through the deeper region, like a faucet that will not shut."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["FinFET", "Gate wraps a fin on three sides"],
          ["GAA", "Gate wraps the channel on four sides"],
          ["Nanosheet", "Horizontally stacked thin-sheet channels"],
          ["Backside power", "Power lines moved to wafer back"]
        ],
        explain: "FinFET wraps three sides and GAA wraps four; the nanosheet is the mainstream GAA form today; backside power leaves the front for signal wiring."
      },
      {
        type: "order",
        q: "Put the key GAA nanosheet steps in order",
        items: ["Alternate Si and SiGe epitaxy", "Form fin-shaped stacks", "Build dummy gate", "Form inner spacers", "Remove SiGe, release channels", "Fill in the gate"],
        explain: "The key step is a highly selective etch that removes the SiGe and releases the channels; ALD then fills the gate insulator and metal into the gaps."
      },
      {
        type: "truefalse",
        q: "Like nanosheets, FinFET drive strength can be tuned freely and continuously.",
        answer: false,
        explain: "FinFET drive strength depends on the number of fins, so designers can only choose one, two or three; the nanosheet width is what can be adjusted."
      }
    ]
  },
  {
    chapter: 13,
    part: 3,
    title: "Memory Processes",
    station: "Memory Line",
    intro: "This wafer will become memory: billions of identical cells in a giant array, and the structure has to grow upward.",
    path: "en/3-integration/13-memory/README.md",
    challenges: [
      {
        type: "quiz",
        q: "What is each DRAM memory cell made of?",
        options: [
          "Two transistors and a fuse",
          "A capacitor and a storage layer",
          "One transistor and a metal line",
          "One transistor and one capacitor"
        ],
        answer: 3,
        explain: "The transistor is the switch and the capacitor is a small bucket of charge: charge means 1, no charge means 0, and it must be refreshed regularly."
      },
      {
        type: "order",
        q: "Put the main 3D NAND flow in order",
        items: ["Stack oxide and nitride", "Etch channel holes", "Deposit storage and channel", "Form the staircase", "Replace nitride with metal"],
        explain: "Stack the layers, etch the channel holes in one go, deposit storage layer and channel, shape the staircase so contacts reach each layer, then swap nitride for word line metal."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["DRAM", "Charge in capacitor, needs refresh"],
          ["NAND", "Keeps data after power-off"],
          ["HBM", "Several DRAM dies stacked vertically"],
          ["TSV", "Vertical wire through the die"]
        ],
        explain: "HBM stacks several DRAM dies and uses TSVs to connect the dies above and below, giving very high bandwidth."
      },
      {
        type: "quiz",
        alarm: true,
        q: "After hundreds of 3D NAND film layers, the wafer is badly warped and cannot lie flat on the scanner. What should you do?",
        options: [
          "Deposit every film layer thicker",
          "Speed up the robot arm",
          "Tune each film's stress so tension and compression cancel, and add a compensating film on the back if needed",
          "Release it anyway; overlay error is small"
        ],
        answer: 2,
        explain: "Every film has a little stress, and hundreds of layers add up to wafer warpage, causing overlay error and even trouble for the robot arm."
      }
    ]
  },
  {
    chapter: 14,
    part: 3,
    title: "Reading Process Nodes",
    station: "Node Decoder",
    intro: "The news says your wafer is \"3 nm\". The engineers say that number hides a twist.",
    path: "en/3-integration/14-process-nodes/README.md",
    challenges: [
      {
        type: "truefalse",
        q: "On a chip made with a \"3 nm\" process, some structure is exactly 3 nm wide.",
        answer: false,
        explain: "The \"nm\" is a generation name, not an actual dimension. On a 3 nm-generation chip the gate pitch is around forty to fifty nanometers."
      },
      {
        type: "quiz",
        q: "The news says one company's \"N nm\" beats another's \"M nm\". What should you compare?",
        options: [
          "The node name; the smaller number wins",
          "Transistor density, gate pitch, metal pitch and SRAM cell area",
          "How famous the company is",
          "The diameter of the wafer"
        ],
        answer: 1,
        explain: "Node names have no common standard, and processes with the same name can differ a lot in density, so look at the actual density and pitch numbers."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["CPP", "Distance between neighboring gates"],
          ["MMP", "Pitch of the densest metal layer"],
          ["PDK", "Design rules and electrical models"],
          ["DTCO", "Design-process co-optimization"]
        ],
        explain: "The PDK is the data a fab gives designers and bridges design and process; DTCO can shrink a chip even when process dimensions barely shrink."
      },
      {
        type: "quiz",
        q: "An automotive power-management chip has modest volume and needs high voltage and long-proven reliability. Which process usually fits?",
        options: [
          "It must use the newest generation",
          "Only structures other than planar transistors",
          "A process that needs no masks",
          "A mature process of twenty-odd nanometers or more"
        ],
        answer: 3,
        explain: "Advanced processes have very high mask and design costs; many analog and high-voltage circuits actually do better on mature processes, with long-proven reliability."
      }
    ]
  }
]);
