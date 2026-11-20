"use strict";

// References and positions come from the same saved KiCad export as the pad locator.
// Single-pad breakouts with R/RB names are deliberately excluded from this list.
const resistorParts = [
  ["sideA", "RB9003", "DD8–DD11 series array", "Beside the RB9003-2, -4, -6 and -8 wire pads.", "rb9003"],
  ["sideA", "RB9004", "DD4–DD7 series array", "Beside the RB9004-2, -4, -6 and -8 wire pads.", "rb9004"],
  ["sideA", "RB9005", "DD0–DD3 series array", "Beside the RB9005-2, -4, -6 and -8 wire pads.", "rb9005"],
  ["sideA", "RB900x1", "DIOR#, DA1, DA2 and DA0 series array", "Beside the square group of RB900x-2, -4, -6 and -8 wire pads. The component reference ends in x1.", "rb900x"],
  ["interfaceB", "R1", "DIOW#", "Upper of the two horizontal resistors R1 and R3, above RB9002.", "if-control"],
  ["interfaceB", "R2", "DMACK#", "Vertical footprint near the left edge; directly above R4, left of the 10 kΩ arrays.", "if-control"],
  ["interfaceB", "R3", "DD15", "Horizontal footprint immediately below R1 and above RB9002.", "if-control"],
  ["interfaceB", "R4", "CS1#", "Vertical footprint near the left edge, immediately below R2.", "if-control"],
  ["interfaceB", "R5", "CS0#", "Vertical footprint on the right of the signal section, below RB9002.", "if-control"],
  ["interfaceB", "R6", "Blue power LED current limiter", "Below the U1 regulator area, to the right of IC1. Follow the right-hand branch toward D1.", "if-power"],
  ["interfaceB", "R7", "Amber activity LED current limiter", "Horizontal footprint directly above the D2 LED pads at the bottom end of the board.", "if-activity"],
  ["interfaceB", "R8", "Activity transistor gate resistor", "Horizontal footprint just below IC1 and above Q1, to the right of R10.", "if-activity"],
  ["interfaceB", "R9", "Activity transistor gate pull-down", "Vertical footprint below R10, to the left of Q1 and above R7.", "if-activity"],
  ["interfaceB", "R10", "DASP# pull-up", "Horizontal footprint below IC1, immediately left of R8. This is 47 kΩ.", "if-activity"],
  ["interfaceB", "RB9002", "DD14, DD13, DD12 and RESET# series array", "Eight pads below R1/R3, beside the RB9002-5 through -8 wire pads on the right.", "if-rb9002"],
  ["interfaceB", "RB9002A1", "DD12–DD15 pull-down array", "Lowest of the four 10 kΩ arrays on the left of the signal section.", "if-rb9002"],
  ["interfaceB", "RB9003A1", "DD8–DD11 pull-down array", "Third 10 kΩ array from the top, between RB9004A1 and RB9002A1.", "if-rb9003"],
  ["interfaceB", "RB9004A1", "DD4–DD7 pull-down array", "Second 10 kΩ array from the top, between RB9005A1 and RB9003A1.", "if-rb9004"],
  ["interfaceB", "RB9005A1", "DD0–DD3 pull-down array", "Topmost 10 kΩ array, to the left of the 33 Ω RB9002 array.", "if-rb9005"],
].map(([board, ref, purpose, landmark, group]) => {
  const lands = buildrData.boards[board].pads.filter(p => p.ref === ref && p.schemaMatch && p.front);
  return {board, ref, purpose, landmark, group, lands, id: board + "-" + ref.toLowerCase(),
    value: lands[0].value.replace(/KΩ/g, " kΩ").replace(/(?<=\d)Ω/g, " Ω"),
    center: [0, 1].map(axis => lands.reduce((sum, p) => sum + p.xy[axis], 0) / lands.length)};
});

function resistorUrl(part) { return "#resistors/" + part.id; }
function resistorSelection(id) { return resistorParts.find(p => p.id === id) || resistorParts[0]; }

function resistorFigure(part, closeup) {
  const board = buildrData.boards[part.board];
  const sideA = part.board === "sideA";
  const width = closeup ? 1000 : sideA ? 1000 : 760;
  const height = closeup ? 660 : sideA ? 560 : 1120;
  return '<figure class="locator"><div class="map-top"><span>' + (closeup ? 'Placement close-up' : 'Whole board · match the outline first') +
    '</span><strong>' + (closeup ? part.ref + ' · ' + part.value : board.label) + '</strong></div>' +
    '<canvas class="resistor-map" data-resistor-map="' + (closeup ? 'detail' : 'overview') + '" width="' + width +
    '" height="' + height + '" role="img" aria-label="' + board.label + ': ' + part.ref +
    ' resistor placement. Gold outlines every pad of the selected component; blue marks its body position. ' +
    (closeup ? 'Each terminal is numbered.' : 'Other resistor footprints are labeled in white.') + '"></canvas>' +
    '<figcaption class="caption">' + (sideA ? 'Front/component side · rotated 180° to match the Side A pad locator.' :
      'Front/component side · KiCad orientation, signal pads at the top and LED pads at the bottom.') +
    (closeup ? ' Gold = solder pads. Blue = body position; drawing is a placement guide, not a component photo.' :
      ' Gold = selected footprint. Match the wire-pad pattern as well as the outline. Labels are added guide callouts.') + '</figcaption></figure>';
}

function resistorPairs(part) {
  if (part.lands.length === 2) return 'Pins 1 and 2';
  return '1–8, 2–7, 3–6 and 4–5';
}

function resistorTable(part) {
  return '<div class="meter-table"><table class="resistor-table"><caption>All resistor footprints on ' +
    buildrData.boards[part.board].label + '</caption><thead><tr><th>Locate</th><th>Value</th><th>Use</th></tr></thead><tbody>' +
    resistorParts.filter(p => p.board === part.board).map(p => '<tr' + (p === part ? ' class="resistor-selected"' : '') +
      '><th scope="row"><a href="' + resistorUrl(p) + '"' + (p === part ? ' aria-current="true"' : '') + '>' + p.ref +
      '</a></th><td>' + p.value + (p.lands.length === 8 ? ' × 4' : '') + '</td><td>' + p.purpose + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function renderResistors(id) {
  const part = resistorSelection(id);
  const boardParts = resistorParts.filter(p => p.board === part.board);
  const index = boardParts.indexOf(part);
  const array = part.lands.length === 8;
  const activity = part.board === 'interfaceB' && ['R7', 'R8', 'R9', 'R10'].includes(part.ref);
  return '<section class="panel"><p class="eyebrow">Side A v0.0 · SubPCB v0.1 · Interface v0.1</p>' +
    '<h2 tabindex="-1">Find and fit the resistors</h2><p class="intro">Choose the board and component below. Match the whole-board outline, then use the numbered close-up to find the exact solder pads.</p>' +
    '<div class="resistor-selectors"><div><label class="field" for="resistor-board">Which BuildR board?</label><select id="resistor-board">' +
    [['sideA', 'Side A PCB · 4 resistor arrays'], ['interfaceB', 'B-side Interface PCB · 15 resistor components']].map(([key,label]) =>
      '<option value="' + key + '"' + (part.board === key ? ' selected' : '') + '>' + label + '</option>').join('') +
    '</select></div><div><label class="field" for="resistor-part">Resistor reference and value</label><select id="resistor-part">' +
    boardParts.map(p => '<option value="' + p.id + '"' + (p === part ? ' selected' : '') + '>' + p.ref + ' · ' + p.value +
      (p.lands.length === 8 ? ' × 4 array' : '') + '</option>').join('') + '</select></div></div>' +
    '<p class="callout">Unplug the PS2 and disconnect the FC1307A while soldering or measuring resistance. These positions and values are for the board revisions listed above.</p>' +
    '<div class="resistor-layout"><div>' + resistorFigure(part, false) + '</div><div>' + resistorFigure(part, true) +
    '<div class="resistor-detail"><h3>' + part.ref + ' · ' + part.value + (array ? ' per channel' : '') + '</h3>' +
    '<dl class="facts"><dt>Board</dt><dd>' + buildrData.boards[part.board].label + '</dd><dt>Find it</dt><dd>' + part.landmark +
    '</dd><dt>Component</dt><dd>' + (array ? 'One 8-terminal package containing four isolated resistors. Fit the whole package over all eight highlighted pads.' :
      'One 2-terminal resistor. Fit its body between the two highlighted pads and solder one end to each pad.') + '</dd><dt>Purpose</dt><dd>' + part.purpose +
    '</dd><dt>Terminal pairs</dt><dd>' + resistorPairs(part) + '</dd></dl>' +
    '<p class="intro">' + (array ? 'Use a four-isolated-resistor array with the matching land pattern. A common-pin/bussed network has different internal connections. The pin numbers identify the footprint; match the purchased part’s pinout before fitting.' :
      'A standard two-terminal resistor has no polarity; either end may go to pad 1. Check the value before soldering.') + '</p>' +
    (activity || part.ref === 'R6' ? '<p class="callout">' + (activity ? 'This belongs to the activity indicator circuit. KiCad marks IC1 DNP; follow your chosen population plan for this circuit.' :
      'R6 belongs to the power indicator circuit. KiCad marks U1 DNP; confirm the power population and supply for your build.') + '</p>' : '') +
    '<p class="caption">After fitting, inspect all joints and neighboring pads. Measure across the terminal pair in Ω mode; parallel paths and copper connections can change an in-circuit reading. Array values are per channel.</p>' +
    '<div class="actions"><a class="button primary" href="#solder/' + part.group + '">Open related schematic &amp; solder tests</a></div>' +
    '<div class="actions">' + (index ? '<a class="button" href="' + resistorUrl(boardParts[index-1]) + '">← ' + boardParts[index-1].ref + '</a>' : '') +
    (index < boardParts.length-1 ? '<a class="button" href="' + resistorUrl(boardParts[index+1]) + '">Next · ' + boardParts[index+1].ref + ' →</a>' : '') +
    '</div></div></div></div>' + resistorTable(part) + '</section>' +
    '<section class="panel resistor-notes"><h3>Which labels are resistor locations?</h3><ul class="bullets">' +
    '<li><strong>Side A:</strong> RB9003, RB9004, RB9005 and RB900x1 are the four 33 Ω array bodies. The nearby names ending in -2, -4, -6 or -8 identify single wire pads.</li>' +
    '<li><strong>Interface:</strong> RB9002 is a 33 Ω array. RB9002A1, RB9003A1, RB9004A1 and RB9005A1 are 10 kΩ arrays. Check the full suffix: these are different footprints and values.</li>' +
    '<li><strong>B-side SubPCB:</strong> this revision has no two-terminal resistors or eight-terminal resistor arrays to populate. R9004, R9006 and R9025 on this PCB are single connection pads named after motherboard locations.</li></ul>' +
    '<div class="actions"><a href="#install/side-a">Side A install step</a><a href="#install/interface">Interface install step</a><a href="#install/subpcb">SubPCB install step</a></div></section>' +
    '<section class="panel resistor-notes"><h3>Motherboard resistors near the coin-cell battery</h3><p class="intro">If you are locating an original motherboard resistor, use the battery and the large IC as landmarks in the reference photo. Gusse marks 1 kΩ, 10 kΩ and 4.7 kΩ for replacing lost components. This photo is a motherboard reference; the BuildR population locations are in the maps above.</p>' +
    gusseIllustration('gusse-resistor-locations.png',768,564,'Motherboard photograph with the coin-cell battery on the left and resistor locations marked 1 kΩ, 10 kΩ and 4.7 kΩ.',
      '<a href="' + gusseSource + '">Gusse’s lost-components reference</a> · Click the photo to open it full size. Confirm the board layout before using a replacement value.') +
    '<p class="caption">For the GH-035-11 signal contacts, open the pad locator: <a href="#pads/iordy">R9006 · IORDY</a>, <a href="#pads/intrq">R9004 · INTRQ</a>, <a href="#pads/dmarq">R9025 · DMARQ</a>.</p>' +
    '<p class="caption">Placement source: the saved KiCad PCB and schematic export in <code>buildr-data.js</code>, also used by the pad locator. This is a CAD placement reference; installed-hardware verification is pending.</p></section>';
}

function resistorBounds(points) {
  return [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
}

function drawResistorMaps() {
  const part = resistorSelection(location.hash.slice(1).split('/')[1]);
  const board = buildrData.boards[part.board];
  const orient = part.board === 'sideA' ? -1 : 1;
  const project = p => [orient*p[0], orient*p[1]];
  const boardParts = resistorParts.filter(p=>p.board===part.board);
  for (const canvas of document.querySelectorAll('[data-resistor-map]')) {
    const ctx = canvas.getContext('2d'), detail = canvas.dataset.resistorMap === 'detail';
    const center = project(part.center);
    const bounds = detail ? [center[0]-5.3,center[1]-3.5,center[0]+5.3,center[1]+3.5] : resistorBounds(board.outline.flat().map(project));
    const marginX = detail ? 32 : part.board === 'sideA' ? 65 : 205;
    const marginY = detail ? 32 : 80;
    const scale = Math.min((canvas.width-2*marginX)/(bounds[2]-bounds[0]),(canvas.height-2*marginY)/(bounds[3]-bounds[1]));
    const tx=canvas.width/2-scale*(bounds[0]+bounds[2])/2, ty=canvas.height/2-scale*(bounds[1]+bounds[3])/2;
    const screen = p => {const q=project(p);return [scale*q[0]+tx,scale*q[1]+ty];};
    ctx.fillStyle='#132638'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.setTransform(scale,0,0,scale,tx,ty);
    drawPcb(ctx,board,[orient,0,0,0],false,1/scale);
    ctx.restore();
    for (const p of boardParts) {
      if (detail && p !== part) continue;
      const ps=p.lands.map(land=>screen(land.xy));
      const b=resistorBounds(ps), selected=p===part;
      const padWidth=Math.max(...p.lands.map(p=>p.size[0]))*scale/2;
      const padHeight=Math.max(...p.lands.map(p=>p.size[1]))*scale/2;
      ctx.strokeStyle=selected?'#ffcb64':'#8faac0';ctx.lineWidth=selected?4:1.5;
      ctx.strokeRect(b[0]-padWidth-5,b[1]-padHeight-5,b[2]-b[0]+padWidth*2+10,b[3]-b[1]+padHeight*2+10);
      if (selected) {
        // Body spans the gap between terminal rows, rather than a single copper pad.
        const horizontal=b[2]-b[0]>b[3]-b[1];
        const horizontalRows=new Set(p.lands.map(p=>p.xy[1])).size===2;
        const body = p.lands.length===2 ? [b[0]+(horizontal?padWidth: -padWidth*.6),b[1]+(horizontal?-padHeight*.6:padHeight),
          Math.max(8,b[2]-b[0]-(horizontal?2*padWidth:-padWidth*1.2)),Math.max(8,b[3]-b[1]-(horizontal?-padHeight*1.2:2*padHeight))] :
          [b[0]+(horizontalRows?-padWidth*.7:padWidth*.7), b[1]+(horizontalRows?padHeight*.7:-padHeight*.7),
            b[2]-b[0]+(horizontalRows?padWidth*1.4:-padWidth*1.4),b[3]-b[1]+(horizontalRows?-padHeight*1.4:padHeight*1.4)];
        ctx.fillStyle='rgba(104,180,250,.26)';ctx.fillRect(...body);ctx.strokeStyle='#8fceff';ctx.lineWidth=2;ctx.strokeRect(...body);
        if(detail) for (let i=0;i<ps.length;i++) {
          const [x,y]=ps[i], pad=p.lands[i];
          const dx=ps[i][0]-(b[0]+b[2])/2,dy=ps[i][1]-(b[1]+b[3])/2;
          const verticalRows=p.lands.length===8 ? horizontalRows : !horizontal;
          const lx=x+(verticalRows?0:(dx<0?-1:1)*(padWidth+21));
          const ly=y+(verticalRows?(dy<0?-1:1)*(padHeight+24):0);
          ctx.font='bold 22px Consolas, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.lineWidth=5;ctx.strokeStyle='#132638';ctx.strokeText(pad.pin,lx,ly);ctx.fillStyle='#fff3cc';ctx.fillText(pad.pin,lx,ly);
        }
      }
    }
    // Leaders and spaced callouts keep references legible at whole-board scale.
    if(!detail) {
      const columns = part.board==='sideA' ? [boardParts] : [boardParts.filter(p=>p.center[0]<147),boardParts.filter(p=>p.center[0]>=147)];
      columns.forEach((items,col)=>{
        const sorted=items.map(p=>({p,xy:screen(p.center)})).sort((a,b)=>a.xy[1]-b.xy[1]);
        let last=-Infinity;
        sorted.forEach(({p,xy},i)=>{
          let x,y;
          if(part.board==='sideA') {x=screen(p.center)[0];y=canvas.height-40-(i%2)*46;}
          else {x=col===0?20:canvas.width-20;y=Math.max(45,xy[1],last+31);last=y;}
          const endX=part.board==='sideA'?x:col===0?190:canvas.width-190;
          ctx.strokeStyle=p===part?'#ffcb64':'#9db6ca';ctx.lineWidth=p===part?3:1.5;
          ctx.beginPath();ctx.moveTo(...xy);ctx.lineTo(endX,y);ctx.stroke();
          ctx.textAlign=part.board==='sideA'?'center':col===0?'left':'right';ctx.textBaseline='middle';
          ctx.font='bold '+(part.board==='sideA'?24:22)+'px Consolas, monospace';
          const label=p.ref;const w=ctx.measureText(label).width;
          const left=ctx.textAlign==='center'?x-w/2:ctx.textAlign==='right'?x-w:x;
          ctx.fillStyle='#132638';ctx.fillRect(left-4,y-16,w+8,32);ctx.fillStyle=p===part?'#ffcb64':'#e8f3fc';ctx.fillText(label,x,y);
        });
      });
      ctx.fillStyle='#bcd0e1';ctx.font='20px system-ui';ctx.textAlign='center';
      ctx.fillText(part.board==='sideA'?'Wire breakout pads ↑':'Signal end ↑',canvas.width/2,28);
      if(part.board==='interfaceB')ctx.fillText('LED pads ↓',canvas.width/2,canvas.height-25);
    } else {
      // Mark nearby physical copper landmarks using the exact exported pad positions.
      const seen=new Set([part.ref]);let labels=[];
      for(const pad of board.pads) {
        if(!pad.front||seen.has(pad.ref))continue;
        const [x,y]=screen(pad.xy);
        if(x<90||x>canvas.width-90||y<40||y>canvas.height-40)continue;
        const relevant=part.board==='sideA'?pad.ref.startsWith(part.ref.replace(/x1$/,'x')+'-'):/^(U1|IC1|Q1|D1|D2|R\d+|RB900\dA1|RB9002-\d)$/.test(pad.ref);
        if(!relevant)continue;
        if(Math.hypot(x-canvas.width/2,y-canvas.height/2)<130)continue;
        if(labels.some(q=>Math.hypot(q[0]-x,q[1]-y)<75))continue;
        seen.add(pad.ref);labels.push([x,y]);ctx.textAlign='center';ctx.font='18px Consolas, monospace';
        ctx.strokeStyle='#132638';ctx.lineWidth=5;ctx.strokeText(pad.ref,x,y-26);ctx.fillStyle='#c6e4f4';ctx.fillText(pad.ref,x,y-26);
      }
      ctx.fillStyle='rgba(19,38,56,.94)';ctx.fillRect(12,7,315,38);
      ctx.fillStyle='#ffcb64';ctx.textAlign='left';ctx.font='bold 24px Consolas, monospace';ctx.fillText(part.ref+' · '+part.value,22,31);
    }
  }
}

document.addEventListener('change', event => {
  if(event.target.id==='resistor-board')location.hash=resistorUrl(resistorParts.find(p=>p.board===event.target.value));
  if(event.target.id==='resistor-part')location.hash='#resistors/'+event.target.value;
});
