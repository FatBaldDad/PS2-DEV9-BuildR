"use strict";

const interfaceBoard = buildrData.boards.interfaceB;
const interfacePadIndices = new Map(interfaceBoard.pads.map((pad, index) =>
  [pad.ref + "." + pad.pin, index]));
const interfacePadIndex = (ref, pin = 1) => interfacePadIndices.get(ref + "." + pin);

function interfaceJoint(index, rect, options = {}) {
  const {signal, peer, kind = "direct", note, incoming, outgoing, meterPin} = options;
  const joint = buildrPad("interfaceB", index);
  const breakout = buildrPad("interfaceB", peer);
  const motherboard = pads.find(pad => pad.signal === signal);
  const pin = meterPin || (motherboard && gussePin(motherboard));
  return {
    id: joint.ref.toLowerCase().replace("+", "plus") + "-" + joint.pin,
    pad: {signal: signal || joint.ref, side: "B"},
    menuLabel: joint.pin === "1" && interfacePadIndex(joint.ref, 2) === undefined ?
      joint.ref : joint.ref + "." + joint.pin,
    joint, breakout, rect, kind, note, incoming, outgoing, motherboard,
    meter: gusseRows[pin - 1],
    adapterPad: outgoing ? joint : undefined,
    route: {board: "interfaceB", joint: index, probe: peer},
  };
}

// Centers are measured on the 1800-pixel-wide rendering of the KiCad PDF.
// Each excerpt's crop below converts them to percentages for its clickable pads.
function interfaceRect(x, y, width = 24, height = 14) {
  return [x - width / 2, y - height / 2, width, height];
}

function interfacePorts(signal) {
  const route = buildrData.signals[signal];
  const output = route.interface.find(index => {
    const {ref} = interfaceBoard.pads[index];
    return ref.startsWith("INT_") || ref.startsWith("IDE_");
  });
  const input = route.interface.find(index => index !== output) ?? interfacePadIndex("RB9002-" +
    ({DD14: 8, DD13: 7, DD12: 6, "RESET#": 5}[signal]));
  return {input, output, route};
}

function interfaceChannel(signal, y, geometry) {
  const {input, output, route} = interfacePorts(signal);
  const {left, right, leftWidth, rightWidth, series} = geometry;
  const [from, to] = series?.pins || [];
  return [
    interfaceJoint(input, interfaceRect(left, y, leftWidth, 28),
      {signal, peer: from ?? output, incoming: true}),
    ...(series ? [
      interfaceJoint(from, interfaceRect(series.x[0], series.y ?? y, 15, 13),
        {signal, peer: to, kind: "resistor", note: "Also verify direct copper to " + padLabel(interfaceBoard.pads[input]) + "."}),
      interfaceJoint(to, interfaceRect(series.x[1], series.y ?? y, 15, 13),
        {signal, peer: from, kind: "resistor", note: "Also verify direct copper to " + padLabel(interfaceBoard.pads[output]) + "."}),
    ] : []),
    interfaceJoint(output, interfaceRect(right, y, rightWidth, 28),
      {signal, peer: to ?? input, outgoing: true}),
    ...(geometry.pullDown ? interfacePullDown(signal, route.pullDown, geometry.pullDown) : []),
  ];
}

function interfacePullDown(signal, index, geometry) {
  const pad = interfaceBoard.pads[index];
  const pin = Number(pad.pin);
  const ground = interfacePadIndex(pad.ref, 9 - pin);
  const x = geometry.x[pin - 1];
  return [
    interfaceJoint(index, interfaceRect(x, geometry.y[0], 14, 18),
      {signal, peer: ground, kind: "resistor", note: "This pull-down is a separate path to ground."}),
    interfaceJoint(ground, interfaceRect(x, geometry.y[1], 14, 18),
      {signal, peer: interfacePadIndex("GND1"), note: "This is the ground terminal paired with " + padLabel(pad) + "."}),
  ];
}

function interfaceGroup(id, label, crop, joints, note) {
  const [x, y, width, height] = crop;
  const rects = joints.map(({rect: [left, top, w, h]}) =>
    [(left - x) / width * 100, (top - y) / height * 100, w / width * 100, h / height * 100]);
  return {
    id, label, title: label, board: "interfaceB", note,
    image: {width: width * 2, height: height * 2, rects},
    joints: joints.map(joint => ({...joint, groupId: id})),
  };
}

const interfaceGround = ["GND1", "GND2", "GND3", "GND4"].map((ref, index) =>
  interfaceJoint(interfacePadIndex(ref), interfaceRect(951, 923 + index * 23.1, 78, 20), {
    peer: interfacePadIndex(index === 0 ? "GND2" : "GND1"),
    note: "Confirm a fitted ground connection against a known motherboard ground before power-up.",
  }));

const interfaceDataGroups = [
  ["if-rb9003", "RB9003A1 data", [89, 104, 520, 251], ["DD8", "DD11", "DD9", "DD10"], 123, [251, 292]],
  ["if-rb9004", "RB9004A1 data", [89, 352, 520, 258], ["DD5", "DD4", "DD7", "DD6"], 369, [503, 545]],
  ["if-rb9005", "RB9005A1 data", [89, 621, 520, 259], ["DD2", "DD0", "DD3", "DD1"], 639, [764, 806]],
].map(([id, label, crop, signals, y, pullY]) => interfaceGroup(id, label, crop,
  signals.flatMap((signal, index) => interfaceChannel(signal, y + index * 30.8, {
    left: 177, right: 518, leftWidth: 172, rightWidth: 165,
    pullDown: {x: [284, 300, 315, 331], y: pullY},
  }))));

const interfaceRb9002PullDown = {x: [277, 292, 308, 324], y: [1046, 1093]};
const interfaceRb9002 = ["DD14", "DD13", "DD12", "RESET#"].flatMap((signal, index) => {
  const route = buildrData.signals[signal];
  return interfaceChannel(signal, 923 + index * 30.8, {
    left: 198, right: 727, leftWidth: 110, rightWidth: 142,
    series: {x: [461, 508], y: 946 + index * 15.4, pins: route.interfaceSeries.slice().reverse()},
    pullDown: signal.startsWith("DD") ? interfaceRb9002PullDown : undefined,
  });
}).concat(interfacePullDown("DD15", buildrData.signals.DD15.pullDown, interfaceRb9002PullDown));

const interfaceControl = [
  ["DIOW#", 492], ["DMACK#", 523], ["DD15", 554], ["IORDY", 600], ["INTRQ", 631], ["DMARQ", 662],
  ["CS1#", 693], ["CS0#", 723], ["DIOR#", 754], ["DA1", 785], ["DA2", 816], ["DA0", 847],
].flatMap(([signal, y]) => {
  const pins = buildrData.signals[signal].interfaceSeries;
  return interfaceChannel(signal, y, {
    left: 731, right: 1217, leftWidth: 146, rightWidth: 148,
    series: pins && {x: [952, 988], pins},
  });
});

function interfaceCircuitJoint([ref, pin, x, y, peer, peerPin, kind, note, width, height]) {
  return interfaceJoint(interfacePadIndex(ref, pin), interfaceRect(x, y, width, height), {
    peer: peer ? interfacePadIndex(peer, peerPin) : undefined, kind, note,
  });
}

const interfacePower = [
  ["+5V1", 1, 676, 138, "C1", 1, "direct", "Solder the fitted console feed here. Use the verified +5 V pickup for your installation.", 92, 24],
  ["U1", 1, 801, 138, "+5V1", 1],
  ["U1", 2, 801, 153, "GND1", 1],
  ["U1", 3, 992, 170, "+5V1", 1],
  ["U1", 4, 992, 153, null, null, "nc"],
  ["U1", 5, 992, 138, "+3V3", 1],
  ["C1", 1, 724, 167, "+5V1", 1], ["C1", 2, 724, 185, "GND1", 1],
  ["C2", 1, 1047, 175, "+3V3", 1], ["C2", 2, 1047, 193, "GND1", 1],
  ["+3V3", 1, 1233, 126, "C2", 1, "direct", "Verify this output in the BuildR power checks after the unpowered checks pass.", 136, 35],
  ["R6", 1, 1116, 185, "R6", 2, "resistor"], ["R6", 2, 1148, 185, "R6", 1, "resistor"],
  ["D1", 2, 1193, 185, "R6", 2, "direct", "Blue power LED anode."],
  ["D1", 1, 1218, 185, "GND1", 1, "direct", "Blue power LED cathode."],
  ["D1_A1", 1, 1170, 161, "D1", 2, "direct", "Back-side anode pad for a wired power LED, if used."],
  ["D1_C1", 1, 1248, 161, "D1", 1, "direct", "Back-side cathode pad for a wired power LED, if used."],
].map(interfaceCircuitJoint);

const interfaceActivity = [
  interfaceJoint(interfacePadIndex("IDE_DASP1"), interfaceRect(638, 276, 148, 26),
    {signal: "DASP#", peer: interfacePadIndex("R10", 1), meterPin: 39, outgoing: true,
      note: "Use this lead if your adapter wiring uses the BuildR activity circuit."}),
  ...[
    ["IC1", 1, 790, 261, null, null, "nc"],
    ["IC1", 2, 790, 276, "IDE_DASP1", 1],
    ["IC1", 3, 790, 292, "GND1", 1],
    ["IC1", 4, 916, 293, "R8", 1],
    ["IC1", 5, 916, 261, "+3V3", 1],
    ["C3", 1, 978, 290, "+3V3", 1], ["C3", 2, 978, 314, "GND1", 1],
    ["R10", 1, 731, 291, "R10", 2, "resistor"], ["R10", 2, 731, 327, "R10", 1, "resistor"],
    ["R8", 1, 967, 362, "R8", 2, "resistor"], ["R8", 2, 1003, 362, "R8", 1, "resistor"],
    ["Q1", 1, 1036, 362, "R8", 2],
    ["Q1", 2, 1069, 385, "GND1", 1],
    ["Q1", 3, 1069, 341, "D2", 1],
    ["R9", 1, 1016, 383, "R9", 2, "resistor"], ["R9", 2, 1016, 416, "R9", 1, "resistor"],
    ["R7", 1, 1159, 316, "R7", 2, "resistor"], ["R7", 2, 1195, 316, "R7", 1, "resistor"],
    ["D2", 1, 1101, 315, "Q1", 3, "direct", "Amber activity LED cathode."],
    ["D2", 2, 1127, 315, "R7", 1, "direct", "Amber activity LED anode."],
    ["D2_C1", 1, 1069, 294, "D2", 1, "direct", "Back-side cathode pad for a wired activity LED, if used."],
    ["D2_A1", 1, 1147, 294, "D2", 2, "direct", "Back-side anode pad for a wired activity LED, if used."],
  ].map(interfaceCircuitJoint),
];

const interfaceGroups = [
  interfaceGroup("if-ground", "Ground", [900, 902, 98, 186], interfaceGround),
  ...interfaceDataGroups,
  interfaceGroup("if-rb9002", "RB9002 data & reset", [141, 893, 663, 268], interfaceRb9002,
    "DD15 goes through R3 in Control & address. Its RB9002A1 pull-down is shown here."),
  interfaceGroup("if-control", "Control & address", [651, 470, 645, 395], interfaceControl),
  interfaceGroup("if-power", "Power & blue LED", [622, 96, 681, 148], interfacePower,
    "KiCad marks U1 DNP. Inspect the footprints and follow the population and power wiring for your build."),
  interfaceGroup("if-activity", "Activity & amber LED", [562, 241, 713, 234], interfaceActivity,
    "KiCad marks IC1 DNP. The activity circuit and the back-side LED leads depend on your build."),
];

function interfaceInstructions(joint) {
  const label = padLabel(joint.joint);
  const side = joint.joint.front ? "front" : "back";
  let action = "Solder " + label + " and inspect the neighboring pads under magnification.";
  if (joint.incoming || joint.outgoing) {
    action = "Locate " + label + " and solder the fitted " + (joint.incoming ? "incoming BuildR" : "adapter-side") +
      " lead if your wiring uses this pad.";
  } else if (joint.joint.dnp) {
    action = "Inspect " + label + " on the footprint marked DNP in KiCad. Solder this lead only if your build calls for the part.";
  } else if (side === "back" || joint.joint.ref.startsWith("GND") || joint.joint.ref.startsWith("+")) {
    action = "Locate " + label + " on the " + side + " and inspect the joint if this connection is fitted.";
  }
  return action + (joint.note ? " " + joint.note : "");
}

function interfaceProbeRows(joint) {
  const label = interfacePadLabel(joint.joint);
  const rows = [];
  if (joint.kind === "nc") {
    return [["NC pin inspection", label, "Nearby pads on other nets", "Isolated from neighboring pins"]];
  }
  if (joint.incoming) {
    const signalRoute = buildrData.signals[joint.pad.signal];
    const source = buildrPad(signalRoute.board, signalRoute.probe);
    rows.push(["Fitted incoming lead", buildrData.boards[signalRoute.board].label + " " + padLabel(source),
      label, "Near the shorted-lead reading"]);
  }
  if (joint.kind === "resistor") {
    const value = joint.joint.value.replace(/(\d)KΩ/i, "$1 kΩ").replace(/(\d)Ω/, "$1 Ω");
    rows.push(["Fitted resistor", label, padLabel(joint.breakout),
      value + " nominal. Parallel paths can lower in-circuit resistance."]);
  } else {
    const to = interfacePadLabel(joint.breakout) + (joint.breakout.front !== joint.joint.front ?
      " (" + (joint.breakout.front ? "front" : "back") + ")" : "");
    rows.push(["Direct copper", label, to, "Near the shorted-lead reading"]);
  }
  rows.push(["Bridge inspection", label, "Physically adjacent pads on other nets",
    "Compare settled resistance against the intended circuit and inspect any unusually low reading"]);
  return rows;
}

function interfaceBridgeLinks(joint) {
  const signal = joint.pad.signal;
  if (!/^DD\d+$/.test(signal)) {
    return '<a href="#bridge">Open data-line bridge checks</a>';
  }
  const neighbors = bridgeTests.filter(test => test.mode === "neighbor" &&
    (test.red.signal === signal || test.black.signal === signal));
  return neighbors.map(test => '<a href="' + bridgeUrl(test) + '">Check ' + test.label + '</a>').join("") +
    '<a href="#bridge/ground-' + padId(signal) + '">Check ' + signal + ' to ground</a>';
}
