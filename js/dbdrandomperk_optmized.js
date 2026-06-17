// ==========================================
// ✅ V252: Zero-Lag Ultimate Edition (완벽한 무반동/무렉 스핀 엔진 탑재)
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

// 💡 스핀 전용 풀 (렉 원천 차단용)
let currentSpinPools = {}; 

let isRandomKiller = false;
let selectedKillers = ['trapper'];
let spinTick = 0;

// ==========================================
// 🚀 모든 이미지 백그라운드 스텔스 로딩 (렉 완전 제거)
// ==========================================
function preloadImagesSequentially() {
    if(typeof PATHS === 'undefined') return;
    const allImgs = [];
    
    if (typeof killerPerkData !== 'undefined') killerPerkData.forEach(p => allImgs.push(PATHS.PERK_K + p.file));
    if (typeof survivorPerkData !== 'undefined') survivorPerkData.forEach(p => allImgs.push(PATHS.PERK_S + p.file));
    if (typeof killers !== 'undefined') killers.forEach(k => allImgs.push(PATHS.PORTRAIT + k.id + '.webp'));
    
    if (typeof killerAddons !== 'undefined') {
        Object.keys(killerAddons).forEach(k => {
            let fId = k === 'theFirst' ? 'theFirst' : k;
            killerAddons[k].forEach(ad => allImgs.push(`${PATHS.ADDON}${fId}/${ad.file}`));
        });
    }

    let index = 0;
    function loadNext() {
        if (index >= allImgs.length) return;
        const img = new Image();
        img.src = allImgs[index];
        index++;
        setTimeout(loadNext, 15); // 0.015초 간격으로 사용자 모르게 백그라운드 다운로드
    }
    loadNext();
}

// ==========================================
// 3. UI 업데이트 및 토글 함수
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
// 5. 로직 및 애니메이션 엔진
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

// ✨ 무반동 애니메이션 엔진
function loopAnimation(timestamp) {
    animationContext.activeIds.forEach(id => {
        if (!animationContext.lastTimes[id]) animationContext.lastTimes[id] = timestamp;
        
        // 45ms 마다 매우 부드럽고 가볍게 업데이트 (DOM 변경 최소화)
        if (timestamp - animationContext.lastTimes[id] >= 45) { 
            animationContext.lastTimes[id] = timestamp;
            spinTick++;

            const pool = currentSpinPools[id];
            if (!pool || pool.length === 0) return;

            if (id === 'killer') {
                const tempId = pool[spinTick % pool.length];
                if (animationContext.currentItems[id] !== tempId) {
                    animationContext.currentItems[id] = tempId;
                    document.getElementById('mainKillerImg').src = `${PATHS.PORTRAIT}${tempId}.webp`;
                    document.getElementById('mainKillerName').innerText = killerNameMap[tempId] || '';
                }
            } else {
                const rnd = pool[spinTick % pool.length];
                if (animationContext.currentItems[id] !== rnd.fullPath) {
                    animationContext.currentItems[id] = rnd.fullPath;

                    if (id.startsWith('p')) {
                        const idx = id.slice(1);
                        document.getElementById(`img${idx}`).src = rnd.fullPath;
                        document.getElementById(`name${idx}`).innerText = rnd.name;
                        document.getElementById(`cat${idx}`).innerText = rnd.category;
                    } else if (id.startsWith('a')) {
                        const idx = id.slice(1);
                        document.getElementById(`adImg${idx}`).src = rnd.fullPath;
                        document.getElementById(`adBg${idx}`).src = PATHS.ADDON_BG + rarityBgs[rnd.rarity];
                        document.getElementById(`adName${idx}`).innerText = rnd.name;
                    }
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

// ==========================================
// 🚀 렉 원천 차단 시퀀스 시작
// ==========================================
window.startSequence = function() {
    if (isSpinning) return;
    isSpinning = true;
    
    const spinBtn = document.getElementById('btnSpin');
    if (spinBtn) spinBtn.disabled = true;
    
    resetSlots(); // UI 클리어

    // 1단계: 버튼을 누르자마자 0.001초만에 멈춤 없이 무조건 애니메이션부터 강제 실행!
    if (currentMode === 'killer_perk' || currentMode === 'survivor_perk') {
        const activeData = currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
        const basePath = currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;

        for (let i = 1; i <= 4; i++) {
            let pool = shuffleArray([...activeData]).slice(0, 15);
            currentSpinPools[`p${i}`] = pool.map(p => ({ ...p, fullPath: basePath + p.file }));

            // 렉 방지를 위해 미리 block 처리
            document.getElementById(`img${i}`).style.display = 'block';
            document.getElementById(`bg${i}`).style.display = 'block';
            document.getElementById(`card${i}`).classList.add('spinning');
            startRAF(`p${i}`);
        }
    } else {
        // 애드온 모드
        let mixedAddons = [];
        if (isRandomKiller && selectedKillers.length > 0) {
            selectedKillers.forEach(kId => {
                const kData = killerAddons[kId] || [];
                let fId = kId === 'theFirst' ? 'theFirst' : kId;
                kData.forEach(ad => mixedAddons.push({ ...ad, fullPath: `${PATHS.ADDON}${fId}/${ad.file}` }));
            });
        } else {
            const kId = selectedKillers[0] || 'trapper';
            const kData = killerAddons[kId] || [];
            let fId = kId === 'theFirst' ? 'theFirst' : kId;
            kData.forEach(ad => mixedAddons.push({ ...ad, fullPath: `${PATHS.ADDON}${fId}/${ad.file}` }));
        }

        for (let i = 1; i <= 2; i++) {
            let pool = shuffleArray([...mixedAddons]).slice(0, 15);
            currentSpinPools[`a${i}`] = pool;

            document.getElementById(`adImg${i}`).style.display = 'block';
            document.getElementById(`adBg${i}`).style.display = 'block';
            document.getElementById(`slot${i}`).classList.add('spinning');
            startRAF(`a${i}`);
        }

        if (isRandomKiller && selectedKillers.length > 0) {
            currentSpinPools['killer'] = selectedKillers;
            document.getElementById('mainKillerImg').classList.add('spinning');
            startRAF('killer');
        }
    }

    // 2단계: 스핀이 부드럽게 돌아가기 시작한 직후에 몰래 무거운 결과값 계산 진행
    setTimeout(() => {
        executeLogic();
    }, 50); // 0.05초 대기 (이 사이에 브라우저가 화면을 그립니다)
};

// 메인 계산 및 정지 스케줄러
function executeLogic() {
    if (currentMode === 'killer_perk' || currentMode === 'survivor_perk') {
        const activeData = currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
        const basePath = currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;

        const speedRangeEl = document.getElementById('speedRange');
        const speedVal = speedRangeEl ? parseInt(speedRangeEl.value) : 2;
        const currentDelay = [0, 600, 1300, 2600][speedVal];

        // 무거운 연산 실행!
        let shuffledPerks = getRandomPerks(activeData, currentTierFilter);
        currentSpunPerks = shuffledPerks;

        if (speedVal === 0) { 
            setTimeout(() => {
                for (let i = 1; i <= 4; i++) stopPerk(i, shuffledPerks[i - 1], basePath);
                finalize();
            }, 500);
        } else { 
            let currentIdx = 1;
            const stopSequentially = () => {
                stopPerk(currentIdx, shuffledPerks[currentIdx - 1], basePath);
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
        // 애드온 모드 연산
        let finalKillerId;
        if (isRandomKiller && selectedKillers.length > 0) {
            finalKillerId = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
        } else {
            finalKillerId = selectedKillers[0] || 'trapper';
        }
        
        let activeAddonData = (typeof killerAddons !== 'undefined' && killerAddons[finalKillerId]) ? killerAddons[finalKillerId] : [];
        let folderId = finalKillerId === 'theFirst' ? 'theFirst' : finalKillerId;
        let basePath = typeof PATHS !== 'undefined' ? `${PATHS.ADDON}${folderId}/` : '';

        let shuffled = [];
        if (activeAddonData && activeAddonData.length > 0) {
            shuffled = [...activeAddonData];
            shuffleArray(shuffled);
        }

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

            if (!activeAddonData || activeAddonData.length === 0) {
                for (let i = 1; i <= 2; i++) stopRAF(`a${i}`);
                resetSlots(); 
                alert(`데이터가 없습니다.`); 
                finalize();
            } else {
                stopAddon(1, shuffled[0], basePath); 
                stopAddon(2, shuffled[1], basePath);
                finalize();
            }
        }, spinDuration); 
    }
}

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
        dataDash.innerText = "K:" + kCount + " | S:" + sCount + " | KP:" + kpCount + " | SP:" + spCount + " | AD:" + adCount;
        infoArea.appendChild(dataDash);
    }
}

// ==========================================
// 🚀 초기화
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    try {
        renderKillerPicker();
        updateInterface();
        validateData(); 

        // 눈에 보이는 기본 뼈대 이미지들만 빠르게 즉시 로딩
        if (typeof PATHS !== 'undefined') {
            for (let i = 0; i < 15; i++) {
                if (typeof killerPerkData !== 'undefined' && killerPerkData[i]) new Image().src = PATHS.PERK_K + killerPerkData[i].file;
                if (typeof survivorPerkData !== 'undefined' && survivorPerkData[i]) new Image().src = PATHS.PERK_S + survivorPerkData[i].file;
            }
            if (typeof killers !== 'undefined') killers.slice(0, 10).forEach(k => new Image().src = PATHS.PORTRAIT + k.id + '.webp');
        }

        // 사용자가 페이지를 보는 동안 1000개의 이미지를 사용자 몰래 조용히 다운로드!
        setTimeout(preloadImagesSequentially, 500);

    } catch (e) {
        console.error("UI 초기화 중 에러 발생:", e);
    }
});