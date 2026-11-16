"use strict";

const powerSteps = [
  {id: "ground", label: "Verify ground and isolation"},
  {id: "jl4016", label: "Measure JL4016", unit: "V DC"},
  {id: "feed", label: "Measure Interface +5V1", unit: "V DC"},
  {id: "pin41", label: "Measure harness pin 41", pin: 41, unit: "V DC"},
  {id: "pin42", label: "Measure harness pin 42", pin: 42, unit: "V DC"},
  {id: "review", label: "Review before connecting"},
];

const supplyObservations = [
  ["", "Unrecorded"], ["present", "About +5 V"], ["zero", "About 0 V"], ["other", "Other / unstable"],
];

function jl4016Figure(active = false) {
  return '<figure class="wire-pickup' + (active ? ' pickup-active' : '') + '">' +
    '<a class="wire-pickup-diagram" href="install/gh035-jl4016.png" target="_blank" rel="noopener">' +
    '<img src="install/gh035-jl4016.png" width="909" height="665" alt="Board drawing showing JL4016 just left of R4306 and above C4214. Open full-size drawing.">' +
    '<span aria-hidden="true"></span></a><figcaption class="caption"><strong>JL4016</strong>, left of R4306 and above C4214. ' +
    'Select the drawing to open it full size.</figcaption></figure>';
}

function powerCheckHeader(step) {
  const destinations = {41: "pin41", 42: "pin42", 43: "ground"};
  const cells = [37, 39, 41, 43, 38, 40, 42, 44].map(pin => {
    const labels = {37: "CS0#", 38: "CS1#", 39: "DASP#", 40: "GND", 41: "5 V logic", 42: "5 V motor", 43: "GND return", 44: "NC"};
    const tile = '<strong>' + pin + '</strong><span>' + labels[pin] + '</span>';
    if (!destinations[pin]) return '<div class="power-pin">' + tile + '</div>';
    const selected = step.id === destinations[pin];
    return '<a class="power-pin ' + (pin === 43 ? "power-ground-pin" : "power-supply-pin") +
      '" href="#power/' + destinations[pin] + '"' + (selected ? ' aria-current="step"' : '') + '>' + tile + '</a>';
  }).join("");
  return '<figure class="power-header"><div class="map-top"><span>44-pin header · component side</span><span>← Pin 1 end</span></div>' +
    '<div class="power-pin-grid" aria-label="Detail of columns 19 to 22">' + cells + '</div>' +
    '<figcaption class="caption">Match the keyed orientation to the full header before identifying the same contacts on the disconnected harness. The facing side of the harness is mirrored.</figcaption></figure>';
}

function powerInstructions(step) {
  const gnd = wireInterfaceEnd(interfacePadIndex("GND1"));
  const supply = wireInterfaceEnd(interfacePadIndex("+5V1"));
  switch (step.id) {
    case "ground":
      return '<p class="intro">With the PS2 unplugged and the FC1307A disconnected, identify harness pin 43. Short the meter leads to get your baseline, then use continuity or Ω mode to check from verified motherboard ground through ' +
        gnd + ' to pin 43. Resolve a missing ground before powering the console.</p><ul class="test-rows">' +
        testRow("fc1307a-ground", "Pin 43 ground continuity", "Harness pin 43 to verified motherboard ground. Expect a stable reading near the shorted-lead baseline.") +
        '</ul><div class="actions"><a href="#install/preflight">Unpowered install checklist</a></div>';
    case "jl4016":
      return '<p class="intro">After the unpowered checks pass, put the black lead in COM and the red lead in the V/Ω jack. Select DC volts. With power off, secure black to a verified ground. Leave the FC1307A disconnected, power up the PS2, and touch red to the highlighted JL4016. Record the voltage. The pickup should be about +5 V relative to ground.</p>';
    case "feed":
      return '<p class="intro">Keep black on the verified ground. With the PS2 on and the FC1307A disconnected, touch red to ' +
        supply + ' on the Interface PCB. Compare it with JL4016. If the pickup is near +5 V and the feed is missing, unplug and check the wire between them.</p>';
    case "pin41":
    case "pin42":
      return '<p class="intro">Measure at the accessible disconnected harness contact. Keep black on verified ground or use harness pin 43 after confirming its continuity with power off. Touch red to pin ' +
        step.pin + ' alone. Record the DC voltage and compare it with the measured +5V1 feed. Keep the probe clear of adjacent contacts.</p>';
    default:
      return '<p class="intro">Compare the two harness contacts with the upstream measurements. A contact near +5 V has supply present at the test point. A contact near 0 V has no measured supply at this point. Resolve unexpected voltage, polarity or an uncertain connection while the adapter is disconnected. Confirm the measured harness matches the adapter’s power requirements. Power off and unplug the PS2 before connecting the FC1307A.</p>';
  }
}

function powerReadingFields(step) {
  return '<div class="power-reading"><label class="field" for="power-voltage">Meter reading (' + step.unit + ')</label>' +
    '<input type="text" id="power-voltage" inputmode="decimal" maxlength="18" placeholder="Enter the meter reading">' +
    '<label class="field" for="power-observation">What do you see?</label><select id="power-observation">' +
    supplyObservations.map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join("") +
    '</select><p class="caption">Readings and observations save in this browser.</p></div>';
}

function powerReadingsSummary() {
  return '<div class="meter-table power-results"><table><caption class="sr-only">Saved FC1307A power readings</caption>' +
    '<thead><tr><th scope="col">Probe point</th><th scope="col">Reading</th><th scope="col">Observation</th></tr></thead><tbody>' +
    powerSteps.filter(step => step.unit).map(step => '<tr><th scope="row"><a href="#power/' + step.id + '">' + step.label +
      '</a></th><td data-power-reading="' + step.id + '">—</td><td data-power-observed="' + step.id + '">Unrecorded</td></tr>').join("") +
    '</tbody></table></div>';
}

function renderPowerCheck(id) {
  const step = powerSteps.find(candidate => candidate.id === id) || powerSteps[0];
  const index = powerSteps.indexOf(step);
  const previous = powerSteps[index - 1];
  const next = powerSteps[index + 1];
  const steps = powerSteps.map((candidate, position) =>
    '<li><a href="#power/' + candidate.id + '"' + (candidate === step ? ' aria-current="step"' : '') +
    '><span class="step-number" aria-hidden="true">' + (position + 1) + '</span><span>' + candidate.label + '</span></a></li>').join("");
  return '<div class="layout power-check-layout" data-power-check="' + step.id + '">' +
    '<section class="panel"><h2 tabindex="-1">FC1307A power check</h2>' +
    '<p class="callout warn">Keep the FC1307A disconnected throughout these checks. Change wiring and use continuity or Ω mode with the PS2 unplugged. Use DC voltage for the powered steps.</p>' +
    '<div class="result"><p class="eyebrow">Step ' + (index + 1) + ' of ' + powerSteps.length + '</p><h3>' +
    step.label + '</h3>' + powerInstructions(step) + (step.unit ? powerReadingFields(step) : "") +
    (step.id === "review" ? powerReadingsSummary() : "") +
    '<div class="actions">' + (previous ? '<a class="button" href="#power/' + previous.id + '">← Previous</a>' : "") +
    (next ? '<a class="button primary" href="#power/' + next.id + '">Next · ' + next.label + ' →</a>' :
      '<a class="button primary" href="#install/baseline">Continue to the disconnected CheckR baseline</a>') + '</div></div>' +
    '<div class="result"><h3>Power check steps</h3><ol class="steps">' + steps + '</ol></div></section>' +
    '<aside class="stack"><section class="panel"><h3>Harness pins 41, 42 and 43</h3>' +
    powerCheckHeader(step) + adapterCanvas(undefined, true) + '<div class="actions"><a href="#adapter/43">Open the full pinout</a></div>' +
    '<p class="caption">The PATA reference assigns pin 41 to logic supply, pin 42 to motor supply and pin 43 to ground return. Use the meter to identify the contacts fed on your harness. <a href="' +
    pata44Reference + '">44-pin reference, Table 6</a>.</p></section>' +
    '<section class="panel"><h3>Motherboard 5 V pickup</h3>' + jl4016Figure(step.id === "jl4016") +
    '<div class="actions"><a href="#pads/power">Interface PCB power pads</a><a href="#wire/power">Power wiring and isolation checks</a></div>' +
    '</section></aside></div>';
}

function activatePowerCheck() {
  const root = document.querySelector("[data-power-check]");
  if (!root) return;
  const step = root.dataset.powerCheck;
  const input = root.querySelector("#power-voltage");
  const observation = root.querySelector("#power-observation");
  if (input && observation) {
    const readingKey = "fc1307a-volts-" + step;
    const observationKey = "fc1307a-observed-" + step;
    input.value = benchResults[readingKey] ?? "";
    observation.value = benchResults[observationKey] ?? "";
    input.addEventListener("input", () => saveBenchResult(readingKey, input.value));
    observation.addEventListener("change", () => saveBenchResult(observationKey, observation.value));
  }
  for (const cell of root.querySelectorAll("[data-power-reading]")) {
    const saved = benchResults["fc1307a-volts-" + cell.dataset.powerReading];
    if (saved) cell.textContent = saved + " V DC";
  }
  for (const cell of root.querySelectorAll("[data-power-observed]")) {
    const observed = benchResults["fc1307a-observed-" + cell.dataset.powerObserved];
    cell.textContent = supplyObservations.find(([value]) => value === observed)?.[1] || "Unrecorded";
  }
}
