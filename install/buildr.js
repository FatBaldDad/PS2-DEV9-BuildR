"use strict";

let locatorView = "installed";
let locatorZoom = false;
let activeSignal;
let benchResults = {};
const benchKey = "fbd-buildr-sidea00-subb01-interfaceb01-tests";

try {
  const saved = JSON.parse(localStorage.getItem(benchKey));
  if (saved && typeof saved === "object") benchResults = saved;
} catch {
  // Results remain available for this browser session.
}

function buildrPad(board, index) {
  return buildrData.boards[board].pads[index];
}

function padLabel(pad) {
  return pad.ref + " pin " + pad.pin;
}

function seriesLabel(board, indices) {
  const [first, second] = indices.map(index => buildrPad(board, index));
  return first.ref + " pins " + first.pin + "–" + second.pin + " (" + first.value + ")";
}

function locatorTabs() {
  return [["installed", "Installed layout"], ["motherboard", "Motherboard only"],
    ["solder", "Solder PCB"], ["interface", "Interface PCB"]].map(([key, label]) =>
    '<button type="button" class="button" data-board-view="' + key + '" aria-pressed="' +
    (locatorView === key) + '">' + label + '</button>').join("");
}

function boardZoomButton() {
  return '<button type="button" class="button zoom-button" data-board-zoom aria-pressed="' +
    locatorZoom + '">' + (locatorZoom ? "Full view" : "Zoom to pad") + '</button>';
}

function probePath(selected) {
  const route = buildrData.signals[selected.signal];
  const board = buildrData.boards[route.board];
  const joint = buildrPad(route.board, route.joint);
  const probe = buildrPad(route.board, route.probe);
  const {input, output} = interfacePorts(selected.signal);
  const ports = [input, output].map(index => interfacePadLabel(buildrPad("interfaceB", index))).join(" → ");
  return '<dl class="facts"><dt>Motherboard</dt><dd>Side ' + selected.side + ' · ' + selected.land +
    (selected.land.startsWith("R") ? " signal-side terminal" : "") + '</dd><dt>' + board.label +
    '</dt><dd>' + padLabel(joint) + ' → ' + padLabel(probe) + '</dd>' +
    (route.series ? '<dt>Series channel</dt><dd>' + seriesLabel(route.board, route.series) + '</dd>' : '') +
    '<dt>Interface PCB</dt><dd>' + ports + '</dd>' +
    (route.interfaceSeries ? '<dt>Interface component</dt><dd>' + seriesLabel("interfaceB", route.interfaceSeries) + '</dd>' : '') +
    (selected.pin ? '<dt>Standard ATA pin</dt><dd>' + selected.pin + '</dd>' : '') + '</dl>';
}

function layoutCaption(selected, route) {
  const board = buildrData.boards[route.board];
  if (locatorView === "installed") return board.label + " over the GH-035 LCG drawing. The gold frame marks the BuildR joint. The pale dashed ring marks the underlying motherboard land. Verify the fit on your board before soldering.";
  if (locatorView === "motherboard") return "GH-035 LCG drawing · Side " + selected.side + " · The gold frame marks the motherboard land.";
  if (locatorView === "solder") {
    const front = route.board === "sideA" ? "Front · installed orientation" : "KiCad front";
    return board.label + " · " + front + " · Gold frames the input joint, cyan marks the output, and violet marks the two series terminals where fitted.";
  }
  return "B-side Interface PCB v0.1 · KiCad front · Cyan marks the signal pads. The frame identifies the pad used for zoom. Violet marks related resistor pads.";
}

function boardFigure(selected) {
  if (selected.power) return powerFigure();
  const adapterPin = gussePin(selected);
  const walkthrough = walkthroughJointForPad(selected);
  const solderUrl = walkthrough ? walkthroughUrl(walkthrough) : "#solder/" + padId(selected.signal);
  const route = buildrData.signals[selected.signal];
  const board = locatorView === "interface" ? buildrData.boards.interfaceB : buildrData.boards[route.board];
  const front = locatorView === "solder" && route.board === "sideA" ? "Installed orientation" : "KiCad front";
  const orientation = ["installed", "motherboard"].includes(locatorView) ?
    "↑ Rear connector edge · Side " + selected.side : front + " · " + board.label;
  return '<div class="board-controls"><div class="view-buttons" role="group" aria-label="PCB view">' +
    locatorTabs() + '</div>' + boardZoomButton() + '</div><figure class="locator"><div class="map-top"><span>' +
    orientation + '</span><strong>' + selected.signal + '</strong></div>' +
    '<canvas class="pcb-view" width="1120" height="620" role="img" aria-label="' +
    selected.signal + ' · ' + layoutCaption(selected, route) + '"></canvas>' +
    '<figcaption class="caption">' + layoutCaption(selected, route) + '</figcaption></figure>' +
    probePath(selected) + (locatorView === "interface" ? interfaceLabelLegend() : "") +
    '<div class="actions"><a class="button primary" href="' + solderUrl + '">Open solder step for ' +
    selected.signal + '</a>' + adapterPinLink(adapterPin, 'Adapter pin ' + adapterPin) +
    gusseMeterLink(selected) + '</div>';
}

const railColors = {ground: "#c7d0e2", input: "#ffd58d", output: "#7fffea"};

function powerFigure() {
  return '<div class="board-controls">' + boardZoomButton() +
    '</div><figure class="locator"><div class="map-top"><span>KiCad front · B-side Interface PCB v0.1</span>' +
    '<strong>Power rails</strong></div><canvas class="pcb-view" width="1120" height="620" role="img" ' +
    'aria-label="Interface PCB v0.1. Gold marks plus 5 volt input, cyan marks 3.3 volt output and light gray marks ground."></canvas>' +
    '<figcaption class="caption">Gold marks +5V1 and U1 pins 1 and 3. Cyan marks +3V3 and U1 pin 5. Gray marks GND1 and U1 pin 2.</figcaption></figure>' +
    interfaceLabelLegend() + '<div class="actions"><a class="button primary" href="#power">Open the FC1307A power check</a>' +
    adapterPinLink(41, 'Adapter 5 V header positions') + '</div>';
}

const motherboardImages = {};
for (const side of ["A", "B"]) {
  const image = new Image();
  image.src = "install/gh035-" + side.toLowerCase() + ".png";
  motherboardImages[side] = image;
}

function pcbPoint([a, b, x, y], [u, v]) {
  return [a * u - b * v + x, b * u + a * v + y];
}

function viewport(points, target, closeupWidth, canvas, zoom) {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  const focus = zoom ? target : [x + width / 2, y + height / 2];
  const scale = zoom ? canvas.width / closeupWidth :
    Math.min(canvas.width / (width * 1.13), canvas.height / (height * 1.13));
  return {scale, transform: [scale, 0, 0, scale,
    canvas.width / 2 - scale * focus[0], canvas.height / 2 - scale * focus[1]]};
}

function drawPcb(context, board, [a, b, x, y], installed, px, back = false) {
  context.save();
  context.transform(a, b, -b, a, x, y);
  px /= Math.hypot(a, b);
  context.beginPath();
  for (const ring of board.outline) {
    context.moveTo(...ring[0]);
    for (const point of ring.slice(1)) context.lineTo(...point);
    context.closePath();
  }
  context.fillStyle = installed ? "rgba(20,92,87,.76)" : "#124b48";
  context.fill("evenodd");
  context.strokeStyle = "#88d5be";
  context.lineWidth = 1.6 * px;
  context.stroke();
  // Castellated pads straddle Edge.Cuts. Clip their copper to the routed board.
  context.clip("evenodd");

  context.strokeStyle = "#539583";
  context.lineCap = "round";
  for (const [x, y, endX, endY, width] of (back ? [] : board.tracks)) {
    context.lineWidth = width * .72;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    context.stroke();
  }
  for (const pad of board.pads) {
    if (!(back ? pad.back : pad.front)) continue;
    context.save();
    context.translate(...pad.xy);
    context.rotate(-pad.angle * Math.PI / 180);
    const [width, height] = pad.size;
    context.beginPath();
    if (pad.shape === 0) context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
    else context.roundRect(-width / 2, -height / 2, width, height, pad.shape === 4 ? Math.min(width, height) / 4 : 0);
    context.fillStyle = pad.net === "GND" ? "#a0bb99" : "#e4ba73";
    context.fill();
    if (pad.drill[0] && pad.drill[1]) {
      context.beginPath();
      context.ellipse(0, 0, pad.drill[0] / 2, pad.drill[1] / 2, 0, 0, Math.PI * 2);
      context.fillStyle = "#102831";
      context.fill();
    }
    context.restore();
  }
  context.restore();
}

function markProbe(context, [x, y], px, ink, {primary = false, dashed = false, extent = 0} = {}) {
  context.save();
  const radius = primary ? Math.max(26 * px, extent + 6 * px) : (dashed ? 14 : 16) * px;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();
  if (primary) context.roundRect(x - radius, y - radius, 2 * radius, 2 * radius, 6 * px);
  else context.arc(x, y, radius, 0, Math.PI * 2);

  context.strokeStyle = "#0a1724";
  context.lineWidth = (primary ? 10 : 7) * px;
  context.stroke();
  context.strokeStyle = ink;
  context.lineWidth = (primary ? 5 : 3.5) * px;
  if (dashed) context.setLineDash([5 * px, 4 * px]);
  context.stroke();
  context.restore();
}

function drawLocator() {
  const canvas = document.querySelector(".pcb-view");
  if (!canvas || !activeSignal) return;
  const context = canvas.getContext("2d");
  const power = activeSignal.power;
  const route = activeSignal.walkthroughRoute || buildrData.signals[activeSignal.signal];
  const mode = power ? "interface" : canvas.dataset.fixedView || locatorView;
  const installed = mode === "installed";
  const hasMotherboard = installed || mode === "motherboard";
  const board = buildrData.boards[mode === "interface" ? "interfaceB" : route.board];
  const jointColor = "#ffcb64";
  const motherPoint = [activeSignal.x, activeSignal.y];
  const flipped = mode === "solder" && route.board === "sideA";
  const placement = installed ? board.placement : [flipped ? -1 : 1, 0, 0, 0];
  const fixedInterface = canvas.dataset.fixedView === "interface-solder";
  const focusIndex = fixedInterface ? (canvas.dataset.probeFocus === "breakout" ? route.probe : route.joint) : undefined;
  const back = fixedInterface && !board.pads[focusIndex].front;
  const project = point => back ? [-point[0], point[1]] : pcbPoint(placement, point);
  const padScale = Math.hypot(placement[0], placement[1]);
  const ring = (indices, color) => indices.map(index => {
    const pad = board.pads[index];
    return {position: project(pad.xy), color, pad,
      extent: Math.max(...pad.size) * padScale / 2};
  });
  let marks = [];
  if (power) {
    const ref = buildrData.power;
    marks = [
      ...ring([ref["+5V1"], ref["U1.1"], ref["U1.3"]], railColors.input),
      ...ring([ref["+3V3"], ref["U1.5"]], railColors.output),
      ...ring([ref["GND1"], ref["U1.2"]], railColors.ground),
    ];
  } else if (mode === "motherboard") {
    marks = [{position: motherPoint, color: jointColor, extent: 4}];
  } else if (mode === "interface") {
    const {input, output} = interfacePorts(activeSignal.signal);
    marks = [...ring([output, input], "#7fffea"), ...ring(route.interfaceSeries || [], "#e2b9ff")];
    if (route.pullDown !== undefined) marks.push(...ring([route.pullDown], "#e2b9ff"));
  } else if (fixedInterface) {
    const primary = focusIndex === route.joint;
    const pairedIndex = primary ? route.probe : route.joint;
    marks = ring([focusIndex], primary ? jointColor : "#7fffea");
    const pairedPad = board.pads[pairedIndex];
    if (pairedPad && (back ? pairedPad.back : pairedPad.front)) {
      marks.push(...ring([pairedIndex], primary ? "#7fffea" : jointColor));
    }
    canvas.closest("figure").querySelector("[data-probe-side]").textContent = back ?
      "Back · mirrored from front" : "Front";
  } else {
    marks = [...ring([route.joint], jointColor), ...ring([route.probe], "#7fffea")];
    if (mode === "solder") marks.push(...ring(route.series || [], "#e2b9ff"));
  }
  if (!fixedInterface && canvas.dataset.probeFocus === "breakout") marks.push(marks.shift());
  const [target, ...otherMarks] = marks;
  const frame = hasMotherboard ? [[0, 0], [512, 192]] : [];
  if (mode !== "motherboard") frame.push(...board.outline.flat().map(project));
  const isInterface = board === buildrData.boards.interfaceB;
  const view = viewport(frame, target.position, hasMotherboard ? 72 : isInterface && !back ? 8.5 : 6, canvas, locatorZoom);
  const px = 1 / view.scale;
  const image = motherboardImages[activeSignal.side];
  context.fillStyle = "#132638";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.setTransform(...view.transform);
  if (hasMotherboard && image.complete && image.naturalWidth) context.drawImage(image, 0, 0, 512, 192);
  if (mode !== "motherboard") {
    context.save();
    if (back) context.scale(-1, 1);
    drawPcb(context, board, placement, installed, px, back);
    context.restore();
    if (isInterface) drawInterfaceLabels(context, view.scale, back, marks.map(mark => mark.pad));
  }
  if (installed) markProbe(context, motherPoint, px, "#fef8b4", {dashed: true});
  for (const marker of otherMarks) markProbe(context, marker.position, px, marker.color);
  markProbe(context, target.position, px, target.color, {primary: true, extent: target.extent});
  context.restore();
}

function refreshBoardFigure() {
  const result = document.querySelector("#pad-result");
  if (!result || !activeSignal) return;
  const view = document.activeElement?.dataset.boardView;
  result.innerHTML = boardFigure(activeSignal);
  if (view) result.querySelector("[data-board-view='" + view + "']")?.focus({preventScroll: true});
  drawLocator();
}

for (const image of Object.values(motherboardImages)) image.addEventListener("load", drawLocator);

document.addEventListener("click", event => {
  const button = event.target.closest("button[data-board-view], button[data-board-zoom]");
  if (!button) return;
  if (button.hasAttribute("data-board-zoom")) {
    locatorZoom = !locatorZoom;
    button.setAttribute("aria-pressed", String(locatorZoom));
    button.textContent = locatorZoom ? "Full view" : "Zoom to pad";
    drawLocator();
    return;
  }
  locatorView = button.dataset.boardView;
  locatorZoom = false;
  refreshBoardFigure();
});


function signalOptions(selected) {
  return pads.map(pad => '<option value="' + padId(pad.signal) + '"' + (pad === selected ? " selected" : "") +
    '>' + pad.signal + ' · Side ' + pad.side + '</option>').join("");
}

function signalById(id) {
  return pads.find(pad => padId(pad.signal) === id) || pads.find(pad => pad.signal === "DD7");
}

function locatorSelection(id) {
  return id === "power" ? {signal: "Power rails", side: "B", power: true} : signalById(id);
}

function testRow(key, title, instruction) {
  const values = [["", "Unrecorded"], ["pass", "Pass"], ["fail", "Fail"], ["review", "Review"]];
  const control = '<select data-solder-test="' + key + '" aria-label="Result for ' + title + '">' +
    values.map(([value, label]) => '<option value="' + value + '"' +
      (benchResults[key] === value ? " selected" : "") + '>' + label + '</option>').join("") + '</select>';
  return '<li class="test-row"><div><strong>' + title + '</strong><p>' + instruction +
    '</p></div>' + control + '</li>';
}

function signalTests(selected) {
  const id = padId(selected.signal);
  const route = buildrData.signals[selected.signal];
  const title = buildrData.boards[route.board].label;
  const joint = padLabel(buildrPad(route.board, route.joint));
  const probe = padLabel(buildrPad(route.board, route.probe));
  const series = route.series?.map(index => padLabel(buildrPad(route.board, index)));
  const rows = [
    testRow(id + "-joint", "Motherboard to solder joint", "With magnification, match Side " + selected.side +
      " " + selected.land + " to " + joint +
      ". Probe an accessible point on the same motherboard net and the exposed solder contact. A sound direct joint reads near the shorted-lead baseline."),
  ];
  if (series) {
    rows.push(testRow(id + "-copper", "Copper on both sides of the series channel",
      "Verify " + joint + " → " + series[0] + " and " + series[1] + " → " + probe +
      " separately. Each direct copper segment should read near the shorted-lead baseline."));
    rows.push(testRow(id + "-series", "Fitted series channel",
      "Use resistance mode across " + seriesLabel(route.board, route.series) +
      ". Compare the reading with the marked part and confirm any ambiguous value on an isolated channel. Parallel circuit paths can lower an in-circuit reading."));
  } else {
    rows.push(testRow(id + "-copper", "SubPCB passthrough",
      "Probe " + joint + " → " + probe + ". Both pads share " + buildrPad(route.board, route.probe).net +
      " on the SubPCB. Check for a stable reading near the shorted-lead baseline."));
  }
  const ports = interfacePorts(selected.signal);
  const [interfaceInput, interfaceOutput] = [ports.input, ports.output].map(index =>
    interfacePadLabel(buildrPad("interfaceB", index)));
  rows.push(testRow(id + "-bridge", "Isolation from neighboring joints",
    "Check for a solder bridge from this pad to each adjacent exposed joint on a different net. Confirm the expected circuit path before interpreting a low reading. Inspect the joints that become hidden when the PCB is seated."));
  rows.push(testRow(id + "-interface", "Link to the Interface PCB",
    "Check the fitted link from " + probe + " to Interface PCB " + interfaceInput +
    ". The adapter-side endpoint is " + interfaceOutput + ". Verify strain relief after testing the lead. " +
    (route.interfaceSeries ? "Inspect " + seriesLabel("interfaceB", route.interfaceSeries) + " as a separate component check." :
      "Verify the actual adapter cable pinout and contact orientation before attachment.")));
  if (route.pullDown !== undefined) {
    const pullDown = buildrPad("interfaceB", route.pullDown);
    rows.push(testRow(id + "-pack", "Interface pull-down array",
      "If " + pullDown.ref + " is populated, inspect " + padLabel(pullDown) +
      " and the neighboring signal pins for solder bridges. The KiCad value is " + pullDown.value +
      ". A signal-to-ground reading can include this pull-down and other in-circuit paths."));
  }
  return '<h3>' + selected.signal + ' · ' + title + '</h3><ul class="test-rows">' + rows.join("") +
    '</ul><div class="actions"><a class="button" href="#pads/' + id + '">Show ' + selected.signal + ' on the PCB</a>' +
    gusseMeterLink(selected) + '</div>';
}

function renderSolder(id) {
  const walkthrough = solderWalkthrough(id);
  if (walkthrough) return walkthrough;
  const selected = signalById(id);
  const power = ref => padLabel(buildrPad("interfaceB", buildrData.power[ref]));
  const powerRows = [
    testRow("dry-fit", "Dry fit and inspect", "Unplug the PS2 and disconnect the FC1307A. Confirm the revision markings, contact orientation, seating and clearance. Inspect for bridges, lifted lands and displaced parts before the BuildR hides the motherboard joints."),
    testRow("ground", "Ground continuity", "Check " + power("GND1") + " → " + power("U1.2") +
      " on the Interface PCB. Check the installed ground connection to the verified motherboard ground. Compare with the shorted-lead baseline."),
    testRow("rails", "Power-rail continuity and isolation", "Check " + power("+5V1") + " → " + power("U1.1") +
      " and " + power("U1.3") + ", then " + power("+3V3") + " → " + power("U1.5") +
      ". Each direct segment should read near the shorted-lead baseline. Test both rails to ground and to each other for a persistent near-zero short. Capacitors can change the reading while they charge."),
    testRow("first-power", "First power-up with adapter disconnected", "After the unpowered checks pass, verify the rails at the accessible Interface PCB pads against ground. The drawing labels the input 5 V and regulator output 3.3 V. Switch off and unplug before attaching the FC1307A.")
  ];
  return '<div class="layout solder-layout"><section class="panel"><h2 tabindex="-1">Solder test plan</h2>' +
    '<p class="intro">Check your fitted parts against Side A PCB v0.0, B-side SubPCB v0.1 and B-side Interface PCB v0.1. Results are saved in this browser when storage is available.</p>' +
    '<p class="callout warn">Unplug the PS2 and remove the FC1307A before using continuity or resistance mode. Short the meter leads together and record the reading as your baseline.</p>' +
    '<details><summary>Soldering order</summary><ol class="bullets"><li>Clean and dry-fit the mating surfaces. Use the Installed layout and Motherboard only views to orient the solder PCB and check each contact before it is covered.</li>' +
    '<li>Hold the PCB flat, tack it at accessible verified mounting joints, then recheck the alignment under magnification before soldering the remaining contacts.</li>' +
    '<li>Inspect each joint and its neighbors, then work through the meter checks below. Verify the Interface PCB links and rails before reconnecting the adapter.</li></ol></details>' +
    '<div class="actions"><a class="button primary" href="#bridge">Check for solder bridges</a><a class="button" href="#wire">Trace a wire through the boards</a></div>' +
    '<div class="walkthrough-entry"><h3>Side A solder walkthroughs</h3>' + walkthroughGroupMenu("sideA") + '</div>' +
    '<div class="walkthrough-entry"><h3>B-side SubPCB solder walkthroughs</h3>' + walkthroughGroupMenu("subB") + '</div>' +
    '<div class="walkthrough-entry"><h3>B-side Interface PCB solder walkthroughs</h3>' + walkthroughGroupMenu("interfaceB") + interfaceLabelLegend() + '</div>' +
    '<label class="field" for="solder-signal">Signal to verify</label><select id="solder-signal">' +
    signalOptions(selected) + '</select><div class="result" id="solder-result" aria-live="polite">' +
    signalTests(selected) + '</div></section><aside class="stack"><section class="panel"><h3>Fit, ground and power</h3>' +
    '<ul class="test-rows">' + powerRows.join("") + '</ul><div class="actions"><a href="#power">FC1307A power check</a><a href="#pads/power">Locate the Interface PCB power pads</a>' +
    '<a href="#meter">Gusse’s meter and 5 V reference</a></div></section>' +
    '<section class="panel"><h3>Confirm on the PS2</h3>' +
    '<p class="intro">After the solder and power checks, capture the disconnected DEV9 snapshot. Follow with the connected Reset, Identify and Reads checks.</p>' +
    '<div class="actions"><a href="#install/baseline">Run the CheckR baseline</a></div></section></aside></div>';
}

document.addEventListener("change", event => {
  const target = event.target;
  if (target.id === "solder-signal") {
    history.replaceState(null, "", "#solder/" + target.value);
    document.querySelector("#solder-result").innerHTML = signalTests(signalById(target.value));
  } else if (target.dataset.solderTest) {
    saveBenchResult(target.dataset.solderTest, target.value);
  }
});

function saveBenchResult(key, value) {
  benchResults[key] = value;
  try {
    localStorage.setItem(benchKey, JSON.stringify(benchResults));
  } catch {
    // Preserve entries in memory for the current session.
  }
}
