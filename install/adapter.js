"use strict";

const pata44Reference = "https://www.seagate.com/support/disc/manuals/ata/100398876a.pdf";
const adapterFunctions = {
  2: "GND", 19: "GND", 20: "KEY", 22: "GND", 24: "GND", 26: "GND",
  28: "CSEL", 30: "GND", 32: "IOCS16#", 34: "PDIAG#", 39: "DASP#",
  40: "GND", 41: "+5 V", 42: "+5 V", 43: "GND", 44: "NC",
};
const adapterPins = gusseRows.map(({pin, signal}) => ({
  pin, signal, label: signal || adapterFunctions[pin],
}));

function adapterInterfacePad(signal) {
  const route = buildrData.signals[signal];
  return route.interface.map(index => buildrPad("interfaceB", index))
    .find(pad => pad.ref.startsWith("INT_") || pad.ref.startsWith("IDE_"));
}

function adapterPinLink(pin, message) {
  return '<a href="#adapter/' + pin + '">' + message + '</a>';
}

function adapterCanvas(pin, compact = false) {
  return '<canvas class="adapter-diagram' + (compact ? ' adapter-diagram-compact' : '') +
    '" width="' + (compact ? '1120" height="142' : '1760" height="600') +
    '" data-adapter-pin="' + (pin || '') + '" role="img" aria-label="SD-to-IDE adapter, component side, pin 1 at upper left' +
    (pin ? ', pin ' + pin + ' ' + adapterPins[pin - 1].label + ' highlighted' : '') +
    '.">Use the pin selector to read the numbered connector positions.</canvas>';
}

function adapterDestination(joint) {
  if (!joint.meter || (joint.route.board === "interfaceB" && !joint.adapterPad)) {
    return joint.groupId === "subpcb-ground" ?
      '<div class="actions">' + adapterPinLink(43, "Adapter ground reference · pin 43") + '</div>' : "";
  }
  const pin = joint.meter.pin;
  const via = joint.adapterPad || adapterInterfacePad(joint.pad.signal);
  return '<section class="callout adapter-destination"><h3>Adapter destination · pin ' + pin + '</h3><p>' +
    'Interface PCB <code>' + interfacePadLabel(via) + '</code> → <strong>' + joint.pad.signal + ' · SD-to-IDE pin ' + pin +
    '</strong>. With power off, check continuity between these two ends of the final lead if it is fitted.</p>' +
    '<a class="adapter-mini" href="#adapter/' + pin + '">' + adapterCanvas(pin, true) +
    '<span>Open pin ' + pin + ' on the 44-pin adapter</span></a></section>';
}

function pinSeating(pin) {
  const column = Math.floor((pin - 1) / 2) + 1;
  const row = pin % 2 ? "odd row nearest the connector edge" : "even row toward the PCB interior";
  return "Column " + column + " from the marked pin-1 end · " + row + ".";
}

function adapterPinDetail(entry) {
  if (!entry) return '<p class="intro">Select a pin for its location and BuildR connection.</p>';
  let note = "";
  let links = "";
  if (entry.signal) {
    const via = adapterInterfacePad(entry.signal);
    const pad = pads.find(candidate => candidate.signal === entry.signal);
    const joint = walkthroughJointForPad(pad);
    note = 'For the final lead through Interface PCB v0.1, check <code>' + interfacePadLabel(via) +
      '</code> to adapter pin ' + entry.pin + ' with power off.';
    links = '<a href="' + walkthroughUrl(joint) + '">Open ' + entry.signal + ' solder step</a>' +
      '<a href="#wire/' + padId(entry.signal) + '">Trace ' + entry.signal + ' through the boards</a>';
  } else if (entry.label === "+5 V") {
    note = "Pins 41 and 42 are the 5 V positions in the 44-pin PATA reference. Confirm which contacts feed the pictured adapter’s supply on your hardware. Use the BuildR power check to identify the +5V1 input and the separate +3V3 regulator output.";
    links = '<a href="#power/pin' + entry.pin + '">Measure harness pin ' + entry.pin + '</a>' +
      '<a href="#pads/power">Open the BuildR power-pad map</a>';
  } else if (entry.pin === 20) {
    note = "Pin 20 is the key position. Use it together with the square pin-1 pad to align the two rows.";
  } else if (entry.pin === 28) {
    note = "The connector reference names this position CSEL. Gusse reports GND for position 28 on his setup. Use a confirmed ground position such as pin 43 for the ground check.";
  } else if (entry.label === "GND") {
    note = "This is a connector ground position. Verify the installed ground path with the console unplugged.";
    if (entry.pin === 43) links = '<a href="#power/ground">Verify harness pin 43</a>';
  } else {
    note = "Reference function for the 44-pin header. Use the verified BuildR wiring for the fitted adapter.";
  }
  return '<h3>Pin ' + entry.pin + ' · ' + entry.label + '</h3><p class="caption">' + pinSeating(entry.pin) +
    '</p><p class="intro">' + note + '</p><div class="actions">' + links +
    '<a href="#meter/' + entry.pin + '">Gusse’s pin ' + entry.pin + ' reference</a></div>';
}

function renderAdapter(id) {
  const selected = adapterPins.find(pin => String(pin.pin) === id);
  const options = adapterPins.map(pin => '<option value="' + pin.pin + '"' +
    (pin === selected ? ' selected' : '') + '>' + pin.pin + ' · ' + pin.label + '</option>').join("");
  return '<section class="panel adapter-panel"><h2 tabindex="-1">44-pin SD-to-IDE adapter</h2>' +
    '<p class="intro">Component side with the header at the top. Find the square pad beside the printed PIN 1 mark. In this orientation the odd row is nearest the connector edge.</p>' +
    '<div class="adapter-scroll">' + adapterCanvas(selected?.pin) + '</div>' +
    '<p class="caption">Click a pin on the diagram or use the selector. The card-slot side mirrors the view.</p>' +
    '<div class="actions"><a class="button" href="install/sd-ide-44-pinout.png">Open full-size pinout image</a></div>' +
    '<label class="field" for="adapter-pin">Connector pin</label><select id="adapter-pin">' +
    '<option value="">Select a pin</option>' + options + '</select><div id="adapter-pin-detail" class="result" aria-live="polite">' +
    adapterPinDetail(selected) + '</div></section>' +
    '<section class="panel adapter-photo"><div><h3>Pin 1 on the pictured adapter</h3>' +
    '<p class="intro">Look for the gold triangle and the square solder pad at the end of the connector. Align this end before counting positions or attaching the harness.</p>' +
    '<p class="caption">Connector signal assignments and Gusse’s readings describe their respective setups.</p>' +
    '<div class="actions"><a href="' + pata44Reference + '">Seagate 44-pin PATA reference</a>' +
    '<a href="' + gusseSource + '">Gusse’s meter guide</a></div></div>' +
    '<a href="install/sd-ide-component-side.png"><img src="install/sd-ide-component-side.png" width="894" height="837" loading="lazy" alt="Black SD-to-IDE adapter component side with a gold triangle marking the square pin-1 pad at the left end"></a></section>';
}

const headerView = {
  full: {left: 104, pitch: 74, odd: 288, even: 373, radius: 23},
  compact: {left: 56, pitch: 48, odd: 49, even: 106, radius: 16},
};

function adapterPinPoint(pin, view) {
  return [view.left + Math.floor((pin - 1) / 2) * view.pitch, pin % 2 ? view.odd : view.even];
}

function paintPinout(canvas, selected) {
  const compact = canvas.classList.contains("adapter-diagram-compact");
  const view = compact ? headerView.compact : headerView.full;
  const ctx = canvas.getContext("2d");
  const mono = "Consolas, monospace";
  const sans = "'Segoe UI', system-ui, sans-serif";
  const ink = "#132940";
  const text = (value, x, y, font, fill, align = "left") => {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = fill;
    ctx.fillText(value, x, y);
  };
  ctx.fillStyle = "#edf3fa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!compact) {
    ctx.fillStyle = "#102139";
    ctx.fillRect(0, 0, canvas.width, 146);
    text("44-pin SD-to-IDE adapter", 65, 59, "700 45px " + sans, "#f5f9ff");
    text("COMPONENT / SOLDER SIDE  ·  HEADER AT TOP", 67, 112, "700 20px " + mono, "#94dce5");
    text("Connector edge  ↑", 1690, 205, "600 23px " + sans, "#395772", "right");
    text("PCB interior  ↓", 1690, 469, "600 23px " + sans, "#395772", "right");
    text("PIN 1", view.left, 204, "700 20px " + mono, "#9a4609", "center");
    text("Match the square pad and key position before wiring.", 70, 518, "600 22px " + sans, ink);
    text("41/42: +5 V header positions  ·  43: ground return  ·  44: NC (Seagate Table 6 and Gusse)", 70, 559,
      "20px " + sans, "#395772");
  }

  const rowTop = compact ? 22 : 227;
  ctx.beginPath();
  ctx.roundRect(compact ? 23 : 64, rowTop, compact ? 1074 : 1632, compact ? 110 : 207, 12);
  ctx.fillStyle = "#18334a";
  ctx.fill();

  for (const entry of adapterPins) {
    const [x, y] = adapterPinPoint(entry.pin, view);
    const isSelected = selected === entry.pin;
    const fill = entry.pin === 20 || entry.label === "NC" ? "#304b63" :
      entry.label === "GND" ? "#aec1d6" : entry.label === "+5 V" ? "#ffc77c" : "#96dee1";
    ctx.beginPath();
    if (entry.pin === 1) ctx.roundRect(x - view.radius, y - view.radius, 2 * view.radius, 2 * view.radius, 4);
    else ctx.arc(x, y, view.radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "#fffff0" : fill;
    ctx.fill();
    if (entry.pin === 20 && !isSelected) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#adc2d7";
      ctx.stroke();
      ctx.restore();
    }
    if (isSelected) {
      ctx.lineWidth = compact ? 5 : 7;
      ctx.strokeStyle = "#ff9c3e";
      ctx.stroke();
    }
    const numberColor = !isSelected && (entry.pin === 20 || entry.label === "NC") ? "#e7f1ff" : "#0f2336";
    text(String(entry.pin), x, y, "700 " + (compact ? "15px " : "22px ") + mono, numberColor, "center");
    if (!compact) {
      text(entry.label, x, entry.pin % 2 ? 248 : 414, "700 17px " + mono, "#f1f7ff", "center");
    }
  }
}

function drawAdapterDiagrams() {
  for (const canvas of document.querySelectorAll(".adapter-diagram")) {
    paintPinout(canvas, Number(canvas.dataset.adapterPin) || undefined);
  }
}

function selectAdapterPin(value) {
  const entry = adapterPins.find(pin => String(pin.pin) === value);
  history.replaceState(null, "", "#adapter" + (entry ? "/" + entry.pin : ""));
  const select = document.querySelector("#adapter-pin");
  select.value = entry ? String(entry.pin) : "";
  document.querySelector("#adapter-pin-detail").innerHTML = adapterPinDetail(entry);
  const canvas = document.querySelector(".adapter-panel .adapter-diagram");
  canvas.dataset.adapterPin = select.value;
  canvas.setAttribute("aria-label", "44-pin SD-to-IDE adapter, pin 1 at upper left" +
    (entry ? ", pin " + entry.pin + " " + entry.label + " highlighted" : ""));
  drawAdapterDiagrams();
}

document.addEventListener("change", event => {
  if (event.target.id === "adapter-pin") selectAdapterPin(event.target.value);
});

document.addEventListener("click", event => {
  if (!event.target.matches(".adapter-panel .adapter-diagram")) return;
  const bounds = event.target.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * event.target.width / bounds.width;
  const y = (event.clientY - bounds.top) * event.target.height / bounds.height;
  const hit = adapterPins.find(pin => {
    const [pinX, pinY] = adapterPinPoint(pin.pin, headerView.full);
    return Math.hypot(x - pinX, y - pinY) <= 31;
  });
  if (hit) selectAdapterPin(String(hit.pin));
});
