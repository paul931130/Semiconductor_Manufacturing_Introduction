// Wafer Quest level data — Part 6 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 23, part: 6,
    title: "How the Fab Is Managed by Systems",
    station: "Control Room",
    intro: "Looking back, our wafer never took a wrong turn: every track-in and track-out was directed and recorded by systems.",
    path: "en/6-beyond-the-fab/23-fab-systems/README.md",
    challenges: [
      { type: "match", q: "Match each system to its analogy",
        pairs: [["MES","The brain and ledger of the fab"],["Dispatching","Traffic lights"],["Equipment automation","The tools' interpreter"],["Yield analysis","The detective"]],
        explain: "MES records each lot's location and next step, dispatching picks the next lot, equipment automation links tools to the MES, and yield analysis combines data to find causes." },
      { type: "order", q: "Put what happens when a lot arrives in order",
        items: ["Place on Load Port","System runs checks","Download recipe, track in","Process, send data","Track out, write history","Decide next step"],
        explain: "The carrier is read and every check passes before the recipe is downloaded and track-in recorded; after processing, track-out writes the history and the system decides the next step." },
      { type: "quiz", alarm: true, q: "A rush order is due, and someone wants to skip a system check for now. What do you do?",
        options: ["Skip it now, fix the record later","Go through formal request and approval, and keep a record","Ask the operator to handle it quietly","Turn off the interlock rule"],
        answer: 1,
        explain: "Many rules were learned from past incidents. Exceptions need formal approval and a record, and the rule should be reviewed afterward." },
      { type: "truefalse", q: "If the system shows a lot has tracked out but the wafers are not actually finished, that mismatch must be handled immediately.", answer: true,
        explain: "System status and the physical wafers must agree. A mismatch must be handled right away." }
    ]
  },
  {
    chapter: 24, part: 6,
    title: "How the Process Shapes Firmware",
    station: "Finished Product",
    intro: "The end of the journey: our wafer has become chips, now inside a product. Firmware takes over, and the quirks of the process hide in every rule it follows.",
    path: "en/6-beyond-the-fab/24-process-and-firmware/README.md",
    challenges: [
      { type: "truefalse", q: "The higher the temperature, the faster DRAM leaks, so the refresh rate usually has to go up.", answer: true,
        explain: "DRAM capacitors leak charge, and the higher the temperature the faster they leak, so refresh is usually more frequent when hot." },
      { type: "match", q: "Match each NAND limit to the firmware countermeasure",
        pairs: [["No in-place overwrite","FTL and garbage collection"],["Limited erase cycles","Wear leveling"],["Bad blocks from factory","Bad block management"],["Charge slowly leaks","Strong ECC, read retry"]],
        explain: "Every firmware feature maps to a physical limit." },
      { type: "quiz", alarm: true, q: "You find a timing parameter in firmware that makes no sense. What should you do before changing it?",
        options: ["Change it to a value that feels reasonable","Find its source, such as the datasheet or characterization report","Delete the whole block","Test it on a few samples and be done"],
        answer: 1,
        explain: "Such numbers usually come from measurements of many chips at different temperatures and voltages, with margin for variation and aging." },
      { type: "quiz", q: "A chip's stepping changes from A0 to A1. What does that usually mean?",
        options: ["Transistors changed too, most masks redone","Only the upper metal wiring was modified","Only the package changed","The chip was recalled"],
        answer: 1,
        explain: "A common convention: a letter change means the transistors were modified too, a number change means only upper metal layers changed; the actual rule depends on the company." }
    ]
  }
]);
