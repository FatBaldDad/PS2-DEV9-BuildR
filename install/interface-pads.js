"use strict";

// Physical order down the Interface PCB tail, viewed from the front. Keep the
// actual KiCad reference here, including PCBA_* pads used on direct copper.
const interfaceTail = [
  ["IDE_DASP1", "DASP", 39, 37, false],
  ["INT_CS1", "CS1", 38, 36],
  ["INT_CS0", "CS0", 37, 35],
  ["PCBA_DA02", "DA2", 36, 34],
  ["PCBA_DA00", "DA0", 35, 33],
  ["PCBA_DA01", "DA1", 33, 31],
  ["INT_INTRQ1", "INTRQ", 31, 30],
  ["INT_DMACK1", "DMACK", 29, 29],
  ["INT_IORDY1", "IORDY", 27, 27],
  ["PCBA_DIOR1", "DIOR", 25, 25],
  ["INT_DIOW1", "DIOW", 23, 24],
  ["INT_DMARQ1", "DMARQ", 21, 22],
  ["IDE_DD15", "DD15", 18, 20],
  ["PCBA_DD00", "DD00", 17, 19],
  ["IDE_DD14", "DD14", 16, 18],
  ["PCBA_DD01", "DD01", 15, 17],
  ["IDE_DD13", "DD13", 14, 16],
  ["IDE_DD02", "DD02", 13, 15],
  ["IDE_DD12", "DD12", 12, 14],
  ["PCBA_DD03", "DD03", 11, 13],
  ["INT_DD11", "DD11", 10, 12],
  ["PCBA_DD04", "DD04", 9, 11],
  ["INT_DD10", "DD10", 8, 10],
  ["PCBA_DD05", "DD05", 7, 9],
  ["INT_DD09", "DD09", 6, 8],
  ["PCBA_DD06", "DD06", 5, 7],
  ["INT_DD08", "DD08", 4, 6],
  ["PCBA_DD07", "DD07", 3, 5],
  ["INT_AST1", "RESET", 1, 3],
].map(([ref, signal, ide, zif, printed = true]) => ({
  ref, signal, ide, zif, printed,
  label: signal + " " + String(ide).padStart(2, "0") + "/" + String(zif).padStart(2, "0"),
}));

const interfacePowerLabels = new Map([
  ["+3V3", "+3V3 · 3.3 V regulator output if fitted"],
  ["+5V1", "+5V1 · Console 5 V feed from JL4016"],
  ...[1, 2, 3, 4].map(n => ["GND" + n, "GND" + n + " · Board ground"]),
]);
const interfacePadNotes = new Map(interfacePowerLabels);
for (const row of interfaceTail) {
  interfacePadNotes.set(row.ref, row.label);
  const standard = pads.find(pad => gussePin(pad) === row.ide);
  if (!standard) continue;
  const {input, output} = interfacePorts(standard.signal);
  for (const index of [input, output]) {
    interfacePadNotes.set(interfaceBoard.pads[index].ref, row.label);
  }
}

function interfacePadLabel(pad) {
  const note = interfacePadNotes.get(pad.ref);
  return padLabel(pad) + (note ? " · " + note : "");
}

function interfaceLabelLegend() {
  return '<p class="caption">Pad numbering is <strong>44-pin IDE / 40-pin ZIF</strong>. ' +
    '<a href="#interface-pads">Open the Interface PCB pad descriptions</a>.</p>';
}

const interfaceTailPads = interfaceTail.map(row => interfaceBoard.pads[interfacePadIndex(row.ref)]);

// Draw upright labels on the visible side of the same CAD view used by the
// locator, the solder steps, and the bridge checks. Keep labels off the copper.
function drawInterfaceLabels(context, scale, back = false, focus = []) {
  context.save();
  const sign = back ? -1 : 1;
  const atlas = new Map(interfaceTail.map((row, index) => [interfaceTailPads[index], row.label]));
  for (const ref of interfacePowerLabels.keys()) {
    const pad = interfaceBoard.pads[interfacePadIndex(ref)];
    atlas.set(pad, ref);
  }
  for (const pad of focus) {
    if (!atlas.has(pad) && interfacePadNotes.has(pad.ref)) atlas.set(pad, interfacePadNotes.get(pad.ref));
  }
  context.font = "600 .54px Consolas, monospace";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = .11;
  context.strokeStyle = "#10283a";
  context.fillStyle = "#f7f9ff";
  const visible = context.canvas.width / scale;
  for (const [pad, label] of atlas) {
    if (!(back ? pad.back : pad.front)) continue;
    const [x, y] = pad.xy;
    const tail = interfaceTailPads.includes(pad);
    const edge = tail && visible > 22 ? 156.8 : x - pad.size[0] / 2 - .36;
    context.textAlign = back ? "left" : "right";
    const labelX = sign * edge;
    context.strokeText(label, labelX, y);
    context.fillText(label, labelX, y);
  }
  context.restore();
}

function renderInterfacePads() {
  const rows = interfaceTail.map(row => {
    const joint = interfaceWireSteps.get(interfacePadIndex(row.ref));
    return '<tr><th scope="row">' + row.signal + '</th><td><a href="' + walkthroughUrl(joint) + '">' +
      row.ref + '</a></td><td>' + row.ide + '</td><td>' + row.zif + '</td><td>' +
      (row.printed ? row.label : "Unlabeled top pad · optional activity") + '</td></tr>';
  }).join("");
  return '<div class="layout interface-label-layout"><section class="panel"><h2 tabindex="-1">Interface PCB pad descriptions</h2>' +
    '<p class="intro">Read the numbers as 44-pin IDE / 40-pin ZIF. The rows follow the staggered pads from the top of the tail toward the power pads.</p>' +
    '<div class="meter-table"><table><caption class="sr-only">Interface PCB tail pads in physical order</caption>' +
    '<thead><tr><th scope="col">Signal</th><th scope="col">KiCad pad</th><th scope="col">IDE</th><th scope="col">ZIF</th><th scope="col">Board label</th></tr></thead><tbody>' +
    rows + '</tbody></table></div><h3 class="result">Power and ground</h3><ul class="bullets">' +
    Array.from(interfacePowerLabels, ([ref, note]) => '<li><a href="' +
      walkthroughUrl(interfaceWireSteps.get(interfacePadIndex(ref))) + '">' + note + '</a></li>').join("") + '</ul>' +
    '<div class="actions"><a href="#power">FC1307A power check</a><a href="#wire">Wire map</a></div></section>' +
    '<aside class="panel"><h3>Front silkscreen on the Interface PCB</h3>' +
    '<figure class="interface-tail-photo"><a href="install/interface-tail-labels.png" target="_blank" rel="noopener">' +
    '<img src="install/interface-tail-labels.png" width="350" height="896" alt="BuildR Interface PCB front showing the 28 labeled IDE and ZIF signal pads and the two power pads"></a>' +
    '<figcaption class="caption">Select a KiCad pad in the table for its zoomed solder view. The contact at the top above CS1 is IDE_DASP1.</figcaption></figure></aside></div>';
}
