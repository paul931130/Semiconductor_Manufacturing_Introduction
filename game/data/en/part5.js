// Wafer Quest level data — Part 5 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 19, part: 5,
    title: "Wafer Test: WAT and CP",
    station: "Test Floor",
    intro: "Front-end is done and our wafer has left the fab, now sitting under the probes. Was the process normal, and is each die good or bad?",
    path: "en/5-backend/19-wafer-test/README.md",
    challenges: [
      { type: "match", q: "Match each term to its meaning",
        pairs: [["WAT","Tests scribe-line test keys; checks process"],["CP","Tests the function of every die"],["Bin","Category assigned after testing"],["KGD","Known good die"]],
        explain: "WAT checks whether the process was right, CP checks whether each chip is usable; CP bins make the wafer map, and good dies are KGD." },
      { type: "wafermap", pattern: "random", q: "This wafer passed WAT on every parameter, but the CP wafer map shows bad dies scattered randomly. What is most likely?",
        options: ["The whole wafer's process parameters shifted","Randomly distributed defects; WAT measures only a few test keys and may miss them","The probe card is completely broken","The wafer map orientation is flipped"],
        answer: 1,
        explain: "WAT only measures a few locations in the scribe lines, so it can't represent every die. Random defects may be missed, so look at WAT and CP together." },
      { type: "quiz", alarm: true, q: "CP yield suddenly drops, and many dies that should be good are judged bad. What do you suspect first?",
        options: ["Wrong wafer ID","Worn or contaminated probes causing poor contact","Probe marks too deep","The color of the tester"],
        answer: 1,
        explain: "Worn or contaminated probes, or an abnormal pad surface, cause poor contact, so good dies are judged bad." },
      { type: "truefalse", q: "WAT measures the product circuits themselves, so passing WAT means every die is good.", answer: false,
        explain: "WAT measures test keys in the scribe lines. It shows the process was normal, but doesn't guarantee every die is good." }
    ]
  },
  {
    chapter: 20, part: 5,
    title: "Packaging: Making the Chip Usable",
    station: "Packaging House",
    intro: "The wafer map travels with our wafer to the packaging house. The good dies will be cut out and given a \"house\" so they can be soldered onto a circuit board.",
    path: "en/5-backend/20-packaging/README.md",
    challenges: [
      { type: "order", q: "Put the first six traditional packaging steps in order",
        items: ["Backgrinding","Dicing","Die attach","Wire bonding","Molding","Marking"],
        explain: "Thin the wafer, then dice it; attach good dies per the wafer map, wire bond, mold to protect, and finally mark the product name and lot number." },
      { type: "match", q: "Match each term to its meaning",
        pairs: [["Wire bonding","Thin metal wires connect pads"],["Flip chip","Die face down, bumps to substrate"],["Underfill","Fills the gap, spreads stress"]],
        explain: "Wire bonding is the most traditional and common method; flip chip turns the die face down, and underfill protects the bumps and spreads stress." },
      { type: "quiz", alarm: true, q: "A bag of chips opened long ago is about to go through the solder oven. To avoid the \"popcorn effect\", what do you do?",
        options: ["Solder right away, we are in a hurry","Bake them first to remove moisture","Add a little more moisture","Raise the temperature even higher"],
        answer: 1,
        explain: "Packages absorb moisture. At soldering temperatures it vaporizes and expands instantly, causing delamination or even cracking, so over-time parts are baked first." },
      { type: "truefalse", q: "Wire bonding is an old technology, so it is rarely used now.", answer: false,
        explain: "Wire bonding is still the most common packaging method because it is low cost and mature." }
    ]
  },
  {
    chapter: 21, part: 5,
    title: "Advanced Packaging",
    station: "Advanced Packaging",
    intro: "Our die no longer works alone. It will sit beside other chiplets, or even be stacked, to become part of one system.",
    path: "en/5-backend/21-advanced-packaging/README.md",
    challenges: [
      { type: "match", q: "Match each approach to its feature",
        pairs: [["2.5D","Chips side by side on an interposer"],["Fan-out","RDL spreads contacts outward"],["3D stacking","Chips stacked, linked by TSVs"],["Hybrid bonding","Copper pads bond directly, no bumps"]],
        explain: "2.5D uses an interposer, fan-out uses a redistribution layer, 3D stacking uses TSVs, and hybrid bonding joins copper pads and insulator together." },
      { type: "order", q: "Order by contact pitch, largest to smallest",
        items: ["Flip-chip bumps","Micro bumps","Hybrid bonding"],
        explain: "Flip-chip bumps are over a hundred micrometers, micro bumps tens of micrometers, hybrid bonding below ten. Smaller pitch means more connections." },
      { type: "quiz", q: "An advanced package holds eight chips, each with 99% yield. About how likely is it that all eight are good?",
        options: ["99%","About 92%","About 50%","About 80%"],
        answer: 1,
        explain: "Yields multiply: 0.99 to the eighth power is about 92%, so every chip must be a KGD before packaging." },
      { type: "quiz", alarm: true, q: "After hybrid bonding, a large patch of contacts all fail to bond. What is the most likely cause?",
        options: ["The bumps are too small","A particle or an uneven bonding surface","Too much underfill","The wrong substrate color"],
        answer: 1,
        explain: "With no bumps to cushion, one particle props open a gap, so bonding surfaces need front-end-level CMP and cleaning." }
    ]
  },
  {
    chapter: 22, part: 5,
    title: "Final Test and Reliability",
    station: "Final Test",
    intro: "Our packaged chip is dropped into a test socket. Before shipping, it must prove it works now and will keep working for years.",
    path: "en/5-backend/22-final-test-and-reliability/README.md",
    challenges: [
      { type: "order", q: "Put the bathtub curve periods in time order",
        items: ["Early failure period","Stable period","Wear-out period"],
        explain: "Weak chips fail soon after start, then the failure rate stays low and stable, and after years materials age and it rises again." },
      { type: "match", q: "Match each aging mechanism to what happens",
        pairs: [["Electromigration","Voids form and break the wire"],["TDDB","Insulator broken down by field"],["HCI","Hot electrons enter gate insulator"],["BTI","Heat plus voltage drifts Vt"]],
        explain: "All four are aging mechanisms caused by long-term current, voltage and temperature." },
      { type: "truefalse", q: "Burn-in makes chips more durable.", answer: false,
        explain: "Burn-in only makes weak chips fail early in the factory so they are screened out. It doesn't make chips more durable." },
      { type: "quiz", alarm: true, q: "A customer asks: \"Will this chip fail?\" How do you answer?",
        options: ["Predict the day this chip will fail","Describe it with a failure rate such as FIT","Guarantee it will never fail","Refuse to discuss it"],
        answer: 1,
        explain: "Reliability is statistics. You can't predict one chip, but FIT (failures per billion device-hours) describes the failure probability of a population." }
    ]
  }
]);
