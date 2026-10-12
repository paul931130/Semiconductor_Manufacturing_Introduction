// Wafer Quest level data — Part 1 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 2,
    part: 1,
    title: "From Physics to Transistors",
    station: "Transistor Lab",
    intro: "Before the work begins, the wafer gets a lesson: its surface will grow billions of tiny switches. Know the transistor and every later process will make sense.",
    path: "en/1-fundamentals/02-transistor-basics/README.md",
    challenges: [
      {
        type: "match",
        q: "Match each MOSFET part to its job",
        pairs: [
          ["Source", "Where the current comes in"],
          ["Drain", "Where the current goes out"],
          ["Gate", "The gate that opens and closes the flow"],
          ["Channel", "Region under the gate between source and drain"]
        ],
        explain: "A MOSFET is like a water gate: the source is the supply, the drain is the outlet, and the gate decides whether the channel lets current through."
      },
      {
        type: "quiz",
        q: "What do you get by adding a little phosphorus or arsenic to silicon?",
        options: [
          "P-type, because of extra holes",
          "An insulator",
          "N-type, because of an extra freely moving electron",
          "Still pure silicon, with no change in conduction"
        ],
        answer: 2,
        explain: "Phosphorus and arsenic have five outer electrons, leaving a free electron: N-type. Boron leaves a hole: P-type."
      },
      {
        type: "truefalse",
        q: "When a CMOS circuit is not switching, one transistor in each pair is always off, so it uses almost no power.",
        answer: true,
        explain: "NMOS and PMOS are used in pairs, and this is why CMOS became the mainstream technology for modern chips."
      },
      {
        type: "quiz",
        alarm: true,
        q: "The gate line width came out slightly smaller than the target. What most directly reveals the effect on the transistors?",
        options: [
          "Wait for the customer to complain",
          "Just look at the wafer's appearance",
          "Measure electrical parameters such as Vt, drive current and leakage current",
          "Assume the effect is small and do nothing"
        ],
        answer: 2,
        explain: "Small changes in line width, oxide thickness or doping change the electrical behavior. Electrical parameters are the most direct report card of the process."
      }
    ]
  },
  {
    chapter: 3,
    part: 1,
    title: "From Sand to Wafer",
    station: "Wafer Supplier",
    intro: "Our wafer began as quartz sand. After purification, crystal growth, slicing and polishing, it is now a mirror-smooth blank silicon disc, ready to ship to the fab.",
    path: "en/1-fundamentals/03-sand-to-wafer/README.md",
    challenges: [
      {
        type: "order",
        q: "Put the steps from ingot to wafer in order",
        items: ["Shape ingot", "Slice", "Lap and edge-round", "Etch", "Polish", "Clean and inspect"],
        explain: "Shape the ingot → Slice → Lap and edge-round → Etch → Polish → Clean and inspect. Only wafers that pass are shipped."
      },
      {
        type: "quiz",
        q: "Electronic-grade polysilicon has \"eleven nines\" of purity. What does that mean?",
        options: [
          "About 99% pure",
          "Fewer than one impurity atom per hundred billion silicon atoms",
          "It contains 11% impurities",
          "Nine impurity atoms per thousand silicon atoms"
        ],
        answer: 1,
        explain: "99.999999999% means fewer than one impurity atom per hundred billion silicon atoms. Metallurgical-grade silicon, at 98 to 99%, is nowhere near enough."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["Monitor wafer", "Checks the condition of tools"],
          ["Dummy wafer", "Fills empty slots in batch tools"],
          ["Reclaimed wafer", "Polished and reused wafer"],
          ["Notch", "Edge cut that sets orientation"]
        ],
        explain: "You cannot risk product wafers to test tools, so fabs use monitor wafers, dummy wafers to fill slots, and reclaim them for reuse."
      },
      {
        type: "truefalse",
        q: "A 300 mm wafer has 2.25 times the area of a 200 mm wafer, so processing one costs 2.25 times as much.",
        answer: false,
        explain: "The cost of processing a wafer does not rise that much, so a larger wafer makes each die cheaper."
      }
    ]
  }
]);
