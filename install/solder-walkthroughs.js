"use strict";

function ataSolderJoint(groupId, signal) {
  const pad = pads.find(candidate => candidate.signal === signal);
  const route = buildrData.signals[signal];
  const [input, output] = (route.series || []).map(index => buildrPad(route.board, index));
  return {
    id: padId(signal), groupId, pad, route, input, output,
    joint: buildrPad(route.board, route.joint),
    breakout: buildrPad(route.board, route.probe),
    meter: gusseRows[gussePin(pad) - 1],
  };
}

function subPcbJoint(groupId, signal, source, destination, net) {
  const board = buildrData.boards.subB;
  const index = ref => board.pads.findIndex(pad => pad.ref === ref && pad.pin === "1" &&
    pad.net === net && pad.front && pad.schemaMatch);
  const route = {board: "subB", joint: index(source), probe: index(destination)};
  return {
    id: padId(signal), groupId, route,
    pad: {signal, side: "B", land: source},
    joint: board.pads[route.joint], breakout: board.pads[route.probe],
  };
}

const expandedSideAImage = {width: 1344, height: 288, lineTops: [11, 32, 53, 74], lineHeight: 21, wide: true};

const sideAGroups = [
  ["rb9003", "RB9003", ["DD8", "DD11", "DD9", "DD10"]],
  ["rb9004", "RB9004", ["DD5", "DD4", "DD7", "DD6"]],
  ["rb9005", "RB9005", ["DD2", "DD0", "DD3", "DD1"]],
  ["rb900x", "RB900x", ["DIOR#", "DA1", "DA2", "DA0"]],
].map(([id, label, signals]) => ({
  id, label, title: label, board: "sideA",
  image: id === "rb9004" || id === "rb900x" ? expandedSideAImage :
    {width: 1136, height: 289, lineTops: [11, 34, 57, 80], lineHeight: 19},
  joints: signals.map(signal => ataSolderJoint(id, signal)),
}));
const sideAJoints = sideAGroups.flatMap(group => group.joints);

const subPcbGroups = [
  {
    id: "subpcb-ground", label: "Ground", title: "SubPCB ground",
    image: {width: 202, height: 216, lineTops: [4, 19, 34], lineHeight: 14},
    joints: ["GND1", "GND2", "GND3"].map(ref =>
      subPcbJoint("subpcb-ground", ref, ref, ref === "GND1" ? "GND2" : "GND1", "GND")),
  },
  {
    id: "subpcb-data", label: "RB9002 data", title: "SubPCB data",
    image: {width: 1344, height: 318, lineTops: [4, 28, 52, 76], lineHeight: 23},
    signals: ["DD13", "DD12", "DD14", "DD15"],
  },
  {
    id: "subpcb-handshake", label: "Handshake", title: "SubPCB handshake",
    image: {width: 1124, height: 252, lineTops: [5, 38, 71], lineHeight: 24},
    signals: ["INTRQ", "IORDY", "DMARQ"],
  },
  {
    id: "subpcb-control", label: "Reset & control", title: "SubPCB reset & control",
    image: {width: 1124, height: 420, lineTops: [2, 22, 42, 62, 82], lineHeight: 17},
    signals: ["RESET#", "CS0#", "CS1#", "DIOW#", "DMACK#"],
  },
  {
    id: "subpcb-pass", label: "Pass-through", title: "SubPCB pass-through",
    image: {width: 1280, height: 420, lineTops: [2, 22, 42, 62, 82], lineHeight: 17},
    joints: ["CL6116", "CL9211", "CL9214", "CL9216", "CL9219"].map((ref, index) => {
      const signal = "PASS" + (index + 1);
      return subPcbJoint("subpcb-pass", signal, ref, ref + "*1", "/" + signal);
    }),
    note: "Follow each named motherboard CL point to its matching SubPCB contact, then verify continuity to the separate *1 breakout.",
  },
].map(group => ({
  ...group, board: "subB",
  joints: group.joints || group.signals.map(signal => ataSolderJoint(group.id, signal)),
}));
const solderGroups = [...sideAGroups, ...subPcbGroups, ...interfaceGroups];

function walkthroughUrl(joint) {
  return "#solder/" + joint.groupId + "-" + joint.id;
}

function walkthroughJointForPad(pad) {
  for (const group of solderGroups) {
    const match = group.joints.find(joint => joint.pad === pad);
    if (match) return match;
  }
}

function jointMark(joint, field) {
  return joint.groupId + "-" + joint.id + "-" + field;
}

function jointVerified(joint) {
  return benchResults[jointMark(joint, "soldered")] && benchResults[jointMark(joint, "verified")];
}

function groundProbeOnly(joint) {
  return joint.id === "gnd3";
}

function walkthroughProgress(group) {
  const total = group.joints.length;
  const prepared = group.joints.filter(joint => benchResults[jointMark(joint, "soldered")]).length;
  const verified = group.joints.filter(jointVerified).length;
  const label = group.id === "subpcb-ground" || group.board === "interfaceB" ? " inspected" : " soldered";
  return prepared + " of " + total + label + " · " + verified + " of " + total + " verified";
}

function walkthroughGroupMenu(board, active) {
  const sectionLabel = buildrData.boards[board].label;
  const links = solderGroups.filter(group => group.board === board).map(group =>
    '<a class="button" href="#solder/' + group.id + '"' + (group === active ? ' aria-current="true"' : '') +
    '>' + group.label + '</a>').join("");
  return '<nav class="walkthrough-group-menu" aria-label="' + sectionLabel + ' groups">' + links + '</nav>';
}

function walkthroughSchematic(group, active) {
  const boardLabel = buildrData.boards[group.board].label;
  const image = group.image;
  const links = group.joints.map((joint, index) => {
    const pin = joint.meter ? " · IDE pin " + joint.meter.pin : "";
    const label = joint.menuLabel ? padLabel(joint.joint) + pin : joint.pad.signal + " · " + joint.joint.ref + pin;
    let position;
    if (image.rects) {
      const [left, top, width, height] = image.rects[index].map(value => value.toFixed(2) + "%");
      position = "--pin-left:" + left + ";--line-top:" + top + ";--pin-width:" + width + ";--line-height:" + height;
    } else {
      position = "--line-top:" + image.lineTops[index] + "%;--line-height:" + image.lineHeight + "%";
    }
    return '<a class="rb-hotspot" href="' + walkthroughUrl(joint) + '" style="' + position + '" aria-label="' + label +
      '" title="' + label + '"' + (joint === active ? ' aria-current="step"' : "") + '></a>';
  }).join("");
  const note = group.note;
  const imageClass = image.rects ? " rb-pin-hotspots" + (group.id === "if-ground" ? " rb-interface-ground" : "") :
    group.id === "subpcb-ground" ? " rb-ground-image" : group.board === "subB" || image.wide ? " rb-wide-hotspots" : "";
  return '<figure class="rb-schematic"><div class="rb-schematic-image' + imageClass + '">' +
    '<img src="install/' + group.id + '-schematic.png" width="' + image.width + '" height="' + image.height +
    '" alt="' + boardLabel + ' KiCad schematic excerpt for ' + group.label + '">' +
    '<nav aria-label="Select a point on the schematic">' + links + '</nav></div>' +
    '<figcaption class="caption">' + boardLabel + ' schematic. ' +
    (image.rects ? "Select a terminal or use the numbered steps." : "Work from top to bottom.") + '</figcaption></figure>' +
    (note ? '<p class="caption">' + note + '</p>' : '');
}

function walkthroughStepMenu(group, active) {
  const steps = group.joints.map((joint, index) =>
    '<li><a href="' + walkthroughUrl(joint) + '"' + (joint === active ? ' aria-current="step"' : "") +
    '><span class="rb-joint-index">' + (index + 1) + '</span><strong>' + (joint.menuLabel || joint.pad.signal) +
    '</strong><span class="rb-joint-state" data-rb-joint-state="' + joint.id + '">' +
    (jointVerified(joint) ? "Verified" : "") + '</span></a></li>').join("");
  return '<nav aria-label="' + group.label + ' point order"><ol class="rb-joint-menu">' + steps + '</ol></nav>';
}

function motherboardLand(pad) {
  return pad.land + (pad.land.startsWith("R") ? " signal-side land" : "");
}

function sideAProbeRows(joint, solderPad) {
  const [x, y] = joint.joint.xy;
  // The 1.4 mm limit includes the direct neighbors of the staggered rows and
  // the 1.3 mm RB900x grid, while excluding the grid's diagonals.
  const neighbors = sideAJoints.filter(other => {
    const [otherX, otherY] = other.joint.xy;
    return other !== joint && Math.hypot(otherX - x, otherY - y) <= 1.4;
  });
  const adjacent = neighbors.map(other => padLabel(other.joint) + " (" + other.pad.signal + ")").join(", ");
  return [
    ["Input copper", solderPad, padLabel(joint.input), "Near the shorted-lead reading"],
    ["Series channel", padLabel(joint.input), padLabel(joint.output), joint.input.value.replace("Ω", " Ω") + " nominal"],
    ["Output copper", padLabel(joint.output), padLabel(joint.breakout), "Near the shorted-lead reading"],
    ["Adjacent joints", solderPad, adjacent + " (one at a time)", "No unintended low-ohms short"],
  ];
}

function probeChecks(joint) {
  const pad = joint.pad;
  const solderPad = padLabel(joint.joint);
  let rows;
  if (joint.route.board === "interfaceB") {
    rows = interfaceProbeRows(joint);
  } else if (joint.groupId === "subpcb-ground") {
    rows = [
      ["SubPCB ground", solderPad, padLabel(joint.breakout), "Near the shorted-lead reading"],
      ["Installed ground", "Verified GH-035-11 ground", solderPad, "Near the shorted-lead reading"],
    ];
  } else {
    rows = [
      ["Across the joint", "GH-035-11 Side " + pad.side + " " + motherboardLand(pad) + " (" + pad.signal + ")",
        solderPad, "Near the shorted-lead reading"],
    ];
    if (pad.side === "A") rows.push(...sideAProbeRows(joint, solderPad));
    else rows.push(
      ["SubPCB continuity", solderPad, padLabel(joint.breakout), "Near the shorted-lead reading"],
      ["Adjacent joints", solderPad + " and " + padLabel(joint.breakout), "Adjacent pads on different nets, one at a time",
        "No unintended low-ohms short"],
    );
  }
  return '<div class="meter-table rb-probe-table"><table><caption class="sr-only">Probe pairs for ' + pad.signal + '</caption>' +
    '<thead><tr><th scope="col">Check</th><th scope="col">Probe A → probe B</th><th scope="col">Expected</th></tr></thead><tbody>' +
    rows.map(([title, start, end, expectation]) =>
      '<tr><th scope="row">' + title + '</th><td>' + start + ' <span aria-hidden="true">→</span> ' + end +
      '</td><td>' + expectation + '</td></tr>').join("") + '</tbody></table></div>';
}

function jointChecks(joint) {
  const jointLabel = joint.route.board === "interfaceB" ? "Pad or fitted joint inspected" :
    groundProbeOnly(joint) ? "Ground pad inspected" : "Joint soldered and inspected";
  const marks = [["soldered", jointLabel], ["verified", "Meter checks passed"]];
  return '<ul class="checks rb-joint-checks">' + marks.map(([field, label]) => {
    const key = jointMark(joint, field);
    return '<li><label><input type="checkbox" data-walkthrough-mark="' + key + '"' +
      (benchResults[key] ? ' checked' : '') + '><span>' + label + '</span></label></li>';
  }).join("") + '</ul>';
}

function jointMeterReference(meter) {
  if (!meter) return "";
  let text = "Pin " + meter.pin + " is unlisted in Gusse’s table.";
  if (meter.diode) {
    const resistance = meter.ohms ? " · " + meter.ohms / 1000 + " kΩ listed resistance." :
      ". Gusse lists no resistance value for this pin.";
    text = meter.diode + " V in diode mode" + resistance +
      " Red probe on ground, black on the connector pin. Gusse measured these values on an IDE Resurrector with a SATA adapter and capacitors fitted.";
  }
  return '<div class="callout rb-meter-reference"><strong>Gusse’s connector reference · pin ' + meter.pin + '</strong>' +
    '<p>' + text + '</p><a href="#meter/' + meter.pin + '">Open Gusse’s pin ' + meter.pin + ' reference</a></div>';
}

function jointInstructions(joint) {
  if (joint.route.board === "interfaceB") return interfaceInstructions(joint);
  if (groundProbeOnly(joint)) {
    return "Locate the exposed GND3 pad. If your wiring uses it, inspect that connection. Verify GND3 to GND1 and to known motherboard ground after mounting.";
  }
  if (joint.groupId === "subpcb-ground") {
    return "Align the " + joint.joint.ref +
      " mounting contact with its motherboard ground land. Confirm the motherboard land against known ground before soldering the anchor.";
  }
  return "On the GH-035-11, align Side " + joint.pad.side + " " + motherboardLand(joint.pad) +
    " for " + joint.pad.signal + " with the " + (joint.pad.side === "A" ? "BuildR castellation " : "SubPCB contact ") +
    padLabel(joint.joint) + ". Solder that contact and inspect the neighboring pads under magnification." +
    (joint.groupId === "subpcb-pass" ? " Use " + padLabel(joint.breakout) + " as the exposed breakout for this pair." : "");
}

function walkthroughProbeMap(joint) {
  const signal = joint.pad.signal;
  const isSub = joint.route.board === "subB";
  const isInterface = joint.route.board === "interfaceB";
  const title = isSub ? "SubPCB probe points" : isInterface ? "Interface PCB probe points" : "BuildR probe points";
  const hasTwo = (isSub || isInterface) && joint.breakout;
  const buttonLabel = pad => isInterface ? interfacePadLabel(pad) : pad.ref;
  const focusButtons = hasTwo ?
    '<div class="view-buttons" role="group" aria-label="Probe point"><button type="button" class="button" data-probe-focus="joint" aria-pressed="true">' +
    buttonLabel(joint.joint) + '</button><button type="button" class="button" data-probe-focus="breakout" aria-pressed="false">' +
    buttonLabel(joint.breakout) + '</button></div>' : "";
  const targets = hasTwo ? "Gold shows " + padLabel(joint.joint) + " and cyan shows " + padLabel(joint.breakout) + "." :
    isInterface ? "Gold shows " + padLabel(joint.joint) + "." :
    "Gold frames the solder joint. Violet marks the ends of the series resistor. Cyan marks the breakout pad.";
  const front = joint.route.board === "sideA" ? "Front · installed orientation" : "KiCad front";
  const side = isInterface ? '<span data-probe-side></span>' : front;
  return '<div class="board-controls' + (hasTwo ? '' : ' rb-probe-controls') + '">' + focusButtons +
    boardZoomButton() + '</div><figure class="locator rb-probe-map"><div class="map-top"><span>' + title +
    ' · ' + side + '</span><strong>' + signal +
    '</strong></div><canvas class="pcb-view" data-fixed-view="' + (isInterface ? "interface-solder" : "solder") +
    '" width="1120" height="620" role="img" aria-label="' +
    targets + '"></canvas><figcaption class="caption">' + targets +
    (hasTwo ? ' Select either pad to center the close-up.' : '') + '</figcaption></figure>' +
    (isInterface ? interfaceLabelLegend() : "");
}

function solderWalkthrough(id) {
  const group = solderGroups.find(item => id === item.id || id?.startsWith(item.id + "-"));
  if (!group) return "";
  const jointId = id.slice(group.id.length + 1);
  const defaultJoint = group.joints.find(joint => !jointVerified(joint)) || group.joints[0];
  const joint = group.joints.find(candidate => candidate.id === jointId) || defaultJoint;
  const index = group.joints.indexOf(joint);
  const previous = group.joints[index - 1];
  const next = group.joints[index + 1];
  const nextGroup = solderGroups[solderGroups.indexOf(group) + 1];
  const isInterface = group.board === "interfaceB";
  const finish = next ?
    '<a class="button primary" href="' + walkthroughUrl(next) + '">Next · ' + (next.menuLabel || next.pad.signal) + ' →</a>' :
    nextGroup?.board === group.board ? '<a class="button primary" href="#solder/' + nextGroup.id + '">Next group · ' + nextGroup.label + ' →</a>' :
    '<a class="button primary" href="#solder">Back to solder tests</a>';
  const signal = joint.pad.signal;
  const heading = isInterface ? padLabel(joint.joint) + (signal === joint.joint.ref ? "" : " · " + signal) :
    group.id === "subpcb-ground" ? signal : signal + " · " + joint.joint.ref;
  const pin = joint.meter ? ' · IDE pin ' + joint.meter.pin : '';
  const type = group.id === "subpcb-ground" ? "Point " : "Joint ";
  const locator = isInterface ?
    (joint.motherboard ? '<a href="#pads/' + padId(signal) + '">Show the motherboard land for ' + signal + '</a>' : "") :
    joint.meter ? '<a href="#pads/' + joint.id + '">Show the motherboard land for ' + signal + '</a>' : "";
  const benchNote = group.board === "sideA" ?
    "Use resistance mode across the 33 Ω channel. Parallel paths can lower an in-circuit reading. " : "";
  locatorZoom = isInterface;
  activeSignal = {...joint.pad, walkthroughRoute: joint.route};
  const menu = walkthroughStepMenu(group, joint);

  return '<div class="layout solder-walkthrough-layout' + (isInterface ? ' interface-walkthrough' : '') + '" data-walkthrough-group="' + group.id + '"><section class="panel"><p class="eyebrow">' +
    buildrData.boards[group.board].label + '</p><h2 tabindex="-1">' + group.title + ' solder walkthrough</h2>' +
    walkthroughGroupMenu(group.board, group) +
    '<p class="intro">Select a point on the schematic or follow the steps in order.</p>' + walkthroughSchematic(group, joint) + (isInterface ? "" : menu) +
    '<p class="caption" id="walkthrough-progress" role="status">' + walkthroughProgress(group) + '</p>' +
    walkthroughProbeMap(joint) + (isInterface ? menu : "") + '<div class="actions">' + locator + '<a href="#solder">All solder tests</a></div></section>' +
    '<section class="panel"><p class="eyebrow">' + type + (index + 1) + ' of ' + group.joints.length + pin + '</p>' +
    '<h3 class="rb-step-title" tabindex="-1" data-step-focus>' + heading + '</h3>' +
    '<p class="callout warn">Unplug the PS2 and disconnect the FC1307A before soldering or using the meter. Short the probes together to establish your continuity baseline.</p>' +
    '<p class="intro">' + jointInstructions(joint) + '</p>' + probeChecks(joint) +
    '<p class="caption">' + (isInterface ?
      'Probe exposed copper or the fitted terminal. Leave a check unverified if the required points are inaccessible.' :
      benchNote + 'For the joint check, use an exposed part of the motherboard land or a verified point on the same net. Leave it unverified if neither point is accessible.') + '</p>' +
    (isInterface ? '<div class="actions">' + interfaceBridgeLinks(joint) + '</div>' : '') +
    adapterDestination(joint) + jointMeterReference(joint.meter) + jointChecks(joint) +
    '<div class="actions rb-step-actions">' +
    (previous ? '<a class="button" href="' + walkthroughUrl(previous) + '">← Previous · ' + (previous.menuLabel || previous.pad.signal) + '</a>' : '') +
    finish + '</div></section></div>';
}

document.addEventListener("change", event => {
  const key = event.target.dataset.walkthroughMark;
  if (!key) return;
  const panel = event.target.closest("[data-walkthrough-group]");
  const group = solderGroups.find(item => item.id === panel.dataset.walkthroughGroup);
  saveBenchResult(key, event.target.checked);
  panel.querySelector("#walkthrough-progress").textContent = walkthroughProgress(group);
  for (const joint of group.joints) {
    panel.querySelector('[data-rb-joint-state="' + joint.id + '"]').textContent = jointVerified(joint) ? "Verified" : "";
  }
});

document.addEventListener("click", event => {
  const button = event.target.closest("button[data-probe-focus]");
  if (!button) return;
  const panel = button.closest("[data-walkthrough-group]");
  panel.querySelector(".pcb-view").dataset.probeFocus = button.dataset.probeFocus;
  for (const control of panel.querySelectorAll("[data-probe-focus]")) {
    control.setAttribute("aria-pressed", String(control === button));
  }
  if (panel.querySelector(".pcb-view").dataset.fixedView === "interface-solder" && !locatorZoom) {
    locatorZoom = true;
    const zoomButton = panel.querySelector("[data-board-zoom]");
    zoomButton.setAttribute("aria-pressed", "true");
    zoomButton.textContent = "Full view";
  }
  drawLocator();
});
