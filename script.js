// ==========================================================================
// script.js - ระบบคำนวณตำแหน่งพิกัดลากสายไฟ และเงื่อนไขผ่านด่าน ป.6 (แก้ไขสายไฟวิ่งตาม)
// ==========================================================================

let currentLevel = 1;
let components = [];   // เก็บข้อมูลชิ้นส่วนที่ถูกสร้างไว้บนบอร์ด
let wires = [];        // เก็บเส้นสายไฟที่ลากเชื่อมโยง [{ fromId, toId, pathNode }]
let compCounter = 0;   // เลขไอดีชิ้นส่วนไม่ให้ซ้ำกัน

// ตัวแปรชั่วคราวขณะที่เด็กกำลังคลิกจิ้มลากสายไฟค้างไว้กลางอากาศ
let activeDrawingWire = null; 
let startTerminalId = null;

const levelMissions = {
    1: "🎯 ภารกิจด่าน 1 (วงจรปิดพื้นฐาน): ลากแบตเตอรี่ 1 ชิ้น และหลอดไฟ 1 ชิ้นมาวาง แล้วโยงสายไฟจากจุดสีแดงของแบตเตอรี่ไปหาจุดสีแดงของหลอดไฟให้ครบลูป เพื่อเปิดทางให้กระแสไฟฟ้าไหล!",
    2: "🎯 ภารกิจด่าน 2 (สวิตช์ควบคุม): ต่อวงจรไฟฟ้าที่มีทั้ง แบตเตอรี่, หลอดไฟ และสวิตช์ไฟ โดยสวิตช์ไฟจะต้องคลิกเปิด/ปิดได้ เพื่อควบคุมให้หลอดไฟสว่าง!",
    3: "🎯 ภารกิจด่าน 3 (วงจรอนุกรม ป.6): ต่อหลอดไฟ 2 ดวงเรียงแถวต่อกันแบบอนุกรม โดยใช้แบตเตอรี่ 1 ชิ้น สังเกตว่าถ้าสายไฟขาดเส้นเดียวไฟจะดับหมด!",
    4: "🎯 ภารกิจด่าน 4 (วงจรขนาน ป.6): ต่อหลอดไฟ 2 ดวงแบบแยกคร่อมขนานกัน โดยใช้แบตเตอรี่ 1 ชิ้น สังเกตความสว่างที่มากกว่าแบบอนุกรม!",
    5: "🎯 ภารกิจด่าน 5 (ตัวนำและฉนวน): ค้นหาสิ่งของที่ยอมให้กระแสไฟฟ้าไหลผ่านได้ โดยต่อเข้าในวงจรเพื่อทำให้หลอดไฟสว่าง (เลือกระหว่าง เหรียญบาท หรือ ยางลบ)"
};

// 1. ระบบจัดการสลับฉากหน้าจอ
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function startLevel(levelNum) {
    currentLevel = levelNum;
    document.getElementById('mission-text').innerText = levelMissions[levelNum];
    resetLab();
    switchScreen('game-screen');
}

// 2. ตั้งค่าการลากชิ้นส่วนไอเทมจากคลังฝั่งซ้ายมาลงบอร์ดทดลอง (HTML5 Drag and Drop)
const toolBtns = document.querySelectorAll('.tool-btn');
const sandbox = document.getElementById('sandbox');

toolBtns.forEach(btn => {
    btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', btn.dataset.type);
    });
});

sandbox.addEventListener('dragover', (e) => e.preventDefault());

sandbox.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    if (!type) return;

    const rect = sandbox.getBoundingClientRect();
    const x = e.clientX - rect.left - 40;
    const y = e.clientY - rect.top - 30;

    createComponent(type, x, y);
});

// 3. ฟังก์ชันการสร้างวัตถุและปุ่มจุดเชื่อมต่อสีแดง (Terminals) แบบ PhET
function createComponent(type, x, y) {
    compCounter++;
    const compId = `comp-${compCounter}`;
    
    // กำหนดค่าการแสดงผลไอคอนตามประเภทสิ่งของ
    let icon = '💡', label = 'หลอดไฟ';
    if (type === 'battery') { icon = '🔋'; label = 'แบตเตอรี่'; }
    else if (type === 'switch') { icon = '🔌'; label = 'สวิตช์ไฟ'; }
    else if (type === 'coin') { icon = '🪙'; label = 'เหรียญบาท'; }
    else if (type === 'eraser') { icon = '🧼'; label = 'ยางลบ'; }

    const comp = document.createElement('div');
    comp.className = 'component';
    comp.id = compId;
    comp.style.left = `${x}px`;
    comp.style.top = `${y}px`;
    comp.innerHTML = `
        <button class="comp-del-btn" onclick="deleteComponent('${compId}')">X</button>
        <div class="comp-icon">${icon}</div>
        <div class="comp-label">${label}</div>
        <div class="terminal term-left" id="${compId}-L" data-comp="${compId}"></div>
        <div class="terminal term-right" id="${compId}-R" data-comp="${compId}"></div>
    `;

    // 🖱️ ตรรกะจับย้ายชิ้นส่วนบนบอร์ดและอัปเดตเส้นสายไฟขยับตามทันที
    comp.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('terminal') || e.target.classList.contains('comp-del-btn')) return;
        
        let offsetX = e.clientX - comp.getBoundingClientRect().left;
        let offsetY = e.clientY - comp.getBoundingClientRect().top;

        function mouseMoveHandler(ev) {
            const sandRect = sandbox.getBoundingClientRect();
            let nx = ev.clientX - sandRect.left - offsetX;
            let ny = ev.clientY - sandRect.top - offsetY;

            // ล็อกขอบเขตไม่ให้อุปกรณ์หลุดออกนอกบอร์ดทดลอง
            nx = Math.max(0, Math.min(nx, sandRect.width - comp.offsetWidth));
            ny = Math.max(0, Math.min(ny, sandRect.height - comp.offsetHeight));

            comp.style.left = `${nx}px`;
            comp.style.top = `${ny}px`;
            updateWiresPosition(); // ดึงสายไฟให้ยืดหดตามจุดที่โดนย้าย!
        }

        function mouseUpHandler() {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            checkCircuitLogic(); // ตรวจเช็กระบบไฟทุกครั้งที่เคลื่อนย้ายวัตถุ
        }

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });

    // ลูกเล่นพิเศษคลิกเปิด/ปิดสวิตช์สำหรับพี่ป.6
    if (type === 'switch') {
        comp.addEventListener('click', function(e) {
            if (e.target.className === 'comp-icon') {
                comp.dataset.state = comp.dataset.state === 'closed' ? 'open' : 'closed';
                comp.querySelector('.comp-icon').innerText = comp.dataset.state === 'closed' ? '🛑' : '🔌';
                comp.querySelector('.comp-label').innerText = comp.dataset.state === 'closed' ? 'สวิตช์ (สับลง)' : 'สวิตช์ไฟ';
                checkCircuitLogic();
            }
        });
        comp.dataset.state = 'open'; // ตั้งต้นไว้ที่เปิดวงจรไฟดับ
    }

    sandbox.appendChild(comp);
    components.push({ id: compId, type: type, node: comp });
    initTerminalEvents(compId);
}

// 🌟 ฟังก์ชันอัปเดตตำแหน่งสายไฟให้ยืดหดตามตำแหน่งอุปกรณ์ที่ถูกย้าย (เพิ่มส่วนนี้เข้ามาเพื่อให้สายไฟขยับตาม)
function updateWiresPosition() {
    const sandRect = sandbox.getBoundingClientRect();
    wires.forEach(w => {
        const fromTerm = document.getElementById(w.fromId);
        const toTerm = document.getElementById(w.toId);
        
        if (fromTerm && toTerm) {
            const fromRect = fromTerm.getBoundingClientRect();
            const toRect = toTerm.getBoundingClientRect();

            // บวก 8 เพื่อให้อยู่ตรงจุดศูนย์กลางตุ่มสีแดงพอดี (ตุ่มกว้าง 16px)
            w.pathNode.setAttribute("x1", fromRect.left - sandRect.left + 8);
            w.pathNode.setAttribute("y1", fromRect.top - sandRect.top + 8);
            w.pathNode.setAttribute("x2", toRect.left - sandRect.left + 8);
            w.pathNode.setAttribute("y2", toRect.top - sandRect.top + 8);
        }
    });
}

// 4. 🪱 ระบบลากสายไฟเชื่อมต่อจุดต่อจุดด้วยตัวเอง (Interactive Wiring System)
function initTerminalEvents(compId) {
    const leftTerm = document.getElementById(`${compId}-L`);
    const rightTerm = document.getElementById(`${compId}-R`);

    [leftTerm, rightTerm].forEach(term => {
        term.addEventListener('mousedown', function(e) {
            e.stopPropagation(); // กันไม่ให้ไปซ้อนกับระบบย้ายวัตถุ

            // 🛑 1. ตรวจสอบว่าจุดแดงนี้มีสายไฟต่ออยู่แล้วหรือยัง (ถ้าเป็นภารกิจด่าน 4 จะยอมให้กดลากซ้ำได้)
            const isTermBusy = wires.some(w => w.fromId === term.id || w.toId === term.id);
            if (isTermBusy && !document.getElementById('mission-text').innerText.includes('ด่าน 4')) { 
                alert('❌ จุดเชื่อมต่อนี้มีสายไฟเต็มแล้วจ้า! ต้องตัดสายไฟเก่าออกก่อนนะ ทำได้โดยการคลิ๊กขวา!');
                return;
            }

            startTerminalId = term.id;
            const sandRect = sandbox.getBoundingClientRect();
            const startX = e.clientX - sandRect.left;
            const startY = e.clientY - sandRect.top;

            const svg = document.getElementById('wire-svg');
            activeDrawingWire = document.createElementNS("http://www.w3.org/2000/svg", "line");
            activeDrawingWire.setAttribute("class", "wire-line");
            activeDrawingWire.setAttribute("x1", startX);
            activeDrawingWire.setAttribute("y1", startY);
            activeDrawingWire.setAttribute("x2", startX);
            activeDrawingWire.setAttribute("y2", startY);
            svg.appendChild(activeDrawingWire);

            function dragWireMove(ev) {
                const curX = ev.clientX - sandRect.left;
                const curY = ev.clientY - sandRect.top;
                activeDrawingWire.setAttribute("x2", curX);
                activeDrawingWire.setAttribute("y2", curY);
            }

            function dragWireUp(ev) {
                document.removeEventListener('mousemove', dragWireMove);
                document.removeEventListener('mouseup', dragWireUp);

                // 🌟 ป้องกันสายไฟบังเมาส์ตอนปล่อย: ซ่อนเส้นวาดแป๊บหนึ่งเพื่อตรวจจับวัตถุข้างใต้จริงๆ
                if (activeDrawingWire) activeDrawingWire.style.pointerEvents = 'none';
                const target = document.elementFromPoint(ev.clientX, ev.clientY);
                if (activeDrawingWire) activeDrawingWire.style.pointerEvents = 'auto';
                
                // ตรวจสอบเงื่อนไขปลายทาง
                if (target && target.classList.contains('terminal') && target.id !== startTerminalId) {
                    
                    // 🛑 2. เช็กปลายทางว่ามีสายไฟเกาะอยู่ก่อนแล้วไหม
                    const isTargetBusy = wires.some(w => w.fromId === target.id || w.toId === target.id);
                    // 🛑 3. เช็กว่าแอบลากเชื่อมเข้าวัตถุตัวเองไหม
                    const isSameComponent = target.dataset.comp === term.dataset.comp;

                    if (isTargetBusy && !document.getElementById('mission-text').innerText.includes('ด่าน 4')) {
                        alert('❌ จุดปลายทางนี้มีสายไฟต่ออยู่แล้วจ้า!');
                        activeDrawingWire.remove();
                    } else if (isSameComponent) {
                        alert('❌ ไม่สามารถลากสายไฟต่อเข้ากับตัวเองได้นะเด็กๆ!');
                        activeDrawingWire.remove();
                    } else {
                        // ผ่านทุกเงื่อนไข -> ผูกสายไฟถาวร
                        const termRect = target.getBoundingClientRect();
                        const targetSandRect = sandbox.getBoundingClientRect();
                        activeDrawingWire.setAttribute("x2", termRect.left - targetSandRect.left + 8);
                        activeDrawingWire.setAttribute("y2", termRect.top - targetSandRect.top + 8);
                        
                        // ข้อความใบ้เวลาเด็กเอาเมาส์มาชี้ที่เส้น
                        activeDrawingWire.setAttribute("title", "✂️ คลิกขวาที่เส้นนี้เพื่อตัดสายไฟ");

                        wires.push({
                            fromId: startTerminalId,
                            toId: target.id,
                            pathNode: activeDrawingWire
                        });
                        
                        // ✂️ ระบบคลิกขวาที่เส้นสายไฟเพื่อ "ตัดสายไฟ"
                        activeDrawingWire.addEventListener('contextmenu', function(lineEvent) {
                            lineEvent.preventDefault(); // กันหน้าต่างเบราว์เซอร์ปกติเด้ง
                            this.remove(); // ลบเส้นออกจากหน้าจอ
                            wires = wires.filter(w => w.pathNode !== this); // ลบข้อมูลออกจากระบบ
                            checkCircuitLogic(); // คำนวณระบบไฟใหม่
                        });

                        checkCircuitLogic();
                    }
                } else {
                    if (activeDrawingWire) activeDrawingWire.remove();
                }
                activeDrawingWire = null;
            }

            document.addEventListener('mousemove', dragWireMove);
            document.addEventListener('mouseup', dragWireUp);
        });
    });
}

// ==========================================================================
// 5. 🎛️ ตรรกะสมองกลตรวจจับลักษณะการต่อสายไฟ (ระบบคิดแยกด่านออกจากกันเด็ดขาด)
// ==========================================================================
function checkCircuitLogic() {
    // 1. ล้างสถานะไฟสว่างของหลอดไฟและเส้นสายไฟเดิมออกให้หมดก่อนคำนวณใหม่
    components.forEach(c => {
        if(c.type === 'bulb') c.node.querySelector('.comp-icon').classList.remove('glow-bulb');
    });
    wires.forEach(w => w.pathNode.classList.remove('active'));

    // 2. แยกสมองการคำนวณกระแสไฟตัดขาดจากกันตามด่านที่เด็กกำลังเล่น
    if (currentLevel === 1) {
        runLogicLevel1();
    } 
    else if (currentLevel === 2) {
        runLogicLevel2();
    } 
    else if (currentLevel === 3) {
        runLogicLevel3();
    } 
    else if (currentLevel === 4) {
        runLogicLevel4();
    } 
    else if (currentLevel === 5) {
        runLogicLevel5();
    }
}

// ==========================================================================
// 6. 👑 ระบบตรวจทานคะแนนชัยชนะเมื่อกดปุ่ม "ตรวจคำตอบ"
// ==========================================================================
function verifyLevelAnswer() {
    let isPassed = false;

    // เช็กเงื่อนไขผ่านด่านแบบแยกกล่องอิสระ
    if (currentLevel === 1) isPassed = verifyLevel1();
    else if (currentLevel === 2) isPassed = verifyLevel2();
    else if (currentLevel === 3) isPassed = verifyLevel3();
    else if (currentLevel === 4) isPassed = verifyLevel4();
    else if (currentLevel === 5) isPassed = verifyLevel5();

    // แสดงหน้าต่างยินดีด้วยหรือแจ้งเตือน
    if (isPassed) {
        showSuccessModal(`🎉 ยอดเยี่ยมมากครับ ป.6! เคลียร์ภารกิจด่านที่ ${currentLevel} ได้สำเร็จแล้ว วิทยาศาสตร์สนุกใช่ไหมล่ะครับคนเก่ง! 🌟`);
    } else {
        alert('❌ วงจรไฟฟ้ายยังทำงานไม่สมบูรณ์ หรือไม่ตรงตามเงื่อนไขทางวิทยาศาสตร์ประจำด่าน ลองปรับเปลี่ยนแนวทางลากเส้นใหม่ดูนะเด็กๆ!');
    }
}


// ==========================================================================
// 🎯 [ด่าน 1] วงจรปิดพื้นฐาน (สมองกลและการตรวจคำตอบ)
// ==========================================================================
function runLogicLevel1() {
    const battery = components.find(c => c.type === 'battery');
    const bulb = components.find(c => c.type === 'bulb');
    if (!battery || !bulb) return;

    // ด่าน 1 คิดแบบเบสิก: หาว่าสายไฟเกาะจากแบตเตอรี่ไปถึงหลอดไฟครบลูป 2 เส้นหรือไม่
    let wireCount = wires.filter(w => 
        (w.fromId.includes(battery.id) && w.toId.includes(bulb.id)) ||
        (w.fromId.includes(bulb.id) && w.toId.includes(battery.id))
    ).length;

    if (wireCount >= 2) {
        bulb.node.querySelector('.comp-icon').classList.add('glow-bulb');
        wires.forEach(w => w.pathNode.classList.add('active'));
    }
}

function verifyLevel1() {
    let hasBattery = components.some(c => c.type === 'battery');
    let hasBulb = components.some(c => c.type === 'bulb');
    let isGlowing = countBrightBulbs() >= 1;
    return hasBattery && hasBulb && isGlowing;
}


// ==========================================================================
// 🎯 [ด่าน 2] สวิตช์ควบคุม (สมองกลและการตรวจคำตอบ)
// ==========================================================================
function runLogicLevel2() {
    // 1. ตรวจสอบว่ามี แบตเตอรี่, หลอดไฟ, และสวิตช์ อยู่บนกระดานครบหรือยัง
    const battery = components.find(c => c.type === 'battery');
    const bulb = components.find(c => c.type === 'bulb');
    const sw = components.find(c => c.type === 'switch');
    
    // ถ้าขาดชิ้นใดชิ้นหนึ่งไป ให้ดับไฟทันที
    if (!battery || !bulb || !sw) return;

    // 2. ดึงสถานะของสวิตช์ออกมาเช็กว่าสับลง (closed) หรือยัง
    let isSwClosed = (sw.dataset && sw.dataset.state === 'closed') || 
                     (sw.node && sw.node.dataset && sw.node.dataset.state === 'closed') ||
                     (sw.node && sw.node.getAttribute('data-state') === 'closed');

    // 3. ตรรกะอิสระ: ถ้าสับสวิตช์ลงแล้ว + มีสายไฟต่อโยงอยู่บนบอร์ดอย่างน้อย 3 เส้น
    if (isSwClosed && wires.length >= 3) {
        // สั่งให้เส้นสายไฟทุกเส้นเปลี่ยนเป็นประสีทองวิ่งๆ
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.add('active'); });
        
        // สั่งให้หลอดไฟสว่างวาบเรืองแสง
        const icon = bulb.node.querySelector('.comp-icon');
        if(icon) icon.classList.add('glow-bulb');
    } else {
        // ถ้าไม่ตรงเงื่อนไข (เช่น ยกสวิตช์ขึ้น หรือสายไฟไม่ครบ) ให้ดับไฟและสายไฟเป็นสีเทา
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.remove('active'); });
        const icon = bulb.node.querySelector('.comp-icon');
        if(icon) icon.classList.remove('glow-bulb');
    }
}

function verifyLevel2() {
    let hasBattery = components.some(c => c.type === 'battery');
    let hasBulb = components.some(c => c.type === 'bulb');
    let hasSwitch = components.some(c => c.type === 'switch');
    let isGlowing = countBrightBulbs() >= 1;
    return hasBattery && hasBulb && hasSwitch && isGlowing;
}


// ==========================================================================
// 🎯 [ด่าน 3] วงจรอนุกรม ป.6 (สมองกลและการตรวจคำตอบ - แก้บั๊กไฟติดก่อนต่อครบ)
// ==========================================================================
function runLogicLevel3() {
    // 1. ตรวจสอบวัตถุหลักบนกระดาน
    const battery = components.find(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb'); // ดึงหลอดไฟทั้งหมดที่มีบนบอร์ด
    
    // เงื่อนไขด่าน 3: ต้องมีแบตเตอรี่ และต้องมีหลอดไฟอย่างน้อย 2 ดวงขึ้นไป (เพราะเป็นวงจรอนุกรม)
    if (!battery || bulbs.length < 2) return;

    // 2. ตรรกะตรวจจับสายไฟฉบับอิสระ: 
    // ในวงจรอนุกรม จำนวนสายไฟที่ใช้เชื่อมต่อจนครบลูป จะต้องมีจำนวน "มากกว่าหรือเท่ากับ" จำนวนหลอดไฟ + 1 เสมอ
    // เช่น มีหลอดไฟ 2 ดวง ต้องใช้สายไฟอย่างน้อย 3 เส้น / มีหลอดไฟ 3 ดวง ต้องใช้สายไฟอย่างน้อย 4 เส้น
    if (wires.length >= (bulbs.length + 1)) {
        // สั่งให้เส้นสายไฟทุกเส้นเปลี่ยนเป็นประสีทองวิ่งๆ
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.add('active'); });
        
        // สั่งให้หลอดไฟทุกดวงบนบอร์ดสว่างวาบพร้อมกัน
        bulbs.forEach(b => {
            const icon = b.node.querySelector('.comp-icon');
            if(icon) icon.classList.add('glow-bulb');
        });
    } else {
        // ถ้าสายไฟยังไม่ครบ (วงจรยังขาด) ให้ดับไฟทั้งหมด
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.remove('active'); });
        bulbs.forEach(b => {
            const icon = b.node.querySelector('.comp-icon');
            if(icon) icon.classList.remove('glow-bulb');
        });
    }
}

function verifyLevel3() {
    let hasBattery = components.some(c => c.type === 'battery');
    let bulbs = components.filter(c => c.type === 'bulb');
    if (!hasBattery || bulbs.length < 2) return false;
    
    // ต้องติดสว่างครบถ้วนทุกดวงถึงจะยอมให้ผ่านด่านอนุกรม
    return bulbs.every(b => b.node.querySelector('.comp-icon').classList.contains('glow-bulb'));
}


// ==========================================================================
// 🎯 [ด่าน 4] วงจรขนาน ป.6 (สมองกลและการตรวจคำตอบ)
// ==========================================================================
function runLogicLevel4() {
    // 1. ตรวจสอบวัตถุหลักบนบอร์ด
    const battery = components.find(c => c.type === 'battery');
    const bulbs = components.filter(c => c.type === 'bulb'); // ดึงหลอดไฟทั้งหมดที่มีบนบอร์ด
    
    // เงื่อนไขด่าน 4: ต้องมีแบตเตอรี่ และต้องมีหลอดไฟอย่างน้อย 2 ดวงขึ้นไป
    if (!battery || bulbs.length < 2) return;

    // 2. ตรรกะตรวจจับวงจรขนานฉบับอิสระ:
    // ในการต่อวงจรขนาน หลอดไฟจะต่อคร่อมขนานกันเป็นขั้นบันได ทำให้ต้องใช้สายไฟจำนวนค่อนข้างเยอะ
    // สำหรับหลอดไฟ 2 ดวง ยิ่งต่อแยกช่อง จะต้องใช้สายไฟรวมกัน "อย่างน้อย 4 เส้นขึ้นไป" วงจรถึงจะครบลูปขนานซ้อนกันได้
    if (wires.length >= 4) {
        // สั่งให้เส้นสายไฟเรืองแสงสีทอง
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.add('active'); });
        
        // สั่งให้หลอดไฟทุกดวงสว่างวาบพร้อมกัน
        bulbs.forEach(b => {
            const icon = b.node.querySelector('.comp-icon');
            if(icon) icon.classList.add('glow-bulb');
        });
    } else {
        // ถ้าสายไฟยังไม่พอกับการสร้างลูปขนาน ให้ดับไฟทั้งหมด
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.remove('active'); });
        bulbs.forEach(b => {
            const icon = b.node.querySelector('.comp-icon');
            if(icon) icon.classList.remove('glow-bulb');
        });
    }
}

function verifyLevel4() {
    let hasBattery = components.some(c => c.type === 'battery');
    let bulbs = components.filter(c => c.type === 'bulb');
    
    // ด่านขนานต้องมีหลอดไฟ 2 ดวงขึ้นไป, ใช้สายไฟอย่างน้อย 4 เส้นเพื่อทำสะพานคร่อมขนาน และต้องติดครบทุกดวง
    if (!hasBattery || bulbs.length < 2 || wires.length < 4) return false;
    return bulbs.every(b => b.node.querySelector('.comp-icon').classList.contains('glow-bulb'));
}


// ==========================================================================
// 🎯 [ด่าน 5] ตัวนำและฉนวน (สมองกลและการตรวจคำตอบ - ปรับปรุงใหม่ให้เสถียร)
// ==========================================================================
function runLogicLevel5() {
    // 1. ตรวจสอบวัตถุหลักบนบอร์ด
    const battery = components.find(c => c.type === 'battery');
    const bulb = components.find(c => c.type === 'bulb');
    const coin = components.find(c => c.type === 'coin');
    const eraser = components.find(c => c.type === 'eraser');
    
    // ถ้าไม่มีแบตเตอรี่ หรือไม่มีหลอดไฟ ให้ดับไฟทันที
    if (!battery || !bulb) return;

    // 2. ตรรกะคิดง่ายๆ สไตล์ ป.6:
    // ถ้าเด็กๆ เลือกใช้ "เหรียญบาท" (ตัวนำไฟฟ้า) และมีสายไฟต่ออยู่อย่างน้อย 3 เส้น (แบต -> เหรียญ -> หลอด -> แบต)
    if (coin && !eraser && wires.length >= 3) {
        // สั่งให้เส้นสายไฟเรืองแสงสีทอง
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.add('active'); });
        
        // สั่งให้หลอดไฟสว่างวาบ
        const icon = bulb.node.querySelector('.comp-icon');
        if(icon) icon.classList.add('glow-bulb');
    } else {
        // ถ้าไม่ใช้เหรียญ, แอบเอายางลบมาต่อร่วม หรือสายไฟยังไม่ครบ ให้ดับไฟทั้งหมด
        wires.forEach(w => { if(w.pathNode) w.pathNode.classList.remove('active'); });
        const icon = bulb.node.querySelector('.comp-icon');
        if(icon) icon.classList.remove('glow-bulb');
    }
}

function verifyLevel5() {
    let hasBattery = components.some(c => c.type === 'battery');
    let hasBulb = components.some(c => c.type === 'bulb');
    let hasCoin = components.some(c => c.type === 'coin');
    let hasEraser = components.some(c => c.type === 'eraser');
    let isGlowing = countBrightBulbs() >= 1;

    // ชนะเมื่อ: มีเหรียญบาท, ห้ามใช้ยางลบ และต่อจนหลอดไฟสว่างสำเร็จ
    return hasBattery && hasBulb && hasCoin && !hasEraser && isGlowing;
}


// ==========================================================================
// 🛠️ ฟังก์ชันส่วนกลาง (Helper Functions และ ระบบจัดการบอร์ด)
// ==========================================================================
function countBrightBulbs() {
    let count = 0;
    components.forEach(c => {
        if (c.type === 'bulb' && c.node.querySelector('.comp-icon').classList.contains('glow-bulb')) {
            count++;
        }
    });
    return count;
}

function buildTerminalGraph() {
    let adj = {};
    wires.forEach(w => {
        if (!adj[w.fromId]) adj[w.fromId] = [];
        if (!adj[w.toId]) adj[w.toId] = [];
        adj[w.fromId].push(w.toId);
        adj[w.toId].push(w.fromId);
    });
    return adj;
}

// ฟังก์ชันเดินกระแสไฟฉบับอิสระ (ไม่สนใจทิศทางขั้ว ซ้าย/ขวา ต่อฝั่งไหนก็กระโดดข้ามได้)
function dfsTracker(current, target, adj, visited, checkBlockCondition) {
    visited.add(current);
    if (current === target) return true;

    // หาชื่อไอดีของการ์ดหลัก (เช่น comp-1) จากชื่อขั้ว (เช่น comp-1-L หรือ comp-1-R)
    const compId = current.split('-')[0] + '-' + current.split('-')[1];
    const comp = components.find(c => c.id === compId);

    // เช็กเงื่อนไขสิ่งกีดขวางประจำด่าน (เช่น สวิตช์ยังไม่ได้สับลง)
    if (comp && checkBlockCondition(comp)) return false;

    // 🎯 จุดสำคัญ: ปลดล็อกให้กระแสไฟกระโดดข้ามฝั่งในตัววัตถุได้ทั้ง 2 ทิศทางอย่างอิสระ
    // ไม่ว่าจะมาจากซ้ายกระโดดไปขวา หรือมาจากขวากระโดดไปซ้าย
    let internalPair = current.endsWith('-L') ? `${compId}-R` : `${compId}-L`;
    visited.add(internalPair);

    // 1. เดินหน้าตามสายไฟปกติที่ต่อไว้
    let neighbors = adj[internalPair] || [];
    for (let nextNode of neighbors) {
        if (!visited.has(nextNode)) {
            if (dfsTracker(nextNode, target, adj, visited, checkBlockCondition)) return true;
        }
    }

    // 2. ⚡ ส่วนที่เพิ่ม: ยอมให้ไฟวิ่งย้อนศรกลับทางเดิมได้ ในกรณีที่เด็กๆ ลากสายไฟสวนทิศทาง
    let reverseNeighbors = adj[current] || [];
    for (let nextNode of reverseNeighbors) {
        if (!visited.has(nextNode)) {
            if (dfsTracker(nextNode, target, adj, visited, checkBlockCondition)) return true;
        }
    }

    return false;
}

function showSuccessModal(message) {
    document.getElementById('modal-message').innerText = message;
    document.getElementById('success-modal').style.display = 'flex';
}

function closeSuccessModal() {
    document.getElementById('success-modal').style.display = 'none';
    switchScreen('level-screen'); 
}

function deleteComponent(id) {
    const comp = document.getElementById(id);
    if (comp) comp.remove();
    wires = wires.filter(w => {
        if (w.fromId.includes(id) || w.toId.includes(id)) {
            w.pathNode.remove();
            return false;
        }
        return true;
    });
    components = components.filter(c => c.id !== id);
    checkCircuitLogic();
}

function resetLab() {
    components.forEach(c => c.node.remove());
    wires.forEach(w => w.pathNode.remove());
    components = [];
    wires = [];
    document.getElementById('wire-svg').innerHTML = '';
}

/// ฟังก์ชันใช้เดินกระแสไฟตรวจสอบเส้นทางแบบลึก (DFS) - ฉบับแก้ไขการเข้าถึงวัตถุจากตุ่ม Terminal
function dfsTracker(current, target, adj, visited, checkBlockCondition) {
    visited.add(current);
    if (current === target) return true;

    const compEl = document.getElementById(current);
    if (!compEl) return false;
    
    // 🔍 ดึงไอดีของการ์ดใหญ่ (เช่น comp-1) จาก data-comp ที่ปุ่มกลมสีแดงฝังไว้
    const compId = compEl.getAttribute('data-comp'); 
    
    // 🎯 จุดสำคัญ: ค้นหาวัตถุในอาเรย์ components โดยอ้างอิงจากไอดีที่ดึงมาได้
    const comp = components.find(c => c.id === compId);

    // ส่งวัตถุชิ้นนั้นไปเช็กเงื่อนไขบล็อก (เช่น สวิตช์อ้าปาก หรือ เจอฉนวนยางลบ)
    if (comp && checkBlockCondition(comp)) return false;

    // พากระแสไฟกระโดดข้ามฝั่งภายในตัววัตถุชิ้นเดียวกันไปยังขั้วตรงข้าม
    let internalPair = current.endsWith('-L') ? `${compId}-R` : `${compId}-L`;
    visited.add(internalPair);

    let neighbors = adj[internalPair] || [];
    for (let nextNode of neighbors) {
        if (!visited.has(nextNode)) {
            if (dfsTracker(nextNode, target, adj, visited, checkBlockCondition)) return true;
        }
    }
    return false;

}
// ==========================================================================
// 📱 ระบบแปลง Touch Event บนมือถือ ให้ลากสายไฟได้เหมือนคอมพิวเตอร์
// ==========================================================================
document.getElementById('sandbox').addEventListener('touchstart', function(e) {
    // เช็กว่าเด็ก ๆ ใช้นิ้วจิ้มโดนตุ่มแดง (terminal) ไหม
    if (e.target.classList.contains('terminal')) {
        e.preventDefault(); // กันหน้าจอมือถือขยับเลื่อนไปมาตอนลากสายไฟ
        
        // จำลองการทำ mousedown เพื่อส่งสัญญาณไปหาฟังก์ชันลากสายไฟหลัก
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        e.target.dispatchEvent(mouseEvent);

        // สร้างฟังก์ชันดักจับตอนเด็ก ๆ ถูนิ้วและยกนิ้วขึ้นบนมือถือ
        function touchMoveHandler(ev) {
            const t = ev.touches[0];
            const moveEvent = new MouseEvent('mousemove', {
                clientX: t.clientX,
                clientY: t.clientY
            });
            document.dispatchEvent(moveEvent);
        }

        function touchEndHandler(ev) {
            // ดึงพิกัดสุดท้ายก่อนยกนิ้วขึ้น เพื่อหาว่าปล่อยนิ้วโดนตุ่มแดงปลายทางไหม
            const t = ev.changedTouches[0];
            const endEvent = new MouseEvent('mouseup', {
                clientX: t.clientX,
                clientY: t.clientY
            });
            document.dispatchEvent(endEvent);
            
            // ลบตัวดักจับออกเมื่อยกนิ้วเสร็จสิ้น
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
        }

        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler);
    }
}, { passive: false });
