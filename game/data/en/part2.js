// Wafer Quest level data — Part 2 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 4, part: 2, title: "Lithography", station: "Litho bay",
    intro: "Your wafer rolls into the yellow-lit litho bay. Fresh photoresist is on, waiting for the circuit pattern to be printed.",
    path: "en/2-process-modules/04-lithography/README.md",
    challenges: [
      { type: "order", q: "Put the first six lithography steps in order", items: ["Surface prep", "Resist coat", "Soft bake", "Align and expose", "Post-exposure bake", "Develop"], explain: "The flow is surface prep, resist coat, soft bake, align and expose, post-exposure bake, develop, and finally inspection (ADI)." },
      { type: "quiz", alarm: true, q: "ADI alarm: this lot's CD is out of spec, but it has not been etched yet. What do you do?", options: ["Send it to etch and fix it later", "Strip the resist, then recoat and re-expose (rework)", "Scrap the whole lot", "Raise the scanner's light wavelength"], answer: 1, explain: "Only a layer of resist has been added and the material underneath is untouched, so lithography is the last chance to redo." },
      { type: "match", q: "Match each term to its meaning", pairs: [["Mask", "Quartz plate carrying the circuit pattern"], ["Photoresist", "Changes chemically when exposed to light"], ["Scanner", "Exposes one small field at a time"], ["Overlay", "Alignment error versus the previous layer"]], explain: "The mask is like film, resist like photo paper, the scanner like a camera; overlay is about layer-to-layer alignment." },
      { type: "truefalse", q: "Every layer of an advanced product must be exposed with EUV.", answer: false, explain: "Only the most critical layers use EUV; the other layers still use DUV to control cost." }
    ]
  },
  {
    chapter: 5, part: 2, title: "Thin Films", station: "Thin-film bay",
    intro: "Freshly cleaned, your wafer arrives at the thin-film bay to get new insulating and conducting layers, one on top of another.",
    path: "en/2-process-modules/05-thin-films/README.md",
    challenges: [
      { type: "match", q: "Match each method to its principle", pairs: [["Thermal oxidation", "Silicon reacts with oxygen"], ["PVD", "Knocked-off target atoms form a film"], ["ALD", "One atomic layer at a time"], ["Epitaxy", "Continues the lattice as single crystal"]], explain: "Each method suits certain materials: ALD is the most uniform but slow, and PVD mainly deposits metals." },
      { type: "quiz", q: "The wafer already has metal on it. Which method suits depositing an insulating film?", options: ["LPCVD, energy from high temperature", "Wet thermal oxidation", "PECVD, plasma at lower temperature", "Epitaxy"], answer: 2, explain: "Metal cannot take high temperatures; PECVD uses plasma for energy, so it can deposit at lower temperature." },
      { type: "quiz", alarm: true, q: "A pre-furnace-cleaned wafer waited for the furnace past its Q-time. What now?", options: ["It must be re-cleaned before the furnace", "Run it anyway, it looks clean", "Raise the furnace temperature to compensate", "Switch to PVD"], answer: 0, explain: "Left too long, silicon regrows native oxide and adsorbs contaminants, so the oxide quality would suffer. Re-clean it." },
      { type: "truefalse", q: "When filling a narrow trench, the more evenly the film thickens on the sidewalls, the better, with no downside.", answer: false, explain: "If the sidewalls thicken too, the opening can close first and leave a void, so gap fill wants growth from the bottom up." }
    ]
  },
  {
    chapter: 6, part: 2, title: "Etching", station: "Etch bay",
    intro: "The pattern now sits in the resist. Your wafer enters a plasma chamber to have the uncovered material carved away.",
    path: "en/2-process-modules/06-etching/README.md",
    challenges: [
      { type: "truefalse", q: "In dry etching, ions accelerated by an electric field strike the wafer almost vertically, giving straight sidewalls.", answer: true, explain: "That is why modern fine patterns are made almost entirely by dry etching; wet etching eats sideways under the resist." },
      { type: "quiz", alarm: true, q: "An etch chamber was just cleaned after maintenance. What is the risk of running product right away, and what should you do?", options: ["No risk, a clean chamber is the most stable", "The first lots will drift; run dummy wafers to season it first", "Use thicker resist", "Shorten the endpoint detection time"], answer: 1, explain: "Wall condition changes the plasma and the etch rate, so dummy wafers coat the walls with stable deposits before product runs." },
      { type: "order", q: "Put the steps after etching in order", items: ["Dry etch", "Ash the resist", "Clean", "AEI inspection"], explain: "After etching, oxygen plasma strips the resist, the wafer is cleaned, and then line width and defects are measured (AEI)." },
      { type: "match", q: "Match each term to its meaning", pairs: [["Etch rate", "How deep it cuts per minute"], ["Selectivity", "Speed ratio of target to other material"], ["Endpoint detection", "Plasma light change shows break-through"], ["Over etch", "A little extra etch after the endpoint"]], explain: "Over etch makes sure the whole wafer is cleared, but too much damages the layer underneath." }
    ]
  },
  {
    chapter: 7, part: 2, title: "Ion Implantation and Thermal Processing", station: "Implant bay",
    intro: "Resist shields the areas that must stay undoped. Your wafer enters the implanter, where dopant ions get shot into the silicon.",
    path: "en/2-process-modules/07-ion-implantation/README.md",
    challenges: [
      { type: "order", q: "Put the implanter's flow in order", items: ["Ion source", "Mass analysis", "Acceleration", "Scanning", "Wafer"], explain: "Ions are made, the wanted species is selected by a magnetic field, accelerated to the right energy, and swept across the wafer." },
      { type: "match", q: "Match each term to its meaning", pairs: [["Dose", "Atoms implanted per unit area"], ["Energy", "Sets how deep the ions go"], ["Channeling", "Ions slide too deep along lattice tunnels"], ["Activation", "Dopants move into place and conduct"]], explain: "Dose sets concentration and energy sets depth; tilting the wafer slightly avoids channeling." },
      { type: "truefalse", q: "A wrongly implanted wafer can be spotted under an ordinary microscope.", answer: false, explain: "It looks identical to a good wafer, and the error often shows up only weeks later at electrical test, with no redo possible. That is why control is so strict." },
      { type: "quiz", alarm: true, q: "A new flow adds a long, hot furnace step after the source/drain implant. What is the main risk?", options: ["The resist gets baked dry", "Dopants keep diffusing, so the doped regions grow deeper and wider", "The ion mass changes", "The wafer turns amorphous"], answer: 1, explain: "The thermal budget is limited; each hot step diffuses dopants further, raising leakage and shifting Vt. Hot steps belong early." }
    ]
  },
  {
    chapter: 8, part: 2, title: "CMP", station: "Polish bay",
    intro: "After many layers, your wafer's surface looks like rolling hills. It goes onto the polishing pad to be flattened.",
    path: "en/2-process-modules/08-cmp/README.md",
    challenges: [
      { type: "match", q: "Match each CMP part to its job", pairs: [["Polishing pad", "Pad on the rotating platen"], ["Slurry", "Liquid with abrasives and chemicals"], ["Polishing head", "Presses the wafer and controls pressure"], ["Conditioner", "Scrapes the pad to keep it rough"]], explain: "Chemicals soften the surface and abrasive particles grind it away; raised spots get more pressure and polish faster." },
      { type: "quiz", q: "Which statement correctly describes dishing?", options: ["A whole dense area ends up lower than its surroundings", "The middle of a wide metal wire is polished into a dip", "Slurry dries on the wafer", "The pad becomes too rough"], answer: 1, explain: "Dishing happens inside a single wide wire; a whole dense region going low is erosion. Causes and fixes differ." },
      { type: "quiz", alarm: true, q: "The wafer just finished polishing and is covered in slurry and particles. What is the key next step?", options: ["Let it air-dry first", "Brush, rinse and dry immediately (dry-in, dry-out)", "Send it straight to lithography", "Polish it again"], answer: 1, explain: "Once slurry dries, the particles stick hard and are very difficult to remove, and leftover particles become defects." },
      { type: "truefalse", q: "Dummy fill on a chip is spare circuitry that only turns on when something fails.", answer: false, explain: "Dummy fill only evens out pattern density so CMP polishes uniformly; it is not backup circuitry." }
    ]
  },
  {
    chapter: 9, part: 2, title: "Cleaning and Contamination Control", station: "Clean bay",
    intro: "One invisible particle can kill a transistor, so your wafer takes a bath in the chemical tanks.",
    path: "en/2-process-modules/09-cleaning/README.md",
    challenges: [
      { type: "match", q: "Match each RCA recipe to its purpose", pairs: [["SC1", "Removes particles and organics"], ["SC2", "Removes metal contamination"], ["DHF", "Removes thin oxide"], ["SPM", "Removes organics and photoresist"]], explain: "SC1 and SC2 are the core of the RCA clean; RCA is the name of the lab that published it, not a chemical." },
      { type: "quiz", alarm: true, q: "The system shows a cleaned lot has exceeded its Q-time and was automatically blocked. Who decides what next?", options: ["The operator simply releases the block", "An engineer decides to re-clean or handle otherwise", "It is scrapped automatically", "Wait for it to become clean again"], answer: 1, explain: "Lots past Q-time are blocked for an engineer to decide; lots near expiry are dispatched first." },
      { type: "truefalse", q: "Q-time is the time a process step itself takes to run.", answer: false, explain: "Q-time is the longest allowed wait between two steps, and it is not only for cleaning; copper CMP has one too." },
      { type: "quiz", q: "Why must tools and carriers that touched copper never return to the front end?", options: ["Copper makes carriers heavy", "Copper diffuses fast in silicon, and contamination causes transistor leakage", "Front-end tools cannot be powered", "Copper changes the resist color"], answer: 1, explain: "A trace of copper brought into a front-end tool contaminates every wafer that follows, so tools are split into contamination levels." }
    ]
  },
  {
    chapter: 10, part: 2, title: "Metallization", station: "Metal bay",
    intro: "The transistors are built. Your wafer reaches the final stretch, where layers of metal wire will join them into a circuit.",
    path: "en/2-process-modules/10-metallization/README.md",
    challenges: [
      { type: "order", q: "After depositing the dielectric, what is the copper damascene order?", items: ["Etch vias and trenches", "Barrier and seed layers", "Copper plating", "Anneal", "Copper CMP", "Cap layer"], explain: "Copper is hard to dry-etch, so trenches come first, then copper fill, then polishing, and finally a cap against oxidation and diffusion." },
      { type: "match", q: "Match each term to its meaning", pairs: [["Contact", "Joins transistor to first metal"], ["Via", "Joins two metal layers"], ["Barrier layer", "Keeps copper from diffusing out"], ["Low-k", "Cuts signal slowdown between wires"]], explain: "Contacts are usually filled with tungsten; low-k materials are porous and fragile, so they need careful handling." },
      { type: "truefalse", q: "Copper wires, like aluminum ones, are made by depositing metal everywhere and then etching away the unwanted parts.", answer: false, explain: "Aluminum is deposited then etched; copper is hard to dry-etch, so the damascene process etches trenches first and then fills them." },
      { type: "quiz", alarm: true, q: "After copper CMP the wafer waits for its cap layer and is nearing its Q-time. Why worry?", options: ["Copper becomes too hard", "Bare copper oxidizes and corrodes, raising via contact resistance", "The cap layer gets thicker", "The barrier layer washes away"], answer: 1, explain: "Exposed copper oxidizes and corrodes easily, so a Q-time sits between CMP and the cap layer; an engineer decides what to do if it is exceeded." }
    ]
  }
]);
