"use strict";

const bridgeGroups = ["RB9003", "RB9004", "RB9005", "RB9002"];
const bridgeSignals = pads.filter(({signal}) => /^DD\d+$/.test(signal));
const bridgeGround = buildrPad("interfaceB", buildrData.power.GND1);
const bridgeModes = {
  neighbor: {
    label: "Adjacent data pins", units: "Ω",
    instruction: "Check for a sustained continuity tone, then switch to Ω and record the settled resistance. A bridge on the motherboard can read through the fitted series resistors and stay above the buzzer threshold. If a pair reads unusually low, compare it with the other pairs in the same group and recheck directly at the motherboard lands if accessible.",
  },
  ground: {
    label: "Continuity to ground", units: "Ω",
    instruction: "Check for a sustained tone, then record the settled resistance in Ω. Compare with your shorted-lead reading and with other data lines. A persistent reading near the shorted-lead baseline at the motherboard land merits inspection. From the Interface PCB, a ground bridge can read through a series resistor.",
  },
  diode: {
    label: "Diode to ground", units: "V",
    instruction: "Select diode mode. Hold the red probe on GND and touch the black probe to the data pad. Record the settled voltage or OL. Compare data lines using the same setup, then run the adjacent-pin checks even when the diode readings match.",
  },
};

const bridgeTests = bridgeGroups.flatMap(group => {
  // The board crop is oriented rear edge up. Use land order, since the Interface
  // PCB fans these nets out in a different order.
  const lands = bridgeSignals.filter(pad => pad.land === group).sort((a, b) => a.x - b.x);
  return lands.slice(1).map((black, index) => {
    const red = lands[index];
    return {
      id: "neighbor-" + padId(red.signal) + "-" + padId(black.signal),
      mode: "neighbor", red, black, label: red.signal + " ↔ " + black.signal,
    };
  });
});
for (const mode of ["ground", "diode"]) {
  for (const black of bridgeSignals) {
    bridgeTests.push({id: mode + "-" + padId(black.signal), mode, black, label: "GND ↔ " + black.signal});
  }
}

let bridgeView = "interface";
let bridgeZoom = "both";

function bridgeUrl(test) {
  return "#bridge/" + test.id;
}

function bridgeModeLinks(test) {
  return Object.entries(bridgeModes).map(([mode, {label}]) => {
    const inMode = candidate => candidate.mode === mode;
    const destination = test.mode === mode ? test :
      bridgeTests.find(candidate => inMode(candidate) && (candidate.black === test.black || candidate.red === test.black)) ||
      bridgeTests.find(inMode);
    return '<a class="button" href="' + bridgeUrl(destination) + '"' +
      (test.mode === mode ? ' aria-current="true"' : '') + '>' + label + '</a>';
  }).join("");
}

function bridgeMeterReference(pad) {
  const pin = gussePin(pad);
  const {diode, ohms} = gusseRows[pin - 1];
  const reading = diode ? diode + " V in diode mode · " + ohms / 1000 + " kΩ listed" : "No reading published";
  return '<li><a href="#meter/' + pin + '">' + pad.signal + ' · IDE pin ' + pin + '</a><span>' + reading + '</span></li>';
}

function renderBridge(id) {
  const test = bridgeTests.find(candidate => candidate.id === id) || bridgeTests[0];
  const {label, instruction, units} = bridgeModes[test.mode];
  const sequence = bridgeTests.filter(candidate => candidate.mode === test.mode);
  const index = sequence.indexOf(test);
  const group = "Side " + test.black.side + " · " + test.black.land;
  const lead = (color, pad) => {
    const contact = pad ? adapterInterfacePad(pad.signal) : bridgeGround;
    return '<li><span class="bridge-lead ' + color + '">' + color + ' probe</span><b>' +
      (pad?.signal || "GND") + '</b><span>' + interfacePadLabel(contact) + '</span></li>';
  };
  const step = (offset, text) => {
    const target = sequence[index + offset];
    return target ? '<a class="button' + (offset > 0 ? ' primary' : '') + '" href="' + bridgeUrl(target) + '">' + text + '</a>' :
      '<button class="button" type="button" disabled>' + text + '</button>';
  };
  bridgeZoom = "both";
  return '<div class="bridge-workspace" data-bridge-test="' + test.id + '">' +
    '<section class="panel"><h2 tabindex="-1">Solder bridge checks</h2>' +
    '<p class="callout warn">Unplug the PS2 and disconnect the SD-to-IDE adapter. Keep the BuildR wiring connected for these checks. For resistance readings, touch the meter probes together first to find your lead baseline.</p>' +
    '<nav class="actions bridge-modes" aria-label="Bridge test modes">' + bridgeModeLinks(test) + '</nav>' +
    '<div class="bridge-picker"><div><label class="field" for="bridge-step">Choose a test</label>' +
    '<select id="bridge-step">' + sequence.map(candidate =>
      '<option value="' + candidate.id + '"' + (candidate === test ? ' selected' : '') + '>' +
      candidate.label + ' · Side ' + candidate.black.side + ' ' + candidate.black.land + '</option>').join("") +
    '</select></div><nav class="actions bridge-paging" aria-label="Steps in ' + label + '">' +
    step(-1, "← Previous") + '<span class="caption">' + (index + 1) + ' of ' + sequence.length + '</span>' +
    step(1, "Next →") + '</nav></div>' +
    (test.mode === "neighbor" ? '<p class="caption">Pairs follow consecutive data lands within each of the four GH-035-11 resistor groups. Use Motherboard to see which joints are next to each other.</p>' : '') +
    '</section>' +
    '<div class="layout"><section class="panel"><h3>Probe locations</h3>' +
    '<div class="board-controls"><div class="view-buttons" role="group" aria-label="Board view">' +
    '<button class="button" type="button" data-bridge-view="interface">Interface PCB</button>' +
    '<button class="button" type="button" data-bridge-view="motherboard">Motherboard</button>' +
    '</div><div class="view-buttons" role="group" aria-label="Probe zoom">' +
    '<button class="button" type="button" data-bridge-zoom="full">Full board</button>' +
    '<button class="button" type="button" data-bridge-zoom="both">Both probes</button>' +
    '<button class="button" type="button" data-bridge-zoom="red">Zoom to red</button>' +
    '<button class="button" type="button" data-bridge-zoom="black">Zoom to black</button>' +
    '</div></div>' +
    '<figure class="locator"><div class="map-top"><span data-bridge-map-title></span><span>' + test.label + '</span></div>' +
    '<canvas class="bridge-map" width="1040" height="620" role="img">Use the probe labels beside the diagram.</canvas>' +
    '<figcaption class="caption" data-bridge-map-note></figcaption></figure>' + interfaceLabelLegend() + '</section>' +
    '<section class="panel"><p class="eyebrow">' + group + '</p><h3>' + test.label + '</h3>' +
    '<ul class="bridge-leads" aria-label="Interface PCB probe pads">' + lead("red", test.red) + lead("black", test.black) + '</ul>' +
    '<p class="intro">' + instruction + '</p>' +
    '<label class="field" for="bridge-reading">Measured reading (' + units + ')</label>' +
    '<input type="text" id="bridge-reading" maxlength="24" placeholder="Enter reading or OL">' +
    '<ul class="test-rows">' + testRow("bridge-result-" + test.id, "Result", "Review any unexpected or unstable reading.") + '</ul>' +
    '<p class="caption">Readings and results are saved in this browser when storage is available.</p>' +
    '<div class="result"><h3>Gusse’s IDE readings</h3><ul class="bridge-reference">' +
    [test.red, test.black].filter(Boolean).map(bridgeMeterReference).join("") + '</ul>' +
    '<p class="caption">Measured on an IDE Resurrector with a SATA adapter and capacitors fitted. Compare at the equivalent IDE signal using red on ground and black on the pin in diode mode.</p>' +
    '<p class="caption"><a href="' + gusseSource + '">Original readings and measurement setup</a></p></div>' +
    '</section></div></div>';
}

const bridgeLeadInk = {red: "#ff686f", black: "#6cf1ff"};

function bridgeMarks(test) {
  if (bridgeView === "motherboard") {
    return [
      ...(test.red ? [{color: "red", xy: [test.red.x, test.red.y], extent: 5}] : []),
      {color: "black", xy: [test.black.x, test.black.y], extent: 5},
    ];
  }
  const red = test.red ? adapterInterfacePad(test.red.signal) : bridgeGround;
  const black = adapterInterfacePad(test.black.signal);
  return [[red, "red"], [black, "black"]].map(([pad, color]) => ({
    color, pad, xy: pad.xy, extent: Math.max(...pad.size) / 2,
  }));
}

function drawBridgeDiagram() {
  const root = document.querySelector("[data-bridge-test]");
  if (!root) return;
  const test = bridgeTests.find(candidate => candidate.id === root.dataset.bridgeTest);
  const canvas = root.querySelector(".bridge-map");
  const pcb = buildrData.boards.interfaceB;
  const motherboard = bridgeView === "motherboard";
  const marks = bridgeMarks(test);
  const bounds = motherboard ? [[0, 0], [512, 192]] : pcb.outline.flat();
  const target = marks.find(mark => mark.color === bridgeZoom)?.xy;
  let view;
  if (target) {
    view = viewport(bounds, target, motherboard ? 90 : 10, canvas, true);
  } else if (bridgeZoom === "both") {
    const margin = motherboard ? 30 : 3.4;
    const region = marks.flatMap(({xy: [x, y]}) => [[x - margin, y - margin], [x + margin, y + margin]]);
    view = viewport(region, null, 0, canvas, false);
  } else {
    view = viewport(bounds, null, 0, canvas, false);
  }

  const context = canvas.getContext("2d");
  context.resetTransform();
  context.fillStyle = "#132638";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(...view.transform);
  const px = 1 / view.scale;
  if (motherboard) {
    const image = motherboardImages[test.black.side];
    if (image.complete && image.naturalWidth) context.drawImage(image, 0, 0, 512, 192);
  } else {
    drawPcb(context, pcb, [1, 0, 0, 0], false, px);
    drawInterfaceLabels(context, view.scale, false, marks.map(mark => mark.pad));
  }
  for (const mark of marks) {
    const focused = bridgeZoom === mark.color;
    const radius = focused ? Math.max(mark.extent + 6 * px, 22 * px) : 13 * px;
    context.beginPath();
    context.arc(...mark.xy, radius, 0, 2 * Math.PI);
    context.strokeStyle = "#0a1724";
    context.lineWidth = 10 * px;
    context.stroke();
    context.strokeStyle = bridgeLeadInk[mark.color];
    context.lineWidth = 5 * px;
    context.stroke();
    context.beginPath();
    context.arc(...mark.xy, 3.5 * px, 0, 2 * Math.PI);
    context.fillStyle = bridgeLeadInk[mark.color];
    context.fill();
  }
  context.resetTransform();

  const onlyBlack = motherboard && !test.red;
  const title = motherboard ? "↑ Rear connector edge · Side " + test.black.side : "Interface PCB v0.1 · Front";
  root.querySelector("[data-bridge-map-title]").textContent = title;
  root.querySelector("[data-bridge-map-note]").textContent = onlyBlack ?
    "Cyan marks the data land. Keep the red probe on Interface PCB GND1 pin 1." :
    "Red marks the red probe. Cyan marks the black probe.";
  canvas.setAttribute("aria-label", title + ". " + (onlyBlack ?
    "Black probe on " + test.black.signal + ". Red probe remains on Interface PCB GND1 pin 1." :
    "Red probe on " + (test.red?.signal || "GND") + ". Black probe on " + test.black.signal + "."));
  for (const button of root.querySelectorAll("[data-bridge-view], [data-bridge-zoom]")) {
    const zoom = button.dataset.bridgeZoom;
    button.disabled = onlyBlack && zoom === "red";
    if (onlyBlack && zoom === "both") button.textContent = "Data land";
    else if (zoom === "both") button.textContent = "Both probes";
    button.setAttribute("aria-pressed", zoom ? zoom === bridgeZoom : button.dataset.bridgeView === bridgeView);
  }
}

function activateBridge() {
  const root = document.querySelector("[data-bridge-test]");
  if (!root) return;
  const reading = root.querySelector("#bridge-reading");
  const key = "bridge-reading-" + root.dataset.bridgeTest;
  reading.value = benchResults[key] ?? "";
  reading.addEventListener("input", () => saveBenchResult(key, reading.value));
  const picker = root.querySelector("#bridge-step");
  picker.addEventListener("change", () => { location.hash = "#bridge/" + picker.value; });
  root.addEventListener("click", event => {
    const {bridgeView: view, bridgeZoom: zoom} = event.target.dataset;
    if (view) {
      bridgeView = view;
      bridgeZoom = "both";
    } else if (zoom) {
      bridgeZoom = zoom;
    } else {
      return;
    }
    drawBridgeDiagram();
  });
  drawBridgeDiagram();
}

for (const image of Object.values(motherboardImages)) image.addEventListener("load", drawBridgeDiagram);
