"use strict";

const installSteps = [
  {
    id: "prepare", title: "Prepare your bench", intro: "Record the hardware revision and prepare two separate pieces of media for CheckR.",
    checks: [
      "Record the full SCPH-700xx model, the GH-035-11 board marking, and the BuildR revision. Gather the wiring map for that exact BuildR revision.",
      "Copy <code>FBD_DEV9_Diagnostic.elf</code> to the root of a FAT32 USB stick. Leave room for the reports.",
      "Use the CheckR v1 image <code>FBD_DEV9_TEST.img</code> with a dedicated spare microSD. In balenaEtcher, select the whole card by reader and capacity, then flash the image and let validation finish.",
      "Eject the microSD after flashing. If Windows offers to initialize or format it, cancel. A raw CheckR card uses fixed sectors."
    ],
    note: "Flashing erases the selected card. Back up its files first. The microSD goes into the FC1307A. The USB stick goes into the PS2.",
    warning: true,
    extra: `<details><summary>Windows media and launcher references</summary>
      <p class="caption">In a local CheckR checkout, use the release files from <code>dist/</code>. Verify the source image and manifest before flashing:</p>
      <pre><code>python tools/verify_test_image.py dist/FBD_DEV9_TEST.img --manifest dist/FBD_DEV9_TEST.json</code></pre>
      <p class="caption"><a href="https://etcher.balena.io/">balenaEtcher</a> · <a href="https://github.com/ps2homebrew/wLaunchELF">wLaunchELF</a></p></details>`
  },
  {
    id: "dry-fit", title: "Identify and dry-fit the boards",
    intro: "This workflow follows the GH-035-11 with Side A PCB v0.0, B-side SubPCB v0.1, B-side Interface PCB v0.1 and the 44-pin FC1307A.",
    checks: [
      "Unplug the console and keep the FC1307A disconnected. Photograph the motherboard marking and the pin-1 orientation of the adapter.",
      "Dry-fit Side A and the B-side SubPCB against the corresponding lands and board features. Confirm every contact is aligned before soldering.",
      "Check the Interface PCB location, insulation, clearance and wire access with the shield and case in mind. Confirm the mounting position on your hardware.",
    ],
    note: "Check the revision printed on each board. Use the Installed layout and Motherboard only views to compare the joint positions.",
    link: ["#pads", "Open the pad locator"],
  },
  {
    id: "side-a", title: "Solder and check the Side A PCB",
    intro: "Work through RB9003, RB9004, RB9005 and RB900x on the GH-035-11 Side A.",
    checks: [
      "Align and tack the board, then check that it sits flat before soldering the mapped joints. Inspect the contacts under magnification.",
      "Verify each motherboard land to its BuildR contact. Use Ω mode across each fitted series channel and check direct copper on either side.",
      "Identify the exposed output pads for the wires that run to the Interface PCB.",
    ],
    note: "Follow the highlighted pad in each schematic step. The series channel and the output pad each have their own probe locations.",
    board: "sideA",
  },
  {
    id: "subpcb", title: "Solder and check the B-side SubPCB",
    intro: "Mount the SubPCB and check its ground, data, handshake, control and five pass-through groups.",
    checks: [
      "Confirm the mounting ground lands before soldering the ground anchors. Recheck alignment before working on the smaller joints.",
      "Verify each data, handshake and control joint to the correct SubPCB breakout. Use the highlighted copper when the same reference appears in two places.",
      "Verify the two points in each fitted pass-through pair. Identify its downstream wiring from the build before routing a lead beyond the breakout.",
    ],
    note: "The pass-through steps identify the motherboard CL point and its matching *1 breakout.",
    board: "subB",
  },
  {
    id: "interface", title: "Prepare the B-side Interface PCB",
    intro: "Check the input pads, routed outputs, fitted resistor channels, ground and power options before attaching the leads.",
    checks: [
      "Inspect the populated components and the front and rear pads. Confirm which power and indicator parts your build uses.",
      "Verify the ground contacts and check each routed signal for direct continuity or its fitted series resistance, as shown in the solder step.",
      "Find the two endpoints for each signal: the input from the solder PCB and the output toward the adapter.",
    ],
    note: "KiCad marks U1 and IC1 DNP. Use the populated hardware and the verified power wiring for your build.",
    board: "interfaceB",
  },
  {
    id: "wire", title: "Route the wires and verify both ends",
    intro: "Work through the wire map with the PS2 unplugged. Each signal follows the motherboard land, solder PCB, Interface input and output, and the numbered adapter pin.",
    checks: [
      "Verify the ground return and the JL4016 → +5V1 lead. Trace the supply contacts on the fitted adapter harness.",
      "Route the wires from the Side A PCB and B-side SubPCB breakouts to their named Interface inputs. Check continuity on each fitted wire.",
      "Route each Interface output to its numbered connector destination. Verify the connector orientation, then use an unplugged harness or breakout to test the other end.",
      "Check strain relief and clearance after routing. Inspect wires, solder joints and insulation before fitting the shield.",
    ],
    note: "The wire map distinguishes direct copper from series resistors. Record the result for each section rather than relying on a buzzer across the whole path.",
    link: ["#wire", "Open the wire map"],
    linkFirst: true,
  },
  {
    id: "preflight", title: "Run the unpowered meter checks",
    intro: "Leave the PS2 unplugged and the FC1307A disconnected until the wiring and isolation checks pass.",
    checks: [
      "Touch the meter probes together and record the resistance baseline. Work through the wire map for all 28 ATA paths and the fitted ground, supply and auxiliary connections.",
      "Check each data line to ground and step through the physical neighboring pairs on the motherboard. Inspect other nearby contacts on different nets. Compare settled resistance when fitted series resistors can keep the continuity buzzer silent.",
      "If checking diode readings, place the red probe on ground and the black probe on the equivalent IDE signal. Compare the readings with Gusse’s fixture values and with your other data lines.",
      "Verify ground continuity from the motherboard to the Interface PCB and to the intended adapter return. Check +5V1 to GND, +3V3 to GND where used, and the two rails for a persistent unintended short.",
      "Confirm pin 1, key position, the actual adapter supply contacts and wire orientation. Resolve unexpected opens, bridges or an uncertain power feed before applying power.",
    ],
    note: "Keep resistance, continuity and diode-mode measurements on the unpowered assembly. Gusse’s diode readings are comparisons from a different setup.",
    warning: true,
    link: ["#bridge", "Open bridge and diode checks"],
    extra: '<div class="actions"><a href="#wire/power">Power and rail checks</a><a href="#wire/ground">Ground return</a><a href="#wire">Wire map</a><a href="#meter">Gusse’s readings</a></div>',
  },
  {
    id: "first-power", title: "Verify rails with the adapter disconnected",
    intro: "After the unpowered checks pass, leave the FC1307A disconnected and switch the meter to DC voltage for the first powered check.",
    checks: [
      "Power up the PS2 with the FC1307A disconnected. Use confirmed ground as the meter reference.",
      "Verify the nominal 5 V at motherboard JL4016, Interface PCB +5V1 and the confirmed supply contact on the disconnected adapter harness, if accessible. Check +3V3 separately when the regulator output is used on this build.",
      "Power off and unplug. If a rail is wrong, trace the feed or short before connecting the adapter. Once the rails are correct, continue with the disconnected CheckR baseline.",
    ],
    note: "The +3V3 pad is the regulator output when fitted. The FC1307A’s 44-pin supply positions are nominally 5 V. Confirm the actual feed and contact assignment for your hardware.",
    link: ["#power", "Open the FC1307A power check"],
    linkFirst: true,
    extra: '<div class="actions"><a href="#pads/power">Show the Interface PCB rail pads</a><a href="#wire/power">Locate JL4016 on the motherboard</a></div>',
  },
  {
    id: "baseline", title: "Capture the DEV9 baseline", intro: "Run CheckR with the BuildR installed and the FC1307A disconnected.",
    checks: [
      "Power off and unplug before disconnecting the FC1307A. Leave the BuildR in place.",
      "Insert the FAT32 USB stick and connect your controller to port 1. Start from a clean boot. In wLaunchELF, open FileBrowser → <code>mass:/</code> → <code>FBD_DEV9_Diagnostic.elf</code>.",
      "Confirm the SCPH-700xx model on CheckR’s 70K Installer Checklist. Select <strong>FC1307A disconnected</strong> and press Cross (×).",
      "Press Square (□) on DEV9 to see the controller readings. Return with Circle (○), press Right for Report, and press Cross to save. Record the numbered folder."
    ],
    note: "ATA access can be blocked with the FC1307A disconnected. Save the DEV9/SPEED readings for comparison with the next boot.",
    link: ["#diagnose/launch", "CheckR won’t launch"]
  },
  {
    id: "detect", title: "Detect the adapter", intro: "Run the same DEV9 check with the FC1307A attached, then confirm that ATA device 0 responds.",
    checks: [
      "Power off and unplug. Put the verified v1 test microSD into the FC1307A, seat the adapter, then relaunch CheckR.",
      "Choose <strong>FC1307A connected</strong> and press Cross. Expect <strong>DEV9 and ATA accessible</strong>.",
      "Press Right to <strong>Reset</strong>, then Cross. Expect <strong>Device ready</strong>.",
      "Press Right to <strong>Identify</strong>, then Cross. Expect <strong>Device 0 identified</strong>. Square shows the model, firmware and capacity."
    ],
    note: "If a check fails, press Square for Details, then Triangle for Report and Cross to save. Start with that failure before touching the wiring.",
    link: ["#diagnose", "Find the first failed check"]
  },
  {
    id: "reads", title: "Verify the data lines", intro: "Use the dedicated CheckR card to verify the 16-bit ATA data path.",
    checks: [
      "After Identify passes, press Right to <strong>Reads</strong> and Cross. Let both passes finish.",
      "Check for <strong>96 validated reads</strong>, <strong>2 passes</strong>, mask <code>0000</code>, and <strong>All 16 lines matched</strong>.",
      "Press Triangle, then Cross to save the connected run in a fresh <code>FBDnnn</code> folder."
    ],
    note: "An invalid image or insufficient verified data leaves the DD line result inconclusive. If the mask shows a mismatch on the verified image, inspect the affected net before reworking it.",
    link: ["#diagnose/media", "Troubleshoot a read failure"]
  },
  {
    id: "report", title: "Save a known-good reference", intro: "Capture a repeatable baseline after a clean Guided Reads run.",
    checks: [
      "Open Start → Advanced → Stress Testing and select <strong>Standard (8 passes)</strong>. In Signal Tuner, enter the board, adapter, BuildR revision, resistor values, wire length and bench notes.",
      "Press Square for A/B, then Cross to run. Confirm <strong>384 verified reads</strong>, mask <code>0000</code>, and zero read failures, timeouts and ATA errors.",
      "Press L1 to capture the baseline, then Triangle → Cross to save. Keep <code>REPORT.TXT</code>, <code>TRACE.CSV</code>, <code>SESSION.JSON</code>, and <code>BASELINE.FBD</code> together.",
      "After reboot, select the numbered slot on the Signal Tuner A/B screen and press R1 to verify the baseline reloads."
    ],
    note: "Keep both DEV9 snapshots and a full-screen photo. For a wiring comparison, change one thing and repeat with the same card, adapter, workload and warm-up conditions.",
    link: ["#reports", "Open a CheckR report"]
  }
];

const symptoms = {
  launch: {
    label: "CheckR won’t launch or the installer is missing", title: "Verify the diagnostic setup",
    checks: ["Use a clean boot, a working homebrew launcher and the standalone ELF on readable FAT32 USB media. For wLaunchELF, open FileBrowser → mass:/ and select FBD_DEV9_Diagnostic.elf.", "Plug the controller into port 1 and set the display or scaler to 4:3 with zoom off. CheckR opens the installer after confirming an SCPH-700xx model.", "Photograph the full screen or launcher error. Record the exact console model and which launcher loaded the ELF."],
    step: "baseline"
  },
  speed: {
    label: "DEV9 shows “SPEED access blocked”", title: "Inspect the DEV9 controller path",
    checks: ["Open Square → Details. Record the detected model, DEV9 revision, presence, power and driver evidence.", "Compare the disconnected and connected snapshots. With the PS2 unplugged, inspect the BuildR seating, power, ground and motherboard-side connections against the correct maps."],
    step: "baseline"
  },
  ata: {
    label: "DEV9 accessible / ATA blocked with adapter attached", title: "Inspect the BuildR-to-adapter connection",
    checks: ["Confirm the FC1307A physically is connected and that you chose the connected path on the installer screen. Record CAPS, REV8 and the IRQ mask under Square → Details.", "Unplug the PS2. Inspect connector seating and orientation, the BuildR-to-FC1307A connection, and the intended power and ground paths. Compare the connected snapshot with the disconnected one.", "Once CheckR reports DEV9 and ATA accessible on the connected boot, run Reset to check device response."],
    step: "detect"
  },
  reset: {
    label: "Reset stays busy or gives no response", title: "Check power, device selection and reset",
    checks: ["Save Square → Details, including the Alternate Status byte. With the PS2 unplugged, check power and ground continuity, seating, device-0 configuration and the RESET# path.", "If Alternate Status stays at 00 or FF, inspect CS1# and DIOR#. Use the appropriate revision drawings for both ends of each net.", "Run Guided Reset before retrying a command after an ATA timeout."],
    step: "detect", pins: ["RESET#", "CS1#", "DIOR#"]
  },
  echo: {
    label: "Identify or Reads shows a task-file echo failure", title: "Inspect the ATA command path",
    checks: ["Save the first failure and the requested versus captured task-file values from Details.", "With the console unplugged, inspect CS0#, DA0–DA2, DIOW#, DIOR# and DD0–DD7. Check both ends, any fitted series resistors and adjacent shorts."],
    step: "detect", pins: ["CS0#", "DA0", "DIOW#", "DD0"]
  },
  command: {
    label: "Identify or Reads reports ERR/DF, missing DRQ or a timeout", title: "Record where the command stopped",
    checks: ["Capture the failing stage, Alternate Status and ATA Error in Square → Details. Save the report before changing the wiring.", "With the console unplugged, inspect the command and status paths (CS0#/DIOW# and CS1#/DIOR#). If the wiring checks pass, the strobe and IORDY timing require appropriate bench instruments.", "Run Guided Reset before retrying after an ATA timeout."],
    step: "detect", pins: ["CS0#", "CS1#", "IORDY"]
  },
  media: {
    label: "Identify passes, but Reads rejects the test image", title: "Verify the dedicated test card",
    checks: ["Verify the v1 source image and manifest on the PC. Check that you flashed the IMG to the whole spare microSD and that the write validated.", "Unplug the PS2 and reseat the card. Rerun Reads. Record the failed stage if CheckR still rejects the image or sector tags.", "Leave DD conclusions open until a verified two-pass run gives enough evidence."],
    step: "prepare"
  },
  mismatch: {
    label: "Verified Reads reports data mismatches", title: "Locate the affected data line",
    checks: ["Record the mask and the first mismatch from Details. Open Start → Advanced → Signal Map, choose the affected DD line, press Cross to open it, then Cross to run its high/low check.", "With the PS2 unplugged, inspect the corresponding signal at both ends, the series resistor and neighboring nets. Keep the same card and adapter for the comparison.", "Use the bit reported by CheckR. DD7 is an example. A clean DD7 probe returns 0080 and FF7F with 476/476 words per polarity."],
    step: "reads", pins: ["DD7"]
  },
  opl: {
    label: "CheckR passes, but my loader still can’t see the drive", title: "Record the loader and disk setup",
    checks: ["Save the connected CheckR report and record which loader or application missed the adapter. Record its build, storage settings and how the intended card is prepared.", "The CheckR card contains raw test patterns. Keep it as a baseline and use separately prepared compatible media for your loader’s storage workflow.", "Repeat the loader check with the same known-good adapter and only one changed setting or part at a time."],
    step: "report"
  }
};

function padId(signal) {
  return signal.toLowerCase().replace("#", "");
}

const pads = [
  ["DD0", 419, 113, "A", "RB9005", 17], ["DD1", 386, 113, "A", "RB9005", 15],
  ["DD2", 436, 113, "A", "RB9005", 13], ["DD3", 403, 113, "A", "RB9005", 11],
  ["DD4", 302, 104, "A", "RB9004", 9], ["DD5", 319, 104, "A", "RB9004", 7],
  ["DD6", 269, 104, "A", "RB9004", 5], ["DD7", 285, 104, "A", "RB9004", 3],
  ["DD8", 196, 104, "A", "RB9003", 4], ["DD9", 162, 104, "A", "RB9003", 6],
  ["DD10", 145, 104, "A", "RB9003", 8], ["DD11", 179, 104, "A", "RB9003", 10],
  ["DD12", 219, 45, "B", "RB9002", 12], ["DD13", 231, 45, "B", "RB9002", 14],
  ["DD14", 207, 45, "B", "RB9002", 16], ["DD15", 195, 45, "B", "RB9002", 18],
  ["DIOR#", 244, 104, "A", "CL9210"], ["DIOW#", 177, 63, "B", "CL9213"],
  ["IORDY", 163, 87, "B", "R9006"], ["CS0#", 189, 173, "B", "CL9208"],
  ["CS1#", 189, 155, "B", "CL9209"], ["DA0", 219, 83, "A", "CL9221"],
  ["DA1", 244, 83, "A", "CL9220"], ["DA2", 219, 104, "A", "CL9217"],
  ["RESET#", 232, 79, "B", "CL9207"], ["INTRQ", 185, 85, "B", "R9004"],
  ["DMARQ", 208, 84, "B", "R9025"], ["DMACK#", 121, 93, "B", "CL9215"]
].map(([signal, x, y, side, land, pin]) => ({signal, x, y, side, land, pin}));
