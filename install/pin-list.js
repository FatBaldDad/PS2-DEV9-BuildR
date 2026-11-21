"use strict";

const pinListGrounds = new Set([2, 19, 22, 24, 26, 28, 30, 40, 43]);
const pinListUnwired = new Set([20, 32, 34, 39, 44]);
const pinListDescriptions = {
  "RESET#": "Active-low drive reset", "DIOR#": "Register / data read strobe",
  "DIOW#": "Register / data write strobe", IORDY: "I/O ready",
  DMARQ: "DMA request", "DMACK#": "DMA acknowledge", INTRQ: "Drive interrupt",
  DA0: "Register address bit 0", DA1: "Register address bit 1", DA2: "Register address bit 2",
  "CS0#": "Command-register chip select", "CS1#": "Control-register chip select",
};
const pinListEntries = Array.from({length: 44}, (_, index) => {
  const pin = index + 1;
  const pad = pads.find(candidate => gussePin(candidate) === pin);
  const joint = pad ? walkthroughJointForPad(pad) : null;
  const ground = pinListGrounds.has(pin);
  const power = pin === 41 || pin === 42;
  const unwired = pinListUnwired.has(pin);
  const color = wireColorEntries.find(entry => entry.id ===
    (pad ? padId(pad.signal) : ground ? "ground" : power ? "power-5v" : pin === 39 ? "dasp" : ""));
  const signal = pad?.signal || (ground ? pin === 28 ? "CSEL / GND" : "GND" :
    power ? "+5 V" : ({20: "KEY", 32: "IOCS16#", 34: "PDIAG#", 39: "DASP#", 44: "TYPE / reserved"})[pin]);
  const description = pad ? (/^DD\d+$/.test(signal) ? "Data bus bit " + signal.slice(2) : pinListDescriptions[signal]) :
    ground ? (pin === 28 ? "Ground in the source checklist; confirm on your adapter" : "Use a confirmed ground return") :
    power ? "Verify supply contacts and the +5 V source before connecting" :
    pin === 39 ? "Unwired in the checklist; optional BuildR activity circuit" :
    pin === 44 ? "Leave unwired pending adapter verification" : "Leave unwired in this build checklist";
  return {pin, pad, joint, ground, power, unwired, color, signal, description,
    destination: pad ? pad.side === "A" ? "TOP · A" : "BOTTOM · B" :
      ground ? "GROUND" : power ? "+5 V" : pin === 44 ? "RESERVED" : "NC"};
});

function pinListCheck(entry, field) {
  if (field === "soldered" && !entry.joint) return '<span class="pin-list-na" aria-label="Not applicable">N/A</span>';
  // Signal checks share the existing solder walkthrough's saved state.
  const key = entry.joint ? jointMark(entry.joint, field) : "pin-list-" + entry.pin + "-" + field;
  const action = field === "soldered" ? "Solder joint inspected" :
    entry.unwired ? "Confirmed left unwired" : entry.power ? "Supply verified" : "Ground return verified";
  return '<input type="checkbox" data-pin-list-mark="' + key + '" aria-label="Pin ' + entry.pin + ' ' +
    entry.signal + ': ' + action + '"' + (benchResults[key] ? ' checked' : '') + '>';
}

function pinListDiagram(entry) {
  if (entry.pad) return '<a class="pin-list-point" href="#pin/' + entry.pin + '">View solder point</a>' +
    '<a class="pin-list-land" href="#pads/' + padId(entry.signal) + '">Motherboard land</a>';
  if (entry.power) return '<a href="#power/pin' + entry.pin + '">Supply reference</a>';
  if (entry.ground) return '<a href="#wire/ground">Ground reference</a>';
  return '<a href="#adapter/' + entry.pin + '">Pin ' + entry.pin + ' reference</a>';
}

function renderPinList(id) {
  const selected = pinListEntries.find(entry => String(entry.pin) === id);
  const rows = pinListEntries.map(entry => {
    const chosen = entry === selected;
    return '<tr data-pin-list-row="' + entry.pin + '"' + (chosen ? ' class="pin-list-selected"' : '') + '>' +
      '<th scope="row"><a href="#adapter/' + entry.pin + '"' +
      (chosen ? ' tabindex="-1" data-step-focus aria-label="Pin ' + entry.pin + ', returned from solder point"' : '') +
      '>' + entry.pin + '</a></th><td>' + entry.destination + '</td>' +
      '<td class="pin-list-check">' + pinListCheck(entry, "soldered") + '</td>' +
      '<td class="pin-list-check">' + pinListCheck(entry, "verified") + '</td>' +
      '<td><strong>' + entry.signal + '</strong><small>' + entry.description + '</small></td>' +
      '<td>' + pinListDiagram(entry) + '</td><td class="pin-list-color">' +
      (entry.color ? wireColorSwatch(entry.color) : '<span class="pin-list-na">N/A</span>') + '</td></tr>';
  }).join("");
  return '<section class="panel pin-list-panel"><p class="eyebrow">44-pin bench reference · GH-035-11</p>' +
    '<h2 tabindex="-1">Pin checklist</h2><p class="intro">Find the IDE pin, check the wire color, then open its solder point. ' +
    'TOP is Side A; BOTTOM is Side B. The close-up centers on the exposed BuildR wire pad.</p>' +
    '<p class="caption">S = motherboard-to-BuildR joint soldered and inspected. T = that joint’s meter checks passed. ' +
    'Signal checks share the solder walkthrough’s saved results. For reference rows, T records ground / supply verification or confirms NC is left unwired. ' +
    'Only fit connections required by your build.</p>' +
    '<div class="actions no-print"><a class="button" href="#wire-colors">Wire colors and full routes</a>' +
    '<button class="button" type="button" data-print-pin-list>Print checklist</button></div>' +
    '<div class="pin-list-toolbar no-print"><div><label for="pin-list-search" class="field">Find pin or signal</label>' +
    '<input type="search" id="pin-list-search" placeholder="e.g. 17, DD0, RESET, purple"></div>' +
    '<div><label for="pin-list-side" class="field">Show connections</label><select id="pin-list-side">' +
    '<option value="all">All 44 pins</option><option value="A">TOP · Side A</option>' +
    '<option value="B">BOTTOM · Side B</option><option value="other">Ground, power and NC</option></select></div></div>' +
    '<p class="caption" id="pin-list-count" role="status">44 pins shown. Results save in this browser when storage is available.</p>' +
    '<div class="pin-list-scroll"><table class="pin-list-table"><caption class="sr-only">IDE pins, solder points and wire colors</caption>' +
    '<thead><tr><th scope="col">IDE pin</th><th scope="col">Destination</th><th scope="col"><abbr title="Soldered and inspected">S</abbr></th>' +
    '<th scope="col"><abbr title="Tested">T</abbr></th><th scope="col">Signal / description</th><th scope="col">Diagram</th>' +
    '<th scope="col">Wire color</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="caption">Colors: <a href="' + wireColorSource + '">PS2 V12 IDE Soldering Checklist</a>. ' +
    'Unassigned colors appear as Not assigned or N/A. Pin 28 is ground in that checklist; pin 39 is unwired unless you fit the optional activity circuit. ' +
    'Pins 41/42 need a verified +5 V feed; leave pin 44 unwired pending adapter verification.</p></section>';
}

function filterPinList() {
  const search = document.querySelector("#pin-list-search");
  if (!search) return;
  const query = search.value.trim().toLowerCase();
  const pinQuery = /^(?:pin\s*)?(\d{1,2})$/.exec(query);
  const terms = query.split(/\s+/).filter(Boolean);
  const side = document.querySelector("#pin-list-side").value;
  let count = 0;
  for (const row of document.querySelectorAll("[data-pin-list-row]")) {
    const entry = pinListEntries[Number(row.dataset.pinListRow) - 1];
    const matchesSide = side === "all" || (side === "other" ? !entry.pad : entry.pad?.side === side);
    const text = [entry.pin, entry.signal, entry.description, entry.destination,
      entry.color ? wirePalette[wireColorValue(entry.color)].name : "N/A"].join(" ").toLowerCase();
    row.hidden = !matchesSide || (pinQuery ? entry.pin !== Number(pinQuery[1]) : !terms.every(term => text.includes(term)));
    if (!row.hidden) count++;
  }
  document.querySelector("#pin-list-count").textContent = count ? count + " of 44 pins shown" : "No matching pins. Clear the search or change the filter.";
}

function renderPinPoint(id) {
  const entry = pinListEntries.find(candidate => String(candidate.pin) === id);
  if (!entry?.joint) return renderPinList();
  const html = solderWalkthrough(walkthroughUrl(entry.joint).slice("#solder/".length));
  locatorZoom = true;
  return '<section class="panel pin-point-header" data-pin-point="' + entry.pin + '">' +
    '<div><p class="eyebrow">IDE pin ' + entry.pin + ' · ' + entry.destination + '</p>' +
    '<h2 tabindex="-1">' + entry.signal + ' · wire solder point</h2><p class="intro">' +
    buildrData.boards[entry.joint.route.board].label + ' · <strong>' + padLabel(entry.joint.breakout) +
    '</strong> · Wire 1 to the Interface PCB input</p></div>' +
    '<div>' + wireColorSwatch(entry.color) + '<div class="actions"><a class="button" href="#pin-list/' +
    entry.pin + '">Back to pin checklist</a><a href="#wire/' + padId(entry.signal) + '">Full wire route</a></div></div>' +
    '<div class="view-buttons" role="group" aria-label="Solder point close-up"><button class="button" type="button" data-pin-focus="breakout" ' +
    'aria-pressed="true">Wire solder pad</button><button class="button" type="button" data-pin-focus="joint" ' +
    'aria-pressed="false">Motherboard contact</button></div></section>' + html;
}

function activatePinPoint() {
  if (!document.querySelector("[data-pin-point]")) return;
  const canvas = document.querySelector(".pcb-view");
  canvas.dataset.probeFocus = "breakout";
  for (const button of document.querySelectorAll("[data-probe-focus]")) {
    button.setAttribute("aria-pressed", String(button.dataset.probeFocus === "breakout"));
  }
}

document.addEventListener("input", event => {
  if (event.target.id === "pin-list-search") filterPinList();
});
document.addEventListener("change", event => {
  if (event.target.id === "pin-list-side") filterPinList();
  const key = event.target.dataset.pinListMark;
  if (key) {
    const valid = pinListEntries.some(entry => ["soldered", "verified"].some(field =>
      key === (entry.joint ? jointMark(entry.joint, field) : "pin-list-" + entry.pin + "-" + field)));
    if (valid) saveBenchResult(key, event.target.checked);
  }
});
document.addEventListener("click", event => {
  if (event.target.closest("[data-print-pin-list]")) window.print();
  const button = event.target.closest("[data-pin-focus], [data-probe-focus]");
  if (!button || !document.querySelector("[data-pin-point]")) return;
  const focus = button.dataset.pinFocus || button.dataset.probeFocus;
  document.querySelector(".pcb-view").dataset.probeFocus = focus;
  locatorZoom = true;
  for (const control of document.querySelectorAll("[data-pin-focus], [data-probe-focus]")) {
    control.setAttribute("aria-pressed", String((control.dataset.pinFocus || control.dataset.probeFocus) === focus));
  }
  const zoom = document.querySelector("[data-board-zoom]");
  zoom.setAttribute("aria-pressed", "true");
  zoom.textContent = "Full view";
  drawLocator();
});
