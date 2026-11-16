"use strict";

const wirePasses = solderGroups.find(group => group.id === "subpcb-pass").joints;
const wireAuxiliary = [
  {id: "ground", label: "Ground"},
  {id: "power", label: "5 V supply and 3.3 V rail"},
  {id: "dasp", label: "DASP# activity · if fitted"},
  ...wirePasses.map(joint => ({id: joint.id, label: joint.pad.signal + " · " + joint.joint.ref})),
];
const wireSections = [
  {label: "Ground and power", items: wireAuxiliary.slice(0, 2)},
  ...["A", "B"].map(side => ({
    label: side === "A" ? "Side A PCB" : "B-side SubPCB",
    items: pads.filter(pad => pad.side === side).map(pad => ({
      id: padId(pad.signal), label: pad.signal + " · IDE pin " + gussePin(pad), pad,
    })),
  })),
  {label: "Pass-through and activity", items: [...wireAuxiliary.slice(3), wireAuxiliary[2]]},
];
const wireSequence = wireSections.flatMap(section => section.items);
const interfaceWireSteps = new Map(interfaceGroups.flatMap(group =>
  group.joints.map(joint => [joint.route.joint, joint])));
const directWireCheck = "Continuity or Ω mode. Compare with the shorted-lead baseline.";
const signalWireCheck = "Check the unplugged lead or accessible harness endpoints. " + directWireCheck;

function wireLink(url, label) {
  return '<a href="' + url + '">' + label + '</a>';
}

function wireJump(item) {
  return "#wire/" + item.id;
}

function wireInterfaceEnd(index) {
  const joint = interfaceWireSteps.get(index);
  return wireLink(walkthroughUrl(joint), interfacePadLabel(joint.joint));
}

function wireAdapterEnd(pin) {
  return adapterPinLink(pin, "SD-to-IDE pin " + pin);
}

function wireMeterRow(item, id, title, a, b, expected = directWireCheck) {
  return testRow("wire-" + item.id + "-" + id, title, a + " → " + b + ". " + expected);
}

function wireOhms(part) {
  return "Use Ω mode across the fitted channel. KiCad lists " + part.value.replace(/(\d)Ω/, "$1 Ω") +
    " nominal. Parallel paths can lower an in-circuit reading.";
}

function wireSelectedSignal(item) {
  const {pad} = item;
  const signal = pad.signal;
  const pin = gussePin(pad);
  const solder = walkthroughJointForPad(pad);
  const {input, output, route} = interfacePorts(signal);
  const label = padLabel;
  const board = buildrData.boards[route.board].label;
  const land = wireLink("#pads/" + item.id, "GH-035-11 Side " + pad.side + " " + motherboardLand(pad));
  const joint = wireLink(walkthroughUrl(solder), board + " " + label(solder.joint));
  const breakout = wireLink(walkthroughUrl(solder), board + " " + label(solder.breakout));
  const src = wireInterfaceEnd(input);
  const dst = wireInterfaceEnd(output);
  const end = wireAdapterEnd(pin);
  const row = (id, title, a, b, expected) => wireMeterRow(item, id, title, a, b, expected);
  const rows = [row("castellation", "Motherboard solder joint", land, joint)];
  if (solder.input) {
    rows.push(
      row("solder-in", "Input copper on " + board, label(solder.joint), label(solder.input)),
      row("solder-series", "Series channel on " + board, label(solder.input), label(solder.output), wireOhms(solder.input)),
      row("solder-out", "Output copper on " + board, label(solder.output), label(solder.breakout)),
    );
  } else {
    rows.push(row("solder-copper", "Copper on the SubPCB", label(solder.joint), label(solder.breakout)));
  }
  rows.push(row("lead-in", "Wire 1 · " + board + " to Interface PCB", breakout, src, signalWireCheck));
  if (route.interfaceSeries) {
    const first = interfaceWireSteps.get(input).route.probe;
    const second = interfaceWireSteps.get(output).route.probe;
    rows.push(
      row("interface-in", "Interface input copper", src, wireInterfaceEnd(first)),
      row("interface-series", "Interface series channel", wireInterfaceEnd(first), wireInterfaceEnd(second),
        wireOhms(buildrPad("interfaceB", first))),
      row("interface-out", "Interface output copper", wireInterfaceEnd(second), dst),
    );
  } else {
    rows.push(row("interface-copper", "Interface PCB copper", src, dst));
  }
  rows.push(row("lead-out", "Wire 2 · Interface PCB to SD-to-IDE", dst, end, signalWireCheck));
  const neighbors = /^DD\d+$/.test(signal) ? '<div class="actions">' + interfaceBridgeLinks(solder) + '</div>' : "";
  return {
    route: [
      ["Motherboard contact", land],
      ["Solder PCB breakout", breakout],
      ["Interface PCB input", src],
      ["Interface PCB output", dst],
      ["44-pin adapter", end],
    ],
    rows, pin, extra: neighbors + jointMeterReference(gusseRows[pin - 1]),
    note: "Select a pad or connector pin to open its locator." + (pad.side === "B" ?
      " Follow the highlight when a SubPCB reference appears on multiple pads." : ""),
  };
}

function wireGround(item) {
  const gnd = wireInterfaceEnd(interfacePadIndex("GND1"));
  const anchors = wireLink("#solder/subpcb-ground", "B-side SubPCB GND1/GND2");
  const pin43 = wireAdapterEnd(43);
  const verified = "Verified GH-035-11 ground at your chosen point";
  return {
    route: [["Motherboard ground", verified], ["Interface PCB ground", gnd],
      ["SD-to-IDE ground", pin43 + " · confirm on your adapter"]],
    rows: [
      wireMeterRow(item, "side-a", "Side A ground contacts", verified, "Side A PCB GND1/GND2 where fitted"),
      wireMeterRow(item, "sub", "SubPCB ground anchors", verified, anchors),
      wireMeterRow(item, "interface", "Interface ground lead", verified, gnd),
      wireMeterRow(item, "adapter", "Adapter return lead", gnd, pin43, signalWireCheck),
    ],
    pin: 43,
    note: "Confirm your adapter’s return against a known adapter ground before wiring it. Pin 43 is the 44-pin ground reference shown here. Verify any additional ground leads at both ends.",
  };
}

function wirePower(item) {
  const supply = wireInterfaceEnd(interfacePadIndex("+5V1"));
  const output = wireInterfaceEnd(interfacePadIndex("+3V3"));
  const gnd = wireInterfaceEnd(interfacePadIndex("GND1"));
  const pins = wireAdapterEnd(41) + " and " + wireAdapterEnd(42);
  const pickup = "<strong>GH-035-11 JL4016</strong>";
  return {
    route: [
      ["Console +5 V pickup", pickup],
      ["Interface PCB feed", supply],
      ["Adapter +5 V feed", pins + " · 44-pin supply positions. Confirm the actual fed contacts and rail."],
      ["Separate Interface rail", output + " · 3.3 V output when the regulator is fitted"],
    ],
    rows: [
      wireMeterRow(item, "input", "Console supply lead", pickup, supply, signalWireCheck),
      wireMeterRow(item, "adapter", "Fitted adapter supply lead", "Verified 5 V feed used by your wiring", "Confirmed adapter supply contact(s) at " + pins, signalWireCheck),
      wireMeterRow(item, "input-ground", "5 V to ground", supply, gnd, "Check for a persistent near-zero short after the reading settles."),
      wireMeterRow(item, "output-ground", "3.3 V to ground", output, gnd, "Check for a persistent near-zero short where the rail is used."),
      wireMeterRow(item, "rail-isolation", "5 V to 3.3 V", supply, output, "Investigate a persistent direct short between the rails before applying power."),
    ],
    note: "JL4016 is the selected pickup for this build. Confirm which 5 V contacts the fitted FC1307A harness feeds. Verify the measured voltage at each end before plugging in the adapter.",
    extra: jl4016Figure() + '<div class="actions"><a href="#power">Measure the FC1307A harness</a></div>',
  };
}

function wirePass(item) {
  const joint = wirePasses.find(candidate => candidate.id === item.id);
  const land = "GH-035-11 Side B " + joint.joint.ref;
  const step = walkthroughUrl(joint);
  const contact = wireLink(step, padLabel(joint.joint));
  const breakout = wireLink(step, padLabel(joint.breakout));
  return {
    route: [["Motherboard point", land], ["SubPCB joint", contact], ["SubPCB breakout", breakout]],
    rows: [
      wireMeterRow(item, "joint", "Pass-through solder joint", land, contact),
      wireMeterRow(item, "breakout", "Pass-through copper", contact, breakout),
    ],
    note: "Verify this pair through the SubPCB where fitted. The KiCad sheets document the local pass-through. Use the fitted build wiring to confirm any destination beyond the breakout.",
  };
}

function wireActivity(item) {
  const dst = wireInterfaceEnd(interfacePadIndex("IDE_DASP1"));
  return {
    route: [["SD-to-IDE activity output", wireAdapterEnd(39)], ["Interface PCB activity circuit", dst]],
    rows: [wireMeterRow(item, "lead", "Optional activity lead", wireAdapterEnd(39), dst, signalWireCheck)],
    pin: 39,
    note: "Fit this line if your build uses the amber activity circuit. Verify the board’s activity circuit population and the adapter connection.",
    extra: jointMeterReference(gusseRows[38]),
  };
}

function renderWire(id) {
  const item = wireSequence.find(entry => entry.id === id) || wireSequence[0];
  const selection = item.pad ? wireSelectedSignal(item) : item.id.startsWith("pass") ? wirePass(item) :
    {ground: wireGround, power: wirePower, dasp: wireActivity}[item.id](item);
  const index = wireSequence.indexOf(item);
  const previous = wireSequence[index - 1];
  const next = wireSequence[index + 1];
  const options = wireSections.map(section => '<optgroup label="' + section.label + '">' +
    section.items.map(entry => '<option value="' + entry.id + '"' + (item === entry ? " selected" : "") + '>' +
      entry.label + '</option>').join("") + '</optgroup>').join("");
  const summary = selection.route.map(([stage, end]) => '<dt>' + stage + '</dt><dd>' + end + '</dd>').join("");
  return '<div class="layout wire-layout"><section class="panel"><h2 tabindex="-1">BuildR wire map</h2>' +
    '<p class="intro">Trace each lead through the fitted boards and check each segment with your meter.</p>' +
    '<p class="callout warn">Unplug the PS2 and disconnect the FC1307A before these checks. Touch the probes together to establish the meter baseline. Use an accessible harness or breakout to check a disconnected adapter lead.</p>' +
    '<label class="field" for="wire-select">Signal or connection</label><select id="wire-select">' + options + '</select>' +
    '<div class="actions wire-paging"><span class="caption">' + (index + 1) + ' of ' + wireSequence.length + '</span>' +
    (previous ? '<a class="button" href="' + wireJump(previous) + '">← Previous</a>' : '') +
    (next ? '<a class="button primary" href="' + wireJump(next) + '">Next →</a>' :
      '<a class="button primary" href="#install/preflight">Pre-power checks →</a>') + '</div>' +
    '<div class="result"><h3>' + item.label + ' · Meter checks</h3><ul class="test-rows">' + selection.rows.join("") + '</ul>' +
    '<p class="caption">Record each result as you go. Results are saved in this browser when storage is available.</p></div>' +
    '<div class="actions"><a href="#install/wire">Install sequence</a><a href="#install/preflight">Pre-power checks</a></div>' +
    '</section><aside class="stack"><section class="panel"><h3>Route on the fitted boards</h3><dl class="facts wire-route">' +
    summary + '</dl><p class="caption">' + selection.note + '</p>' +
    (selection.pin ? '<figure class="wire-adapter">' + adapterCanvas(selection.pin, true) +
      '<figcaption class="caption">' + adapterPinLink(selection.pin, "Open the connector diagram at pin " + selection.pin) + '</figcaption></figure>' : '') +
    (selection.extra || "") + interfaceLabelLegend() + '</section></aside></div>';
}

document.addEventListener("change", event => {
  if (event.target.id === "wire-select") location.hash = "#wire/" + event.target.value;
});
