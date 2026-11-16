"use strict";

const gusseSource = "https://gusse.in/ps2-modchip-diagram-and-resources/ide-installation-troubleshoot-guide/";
const gusseDataPins = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18];
const gusseDiode = {
  1: "0.563", 21: "0.554", 23: "0.562", 25: "0.562", 27: "0.527",
  29: "0.560", 31: "0.560", 33: "0.560", 34: "0.742", 35: "0.560",
  36: "0.560", 37: "0.560", 38: "0.561", 39: "0.692", 41: "0.105", 42: "0.105",
};
const gusseResistance = {21: 4700, 27: 1000, 31: 10000};
const gusseGround = [2, 19, 22, 24, 26, 28, 30, 40, 43];
const gusseNc = [20, 32, 44];
const gusseControlPins = {
  "RESET#": 1, DMARQ: 21, "DIOW#": 23, "DIOR#": 25, IORDY: 27,
  "DMACK#": 29, INTRQ: 31, DA1: 33, DA0: 35, DA2: 36, "CS0#": 37, "CS1#": 38,
};

function gussePin(pad) {
  return pad.pin ?? gusseControlPins[pad.signal];
}

function gusseMeterLink(pad) {
  const pin = gussePin(pad);
  return pin ? '<a href="#meter/' + pin + '">Gusse meter reference · pin ' + pin + '</a>' : "";
}

const gusseSignals = new Map(pads.map(pad => [gussePin(pad), pad.signal]));
const gusseRows = Array.from({length: 44}, (_, index) => {
  const pin = index + 1;
  const dataPin = gusseDataPins.includes(pin);
  return {
    pin, signal: gusseSignals.get(pin),
    diode: dataPin ? "0.558" : gusseDiode[pin],
    ohms: dataPin ? 10000 : gusseResistance[pin],
    status: gusseGround.includes(pin) ? "GND" : gusseNc.includes(pin) ? "NC" : "",
  };
});

function normalizeMeterSearch(value) {
  return value.toLowerCase().replace(/[\s#]/g, "").replace(/ohms?|ω/g, "");
}

function matchingMeterRows(query) {
  const normalized = normalizeMeterSearch(query);
  const pinSearch = /^(?:pin)?(\d{1,2})$/.exec(normalized);
  if (pinSearch) return gusseRows.filter(row => row.pin === Number(pinSearch[1]));
  return gusseRows.filter(row => {
    const terms = [row.signal, row.status, row.diode, row.ohms?.toString()];
    if (row.ohms) terms.push(row.ohms / 1000 + "k");
    return !normalized || terms.some(term => term && normalizeMeterSearch(term).includes(normalized));
  });
}

function meterRows(query) {
  const rows = matchingMeterRows(query);
  if (!rows.length) return '<tr><td colspan="4">No matching pin or reading.</td></tr>';
  return rows.map(row => {
    const signal = row.signal ?
      '<a class="meter-signal" href="#pads/' + padId(row.signal) + '">' + row.signal + '</a>' : "—";
    const diode = row.diode || row.status || (row.pin === 15 ? "Unlisted" : "—");
    return '<tr><th scope="row">' + row.pin + '</th><td>' + signal + '</td><td>' + diode +
      '</td><td>' + (row.ohms ? row.ohms / 1000 + ' kΩ' : '—') + '</td></tr>';
  }).join("");
}

function gusseIllustration(file, width, height, alt, caption) {
  const path = "install/" + file;
  return '<figure class="meter-figure"><a href="' + path + '" target="_blank" rel="noopener">' +
    '<img src="' + path + '" width="' + width + '" height="' + height + '" loading="lazy" alt="' + alt +
    '"></a><figcaption class="caption">' + caption + '</figcaption></figure>';
}

function renderMeter(id) {
  const pin = gusseRows.find(row => String(row.pin) === id)?.pin;
  const query = pin ? String(pin) : "";
  return '<div class="layout meter-layout"><section class="panel"><h2 tabindex="-1">IDE meter reference</h2>' +
    '<p class="intro">Gusse recorded these readings on an IDE Resurrector with a SATA adapter and capacitors fitted. Use them as comparison readings when investigating a BuildR or FC1307A install.</p>' +
    '<p class="callout">Unplug the PS2 for diode and resistance checks. In diode mode, place the red probe on ground and the black probe on the IDE connector pin. Use the 44-pin Resurrector numbering shown in Gusse’s drawing.</p>' +
    '<label for="meter-search" class="field">Find a pin, signal, or reading</label>' +
    '<input type="search" id="meter-search" placeholder="DD7, pin 3, or 4.7 kΩ" value="' + query + '">' +
    '<p id="meter-count" class="caption" role="status">' + (pin ? '1 pin shown.' : '44 pin positions shown.') + '</p>' +
    '<div class="meter-table"><table><caption class="sr-only">Gusse’s IDE Resurrector readings by 44-pin connector position</caption>' +
    '<thead><tr><th scope="col">Pin</th><th scope="col">ATA signal</th><th scope="col">Diode (V) / status</th><th scope="col">Listed Ω</th></tr></thead>' +
    '<tbody id="meter-rows">' + meterRows(query) + '</tbody></table></div>' +
    '<p class="caption">Gusse’s table skips pin 15. A dash in the resistance column means no value was listed.</p>' +
    '<p class="caption"><a href="' + gusseSource + '">Gusse’s original troubleshooting guide</a></p></section>' +
    '<aside class="stack"><section class="panel"><h3>Connector orientation</h3>' +
    gusseIllustration("gusse-ide-connector.png", 566, 225, "IDE Resurrector v0.4 connector drawing, with pin 1 marked at the right",
      "Gusse’s IDE Resurrector v0.4 drawing. Match the connector orientation before counting pins.") + '</section>' +
    '<section class="panel"><h3>Motherboard resistor values</h3><p class="intro">Gusse marked 1 kΩ, 10 kΩ, and 4.7 kΩ on the motherboard photo.</p>' +
    gusseIllustration("gusse-resistor-locations.png", 768, 564, "Gusse’s motherboard photo with 1 kΩ, 10 kΩ and 4.7 kΩ resistor locations",
      'Gusse’s reference photo. The <a href="#solder">BuildR solder tests</a> show the fitted BuildR component values and where to probe their terminals.') + '</section>' +
    '<section class="panel"><h3>Gusse’s 5 V locations</h3><p class="intro">The photo shows the main and USB 5 V locations from Gusse’s guide. This BuildR installation uses a different motherboard pickup.</p>' +
    gusseIllustration("gusse-5v-locations.png", 610, 1024, "Gusse’s motherboard photo marking a 5 V point and a USB 5 V point",
      'This BuildR uses <a href="#wire/power">JL4016</a>. The <a href="#power">FC1307A power check</a> covers the Interface +5V1 feed and the disconnected harness.') +
    '</section></aside></div>';
}

document.addEventListener("input", event => {
  if (event.target.id !== "meter-search") return;
  const query = event.target.value;
  const count = matchingMeterRows(query).length;
  document.querySelector("#meter-rows").innerHTML = meterRows(query);
  document.querySelector("#meter-count").textContent = count + (count === 1 ? " pin shown." : " pin positions shown.");
});
