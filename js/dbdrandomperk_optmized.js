// ==========================================
// ✅ V251: Ultimate Optimized Edition (버튼 먹통 완벽 해결 & 속도업 반영)
// ==========================================

// 1. 초기 데이터 매핑
const killerNameMap = {};
if (typeof killers !== 'undefined') {
    killers.forEach(k => killerNameMap[k.id] = k.name);
}

function assignTiers(dataArray, tierDict) {
    if (!dataArray || !tierDict) return;
    dataArray.forEach(perk => {
        perk.tier = 3; 
        for (let t = 1; t <= 5; t++) {
            if (tierDict[t] && tierDict[t].includes(perk.name)) {
                perk.tier = t; 
                break;
            }
        }
    });
}

if (typeof killerPerkData !== 'undefined' && typeof killerTiers !== 'undefined') assignTiers(killerPerkData, killerTiers);
if (typeof survivorPerkData !== 'undefined' && typeof survivorTiers !== 'undefined') assignTiers(survivorPerkData, survivorTiers);

// 2. 전역 상태 변수
let currentMode = 'killer_perk'; 
let isSpinning = false;
let currentTierFilter = 'all';
let currentSpunPerks = [];

const animationContext = {
    activeIds: new Set(),
    lastTimes: {},
    currentItems: {}
};

let isRandomKiller = false;
let selectedKillers = ['trapper'];
let spinTick = 0;

// ==========================================
// 3. UI 업데이트 및 토글 함수 (HTML 바인딩)
// ==========================================
window.toggleMode = function() {
    if (isSpinning) return;
    const wrapperP = document.getElementById('perkWrapper');
    const wrapperA = document.getElementById('addonWrapper');
    
    if (currentMode === 'killer_perk') {
        currentMode = 'survivor_perk';
        if (wrapperP) wrapperP.style.display = 'flex'; 
        if (wrapperA) wrapperA.style.display = 'none';
    } else if (currentMode === 'survivor_perk') {
        currentMode = 'killer_addon';
        if (wrapperP) wrapperP.style.display = 'none'; 
        if (wrapperA) wrapperA.style.display = 'flex'; 
        renderKillerPicker();
    } else {
        currentMode = 'killer_perk';
        if (wrapperP) wrapperP.style.display = 'flex'; 
        if (wrapperA) wrapperA.style.display = 'none';
    }
    updateInterface();
    resetSlots();
};

window.setTierFilter = function(val) {
    if (isSpinning) return;
    currentTierFilter = val;
    document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById('btnFilter_' + val);
    if (targetBtn) targetBtn.classList.add('active');
};

function updateInterface() {
    const h1 = document.getElementById('headerTitle');
    const btn = document.getElementById('btnSpin');
    const slider = document.getElementById('speedRange');
    const status = document.getElementById('speedStatus');
    const rightPanel = document.getElementById('rightPanel');
    
    document.body.className = currentMode === 'killer_perk' ? 'mode-killer' : 'mode-survivor';
    
    if (currentMode === 'killer_addon') {
        if (h1) { h1.innerText = "🟣 KILLER ADDON 🟣"; h1.style.color = "#E040FB"; }
        if (btn) btn.className = "start-btn addon-btn"; 
        if (status) { status.style.color = "#aaa"; status.innerText = "고정"; }
        if (slider) slider.disabled = true;
        if (rightPanel) rightPanel.style.display = 'none'; 
    } else {
        const isKiller = currentMode === 'killer_perk';
        if (h1) {
            h1.innerText = isKiller ? "🩸 KILLER PERK 🩸" : "🔹 SURVIVOR PERK 🔹";
            h1.style.color = isKiller ? "#ff3333" : "#4da6ff";
        }
        if (btn) btn.className = isKiller ? "start-btn killer-btn" : "start-btn survivor-btn";
        if (status) status.style.color = isKiller ? "#ff3333" : "#4da6ff";
        if (slider) slider.disabled = false; 
        window.updateSpeedText();
        
        if (rightPanel) rightPanel.style.display = 'flex'; 
        document.querySelectorAll('.perk-bg').forEach(bg => {
            bg.src = isKiller ? "images/perk_bg.png" : "images/perk_bg_survivor.png";
        });
    }
}

window.updateSpeedText = function() {
    const slider = document.getElementById('speedRange');
    const status = document.getElementById('speedStatus');
    if (!slider || !status) return;
    const val = slider.value;
    const texts = ["동시", "빠름", "보통", "느림"];
    status.innerText = texts[val] || "보통";
};

// 4. 리셋 및 렌더링
function resetSlots() {
    const scoreDisplay = document.getElementById('averageScoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.innerText = '-';
        scoreDisplay.className = 'avg-score';
    }
    currentSpunPerks = [];
    
    animationContext.activeIds.clear();
    animationContext.lastTimes = {};
    animationContext.currentItems = {};
    
    for (let i = 1; i <= 4; i++) {
        const img = document.getElementById(`img${i}`);
        const bg = document.getElementById(`bg${i}`);
        const name = document.getElementById(`name${i}`);
        const cat = document.getElementById(`cat${i}`);
        const card = document.getElementById(`card${i}`);
        const tierBox = document.getElementById(`tierBox${i}`);

        if (img) img.style.display = 'none';
        if (bg) bg.style.display = 'none';
        if (name) name.innerText = '';
        if (cat) cat.innerText = '';
        if (card) card.className = 'perk-card';
        if (tierBox) tierBox.style.display = 'none';
    }
    
    for (let i = 1; i <= 2; i++) {
        const adImg = document.getElementById(`adImg${i}`);
        const adBg = document.getElementById(`adBg${i}`);
        const adName = document.getElementById(`adName${i}`);
        const slot = document.getElementById(`slot${i}`);

        if (adImg) adImg.style.display = 'none';
        if (adBg) adBg.style.display = 'none';
        if (adName) adName.innerText = '';
        if (slot) {
            slot.className = 'addon-slot';
            slot.classList.remove('selected', 'spinning');
        }
    }
    
    const killerImg = document.getElementById('mainKillerImg');
    if (killerImg) killerImg.classList.remove('spinning');
    
    const kName = document.getElementById('mainKillerName');
    if (kName && selectedKillers.length > 0) {
        kName.innerText = killerNameMap[selectedKillers[0]] || '';
    }
}

function renderKillerPicker() {
    const list = document.getElementById('killerListContainer');
    if (!list || list.innerHTML !== "") return; 
    if (typeof killers === 'undefined') return;

    killers.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'killer-list-btn killer-item-btn';
        btn.id = 'kbtn_' + k.id;
        btn.innerText = k.name;
        btn.onclick = () => window.selectKiller(k.id);
        list.appendChild(btn);
    });
    
    const initId = selectedKillers[0] || 'trapper';
    const initBtn = document.getElementById('kbtn_' + initId);
    if (initBtn) initBtn.classList.add('active');
    
    const killerImg = document.getElementById('mainKillerImg');
    if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + initId + ".webp";
    
    const killerName = document.getElementById('mainKillerName');
    if (killerName) killerName.innerText = killerNameMap[initId] || '';
}

window.selectAllKillers = function() {
    if (isSpinning || typeof killers === 'undefined') return;
    isRandomKiller = true;
    const rndBtn = document.getElementById('btnRandomKiller');
    if (rndBtn) rndBtn.classList.add('active');
    
    selectedKillers = killers.map(k => k.id);
    document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.add('active'));
};

window.toggleRandomKiller = function() {
    if (isSpinning) return;
    isRandomKiller = !isRandomKiller;
    const rndBtn = document.getElementById('btnRandomKiller');
    if (rndBtn) rndBtn.classList.toggle('active', isRandomKiller);
    
    if (!isRandomKiller) {
        const idToKeep = selectedKillers[0] || 'trapper';
        selectedKillers = [idToKeep];
        document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
        
        const keepBtn = document.getElementById('kbtn_' + idToKeep);
        if (keepBtn) keepBtn.classList.add('active');
        
        const killerImg = document.getElementById('mainKillerImg');
        if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + idToKeep + ".webp";
        
        const killerName = document.getElementById('mainKillerName');
        if (killerName) killerName.innerText = killerNameMap[idToKeep] || '';
    }
};

window.selectKiller = function(id) {
    if (isSpinning) return;
    
    if (isRandomKiller) {
        const idx = selectedKillers.indexOf(id);
        if (idx > -1) {
            if (selectedKillers.length > 1) { 
                selectedKillers.splice(idx, 1);
                const targetBtn = document.getElementById('kbtn_' + id);
                if (targetBtn) targetBtn.classList.remove('active');
            }
        } else {
            selectedKillers.push(id);
            const targetBtn = document.getElementById('kbtn_' + id);
            if (targetBtn) targetBtn.classList.add('active');
        }
    } else {
        selectedKillers = [id];
        document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
        
        const targetBtn = document.getElementById('kbtn_' + id);
        if (targetBtn) targetBtn.classList.add('active');
        
        const killerImg = document.getElementById('mainKillerImg');
        if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + id + ".webp";
        
        const killerName = document.getElementById('mainKillerName');
        if (killerName) killerName.innerText = killerNameMap[id] || '';
        resetSlots();
    }
};

// ==========================================
// 5. 로직 및 애니메이션 엔진 (rAF 기반)
// ==========================================
function shuffleArray(array) {
    if (!array) return [];
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function getRandomPerks(data, filterVal) {
    if (!data || data.length === 0) return [];
    if (filterVal === 'all') {
        let tempArray = [...data];
        return shuffleArray(tempArray).slice(0, 4);
    }

    let pools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    data.forEach(p => { if (pools[p.tier]) pools[p.tier].push(p); });

    let minSum = 0, maxSum = 20, targetTiers = [];
    if (filterVal === '4') { minSum = 16; maxSum = 20; targetTiers = [3, 4, 4, 5, 5]; }
    else if (filterVal === '3') { minSum = 12; maxSum = 15; targetTiers = [2, 3, 3, 4, 4]; }
    else if (filterVal === '2') { minSum = 8; maxSum = 11; targetTiers = [1, 2, 2, 3, 3]; }
    else if (filterVal === '1') { minSum = 4; maxSum = 7; targetTiers = [1, 1, 2]; }

    let attempts = 0;
    while (attempts < 2000) {
        attempts++;
        let selectedTiers = [];
        for (let i = 0; i < 4; i++) {
            selectedTiers.push(targetTiers[Math.floor(Math.random() * targetTiers.length)]);
        }
        
        let sum = selectedTiers.reduce((a, b) => a + b, 0);
        if (sum >= minSum && sum <= maxSum) {
            let combo = [];
            let usedIndices = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
            let isValid = true;
            
            for (let t of selectedTiers) {
                let pool = pools[t];
                if (!pool || pool.length === 0 || usedIndices[t].size >= pool.length) {
                    isValid = false; break;
                }
                let r;
                do { r = Math.floor(Math.random() * pool.length); } while (usedIndices[t].has(r));
                usedIndices[t].add(r);
                combo.push(pool[r]);
            }
            if (isValid) return combo;
        }
    }
    let tempArray = [...data];
    return shuffleArray(tempArray).slice(0, 4);
}

function loopAnimation(timestamp) {
    animationContext.activeIds.forEach(id => {
        if (!animationContext.lastTimes[id]) animationContext.lastTimes[id] = timestamp;
        
        if (timestamp - animationContext.lastTimes[id] >= 45) { // 45ms 간격 부드러운 스핀
            animationContext.lastTimes[id] = timestamp;
            spinTick++;

            if (id.startsWith('p')) {
                const idx = id.slice(1);
                const data = currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
                const path = currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;
                
                if (data && data.length > 0) {
                    const rnd = data[spinTick % data.length];
                    if (rnd && animationContext.currentItems[id] !== rnd.file) {
                        animationContext.currentItems[id] = rnd.file;
                        
                        const img = document.getElementById(`img${idx}`);
                        const bg = document.getElementById(`bg${idx}`);
                        const name = document.getElementById(`name${idx}`);
                        const cat = document.getElementById(`cat${idx}`);

                        if (img) { img.src = path + rnd.file; img.style.display = 'block'; }
                        if (bg) bg.style.display = 'block';
                        if (name) name.innerText = rnd.name;
                        if (cat) cat.innerText = rnd.category;
                    }
                }
            } else if (id.startsWith('a')) {
                const idx = id.slice(1);
                
                // 💡 버그 픽스: 트래퍼가 아닌 선택된 살인마 풀에서 랜덤으로 돌아가게 수정
                let spinData = [];
                let fId = 'trapper';
                if (isRandomKiller && selectedKillers.length > 0) {
                    let tempK = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
                    spinData = typeof killerAddons !== 'undefined' ? (killerAddons[tempK] || []) : [];
                    fId = tempK === 'theFirst' ? 'theFirst' : tempK;
                } else {
                    let tempK = selectedKillers[0] || 'trapper';
                    spinData = typeof killerAddons !== 'undefined' ? (killerAddons[tempK] || []) : [];
                    fId = tempK === 'theFirst' ? 'theFirst' : tempK;
                }
                
                let spinPath = typeof PATHS !== 'undefined' ? `${PATHS.ADDON}${fId}/` : '';
                
                if (spinData && spinData.length > 0) {
                    const rnd = spinData[spinTick % spinData.length];
                    if (rnd && animationContext.currentItems[id] !== rnd.file) {
                        animationContext.currentItems[id] = rnd.file;

                        const img = document.getElementById(`adImg${idx}`);
                        const bg = document.getElementById(`adBg${idx}`);
                        const name = document.getElementById(`adName${idx}`);

                        if (img) { img.src = spinPath + rnd.file; img.style.display = 'block'; }
                        if (bg && typeof PATHS !== 'undefined' && typeof rarityBgs !== 'undefined') {
                            bg.src = PATHS.ADDON_BG + rarityBgs[rnd.rarity]; 
                            bg.style.display = 'block';
                        }
                        if (name) name.innerText = rnd.name;
                    }
                }
            } else if (id === 'killer') {
                const tempId = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
                if (animationContext.currentItems[id] !== tempId) {
                    animationContext.currentItems[id] = tempId;
                    
                    const killerImg = document.getElementById('mainKillerImg');
                    const killerName = document.getElementById('mainKillerName');
                    
                    if (killerImg && typeof PATHS !== 'undefined') killerImg.src = `${PATHS.PORTRAIT}${tempId}.webp`;
                    if (killerName) killerName.innerText = killerNameMap[tempId] || '';
                }
            }
        }
    });

    if (animationContext.activeIds.size > 0) {
        requestAnimationFrame(loopAnimation);
    }
}

function startRAF(id) {
    animationContext.activeIds.add(id);
    animationContext.lastTimes[id] = 0;
    if (animationContext.activeIds.size === 1) {
        requestAnimationFrame(loopAnimation);
    }
}

function stopRAF(id) {
    animationContext.activeIds.delete(id);
    delete animationContext.lastTimes[id];
    delete animationContext.currentItems[id];
}

window.startSequence = function() {
    if (isSpinning) return;
    isSpinning = true;
    
    const spinBtn = document.getElementById('btnSpin');
    if (spinBtn) spinBtn.disabled = true;
    
    let activeData, path, type;
    let finalKillerId; 

    if (currentMode === 'killer_perk') { 
        activeData = typeof killerPerkData !== 'undefined' ? killerPerkData : []; 
        path = typeof PATHS !== 'undefined' ? PATHS.PERK_K : ''; 
        type = 'perk'; 
    } else if (currentMode === 'survivor_perk') { 
        activeData = typeof survivorPerkData !== 'undefined' ? survivorPerkData : []; 
        path = typeof PATHS !== 'undefined' ? PATHS.PERK_S : ''; 
        type = 'perk'; 
    } else { 
        type = 'addon'; 
    }

    resetSlots(); 

    if (type === 'perk') {
        const speedRangeEl = document.getElementById('speedRange');
        const speedVal = speedRangeEl ? parseInt(speedRangeEl.value) : 2;
        const currentDelay = [0, 600, 1300, 2600][speedVal];
        
        let shuffledPerks = getRandomPerks(activeData, currentTierFilter);
        currentSpunPerks = shuffledPerks;

        shuffledPerks.forEach(p => {
            if (p) new Image().src = path + p.file;
        });

        for (let i = 1; i <= 4; i++) {
            const card = document.getElementById(`card${i}`);
            if (card) card.classList.add('spinning');
            startRAF(`p${i}`);
        }

        if (speedVal === 0) { 
            setTimeout(() => {
                for (let i = 1; i <= 4; i++) stopPerk(i, shuffledPerks[i - 1], path);
                finalize();
            }, 500);
        } else { 
            let currentIdx = 1;
            const stopSequentially = () => {
                stopPerk(currentIdx, shuffledPerks[currentIdx - 1], path);
                if (currentIdx === 4) { 
                    finalize(); 
                    return; 
                }
                currentIdx++; 
                setTimeout(stopSequentially, currentDelay);
            };
            setTimeout(stopSequentially, 1000);
        }
    } else {
        // 애드온 모드
        if (isRandomKiller && selectedKillers.length > 0) {
            finalKillerId = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
        } else {
            finalKillerId = selectedKillers[0] || 'trapper';
        }
        
        if (typeof PATHS !== 'undefined') {
            new Image().src = `${PATHS.PORTRAIT}${finalKillerId}.webp`;
        }

        activeData = (typeof killerAddons !== 'undefined' && killerAddons[finalKillerId]) ? killerAddons[finalKillerId] : [];
        let folderId = finalKillerId === 'theFirst' ? 'theFirst' : finalKillerId;
        path = typeof PATHS !== 'undefined' ? `${PATHS.ADDON}${folderId}/` : '';

        let shuffled = [];
        if (activeData && activeData.length > 0) {
            shuffled = [...activeData];
            shuffleArray(shuffled);
            if (shuffled[0]) new Image().src = path + shuffled[0].file;
            if (shuffled[1]) new Image().src = path + shuffled[1].file;
        }

        if (isRandomKiller && selectedKillers.length > 0) {
            const killerImg = document.getElementById('mainKillerImg');
            if (killerImg) killerImg.classList.add('spinning');
            startRAF('killer');
        }

        for (let i = 1; i <= 2; i++) {
            const slot = document.getElementById(`slot${i}`);
            if (slot) slot.classList.add('spinning');
            startRAF(`a${i}`);
        }

        // 💡 단일 살인마 선택 시 스핀 속도 대폭 단축 (1200ms -> 700ms)
        let spinDuration = (isRandomKiller && selectedKillers.length > 1) ? 1200 : 700;

        setTimeout(() => {
            if (isRandomKiller && selectedKillers.length > 0) {
                stopRAF('killer');
                const killerImg = document.getElementById('mainKillerImg');
                if (killerImg) {
                    killerImg.classList.remove('spinning');
                    if (typeof PATHS !== 'undefined') killerImg.src = `${PATHS.PORTRAIT}${finalKillerId}.webp`;
                }
                const killerName = document.getElementById('mainKillerName');
                if (killerName) killerName.innerText = killerNameMap[finalKillerId] || '';
            } else {
                const killerName = document.getElementById('mainKillerName');
                if (killerName) killerName.innerText = killerNameMap[finalKillerId] || '';
            }

            if (!activeData || activeData.length === 0) {
                for (let i = 1; i <= 2; i++) stopRAF(`a${i}`);
                resetSlots(); 
                alert(`데이터가 없습니다.`); 
                finalize();
            } else {
                stopAddon(1, shuffled[0], path); 
                stopAddon(2, shuffled[1], path);
                finalize();
            }
        }, spinDuration); 
    }
};

function stopPerk(idx, item, path) {
    stopRAF(`p${idx}`);
    if (!item) return;

    const img = document.getElementById(`img${idx}`);
    const name = document.getElementById(`name${idx}`);
    const cat = document.getElementById(`cat${idx}`);
    const card = document.getElementById(`card${idx}`);
    const tierBox = document.getElementById(`tierBox${idx}`);
    const tierImg = document.getElementById(`tierImg${idx}`);

    if (img) { img.src = path + item.file; img.style.display = 'block'; }
    if (name) name.innerText = item.name;
    if (cat) cat.innerText = item.category;
    
    if (card) {
        card.classList.remove('spinning'); 
        card.classList.add('selected', currentMode);
    }

    const tierNum = item.tier || 3;
    if (tierImg) tierImg.src = `images/tier_logo${tierNum}.png`;
    if (tierBox) tierBox.style.display = 'block';
}

function stopAddon(idx, item, path) {
    stopRAF(`a${idx}`);
    if (!item) return;

    const img = document.getElementById(`adImg${idx}`);
    const bg = document.getElementById(`adBg${idx}`);
    const name = document.getElementById(`adName${idx}`);
    const slot = document.getElementById(`slot${idx}`);

    if (img) { img.src = path + item.file; img.style.display = 'block'; }
    if (bg && typeof PATHS !== 'undefined' && typeof rarityBgs !== 'undefined') {
        bg.src = PATHS.ADDON_BG + rarityBgs[item.rarity];
    }
    if (name) name.innerText = item.name;
    if (slot) {
        slot.classList.remove('spinning');
        slot.classList.add('selected');
    }
}

function finalize() { 
    isSpinning = false; 
    const spinBtn = document.getElementById('btnSpin');
    if (spinBtn) spinBtn.disabled = false; 
    
    if (currentMode !== 'killer_addon' && currentSpunPerks && currentSpunPerks.length === 4) {
        let avg = (Number(currentSpunPerks[0].tier || 3) + 
                   Number(currentSpunPerks[1].tier || 3) + 
                   Number(currentSpunPerks[2].tier || 3) + 
                   Number(currentSpunPerks[3].tier || 3)) / 4;
                   
        const scoreDisplay = document.getElementById('averageScoreDisplay');
        if (scoreDisplay) {
            scoreDisplay.innerText = avg.toFixed(2);
            scoreDisplay.className = `avg-score show ${currentMode === 'killer_perk' ? 'killer-score' : 'survivor-score'}`;
        }
    }
}

window.openUpdateNotes = function() {
    const modal = document.getElementById('updateModalOverlay');
    if (modal) modal.classList.add('show');
    try {
        const iframe = document.getElementById('notesIframe');
        if (iframe) iframe.contentWindow.location.reload(true);
    } catch (e) {}
};

window.closeUpdateNotes = function(event) {
    if (!event || event.target.id === 'updateModalOverlay' || event.target.className === 'close-modal') {
        const modal = document.getElementById('updateModalOverlay');
        if (modal) modal.classList.remove('show');
    }
};

document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        const modal = document.getElementById('updateModalOverlay');
        if (modal && modal.classList.contains('show')) {
            window.closeUpdateNotes();
        }
    }
});

// 💡 샌드캣님의 요청사항: 데이터 상태 표시기 추가
function validateData() {
    let kCount = typeof killers !== 'undefined' ? killers.length : 0;
    let sCount = typeof survivors !== 'undefined' ? survivors.length : 0;
    let kpCount = typeof killerPerkData !== 'undefined' ? killerPerkData.length : 0;
    let spCount = typeof survivorPerkData !== 'undefined' ? survivorPerkData.length : 0;
    let adCount = 0;
    if (typeof killerAddons !== 'undefined') {
        for (let k in killerAddons) adCount += killerAddons[k].length;
    }

    const infoArea = document.querySelector('.bottom-info-area');
    if (infoArea) {
        const dataDash = document.createElement('div');
        dataDash.style.fontSize = '11px';
        dataDash.style.color = 'rgba(255,255,255,0.3)';
        dataDash.style.marginTop = '5px';
        // 텍스트 깨짐 방지를 위해 백틱 안에 직접 입력합니다.
        dataDash.innerText = "K:" + kCount + " | S:" + sCount + " | KP:" + kpCount + " | SP:" + spCount + " | AD:" + adCount;
        infoArea.appendChild(dataDash);
    }
}

// 초기화 시작 (안전성 보장)
window.addEventListener('DOMContentLoaded', () => {
    try {
        renderKillerPicker();
        updateInterface();
        validateData(); // V251 데이터 무결성 검증기 활성화
    } catch (e) {
        console.error("UI 초기화 중 에러 발생:", e);
    }
});