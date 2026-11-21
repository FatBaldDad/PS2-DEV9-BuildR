"use strict";

const page = document.querySelector("#page");
const progressKey = "fbd-dev9-gh03511-install-v1";
let checked = new Set();

try {
  const saved = JSON.parse(localStorage.getItem(progressKey));
  if (Array.isArray(saved)) checked = new Set(saved);
} catch {
  // The checklist also works when browser storage is unavailable.
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey, JSON.stringify([...checked]));
  } catch {
    // Keep the current session usable if storage is unavailable.
  }
}

function checkId(step, index) {
  return step.id + "-" + index;
}

function stepComplete(step) {
  return step.checks.every((_, index) => checked.has(checkId(step, index)));
}

function stepSummary() {
  const complete = installSteps.filter(stepComplete).length;
  return '<div class="step-header"><div><p class="eyebrow">' + complete +
    ' of ' + installSteps.length + ' complete</p><h3 id="steps-title">Installation checklist</h3></div>' +
    '<progress aria-label="Completed installation steps" value="' + complete + '" max="' + installSteps.length + '"></progress></div>';
}

function pathDiagram() {
  return '<section class="panel" aria-labelledby="path-title"><h3 id="path-title">Storage path</h3>' +
    '<div class="diagram" aria-label="The PS2 motherboard connects to BuildR, then to the FC1307A with a test microSD.">' +
    '<div><b>PS2</b>GH-035-11</div><span class="flow-arrow" aria-hidden="true">→</span>' +
    '<div><b>BuildR</b>Interposer</div><span class="flow-arrow" aria-hidden="true">→</span>' +
    '<div><b>FC1307A</b>Test microSD</div></div>' +
    '<p class="caption">Launch the CheckR ELF and save reports using the separate FAT32 USB stick.</p></section>';
}

function renderInstall(id) {
  const stepId = id === "inspect" ? "dry-fit" : id;
  const active = installSteps.find(step => step.id === stepId) || installSteps[0];
  const position = installSteps.indexOf(active);
  const items = active.checks.map((check, index) => {
    const key = checkId(active, index);
    return '<li><label><input data-check="' + key + '" type="checkbox"' +
      (checked.has(key) ? " checked" : "") + '><span>' + check + '</span></label></li>';
  }).join("");
  const steps = installSteps.map((step, index) =>
    '<li data-step="' + step.id + '"><a class="' + (stepComplete(step) ? "done" : "") + '" href="#install/' + step.id + '"' +
    (step === active ? ' aria-current="step"' : '') + '><span class="step-number" aria-hidden="true">' +
    (stepComplete(step) ? "✓" : index + 1) + '</span><span>' + step.title + '</span>' +
    '<span class="sr-only">' + (stepComplete(step) ? " (complete)" : "") + '</span></a></li>').join("");
  const next = installSteps[position + 1];
  const nextStep = next ? '<a class="button' + (active.linkFirst ? "" : " primary") + '" href="#install/' + next.id +
    '">Next · ' + next.title + ' <span aria-hidden="true">→</span></a>' :
    '<a class="button primary" href="#reports">Open reports <span aria-hidden="true">→</span></a>';
  const link = active.link ? '<a' + (active.linkFirst ? ' class="button primary"' : "") +
    ' href="' + active.link[0] + '">' + active.link[1] + '</a>' : "";
  const actions = active.linkFirst ? link + nextStep : nextStep + link;
  const groups = active.board ? walkthroughGroupMenu(active.board) : "";
  return '<div class="layout"><section class="panel"><p class="eyebrow">Step ' + (position + 1) + ' of ' +
    installSteps.length + '</p><h2 tabindex="-1">' + active.title + '</h2><p class="intro">' + active.intro +
    '</p><ul class="checks">' + items + '</ul><div class="callout' + (active.warning ? " warn" : "") +
    '">' + active.note + '</div>' + groups + (active.extra || "") + '<div class="actions">' + actions + '</div></section>' +
    '<aside class="stack"><section class="panel" aria-labelledby="steps-title"><div id="step-summary">' + stepSummary() +
    '</div><ol class="steps">' + steps + '</ol></section>' +
    '<section class="panel quick"><h3>Adapter already installed?</h3>' +
    '<p class="caption">Run CheckR on the connected adapter and start with its first failed test.</p>' +
    '<div class="actions"><a class="button" href="#checkr">Download and run CheckR</a>' +
    '<a href="#diagnose">Troubleshoot adapter detection</a></div></section>' + pathDiagram() + '</aside></div>';
}

function diagnosisResult(id) {
  if (!Object.hasOwn(symptoms, id)) {
    return '<h3>Start with the connected DEV9 result</h3><p class="intro">Choose <strong>FC1307A connected</strong> in CheckR. If ' +
      'DEV9 and ATA are accessible, continue to Reset and Identify. Select the first result that fails.</p>' +
      '<div class="actions"><a class="button" href="#install/detect">Open the connected check</a></div>';
  }
  const item = symptoms[id];
  const links = (item.pins || []).map(pin =>
    '<a class="button" href="#pads/' + padId(pin) + '">' + pin + (id === "mismatch" ? " example" : "") + '</a>').join("");
  return '<h3>' + item.title + '</h3><ol class="bullets">' +
    item.checks.map(check => '<li>' + check + '</li>').join("") + '</ol>' +
    '<div class="actions">' + links + '<a href="#install/' + item.step + '">Open the related guide step</a></div>';
}

function renderDiagnosis(id) {
  const options = Object.entries(symptoms).map(([key, item]) =>
    '<option value="' + key + '"' + (key === id ? " selected" : "") + '>' + item.label + '</option>').join("");
  return '<div class="layout"><section class="panel"><h2 tabindex="-1">Troubleshoot the first failure</h2>' +
    '<p class="intro">If the FC1307A worked before installation, compare the installed setup at each stage. Record one result before changing a part or wire.</p>' +
    '<label class="field" for="symptom">What does CheckR show?</label><select id="symptom">' +
    '<option value="">Choose a result</option>' + options + '</select><div class="result" id="diagnosis-result" aria-live="polite">' +
    diagnosisResult(id) + '</div></section><aside class="stack">' + pathDiagram() +
    '<section class="panel"><h3>Save evidence before rework</h3><p class="intro">Press Square for Details. Press Triangle, then Cross to save the report. Note the connected or disconnected state and the folder number.</p>' +
    '<div class="actions"><a href="#reports">Open reports</a></div></section></aside></div>';
}

function renderPads(id) {
  locatorZoom = false;
  activeSignal = locatorSelection(id);
  const powerOption = '<option value="power"' + (activeSignal.power ? " selected" : "") + '>Power rails · Interface PCB</option>';
  return '<div class="layout"><section class="panel"><h2 tabindex="-1">GH-035-11 pad locator</h2>' +
    '<p class="intro">Select a signal to see the motherboard contact, the solder PCB and its corresponding Interface PCB pads.</p>' +
    '<label for="signal" class="field">Signal or power rail</label><select id="signal">' + signalOptions(activeSignal) +
    powerOption + '</select><div id="pad-result" aria-live="polite">' + boardFigure(activeSignal) + '</div></section>' +
    '<aside class="stack"><section class="panel"><h3>Identify the solder joint</h3>' +
    '<p class="intro">The bright frame marks the pad in focus. Use Zoom to pad for a centered close-up. ' +
    'Switch to Motherboard only to see the land beneath the BuildR, or use the PCB views to find exposed pads.</p>' +
    '<p class="callout warn">Unplug the PS2 and disconnect the adapter before checking continuity, resistance or adjacent shorts.</p>' +
    '<p class="caption">The larger Interface PCB is shown in its KiCad front view. Its mounting position needs an installed-board reference.</p>' +
    '<p class="caption"><a href="https://delta-island.com/downloads/sony-ps2-psx/service-manual/service-manual-scph-70000-gh035.pdf">Sony GH-035 LCG reference</a></p></section>' +
    pathDiagram() + '</aside></div>';
}

function renderReports() {
  return '<div class="layout"><section class="panel"><h2 tabindex="-1">Inspect a CheckR report</h2>' +
    '<p class="intro">Open <code>SESSION.JSON</code> from a numbered USB report folder to see the latest pattern run and its saved baseline. The file is read in this browser.</p>' +
    '<label for="session-file" class="field">CheckR session file</label><input id="session-file" type="file" accept=".json,application/json">' +
    '<div id="report-result" class="result" aria-live="polite"><p class="caption">Choose a file to view its evidence.</p></div></section>' +
    '<aside class="panel"><h3>What to keep</h3><ul class="bullets">' +
    '<li><code>CHECKR.LOG</code> next to the ELF for the automatic USB check.</li>' +
    '<li><code>REPORT.TXT</code> for the DEV9, Reset and Identify details.</li><li><code>TRACE.CSV</code> for individual transactions.</li>' +
    '<li><code>SESSION.JSON</code> for pattern evidence and A/B data.</li><li><code>BASELINE.FBD</code> to reload a saved baseline on the PS2.</li></ul>' +
    '<p class="caption">Keep both numbered folders, a photo of the first failure and the console, motherboard and BuildR revisions.</p>' +
    '<div class="actions"><a href="#checkr">CheckR launch and log instructions</a>' +
    '<a href="#install/report">Return to the baseline workflow</a></div></aside></div>';
}

function readSession(source) {
  const session = JSON.parse(source);
  if (session?.schema !== 1 || typeof session.software !== "string" ||
      !Object.hasOwn(session, "latest") || !Object.hasOwn(session, "baseline")) throw new Error("Unsupported session");
  for (const run of [session.latest, session.baseline]) {
    if (run === null) continue;
    if (!run || !Number.isSafeInteger(run.verified_reads) || run.verified_reads < 0 ||
        !Number.isSafeInteger(run.passes) || run.passes < 0 ||
        !Number.isInteger(run.error_mask) || run.error_mask < 0 || run.error_mask > 0xffff ||
        ![0, 1].includes(run.evidence) || ![0, 1].includes(run.image_valid)) throw new Error("Invalid run");
  }
  return session;
}

function appendSnapshot(container, title, snapshot) {
  const heading = document.createElement("h3");
  heading.textContent = title;
  container.append(heading);
  const text = document.createElement("p");
  text.className = "intro";
  if (!snapshot) {
    text.textContent = "No pattern run recorded. Check REPORT.TXT and TRACE.CSV for early-stage results.";
  } else if (!snapshot.evidence || !snapshot.image_valid) {
    text.textContent = "Data-line evidence is inconclusive. Review the first failure in REPORT.TXT before assigning a DD line.";
  } else {
    const lines = pads.slice(0, 16).filter((_, index) => snapshot.error_mask & (1 << index)).map(pad => pad.signal);
    const mask = snapshot.error_mask.toString(16).toUpperCase().padStart(4, "0");
    text.textContent = snapshot.verified_reads + " verified reads · " + snapshot.passes + " passes · Mask " + mask;
    if (lines.length) {
      const links = document.createElement("div");
      links.className = "actions";
      for (const line of lines) {
        const link = document.createElement("a");
        link.className = "button";
        link.href = "#pads/" + padId(line);
        link.textContent = "Locate " + line;
        links.append(link);
      }
      container.append(text, links);
      return;
    }
  }
  container.append(text);
}

async function importReport(input) {
  const result = document.querySelector("#report-result");
  const file = input.files[0];
  if (!file) return;
  result.textContent = "Reading session…";
  try {
    if (file.size > 1024 * 1024) throw new Error("File exceeds session limit");
    const session = readSession(await file.text());
    if (input.files[0] !== file) return;
    result.replaceChildren();
    appendSnapshot(result, "Latest run", session.latest);
    const baseline = document.createElement("div");
    baseline.className = "result";
    appendSnapshot(baseline, "Saved baseline", session.baseline);
    result.append(baseline);
  } catch {
    if (input.files[0] !== file) return;
    result.textContent = "This file could not be read as a CheckR v1 SESSION.JSON. Select the file from the numbered USB report folder.";
  }
}

const routes = {resistors: renderResistors, install: renderInstall, checkr: renderCheckR, diagnose: renderDiagnosis, pads: renderPads, solder: renderSolder, bridge: renderBridge, wire: renderWire, "wire-colors": renderWireColors, power: renderPowerCheck, "interface-pads": renderInterfacePads, meter: renderMeter, adapter: renderAdapter, reports: renderReports};

function render(focusHeading) {
  let [route, id] = location.hash.slice(1).split("/");
  if (!Object.hasOwn(routes, route)) route = "install";
  for (const link of document.querySelectorAll(".navigation a")) {
    if (link.dataset.page === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  page.innerHTML = routes[route](id);
  if (page.querySelector(".pcb-view")) drawLocator();
  if (route === "resistors") drawResistorMaps();
  drawAdapterDiagrams();
  activateBridge();
  activatePowerCheck();
  if (focusHeading) (page.querySelector("[data-step-focus]") || page.querySelector("h2")).focus();
}

page.addEventListener("change", event => {
  const input = event.target;
  if (input.dataset.check) {
    if (input.checked) checked.add(input.dataset.check);
    else checked.delete(input.dataset.check);
    saveProgress();
    document.querySelector("#step-summary").innerHTML = stepSummary();
    for (const node of document.querySelectorAll("[data-step]")) {
      const index = installSteps.findIndex(step => step.id === node.dataset.step);
      const done = stepComplete(installSteps[index]);
      node.querySelector("a").classList.toggle("done", done);
      node.querySelector(".step-number").textContent = done ? "✓" : index + 1;
      node.querySelector(".sr-only").textContent = done ? " (complete)" : "";
    }
  } else if (input.id === "symptom") {
    history.replaceState(null, "", "#diagnose" + (input.value ? "/" + input.value : ""));
    document.querySelector("#diagnosis-result").innerHTML = diagnosisResult(input.value);
  } else if (input.id === "signal") {
    activeSignal = locatorSelection(input.value);
    locatorZoom = false;
    history.replaceState(null, "", "#pads/" + input.value);
    refreshBoardFigure();
  } else if (input.id === "session-file") {
    void importReport(input);
  }
});

document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  document.querySelector("#workspace").focus();
});
window.addEventListener("hashchange", () => render(true));
render(false);
