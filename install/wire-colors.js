"use strict";

// Bench color choices only; all electrical endpoints come from the existing wire map.
const wireColorKey = "fbd-dev9-buildr-checklist-wire-colors-v1";
const wirePalette = {
  unset: {name: "Not assigned", hex: "#ffffff"},
  black: {name: "Black", hex: "#20252c"},
  red: {name: "Red", hex: "#df303a"},
  pink: {name: "Pink", hex: "#ed83bc"},
  brown: {name: "Brown", hex: "#995a32"},
  orange: {name: "Orange", hex: "#ef8c24"},
  yellow: {name: "Yellow", hex: "#f2d74b"},
  green: {name: "Green", hex: "#39a15d"},
  blue: {name: "Blue", hex: "#347ccc"},
  purple: {name: "Purple", hex: "#945dcc"},
  gray: {name: "Gray", hex: "#929aa5"},
  white: {name: "White", hex: "#ffffff"},
  cyan: {name: "Cyan", hex: "#34c5cf"},
};
// Pin Checklist!A7:I50, Wire color column. N/A and absent rows stay unassigned.
const wireColorSource = "https://docs.google.com/spreadsheets/d/1KdZB02xICUhMrN8yKhpt6ARcejf_AVAqhD7HWVxzkDs/edit#gid=1088510634&range=A6:I50";
const wireReferenceColors = {
  "1": "purple",
  "3": "white",
  "4": "gray",
  "5": "white",
  "6": "gray",
  "7": "white",
  "8": "gray",
  "9": "white",
  "10": "gray",
  "11": "white",
  "12": "gray",
  "13": "white",
  "14": "gray",
  "15": "white",
  "16": "gray",
  "17": "white",
  "18": "gray",
  "21": "green",
  "23": "blue",
  "25": "blue",
  "27": "brown",
  "29": "green",
  "31": "brown",
  "33": "yellow",
  "35": "yellow",
  "36": "yellow",
  "37": "orange",
  "38": "orange"
};
const wireColorEntries = [
  {id: "ground", mapId: "ground", signal: "GND", group: "Ground and power", defaultColor: "unset",
    source: "Verified GH-035-11 ground; Side A / SubPCB ground contacts where fitted",
    via: wireInterfaceEnd(interfacePadIndex("GND1")),
    end: wireAdapterEnd(43) + " · confirm adapter return", note: "Ground leads"},
  {id: "power-5v", mapId: "power", signal: "+5 V", group: "Ground and power", defaultColor: "unset",
    source: '<a href="#wire/power">GH-035-11 JL4016</a>',
    via: wireInterfaceEnd(interfacePadIndex("+5V1")),
    end: wireAdapterEnd(41) + " / " + wireAdapterEnd(42) + " · confirm fitted feed",
    note: "5 V supply leads; verify the actual harness contacts"},
  {id: "power-3v3", mapId: "power", signal: "+3.3 V", group: "Ground and power", defaultColor: "unset",
    source: "Local Interface regulator output · if fitted",
    via: wireInterfaceEnd(interfacePadIndex("+3V3")),
    end: "No adapter destination assigned", note: "Separate rail; only use if required by your build"},
  ...wireSequence.filter(item => item.pad).map(item => {
    const solder = walkthroughJointForPad(item.pad);
    const {input, output, route} = interfacePorts(item.pad.signal);
    return {
      id: item.id, mapId: item.id, signal: item.pad.signal,
      group: item.pad.side === "A" ? "Side A PCB" : "B-side SubPCB",
      defaultColor: wireReferenceColors[gussePin(item.pad)] || "unset",
      source: buildrData.boards[route.board].label + " · " +
        wireLink(walkthroughUrl(solder), padLabel(solder.breakout)),
      via: "In: " + wireInterfaceEnd(input) + "<br>Out: " + wireInterfaceEnd(output),
      end: wireAdapterEnd(gussePin(item.pad)),
      note: "Same color for Wire 1 and Wire 2; label both ends " + item.pad.signal,
    };
  }),
  ...wirePasses.map(joint => ({
    id: joint.id, mapId: joint.id, signal: joint.pad.signal, group: "Pass-through and activity",
    defaultColor: "unset",
    source: wireLink(walkthroughUrl(joint), joint.joint.ref + " to " + joint.breakout.ref),
    via: "Local SubPCB copper pair", end: "Downstream destination unconfirmed",
    note: "Assign a color only for an external lead you actually fit",
  })),
  {id: "dasp", mapId: "dasp", signal: "DASP#", group: "Pass-through and activity", defaultColor: "unset",
    source: "Optional adapter activity lead",
    via: wireInterfaceEnd(interfacePadIndex("IDE_DASP1")), end: wireAdapterEnd(39),
    note: "Checklist leaves pin 39 unwired; only fit if your BuildR uses the activity circuit"},
];
let wireColorChoices = {};
let wireColorStorage = true;
try {
  const saved = JSON.parse(localStorage.getItem(wireColorKey));
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const entry of wireColorEntries) {
      if (Object.hasOwn(saved, entry.id) && typeof saved[entry.id] === "string" && Object.hasOwn(wirePalette, saved[entry.id])) {
        wireColorChoices[entry.id] = saved[entry.id];
      }
    }
  }
} catch {
  wireColorStorage = false;
}

function wireColorValue(entry) {
  return wireColorChoices[entry.id] || entry.defaultColor;
}

function wireColorSwatch(entry) {
  const key = wireColorValue(entry);
  const color = wirePalette[key];
  return '<span class="wire-color-chip"><span class="wire-color-swatch' +
    (key === "unset" ? " wire-color-unset" : "") + '" style="--wire-color:' + color.hex +
    '" aria-hidden="true"></span><strong>' + color.name + '</strong></span>';
}

function wireColorBadge(entry) {
  return wireColorSwatch(entry) + '<span class="wire-color-origin">' +
    (Object.hasOwn(wireColorChoices, entry.id) ? "Your choice" :
      entry.defaultColor === "unset" ? "Not specified in checklist" : "From checklist") + '</span>';
}

function wireColorDetail(id) {
  const entries = wireColorEntries.filter(entry => entry.mapId === id);
  return '<section class="wire-color-detail" aria-label="Wire color reference"><h3>Wire color</h3>' +
    entries.map(entry => '<p><b>' + entry.signal + '</b> ' + wireColorBadge(entry) + '</p>').join("") +
    '<p class="caption">Use the same color for both wire segments of a signal. Colors repeat, so label both ends with the signal name. ' +
    '<a href="#wire-colors">View or change the color reference</a>.</p></section>';
}

function wireColorOptions(entry) {
  return Object.entries(wirePalette).map(([key, color]) =>
    '<option value="' + key + '"' + (key === wireColorValue(entry) ? " selected" : "") + '>' +
    color.name + '</option>').join("");
}

function wireColorStatus() {
  return wireColorStorage ?
    "Color choices are saved in this browser on this device. Print your reference to keep a copy." :
    "Color choices are available for this session. Browser storage is unavailable; print your reference to keep a copy.";
}

function renderWireColors() {
  let group = "";
  const rows = wireColorEntries.map(entry => {
    const heading = group === entry.group ? "" :
      '<tr class="wire-color-group"><th colspan="5" scope="colgroup">' + entry.group + '</th></tr>';
    group = entry.group;
    return heading + '<tr data-wire-color-row="' + entry.id + '">' +
      '<td data-label="Wire color"><div data-wire-color-badge>' + wireColorBadge(entry) + '</div>' +
      '<label class="sr-only" for="wire-color-' + entry.id + '">Wire color for ' + entry.signal + '</label>' +
      '<select class="wire-color-select no-print" id="wire-color-' + entry.id + '" data-wire-color="' + entry.id + '">' +
      wireColorOptions(entry) + '</select></td>' +
      '<th scope="row" data-label="Signal / label"><a href="#wire/' + entry.mapId + '">' +
      entry.signal + '</a><small>' + entry.note + '</small></th>' +
      '<td data-label="Solder PCB / source">' + entry.source + '</td>' +
      '<td data-label="Interface PCB">' + entry.via + '</td>' +
      '<td data-label="Adapter pin">' + entry.end + '</td></tr>';
  }).join("");
  return '<section class="panel wire-colors-panel"><p class="eyebrow">Bench reference · GH-035-11</p>' +
    '<h2 tabindex="-1">Wire color reference</h2>' +
    '<p class="intro">Colors follow the Wire color column in your PS2 V12 IDE Soldering Checklist. Follow each signal from its solder PCB breakout through the Interface PCB to the adapter, or change a color to match your wire.</p>' +
    '<p class="callout">These are your checklist colors, not a factory or ATA color standard. ' +
    'Colors repeat: label both ends with the signal name. Use the same color for Wire 1 (solder PCB to Interface input) ' +
    'and Wire 2 (Interface output to adapter). Match the pad names and pin numbers before soldering.</p>' +
    '<p class="caption">Source: <a href="' + wireColorSource + '">PS2 V12 IDE Soldering Checklist · Pin Checklist · Wire color column</a>. ' +
    'N/A colors and connections absent from the sheet remain unassigned. The source supplies the colors; the BuildR wire map supplies the board endpoints.</p>' +
    '<p class="caption">Side A PCB v0.0 · B-side SubPCB v0.1 · B-side Interface PCB v0.1 · 44-pin FC1307A. ' +
    '5 V and 3.3 V are separate rails. Supply pins 41/42 are reference positions; confirm the fitted harness feed. ' +
    'Pass-through rows show local copper only until external wiring is confirmed.</p>' +
    '<div class="actions no-print"><button type="button" class="button primary" data-print-wire-colors>Print reference</button>' +
    '<button type="button" class="button" data-reset-wire-colors>Use spreadsheet colors</button>' +
    '<a href="#wire">Open wire map and meter checks</a></div>' +
    '<p class="caption no-print" id="wire-color-status" role="status">' + wireColorStatus() + '</p>' +
    '<div class="wire-color-filter no-print"><label class="field" for="wire-color-search">Find a signal, pad or adapter pin</label>' +
    '<input type="search" id="wire-color-search" placeholder="e.g. DD0, RESET, pin 17, JL4016"></div>' +
    '<p class="caption" id="wire-color-count" role="status">' + wireColorEntries.length + ' connections</p>' +
    '<div class="wire-color-table"><table><caption class="sr-only">Wire colors and board endpoints</caption>' +
    '<thead><tr><th scope="col">Wire color</th><th scope="col">Signal / label</th><th scope="col">Solder PCB / source</th>' +
    '<th scope="col">Interface PCB</th><th scope="col">Adapter pin</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
}

function saveWireColors() {
  try {
    localStorage.setItem(wireColorKey, JSON.stringify(wireColorChoices));
    wireColorStorage = true;
  } catch {
    wireColorStorage = false;
  }
}

function filterWireColors() {
  const input = document.querySelector("#wire-color-search");
  if (!input) return;
  const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const row of document.querySelectorAll("[data-wire-color-row]")) {
    const entry = wireColorEntries.find(candidate => candidate.id === row.dataset.wireColorRow);
    const text = [entry.signal, entry.group, entry.source, entry.via, entry.end,
      wirePalette[wireColorValue(entry)].name].join(" ").replace(/<[^>]*>/g, " ").toLowerCase();
    row.hidden = !terms.every(term => text.includes(term));
    if (!row.hidden) count++;
  }
  for (const heading of document.querySelectorAll(".wire-color-group")) {
    let row = heading.nextElementSibling;
    let visible = false;
    while (row && row.hasAttribute("data-wire-color-row")) {
      if (!row.hidden) visible = true;
      row = row.nextElementSibling;
    }
    heading.hidden = !visible;
  }
  document.querySelector("#wire-color-count").textContent = count ?
    count + " of " + wireColorEntries.length + " connections" : "No matching connections. Clear the search to show all.";
}

document.addEventListener("input", event => {
  if (event.target.id === "wire-color-search") filterWireColors();
});

document.addEventListener("change", event => {
  const id = event.target.dataset.wireColor;
  const entry = wireColorEntries.find(candidate => candidate.id === id);
  if (!entry || !Object.hasOwn(wirePalette, event.target.value)) return;
  if (event.target.value === entry.defaultColor) delete wireColorChoices[id];
  else wireColorChoices[id] = event.target.value;
  saveWireColors();
  event.target.closest("tr").querySelector("[data-wire-color-badge]").innerHTML = wireColorBadge(entry);
  document.querySelector("#wire-color-status").textContent = wireColorStatus();
  filterWireColors();
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-print-wire-colors]")) window.print();
  if (event.target.closest("[data-reset-wire-colors]")) {
    wireColorChoices = {};
    saveWireColors();
    for (const select of document.querySelectorAll("[data-wire-color]")) {
      const entry = wireColorEntries.find(candidate => candidate.id === select.dataset.wireColor);
      select.value = wireColorValue(entry);
      select.closest("tr").querySelector("[data-wire-color-badge]").innerHTML = wireColorBadge(entry);
    }
    document.querySelector("#wire-color-status").textContent = wireColorStatus();
    filterWireColors();
  }
});
