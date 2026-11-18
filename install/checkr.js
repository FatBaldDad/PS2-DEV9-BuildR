"use strict";

function renderCheckR() {
  return `
    <div class="stack">
      <section class="panel">
        <h2 tabindex="-1">CheckR downloads and instructions</h2>
        <p class="intro">Use CheckR v0.5.0 to find the first failing stage of the DEV9 and IDE path on an SCPH-700xx PS2.</p>
        <div class="actions">
          <a class="button primary" href="https://github.com/FatBaldDad/PS2-DEV9-BuildR/releases/download/checkr-v0.5.0/FBD_DEV9_CheckR.ELF">Download CheckR ELF</a>
          <a class="button" href="https://github.com/FatBaldDad/PS2-DEV9-BuildR/releases/download/checkr-v0.5.0/FBD_DEV9_TEST.img">Download microSD image</a>
          <a href="https://github.com/FatBaldDad/PS2-DEV9-BuildR/releases/download/checkr-v0.5.0/SHA256SUMS.txt" target="_blank" rel="noopener">SHA-256 checksums</a>
          <a href="https://github.com/FatBaldDad/PS2-DEV9-BuildR/releases/download/checkr-v0.5.0/FBD_DEV9_TEST.json" target="_blank" rel="noopener">Image manifest</a>
        </div>
      </section>

      <div class="layout">
        <div class="stack">
          <section class="panel" aria-labelledby="checkr-launch">
            <h3 id="checkr-launch">Run CheckR from USB</h3>
            <ol class="bullets">
              <li>Copy <code>FBD_DEV9_CheckR.ELF</code> to a FAT32 USB stick and plug it into the PS2. For the automatic check, leave the FC1307A and its current microSD installed.</li>
              <li>From a clean boot in wLaunchELF, open <strong>FileBrowser → mass:/</strong> and launch the ELF. CheckR starts automatically when the launcher supplies the USB path. If the installer screen opens first, make sure you launched the ELF directly from <code>mass:/</code>.</li>
              <li>Read the first failed stage and the suggested wiring checks. Use <strong>Left</strong> and <strong>Right</strong> to page through the evidence, <strong>Cross (×)</strong> to rerun, or <strong>Circle (○)</strong> to open the <strong>70K Installer Checklist</strong>.</li>
            </ol>
            <p class="caption"><a href="https://github.com/ps2homebrew/wLaunchELF">wLaunchELF project</a></p>
          </section>

          <section class="panel" aria-labelledby="checkr-tests">
            <h3 id="checkr-tests">What each automatic test checks</h3>
            <p class="intro">CheckR confirms the console model before touching DEV9, then runs these five tests in order. It stops at the first failure and leaves the contents of the IDE media intact.</p>
            <ol class="bullets">
              <li><strong>DEV9 and SPEED.</strong> Reads the DEV9 revision and power registers, starts the DEV9 driver, and samples the SPEED revision and capability registers eight times. It checks that the readings are stable and that the ATA capability, presence and interrupt mask allow task-file access. Unusable SPEED readings point to the controller path. A stable SPEED reading with ATA blocked points to the adapter power and connections. <a href="#diagnose/speed">SPEED</a> · <a href="#diagnose/ata">ATA access</a></li>
              <li><strong>ATA reset.</strong> Resets the ATA bus through SPEED, sets conservative PIO0 timing, and waits for device 0 to become ready. It records the status, any reset signature and the time to ready. A silent or stuck response is a reason to inspect adapter power, RESET#, and the status-read path. <a href="#diagnose/reset">Reset checks</a></li>
              <li><strong>Task-file echo.</strong> Writes walking-one and walking-zero bytes to the Sector Count and three sector address registers, then reads them back. A mismatch shows which register and bits differed. Check the lower eight data lines, register address lines, chip select and read/write strobes. These writes go to registers. <a href="#diagnose/echo">Task-file checks</a></li>
              <li><strong>IDENTIFY DEVICE.</strong> Requests the device’s 256-word identity block twice. It checks the reported geometry and any declared checksum on the first response, then compares both blocks word for word. It records model, firmware, capacity and changed bits. Failure can show a command or data-transfer problem. <a href="#diagnose/command">Command and transfer checks</a></li>
              <li><strong>PIO sector reads.</strong> Reads selected sector addresses within the reported capacity twice each. It compares the returned words and the primary and alternate status bits, and records checksums and timing. Agreement shows that the samples are repeatable. A consistent data-line fault can still pass here.</li>
            </ol>
            <p class="callout">The automatic check uses programmed I/O (PIO). Use the prepared microSD for known-data comparisons. DMA and electrical signal levels require separate tests.</p>
          </section>

          <section class="panel" aria-labelledby="checkr-log">
            <h3 id="checkr-log">Save the result</h3>
            <p class="intro">CheckR appends each stage to <code>CHECKR.LOG</code> next to the ELF on the USB stick. Keep the log and the first failure shown on screen. The log may include the device serial number in the IDENTIFY response.</p>
            <p class="intro">If the log is incomplete or you need the full evidence, press <strong>Triangle (△)</strong> to open <strong>Report</strong>, then <strong>Cross (×)</strong> to save a numbered <code>FBDnnn</code> folder on USB.</p>
            <div class="actions"><a href="#reports">Open the report viewer</a></div>
          </section>
        </div>

        <div class="stack">
          <section class="panel" aria-labelledby="checkr-microsd">
            <h3 id="checkr-microsd">Prepare the test microSD</h3>
            <p class="callout warn"><strong>Use a spare card and back up its files first.</strong> Flashing the raw image overwrites the start of the selected device, including its partition table and file system.</p>
            <ol class="bullets">
              <li>Download <code>FBD_DEV9_TEST.img</code> above. The v1 image is <strong>33,554,944 bytes</strong>.</li>
              <li>Insert the spare microSD into a PC card reader. In balenaEtcher, choose <strong>Flash from file</strong> and select the downloaded IMG. If Etcher warns that the image has no partition table, continue. CheckR reads raw sectors and the image deliberately has no partition table or filesystem.</li>
              <li>Choose <strong>Select target</strong>. Identify the whole spare card by its reader and capacity. Confirm that target before pressing <strong>Flash!</strong> and wait for Etcher’s validation to finish. <a href="https://etcher.balena.io/">Get balenaEtcher</a></li>
              <li>If your operating system asks to initialize or format the flashed card, cancel the prompt to preserve the test sectors.</li>
              <li>Safely eject the card. With the PS2 off and unplugged, insert it into the FC1307A. Keep the ELF and logs on the FAT32 USB stick.</li>
            </ol>
            <details>
              <summary>Verify the downloaded image on Windows</summary>
              <p class="caption">In PowerShell, open the folder where you saved the files. Compare the hash with the image entry in the SHA-256 checksums above.</p>
              <pre><code>Get-FileHash .\\FBD_DEV9_TEST.img -Algorithm SHA256</code></pre>
            </details>
          </section>

          <section class="panel" aria-labelledby="checkr-patterns">
            <h3 id="checkr-patterns">Verify DD0–DD15 with the test card</h3>
            <ol class="bullets">
              <li>Launch CheckR from USB. After the automatic check, press <strong>Circle (○)</strong> and select <strong>FC1307A connected</strong>. Press <strong>Cross (×)</strong> for DEV9, then advance with <strong>Right</strong> and run <strong>Reset</strong>, <strong>Identify</strong> and <strong>Reads</strong> in order.</li>
              <li><strong>Reads</strong> verifies the image header and checks the tags and data of 48 known sectors per pass. Walking-one, walking-zero, alternating and other patterns exercise the 16 data bits. CheckR compares the results with the expected words and reports the bits that differ.</li>
              <li>A clean run shows <strong>96 reads, 2 passes, mask 0000</strong> and <strong>All 16 lines matched</strong>. A rejected image, unreadable sector tag or incomplete run leaves the data-line result inconclusive. If a verified run shows a mismatch, use the reported DD bit to find the pads and check for shorts.</li>
            </ol>
            <div class="actions">
              <a href="#install/reads">Guided Reads workflow</a>
              <a href="#bridge">Bridge checks</a>
              <a href="#diagnose/media">Test-card troubleshooting</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
