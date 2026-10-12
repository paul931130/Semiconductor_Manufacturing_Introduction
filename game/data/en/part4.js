// Wafer Quest level data — Part 4 (en). Based on the book, CC BY-NC-SA 4.0.
WaferQuest.register("en", [
  {
    chapter: 15,
    part: 4,
    title: "Metrology and Inspection",
    station: "Metrology Bay",
    intro: "A key step has just finished, and your wafer is wheeled up to the eyes of the fab: thickness, line width and defects all get a close look.",
    path: "en/4-yield-and-quality/15-metrology/README.md",
    challenges: [
      {
        type: "match",
        q: "Match each method to its use",
        pairs: [
          ["CD-SEM", "Measures line width from above"],
          ["OCD", "Scattered light gives 3D profile"],
          ["Overlay", "Aligns two layers' marks"],
          ["Four probes", "Measures sheet resistance"]
        ],
        explain: "Line width uses CD-SEM, 3D profile uses OCD, overlay measures the alignment marks of two layers, and sheet resistance uses four probes touching the surface."
      },
      {
        type: "order",
        q: "Put the defect inspection flow in order",
        items: ["Scan whole wafer", "Compare neighboring dies", "Mark differences", "Review with electron microscope"],
        explain: "Every die should look the same, so differences found by comparing neighboring dies are reviewed and classified with an electron microscope."
      },
      {
        type: "wafermap",
        pattern: "scratch",
        q: "On the defect map, the defects line up along an arc. Which defect will review most likely show?",
        options: ["Randomly landed particles", "Pattern bridging", "A scratch", "A repeating exposure field defect"],
        answer: 2,
        explain: "A straight line or an arc is the typical sign of a scratch; randomly scattered points point to particles."
      },
      {
        type: "quiz",
        alarm: true,
        q: "Two metrology tools measure the same wafer and give different results. What should you do?",
        options: [
          "Just average them and move on",
          "Calibrate the tools regularly, check repeatability and match the tools to each other",
          "Trust only the newer tool",
          "Make the photoresist thicker"
        ],
        answer: 1,
        explain: "Every process decision rests on measurement data. If measurement is off, good wafers get misjudged and automatic adjustment drifts further and further off."
      }
    ]
  },
  {
    chapter: 16,
    part: 4,
    title: "Yield and Failure Analysis",
    station: "Yield Lab",
    intro: "Wafer test is done and a wafer map lies on the table. How the bad dies are spread is the first clue to the culprit.",
    path: "en/4-yield-and-quality/16-yield-analysis/README.md",
    challenges: [
      {
        type: "quiz",
        q: "Line yield is 98%, die yield is 90% and final test yield is 99%. What is the overall yield?",
        options: ["About 98%", "About 95%", "About 87%", "About 90%"],
        answer: 2,
        explain: "Overall yield is the product of the stages: 98% x 90% x 99% leaves only about 87%."
      },
      {
        type: "wafermap",
        pattern: "edge",
        q: "On the wafer map, the bad dies form a ring at the wafer edge. Where should you look first?",
        options: ["A mask defect", "Process control problems at the wafer edge", "Randomly landed particles", "A scratch"],
        answer: 1,
        explain: "A ring, or bad dies concentrated at the edge, points to process control problems at the wafer edge."
      },
      {
        type: "order",
        q: "Put the failure analysis (FA) steps in order",
        items: ["Electrical fault isolation", "Deprocessing", "Precise cross-sectioning", "Observation and analysis"],
        explain: "Locate the failure electrically, deprocess layer by layer, cut a cross-section with the FIB, then use an electron microscope to confirm a short, open, void or contamination."
      },
      {
        type: "quiz",
        alarm: true,
        q: "On the wafer map, the bad dies sit at the same position in every exposure field. What should you check first?",
        options: [
          "The cleanliness of the fab",
          "Whether particles are landing randomly",
          "Scratches from dicing",
          "The mask used for this layer and the exposure conditions"
        ],
        answer: 3,
        explain: "The scanner uses the same mask for every exposure, so a mask defect is copied into every field. Treating it as a random defect wastes time and keeps hurting later wafers."
      }
    ]
  },
  {
    chapter: 17,
    part: 4,
    title: "Process Control",
    station: "Control Center",
    intro: "Data starts to stream into the control center. This lot's measurement point seems to be creeping toward a boundary.",
    path: "en/4-yield-and-quality/17-process-control/README.md",
    challenges: [
      {
        type: "quiz",
        alarm: true,
        q: "SPC shows a point outside the control limits (OOC) but still inside the specification limits. What do you do?",
        options: [
          "Ignore it; the product is still good",
          "Wait until the next lot is really out of spec",
          "Widen the control limits",
          "Follow the OCAP and check the tool and process right away"
        ],
        answer: 3,
        explain: "Control limits exist to warn early. It is only OOC now, but the next lot may be OOS, and by then many lots may be affected."
      },
      {
        type: "match",
        q: "Match each term to its meaning",
        pairs: [
          ["OOC", "Data outside control limits"],
          ["OOS", "Data outside spec limits"],
          ["R2R", "Adjusts next lot from prior lots"],
          ["FDC", "Watches tool sensors in real time"]
        ],
        explain: "OOC is a warning signal of the process and OOS means the product is out of spec; R2R adjusts between lots, while FDC monitors during processing."
      },
      {
        type: "truefalse",
        q: "If R2R keeps the measurement results near target, the tool must be in good condition.",
        answer: false,
        explain: "R2R keeps compensating for tool drift, so you must also watch the adjustment amount itself; otherwise the problem erupts at once when the adjustment runs out."
      },
      {
        type: "quiz",
        q: "On an SPC control chart, several points in a row fall on the same side of the center line. What does it suggest?",
        options: [
          "The metrology tool is broken",
          "The mean may have shifted",
          "The control limits are too narrow",
          "All is well, since no point is out of limits"
        ],
        answer: 1,
        explain: "Even if every point is within spec, a wrong \"shape\" deserves attention. A run on one side suggests the mean may have shifted."
      }
    ]
  },
  {
    chapter: 18,
    part: 4,
    title: "Abnormality Handling and Engineering Change",
    station: "Response Room",
    intro: "The alarm is sounding. The tool holding your wafer has been found abnormal, and the whole fab must react quickly with one common set of steps.",
    path: "en/4-yield-and-quality/18-abnormality-handling/README.md",
    challenges: [
      {
        type: "order",
        q: "Put the basic abnormality handling sequence in order",
        items: ["Detect", "Contain", "Find the scope", "Disposition", "Find root cause", "Prevent recurrence"],
        explain: "Contain first, then find the scope and decide the disposition, and only then chase the root cause and prevent recurrence."
      },
      {
        type: "quiz",
        alarm: true,
        q: "At midnight a tool is found giving abnormal results, and you are on shift. What is the first thing to do?",
        options: [
          "Keep producing while you slowly investigate",
          "Delete the abnormal data and re-measure",
          "Stop the tool and hold the suspect wafers, then start investigating",
          "Scrap the whole lot immediately"
        ],
        answer: 2,
        explain: "Investigation can take hours, and producing meanwhile only affects more wafers. The first step is to contain, not to fix."
      },
      {
        type: "quiz",
        alarm: true,
        q: "A tool was found abnormal this afternoon, and nobody knows when it started. How do you define the suspect wafers?",
        options: [
          "Only wafers inside the tool when it was found",
          "Everything since the last time the tool was confirmed normal",
          "Only wafers that ran after this afternoon",
          "All wafers of the whole month"
        ],
        answer: 1,
        explain: "The abnormality may have started long before it was found, so every wafer through the tool since the last confirmed normal time, such as the last good monitor wafer measurement, is suspect."
      },
      {
        type: "match",
        q: "Match each disposition to its meaning",
        pairs: [
          ["Release", "No impact; production continues"],
          ["Rework", "Remove part of result, redo it"],
          ["Scrap", "Wafers leave production"],
          ["Conditional release", "Continue with extra checks later"]
        ],
        explain: "When the impact is large or uncertain, an MRB with several departments decides the disposition together."
      }
    ]
  }
]);
