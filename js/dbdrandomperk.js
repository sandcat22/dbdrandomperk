/**
 * Dead by Daylight Random Perk/Addon Generator
 * Optimized for High-Performance Rendering
 * V255 - Perk Lock (Pinning) System Added
 */

// ============================================================================
// 1. 전역 상태 및 데이터 맵 초기화
// ============================================================================
const killerNameMap = typeof killers !== 'undefined' ? Object.fromEntries(killers.map(k => [k.id, k.name])) : {};

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

let currentMode = 'killer_perk'; 
let isSpinning = false;
let currentTierFilter = 'all';
let currentSpunPerks = [];
let isRandomKiller = false;
let selectedKillers = ['trapper'];
let spinTick = 0;

// ============================================================================
// 2. 고성능 DOM 캐시 엔진
// ============================================================================
const DOM = {
    cache: new Map(),
    get(id) {
        if (!this.cache.has(id)) {
            this.cache.set(id, document.getElementById(id));
        }
        return this.cache.get(id);
    },
    getPerkElements(idx) {
        return {
            img: this.get(`img${idx}`),
            bg: this.get(`bg${idx}`),
            name: this.get(`name${idx}`),
            cat: this.get(`cat${idx}`),
            card: this.get(`card${idx}`),
            tierBox: this.get(`tierBox${idx}`),
            tierImg: this.get(`tierImg${idx}`),
            lockBtn: this.get(`lock${idx}`)
        };
    },
    getAddonElements(idx) {
        return {
            img: this.get(`adImg${idx}`),
            bg: this.get(`adBg${idx}`),
            name: this.get(`adName${idx}`),
            slot: this.get(`slot${idx}`)
        };
    }
};

// ============================================================================
// 3. requestAnimationFrame 애니메이션 컨텍스트
// ============================================================================
const animationContext = {
    activeSlots: new Map(), 
    lastTimes: {},        
    currentItems: {}      
};

// ============================================================================
// 4. 이벤트 및 UI 유틸리티
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof PATHS === 'undefined') return;
        for (let i = 0; i < 15; i++) {
            if (typeof killerPerkData !== 'undefined' && killerPerkData[i]) new Image().src = PATHS.PERK_K + killerPerkData[i].file;
            if (typeof survivorPerkData !== 'undefined' && survivorPerkData[i]) new Image().src = PATHS.PERK_S + survivorPerkData[i].file;
        }
        if (typeof killers !== 'undefined') {
            killers.slice(0, 10).forEach(k => {
                new Image().src = PATHS.PORTRAIT + k.id + '.webp';
            });
        }
    } catch (e) {
        console.error("사전 이미지 로딩 중 에러 발생:", e);
    }
});

// 🔥 신규: 자물쇠 토글 기능
window.toggleLock = function(idx) {
    if (isSpinning) return;
    if (currentMode === 'killer_addon') return; 
    if (!currentSpunPerks[idx - 1]) return; // 빈 슬롯은 고정 불가
    
    const card = DOM.get(`card${idx}`);
    
    // CSS 클래스만 넣고 빼면 디자인(흑백/컬러)이 자동 적용됨
    if (card.classList.contains('locked')) {
        card.classList.remove('locked');
    } else {
        card.classList.add('locked');
    }
};

function setTierFilter(val) {
    if (isSpinning) return;
    currentTierFilter = val;
    document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = DOM.get('btnFilter_' + val);
    if (targetBtn) targetBtn.classList.add('active');
}

function toggleMode() {
    if (isSpinning) return;
    const wrapperP = DOM.get('perkWrapper');
    const wrapperA = DOM.get('addonWrapper');
    
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
    resetSlots(true); // 모드 변경 시에는 모든 자물쇠 강제 초기화
}

function updateInterface() {
    const h1 = DOM.get('headerTitle');
    const btn = DOM.get('btnSpin');
    const slider = DOM.get('speedRange');
    const status = DOM.get('speedStatus');
    const rightPanel = DOM.get('rightPanel');
    
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
        updateSpeedText();
        
        if (rightPanel) rightPanel.style.display = 'flex'; 
        document.querySelectorAll('.perk-bg').forEach(bg => {
            bg.src = isKiller ? "images/perk_bg.png" : "images/perk_bg_survivor.png";
        });
    }
}

// 🔥 수정: 자물쇠가 걸린 카드는 지우지 않도록 방어
function resetSlots(forceAll = false) {
    const scoreDisplay = DOM.get('averageScoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.innerText = '-';
        scoreDisplay.className = 'avg-score';
    }
    
    animationContext.activeSlots.clear();
    animationContext.lastTimes = {};
    animationContext.currentItems = {};
    
    if (forceAll) {
        currentSpunPerks = [];
        for (let i = 1; i <= 4; i++) {
            const card = DOM.get(`card${i}`);
            if (card) card.classList.remove('locked');
        }
    }
    
    for (let i = 1; i <= 4; i++) {
        const card = DOM.get(`card${i}`);
        const isLocked = !forceAll && card && card.classList.contains('locked');
        
        if (!isLocked) {
            const el = DOM.getPerkElements(i);
            if (el.img) el.img.style.display = 'none';
            if (el.bg) el.bg.style.display = 'none';
            if (el.name) el.name.innerText = '';
            if (el.cat) el.cat.innerText = '';
            if (el.tierBox) el.tierBox.style.display = 'none';
            if (el.card) el.card.classList.remove('selected', 'killer_perk', 'survivor_perk', 'spinning');
        }
    }
    
    for (let i = 1; i <= 2; i++) {
        const el = DOM.getAddonElements(i);
        if (el.img) el.img.style.display = 'none';
        if (el.bg) el.bg.style.display = 'none';
        if (el.name) el.name.innerText = '';
        if (el.slot) {
            el.slot.className = 'addon-slot';
            el.slot.classList.remove('selected', 'spinning', 'error-active');
        }
    }
    
    if (forceAll) {
        const killerImg = DOM.get('mainKillerImg');
        if (killerImg) killerImg.classList.remove('spinning');
        const kName = DOM.get('mainKillerName');
        if (kName && selectedKillers.length > 0) {
            kName.innerText = killerNameMap[selectedKillers[0]] || '';
        }
    }
}

// ============================================================================
// 5. 살인마 데이터 조작 및 셔플 알고리즘
// ============================================================================
function renderKillerPicker() {
    const list = DOM.get('killerListContainer');
    if (!list || list.innerHTML !== "") return; 
    if (typeof killers === 'undefined') return;

    const fragment = document.createDocumentFragment();
    killers.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'killer-list-btn killer-item-btn';
        btn.id = 'kbtn_' + k.id;
        btn.innerText = k.name;
        btn.onclick = () => selectKiller(k.id);
        fragment.appendChild(btn);
    });
    list.appendChild(fragment);
    
    const initId = selectedKillers[0] || 'trapper';
    const initBtn = DOM.get('kbtn_' + initId);
    if (initBtn) initBtn.classList.add('active');
    
    const killerImg = DOM.get('mainKillerImg');
    if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + initId + ".webp";
    
    const killerName = DOM.get('mainKillerName');
    if (killerName) killerName.innerText = killerNameMap[initId] || '';
}

function selectAllKillers() {
    if (isSpinning || typeof killers === 'undefined') return;
    isRandomKiller = true;
    const rndBtn = DOM.get('btnRandomKiller');
    if (rndBtn) rndBtn.classList.add('active');
    
    selectedKillers = killers.map(k => k.id);
    document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.add('active'));
}

function toggleRandomKiller() {
    if (isSpinning) return;
    isRandomKiller = !isRandomKiller;
    const rndBtn = DOM.get('btnRandomKiller');
    if (rndBtn) rndBtn.classList.toggle('active', isRandomKiller);
    
    if (!isRandomKiller) {
        const idToKeep = selectedKillers[0] || 'trapper';
        selectedKillers = [idToKeep];
        document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
        
        const keepBtn = DOM.get('kbtn_' + idToKeep);
        if (keepBtn) keepBtn.classList.add('active');
        
        const killerImg = DOM.get('mainKillerImg');
        if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + idToKeep + ".webp";
        
        const killerName = DOM.get('mainKillerName');
        if (killerName) killerName.innerText = killerNameMap[idToKeep] || '';
    }
}

function selectKiller(id) {
    if (isSpinning) return;
    
    if (isRandomKiller) {
        const idx = selectedKillers.indexOf(id);
        if (idx > -1) {
            if (selectedKillers.length > 1) { 
                selectedKillers.splice(idx, 1);
                const targetBtn = DOM.get('kbtn_' + id);
                if (targetBtn) targetBtn.classList.remove('active');
            }
        } else {
            selectedKillers.push(id);
            const targetBtn = DOM.get('kbtn_' + id);
            if (targetBtn) targetBtn.classList.add('active');
        }
    } else {
        selectedKillers = [id];
        document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
        
        const targetBtn = DOM.get('kbtn_' + id);
        if (targetBtn) targetBtn.classList.add('active');
        
        const killerImg = DOM.get('mainKillerImg');
        if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + id + ".webp";
        
        const killerName = DOM.get('mainKillerName');
        if (killerName) killerName.innerText = killerNameMap[id] || '';
        resetSlots(true);
    }
}

function shuffleArray(array) {
    if (!array) return [];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 🔥 수정: 필요한 만큼만 뽑고, 이미 뽑힌 퍽은 제외하는 알고리즘
function getRandomPerks(data, filterVal, needed = 4, excludeNames = []) {
    let availableData = data.filter(p => !excludeNames.includes(p.name));
    if (!availableData || availableData.length === 0) return [];
    
    if (filterVal === 'all') {
        return shuffleArray([...availableData]).slice(0, needed);
    }

    const pools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    availableData.forEach(p => { if (pools[p.tier]) pools[p.tier].push(p); });

    let minSum = 0, maxSum = 20, targetTiers = [];
    if (filterVal === '4') { minSum = 16; maxSum = 20; targetTiers = [3, 4, 4, 5, 5]; }
    else if (filterVal === '3') { minSum = 12; maxSum = 15; targetTiers = [2, 3, 3, 4, 4]; }
    else if (filterVal === '2') { minSum = 8; maxSum = 11; targetTiers = [1, 2, 2, 3, 3]; }
    else if (filterVal === '1') { minSum = 4; maxSum = 7; targetTiers = [1, 1, 2]; }

    for (let attempts = 0; attempts < 2000; attempts++) {
        let selectedTiers = Array.from({ length: 4 }, () => targetTiers[Math.floor(Math.random() * targetTiers.length)]);
        let sum = selectedTiers.reduce((a, b) => a + b, 0);
        
        if (sum >= minSum && sum <= maxSum) {
            let combo = [];
            let usedIndices = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
            let isValid = true;
            
            for (let t of selectedTiers) {
                let pool = pools[t];
                if (!pool || pool.length === 0 || usedIndices[t].size >= pool.length) {
                    isValid = false; 
                    break;
                }
                let r;
                do { r = Math.floor(Math.random() * pool.length); } while (usedIndices[t].has(r));
                usedIndices[t].add(r);
                combo.push(pool[r]);
            }
            if (isValid) return combo.slice(0, needed);
        }
    }
    return shuffleArray([...availableData]).slice(0, needed);
}

// ============================================================================
// 6. 최적화된 고성능 통합 애니메이션 엔진 (rAF 기반)
// ============================================================================
function loopAnimation(timestamp) {
    if (animationContext.activeSlots.size === 0) return;

    animationContext.activeSlots.forEach((meta, slotId) => {
        if (!animationContext.lastTimes[slotId]) animationContext.lastTimes[slotId] = timestamp;
        
        if (timestamp - animationContext.lastTimes[slotId] >= 45) {
            animationContext.lastTimes[slotId] = timestamp;
            spinTick++;

            if (meta.type === 'perk') {
                const idx = meta.index;
                const data = currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
                const path = currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;
                
                if (data && data.length > 0) {
                    const rnd = data[spinTick % Math.min(15, data.length)];
                    if (rnd && animationContext.currentItems[slotId] !== rnd.file) {
                        animationContext.currentItems[slotId] = rnd.file;
                        const el = DOM.getPerkElements(idx);

                        if (el.img) { el.img.src = path + rnd.file; el.img.style.display = 'block'; }
                        if (el.bg) el.bg.style.display = 'block';
                        if (el.name) el.name.innerText = rnd.name;
                        if (el.cat) el.cat.innerText = rnd.category;
                    }
                }
            } else if (meta.type === 'addon') {
                const idx = meta.index;
                let currentId = 'trapper';
                if (isRandomKiller && selectedKillers.length > 0) {
                    currentId = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
                } else if (selectedKillers.length > 0) {
                    currentId = selectedKillers[0];
                }
                
                const spinData = (typeof killerAddons !== 'undefined' && killerAddons[currentId]) ? killerAddons[currentId] : []; 
                const folderId = currentId === 'theFirst' ? 'theFirst' : currentId;
                const spinPath = typeof PATHS !== 'undefined' ? `${PATHS.ADDON}${folderId}/` : '';
                
                if (spinData && spinData.length > 0) {
                    const rnd = spinData[spinTick % Math.min(10, spinData.length)];
                    if (rnd && animationContext.currentItems[slotId] !== rnd.file) {
                        animationContext.currentItems[slotId] = rnd.file;
                        const el = DOM.getAddonElements(idx);

                        if (el.img) { el.img.src = spinPath + rnd.file; el.img.style.display = 'block'; }
                        if (el.bg && typeof PATHS !== 'undefined' && typeof rarityBgs !== 'undefined') {
                            el.bg.src = PATHS.ADDON_BG + rarityBgs[rnd.rarity]; 
                            el.bg.style.display = 'block';
                        }
                        if (el.name) el.name.innerText = rnd.name;
                    }
                }
            } else if (meta.type === 'killer') {
                const tempId = selectedKillers[Math.floor(Math.random() * selectedKillers.length)];
                if (animationContext.currentItems[slotId] !== tempId) {
                    animationContext.currentItems[slotId] = tempId;
                    
                    const killerImg = DOM.get('mainKillerImg');
                    const killerName = DOM.get('mainKillerName');
                    
                    if (killerImg && typeof PATHS !== 'undefined') killerImg.src = `${PATHS.PORTRAIT}${tempId}.webp`;
                    if (killerName) killerName.innerText = killerNameMap[tempId] || '';
                }
            }
        }
    });

    requestAnimationFrame(loopAnimation);
}

function startRAF(slotId, type, index = null) {
    const isFirst = animationContext.activeSlots.size === 0;
    animationContext.activeSlots.set(slotId, { type, index });
    animationContext.lastTimes[slotId] = 0;
    
    if (isFirst) {
        requestAnimationFrame(loopAnimation);
    }
}

function stopRAF(slotId) {
    animationContext.activeSlots.delete(slotId);
    delete animationContext.lastTimes[slotId];
    delete animationContext.currentItems[slotId];
}

// ============================================================================
// 7. 메인 룰렛 제어 시퀀스 (🔥자물쇠 시스템 완벽 연동)
// ============================================================================
function startSequence() {
    if (isSpinning) return;
    isSpinning = true;
    
    const spinBtn = DOM.get('btnSpin');
    if (spinBtn) spinBtn.disabled = true;
    
    let activeData, path, type;

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

    resetSlots(false); // false를 전달하여 자물쇠가 걸린 슬롯은 보존함

    if (type === 'perk') {
        const speedRangeEl = DOM.get('speedRange');
        const speedVal = speedRangeEl ? parseInt(speedRangeEl.value) : 2;
        const currentDelay = [0, 600, 1300, 2600][speedVal];
        
        let lockedIndices = [];
        for (let i = 1; i <= 4; i++) {
            const card = DOM.get(`card${i}`);
            // 현재 카드가 고정(Lock)되어 있다면 명단에 추가하고 애니메이션을 돌리지 않음
            if (card && card.classList.contains('locked') && currentSpunPerks[i - 1]) {
                lockedIndices.push(i - 1);
            } else {
                if (card) card.classList.add('spinning');
                startRAF(`p${i}`, 'perk', i);
            }
        }

        // 만약 4개가 전부 다 잠겨있다면 그냥 종료
        if (lockedIndices.length === 4) {
            finalize();
            return;
        }

        setTimeout(() => {
            // 현재 고정되어 있는 퍽들의 이름을 추출하여 중복 방지 리스트 생성
            let excludeNames = lockedIndices.map(idx => currentSpunPerks[idx].name);
            let needed = 4 - lockedIndices.length; // 뽑아야 할 새로운 퍽 개수
            
            let newPerks = getRandomPerks(activeData, currentTierFilter, needed, excludeNames);
            
            // 기존 고정 퍽 + 새롭게 뽑힌 퍽 병합
            let nextSpunPerks = [];
            let newPerkIdx = 0;
            for (let i = 0; i < 4; i++) {
                if (lockedIndices.includes(i)) {
                    nextSpunPerks[i] = currentSpunPerks[i]; // 기존 퍽 유지
                } else {
                    nextSpunPerks[i] = newPerks[newPerkIdx++]; // 새 퍽 할당
                }
            }
            currentSpunPerks = nextSpunPerks;

            // 새로 뽑힌 퍽만 프리로드
            newPerks.forEach(p => {
                if (p) new Image().src = path + p.file;
            });

            // 스핀을 멈출 슬롯(고정되지 않은 슬롯)들의 인덱스만 추림
            let unlockedIndices = [1, 2, 3, 4].filter(i => !lockedIndices.includes(i - 1));

            if (speedVal === 0) { 
                setTimeout(() => {
                    unlockedIndices.forEach(idx => stopPerk(idx, currentSpunPerks[idx - 1], path));
                    finalize();
                }, 500);
            } else { 
                let currentStep = 0;
                const stopSequentially = () => {
                    let idx = unlockedIndices[currentStep];
                    stopPerk(idx, currentSpunPerks[idx - 1], path);
                    currentStep++;
                    if (currentStep >= unlockedIndices.length) { 
                        finalize(); 
                        return; 
                    }
                    setTimeout(stopSequentially, currentDelay);
                };
                setTimeout(stopSequentially, 1000);
            }
        }, 10);

    } else {
        // 애드온 모드는 고정 기능 없음
        let finalKillerId;
        
        if (isRandomKiller && selectedKillers.length > 0) {
            const killerImg = DOM.get('mainKillerImg');
            if (killerImg) killerImg.classList.add('spinning');
            startRAF('killer', 'killer');
        }

        for (let i = 1; i <= 2; i++) {
            const slot = DOM.get(`slot${i}`);
            if (slot) slot.classList.add('spinning');
            startRAF(`a${i}`, 'addon', i);
        }

        setTimeout(() => {
            finalKillerId = isRandomKiller && selectedKillers.length > 0 
                ? selectedKillers[Math.floor(Math.random() * selectedKillers.length)]
                : (selectedKillers[0] || 'trapper');
            
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

            let spinDuration = (isRandomKiller && selectedKillers.length > 1) ? 1200 : 700;

            setTimeout(() => {
                if (isRandomKiller && selectedKillers.length > 0) {
                    stopRAF('killer');
                    const killerImg = DOM.get('mainKillerImg');
                    if (killerImg) {
                        killerImg.classList.remove('spinning');
                        if (typeof PATHS !== 'undefined') killerImg.src = `${PATHS.PORTRAIT}${finalKillerId}.webp`;
                    }
                    const killerName = DOM.get('mainKillerName');
                    if (killerName) killerName.innerText = killerNameMap[finalKillerId] || '';
                } else {
                    const killerName = DOM.get('mainKillerName');
                    if (killerName) killerName.innerText = killerNameMap[finalKillerId] || '';
                }

                if (!activeData || activeData.length === 0) {
                    for (let i = 1; i <= 2; i++) stopRAF(`a${i}`);
                    resetSlots(true); 
                    alert(`데이터가 없습니다.`); 
                    finalize();
                } else {
                    stopAddon(1, shuffled[0], path); 
                    stopAddon(2, shuffled[1], path);
                    finalize();
                }
            }, spinDuration); 
        }, 10);
    }
}

function stopPerk(idx, item, path) {
    stopRAF(`p${idx}`);
    if (!item) return;

    const el = DOM.getPerkElements(idx);

    if (el.img) { el.img.src = path + item.file; el.img.style.display = 'block'; }
    if (el.name) el.name.innerText = item.name;
    if (el.cat) el.cat.innerText = item.category;
    
    if (el.card) {
        el.card.classList.remove('spinning'); 
        el.card.classList.add('selected', currentMode);
    }

    const tierNum = item.tier || 3;
    if (el.tierImg) el.tierImg.src = `images/tier_logo${tierNum}.png`;
    if (el.tierBox) el.tierBox.style.display = 'block';
}

function stopAddon(idx, item, path) {
    stopRAF(`a${idx}`);
    if (!item) return;

    const el = DOM.getAddonElements(idx);

    if (el.img) { el.img.src = path + item.file; el.img.style.display = 'block'; }
    if (el.bg && typeof PATHS !== 'undefined' && typeof rarityBgs !== 'undefined') {
        el.bg.src = PATHS.ADDON_BG + rarityBgs[item.rarity];
    }
    if (el.name) el.name.innerText = item.name;
    if (el.slot) {
        el.slot.classList.remove('spinning');
        el.slot.classList.add('selected');
    }
}

function finalize() { 
    isSpinning = false; 
    const spinBtn = DOM.get('btnSpin');
    if (spinBtn) spinBtn.disabled = false; 
    
    if (currentMode !== 'killer_addon' && currentSpunPerks && currentSpunPerks.length === 4) {
        let avg = (Number(currentSpunPerks[0].tier || 3) + 
                   Number(currentSpunPerks[1].tier || 3) + 
                   Number(currentSpunPerks[2].tier || 3) + 
                   Number(currentSpunPerks[3].tier || 3)) / 4;
                   
        const scoreDisplay = DOM.get('averageScoreDisplay');
        if (scoreDisplay) {
            scoreDisplay.innerText = avg.toFixed(2);
            scoreDisplay.className = `avg-score show ${currentMode === 'killer_perk' ? 'killer-score' : 'survivor-score'}`;
        }
    }
}

function updateSpeedText() {
    const slider = DOM.get('speedRange');
    const status = DOM.get('speedStatus');
    if (!slider || !status) return;
    
    const val = slider.value;
    const texts = ["동시", "빠름", "보통", "느림"];
    status.innerText = texts[val] || "보통";
}

// ============================================================================
// 8. 모달 제어 및 🔥에러 매니저 탑재
// ============================================================================
function openUpdateNotes() {
    const modal = DOM.get('updateModalOverlay');
    if (modal) modal.classList.add('show');
    
    const modalBody = DOM.get('updateModalBody');
    if (modalBody) {
        if (typeof updateNotesText !== 'undefined') {
            modalBody.innerText = updateNotesText;
        } else {
            modalBody.innerText = "업데이트 노트를 불러올 수 없습니다.\n(js/updatenotes.js 파일이 연결되지 않았습니다.)";
        }
    }
}

function closeUpdateNotes(event) {
    if (!event || event.target.id === 'updateModalOverlay' || event.target.className === 'close-modal') {
        const modal = DOM.get('updateModalOverlay');
        if (modal) modal.classList.remove('show');
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        const modal = DOM.get('updateModalOverlay');
        if (modal && modal.classList.contains('show')) {
            closeUpdateNotes();
        }
    }
});

const ErrorManager = {
    logs: new Set(),
    addError(msg) {
        this.logs.add(msg);
        this.renderButton();
    },
    renderButton() {
        const infoArea = document.querySelector('.bottom-info-area');
        if (!infoArea) return;
        let btn = document.getElementById('dataErrorBtn');
        if (this.logs.size > 0 && !btn) {
            btn = document.createElement('button');
            btn.id = 'dataErrorBtn';
            btn.innerHTML = '🚨 DATA ERROR';
            btn.style.cssText = 'background: #ff3333; color: white; border: none; padding: 5px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 5px; font-size: 11px; animation: blink 1s infinite;';
            btn.onclick = () => alert("🚨 발견된 오류 내역 🚨\n\n" + Array.from(this.logs).join('\n'));
            infoArea.appendChild(btn);
            
            if (!document.getElementById('blinkStyle')) {
                const style = document.createElement('style');
                style.id = 'blinkStyle';
                style.innerHTML = `@keyframes blink { 50% { opacity: 0.5; } }`;
                document.head.appendChild(style);
            }
        }
    }
};

function validateData() {
    let kCount = typeof killers !== 'undefined' ? killers.length : 0;
    let sCount = typeof survivors !== 'undefined' ? survivors.length : 0;
    let kpCount = typeof killerPerkData !== 'undefined' ? killerPerkData.length : 0;
    let spCount = typeof survivorPerkData !== 'undefined' ? survivorPerkData.length : 0;
    let adCount = 0;
    
    if (typeof killerAddons !== 'undefined') {
        killers.forEach(k => {
            const addons = killerAddons[k.id];
            if (!addons) ErrorManager.addError(`[${k.name}] 애드온 누락`);
            else {
                adCount += addons.length;
                if (addons.length !== 20) ErrorManager.addError(`[${k.name}] 애드온 개수 불일치(${addons.length}개)`);
            }
        });
    }

    const validKillerCategories = [...Object.values(killerNameMap), "공용 퍽"];
    if (typeof killerPerkData !== 'undefined') {
        killerPerkData.forEach(p => {
            if (!validKillerCategories.includes(p.category)) ErrorManager.addError(`[킬러 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });
    }

    const validSurvivorCategories = [...Object.values(survivorNameMap), "공용 퍽"];
    if (typeof survivorPerkData !== 'undefined') {
        survivorPerkData.forEach(p => {
            if (!validSurvivorCategories.includes(p.category)) ErrorManager.addError(`[생존자 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });
    }

    const infoArea = document.querySelector('.bottom-info-area');
    if (infoArea) {
        const dataDash = document.createElement('div');
        dataDash.style.fontSize = '11px';
        dataDash.style.color = 'rgba(255,255,255,0.3)';
        dataDash.style.marginTop = '5px';
        dataDash.innerText = `K:${kCount} | S:${sCount} | KP:${kpCount} | SP:${spCount} | AD:${adCount}`;
        infoArea.appendChild(dataDash);
    }
    
    ErrorManager.renderButton(); 
}

// 진입점 초기화 실행
try {
    renderKillerPicker();
    updateInterface();
    validateData(); 
    
    setTimeout(() => {
        let preImgLoad = setInterval(() => {
            if (typeof PATHS !== 'undefined' && typeof killers !== 'undefined') {
                if (killers.length >= 40) {
                    clearInterval(preImgLoad);
                }
            } else {
                clearInterval(preImgLoad);
            }
        }, 500);
    }, 1000);
} catch (e) {
    console.error("UI 초기화 구성 도중 에러가 발견되었습니다:", e);
}

// ============================================================================
// 9. 동적 DOM 이벤트 핸들링 허브
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function() {
            if (this.src) {
                const filename = decodeURIComponent(this.src.substring(this.src.lastIndexOf('/') + 1));
                if (filename && filename !== 'null' && filename !== 'undefined') {
                    ErrorManager.addError(`이미지 파일 누락: ${filename}`);
                }
            }
        });
    });

    const headerTitle = DOM.get('headerTitle');
    if (headerTitle) headerTitle.addEventListener('click', toggleMode);

    const filterContainer = DOM.get('tierFilterContainer');
    if (filterContainer) {
        filterContainer.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('.tier-btn');
            if (targetBtn) {
                const tierVal = targetBtn.getAttribute('data-tier');
                if (tierVal) setTierFilter(tierVal);
            }
        });
    }

    const btnRandomKiller = DOM.get('btnRandomKiller');
    if (btnRandomKiller) btnRandomKiller.addEventListener('click', toggleRandomKiller);

    const btnSelectAllKillers = DOM.get('btnSelectAllKillers');
    if (btnSelectAllKillers) btnSelectAllKillers.addEventListener('click', selectAllKillers);

    const btnSpin = DOM.get('btnSpin');
    if (btnSpin) btnSpin.addEventListener('click', startSequence);

    const speedRange = DOM.get('speedRange');
    if (speedRange) speedRange.addEventListener('input', updateSpeedText);

    const btnUpdateNotes = DOM.get('btnUpdateNotes');
    if (btnUpdateNotes) btnUpdateNotes.addEventListener('click', openUpdateNotes);

    const btnCloseModal = DOM.get('btnCloseModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeUpdateNotes);

    const updateModalOverlay = DOM.get('updateModalOverlay');
    if (updateModalOverlay) updateModalOverlay.addEventListener('click', closeUpdateNotes);
});