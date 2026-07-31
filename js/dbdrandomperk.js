/**
 * Dead by Daylight Random Perk/Addon Generator
 * Optimized for High-Performance Rendering
 * V265 - Chosung Multi-Select Filter & Lock System Combined + Auto Update Notes Popup + Filter Auto Reset
 */

// ============================================================================
// 1. 전역 상태 및 데이터 맵 초기화
// ============================================================================
const killerNameMap = typeof killers !== 'undefined' ? Object.fromEntries(killers.map(k => [k.id, k.name])) : {};

const dbdBucket = {
    currentMode: 'killer_perk',
    isSpinning: false,
    currentFilterType: 'tier', // 'tier' 또는 'chosung'
    currentTierFilter: 'all',
    currentChosungFilter: [], // 다중 선택을 위해 빈 배열로 초기화
    currentSpunPerks: [],
    isRandomKiller: false,
    selectedKillers: ['trapper'],
    spinTick: 0
};

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

// ============================================================================
// 2. 초성 추출 및 데이터 전처리 엔진
// ============================================================================
function getCleanPerkName(name) {
    const prefixes = ["주술: ", "재앙: ", "호재: ", "팀워크: ", "기도: "];
    let cleanName = name;
    for (let p of prefixes) {
        if (cleanName.startsWith(p)) {
            cleanName = cleanName.substring(p.length);
            break;
        }
    }
    return cleanName.trim();
}

function getChosung(name) {
    let cleanName = getCleanPerkName(name);

    const numToKor = { '0':'영', '1':'일', '2':'이', '3':'삼', '4':'사', '5':'오', '6':'육', '7':'칠', '8':'팔', '9':'구' };
    cleanName = cleanName.replace(/[0-9]/g, match => numToKor[match]);

    cleanName = cleanName.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');

    if (cleanName.length === 0) return '기타';

    const firstChar = cleanName.charAt(0);
    const code = firstChar.charCodeAt(0) - 44032;
    
    if (code > -1 && code < 11172) {
        const chosungList = ['ㄱ', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅂ', 'ㅅ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        return chosungList[Math.floor(code / 588)];
    }
    
    return '기타'; 
}

// ============================================================================
// 3. 고성능 DOM 캐시 엔진
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
// 4. requestAnimationFrame 애니메이션 컨텍스트
// ============================================================================
const animationContext = {
    activeSlots: new Map(),
    lastTimes: {},        
    currentItems: {}      
};

// ============================================================================
// 5. 이벤트 및 UI 유틸리티
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

function toggleLock(idx) {
    if (dbdBucket.isSpinning) return;
    if (dbdBucket.currentMode === 'killer_addon') return; 
    if (!dbdBucket.currentSpunPerks[idx - 1]) return;
    
    const card = DOM.get(`card${idx}`);
    if (!card) return;
    
    if (card.classList.contains('locked')) {
        card.classList.remove('locked');
    } else {
        card.classList.add('locked');
    }
}

function setTierFilter(val) {
    if (dbdBucket.isSpinning) return;
    dbdBucket.currentTierFilter = val;
    document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = DOM.get('btnFilter_' + val);
    if (targetBtn) targetBtn.classList.add('active');
}

// 🔥 모드 전환 시 필터 강제 초기화 로직이 추가되었습니다.
function toggleMode() {
    if (dbdBucket.isSpinning) return;
    
    // [1] 필터 상태 변수 초기화
    dbdBucket.currentFilterType = 'tier';
    dbdBucket.currentTierFilter = 'all';
    dbdBucket.currentChosungFilter = [];
    
    // [2] 탭 UI 및 내용 패널 초기화 (티어 탭으로 원복)
    const tabTier = DOM.get('tabTier');
    const tabChosung = DOM.get('tabChosung');
    const tierContainer = DOM.get('tierFilterContainer');
    const chosungContainer = DOM.get('chosungFilterContainer');
    
    if (tabTier && tabChosung && tierContainer && chosungContainer) {
        tabTier.classList.add('active');
        tabChosung.classList.remove('active');
        tierContainer.classList.remove('hide');
        chosungContainer.classList.add('hide');
    }

    // [3] 티어 버튼 UI 초기화 ('ALL 랜덤'으로 원복)
    document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
    const allTierBtn = DOM.get('btnFilter_all');
    if (allTierBtn) allTierBtn.classList.add('active');

    // [4] 초성 버튼 UI 초기화 (선택 해제)
    document.querySelectorAll('.cho-grid .cho-btn').forEach(btn => btn.classList.remove('active'));

    // [5] 모드 변경 실행
    const wrapperP = DOM.get('perkWrapper');
    const wrapperA = DOM.get('addonWrapper');
    
    if (dbdBucket.currentMode === 'killer_perk') {
        dbdBucket.currentMode = 'survivor_perk';
        if (wrapperP) wrapperP.classList.remove('hide'); 
        if (wrapperA) wrapperA.classList.add('hide');
    } else if (dbdBucket.currentMode === 'survivor_perk') {
        dbdBucket.currentMode = 'killer_addon';
        if (wrapperP) wrapperP.classList.add('hide'); 
        if (wrapperA) wrapperA.classList.remove('hide'); 
        renderKillerPicker();
    } else {
        dbdBucket.currentMode = 'killer_perk';
        if (wrapperP) wrapperP.classList.remove('hide'); 
        if (wrapperA) wrapperA.classList.add('hide');
    }
    
    updateInterface();
    resetSlots(true);
}

function updateInterface() {
    const wrapper = DOM.get('Wrapper');
    const h1 = DOM.get('headerTitle');
    const btn = DOM.get('btnSpin');
    const slider = DOM.get('speedRange');
    const status = DOM.get('speedStatus');
    const rightPanel = DOM.get('rightPanel');
    
    wrapper.classList.remove('mode-killer','mode-survivor');
    wrapper.classList.add('mode-killer');
    if(dbdBucket.currentMode !== 'killer_perk') wrapper.classList.add('mode-survivor');
    
    if (dbdBucket.currentMode === 'killer_addon') {
        if (h1) { h1.innerText = "🟣 KILLER ADDON 🟣"; h1.style.color = "#E040FB"; }
        if (btn) btn.className = "start-btn addon-btn"; 
        if (status) { status.style.color = "#aaa"; status.innerText = "고정"; }
        if (slider) slider.disabled = true;
        if (rightPanel) rightPanel.classList.add('hide'); 
    } else {
        const isKiller = dbdBucket.currentMode === 'killer_perk';
        if (h1) {
            h1.innerText = isKiller ? "🩸 KILLER PERK 🩸" : "🔹 SURVIVOR PERK 🔹";
            h1.style.color = isKiller ? "#ff3333" : "#4da6ff";
        }
        if (btn) btn.className = isKiller ? "start-btn killer-btn" : "start-btn survivor-btn";
        if (status) status.style.color = isKiller ? "#ff3333" : "#4da6ff";
        if (slider) slider.disabled = false; 
        updateSpeedText();
        
        if (rightPanel) rightPanel.classList.remove('hide'); 
        
        document.querySelectorAll('.perk-bg').forEach(bg => {
            bg.src = isKiller ? "images/perk_bg.png" : "images/perk_bg_survivor.png";
        });
    }
}

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
        dbdBucket.currentSpunPerks = [];
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
        const kName = DOM.get('mainKillerName');
        if (killerImg) killerImg.classList.remove('spinning');
        if (kName && dbdBucket.selectedKillers.length > 0) {
            kName.innerText = killerNameMap[dbdBucket.selectedKillers[0]] || '';
        }
    }
}

// ============================================================================
// 6. 살인마 데이터 조작 및 셔플 필터링 알고리즘
// ============================================================================
function renderKillerPicker() {
    const list = DOM.get('killerListContainer');
    if (!list || list.innerHTML !== "") return; 
    if (typeof killers === 'undefined') return;

    const fragment = document.createDocumentFragment();
    killers.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'killer-list-btn';
        btn.id = 'kbtn_' + k.id;
        btn.innerText = k.name;
        btn.onclick = () => selectKiller(k.id);
        fragment.appendChild(btn);
    });
    list.appendChild(fragment);
    
    const initId = dbdBucket.selectedKillers[0] || 'trapper';
    const initBtn = DOM.get('kbtn_' + initId);
    if (initBtn) initBtn.classList.add('active');
    
    const killerImg = DOM.get('mainKillerImg');
    if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + initId + ".webp";
    
    const killerName = DOM.get('mainKillerName');
    if (killerName) killerName.innerText = killerNameMap[initId] || '';
}

function selectAllKillers() {
    if (dbdBucket.isSpinning || typeof killers === 'undefined') return;
    dbdBucket.isRandomKiller = true;
    const rndBtn = DOM.get('btnRandomKiller');
    if (rndBtn) rndBtn.classList.add('active');
    
    dbdBucket.selectedKillers = killers.map(k => k.id);
    document.querySelectorAll('.killer-list-btn').forEach(btn => btn.classList.add('active'));
}

function toggleRandomKiller() {
    if (dbdBucket.isSpinning) return;
    dbdBucket.isRandomKiller = !dbdBucket.isRandomKiller;
    const rndBtn = DOM.get('btnRandomKiller');
    if (rndBtn) rndBtn.classList.toggle('active', dbdBucket.isRandomKiller);
    
    if (!dbdBucket.isRandomKiller) {
        const idToKeep = dbdBucket.selectedKillers[0] || 'trapper';
        dbdBucket.selectedKillers = [idToKeep];
        document.querySelectorAll('.killer-list-btn').forEach(btn => btn.classList.remove('active'));
        
        const keepBtn = DOM.get('kbtn_' + idToKeep);
        if (keepBtn) keepBtn.classList.add('active');
        
        const killerImg = DOM.get('mainKillerImg');
        if (killerImg && typeof PATHS !== 'undefined') killerImg.src = PATHS.PORTRAIT + idToKeep + ".webp";
        
        const killerName = DOM.get('mainKillerName');
        if (killerName) killerName.innerText = killerNameMap[idToKeep] || '';
    }
}

function selectKiller(id) {
    if (dbdBucket.isSpinning) return;
    
    if (dbdBucket.isRandomKiller) {
        const idx = dbdBucket.selectedKillers.indexOf(id);
        if (idx > -1) {
            if (dbdBucket.selectedKillers.length > 1) { 
                dbdBucket.selectedKillers.splice(idx, 1);
                const targetBtn = DOM.get('kbtn_' + id);
                if (targetBtn) targetBtn.classList.remove('active');
            }
        } else {
            dbdBucket.selectedKillers.push(id);
            const targetBtn = DOM.get('kbtn_' + id);
            if (targetBtn) targetBtn.classList.add('active');
        }
    } else {
        dbdBucket.selectedKillers = [id];
        document.querySelectorAll('.killer-list-btn').forEach(btn => btn.classList.remove('active'));
        
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

// -------------------------------------------------------------
// 핵심 로직: 다중 초성 필터 배열 검사 반영
// -------------------------------------------------------------
function getRandomPerks(data, needed = 4, excludeNames = []) {
    let availableData = data.filter(p => !excludeNames.includes(p.name));
    if (!availableData || availableData.length === 0) return [];
    
    // [1] 초성 필터가 켜져있는 경우 (배열에 값이 있을 때만 필터 적용)
    if (dbdBucket.currentFilterType === 'chosung') {
        if (dbdBucket.currentChosungFilter.length > 0) {
            availableData = availableData.filter(p => {
                const cho = getChosung(p.name);
                return dbdBucket.currentChosungFilter.includes(cho);
            });
        }
        return shuffleArray([...availableData]).slice(0, needed);
    }
    
    // [2] 티어 필터가 켜져있는 경우
    if (dbdBucket.currentFilterType === 'tier' && dbdBucket.currentTierFilter !== 'all') {
        const pools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        availableData.forEach(p => { if (pools[p.tier]) pools[p.tier].push(p); });

        let minSum = 0, maxSum = 20, targetTiers = [];
        if (dbdBucket.currentTierFilter === '4') { minSum = 16; maxSum = 20; targetTiers = [3, 4, 4, 5, 5]; }
        else if (dbdBucket.currentTierFilter === '3') { minSum = 12; maxSum = 15; targetTiers = [2, 3, 3, 4, 4]; }
        else if (dbdBucket.currentTierFilter === '2') { minSum = 8; maxSum = 11; targetTiers = [1, 2, 2, 3, 3]; }
        else if (dbdBucket.currentTierFilter === '1') { minSum = 4; maxSum = 7; targetTiers = [1, 1, 2]; }

        if (needed < 4) {
            let validPool = [];
            targetTiers.forEach(t => { if(pools[t]) validPool.push(...pools[t]); });
            validPool = [...new Set(validPool)];
            return shuffleArray(validPool).slice(0, needed);
        }

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
    }
    
    return shuffleArray([...availableData]).slice(0, needed);
}

// ============================================================================
// 7. 최적화된 고성능 통합 애니메이션 엔진 (rAF 기반)
// ============================================================================
function loopAnimation(timestamp) {
    if (animationContext.activeSlots.size === 0) return;

    animationContext.activeSlots.forEach((meta, slotId) => {
        if (!animationContext.lastTimes[slotId]) animationContext.lastTimes[slotId] = timestamp;
        
        if (timestamp - animationContext.lastTimes[slotId] >= 45) {
            animationContext.lastTimes[slotId] = timestamp;
            dbdBucket.spinTick++;

            if (meta.type === 'perk') {
                const idx = meta.index;
                const data = dbdBucket.currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
                const path = dbdBucket.currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;
                
                if (data && data.length > 0) {
                    const rnd = data[dbdBucket.spinTick % Math.min(15, data.length)];
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
                if (dbdBucket.isRandomKiller && dbdBucket.selectedKillers.length > 0) {
                    currentId = dbdBucket.selectedKillers[Math.floor(Math.random() * dbdBucket.selectedKillers.length)];
                } else if (dbdBucket.selectedKillers.length > 0) {
                    currentId = dbdBucket.selectedKillers[0];
                }
                
                const spinData = (typeof killerAddons !== 'undefined' && killerAddons[currentId]) ? killerAddons[currentId] : []; 
                const folderId = currentId === 'theFirst' ? 'theFirst' : currentId;
                const spinPath = typeof PATHS !== 'undefined' ? `${PATHS.ADDON}${folderId}/` : '';

                if (spinData && spinData.length > 0) {
                    const rnd = spinData[dbdBucket.spinTick % Math.min(10, spinData.length)];
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
                const tempId = dbdBucket.selectedKillers[Math.floor(Math.random() * dbdBucket.selectedKillers.length)];
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
// 8. 메인 룰렛 제어 시퀀스
// ============================================================================
function startSequence() {
    if (dbdBucket.isSpinning) return;
    dbdBucket.isSpinning = true;
    
    const spinBtn = DOM.get('btnSpin');
    if (spinBtn) spinBtn.disabled = true;
    
    let activeData, path, type;

    if (dbdBucket.currentMode === 'killer_perk') { 
        activeData = typeof killerPerkData !== 'undefined' ? killerPerkData : []; 
        path = typeof PATHS !== 'undefined' ? PATHS.PERK_K : ''; 
        type = 'perk'; 
    } else if (dbdBucket.currentMode === 'survivor_perk') { 
        activeData = typeof survivorPerkData !== 'undefined' ? survivorPerkData : []; 
        path = typeof PATHS !== 'undefined' ? PATHS.PERK_S : ''; 
        type = 'perk'; 
    } else { 
        type = 'addon'; 
    }

    resetSlots(false); 

    if (type === 'perk') {
        const speedRangeEl = DOM.get('speedRange');
        const speedVal = speedRangeEl ? parseInt(speedRangeEl.value) : 2;
        const currentDelay = [0, 600, 1300, 2600][speedVal];

        let lockedIndices = [];
        for (let i = 1; i <= 4; i++) {
            const card = DOM.get(`card${i}`);
            if (card && card.classList.contains('locked') && dbdBucket.currentSpunPerks[i - 1]) {
                lockedIndices.push(i - 1);
            }
        }

        if (lockedIndices.length === 4) {
            finalize();
            return;
        }
        
        let excludeNames = lockedIndices.map(idx => dbdBucket.currentSpunPerks[idx].name);
        let needed = 4 - lockedIndices.length; 
        
        let newPerks = getRandomPerks(activeData, needed, excludeNames);
        
        if (newPerks.length === 0) {
            alert("선택한 조건(필터)에 해당하는 퍽이 더 이상 존재하지 않습니다.\n옵션을 변경하거나 고정(Lock)을 해제해주세요.");
            finalize();
            return;
        }

        if (newPerks.length < needed) {
            alert(`해당 초성/조건에 맞는 퍽이 ${newPerks.length}개 뿐입니다.\n부족한 슬롯은 비워진 상태로 표시됩니다.`);
        }

        for (let i = 1; i <= 4; i++) {
            const card = DOM.get(`card${i}`);
            if (!lockedIndices.includes(i - 1)) {
                if (card) card.classList.add('spinning');
                startRAF(`p${i}`, 'perk', i);
            }
        }

        let nextSpunPerks = [];
        let newPerkIdx = 0;
        for (let i = 0; i < 4; i++) {
            if (lockedIndices.includes(i)) {
                nextSpunPerks[i] = dbdBucket.currentSpunPerks[i]; 
            } else {
                nextSpunPerks[i] = newPerks[newPerkIdx++] || null; 
            }
        }
        dbdBucket.currentSpunPerks = nextSpunPerks;

        newPerks.forEach(p => {
            if (p) new Image().src = path + p.file;
        });

        let unlockedIndices = [1, 2, 3, 4].filter(i => !lockedIndices.includes(i - 1));

        setTimeout(() => {
            if (speedVal === 0) { 
                unlockedIndices.forEach(idx => stopPerk(idx, dbdBucket.currentSpunPerks[idx - 1], path));
                finalize();
            } else { 
                let currentStep = 0;
                const stopSequentially = () => {
                    let idx = unlockedIndices[currentStep];
                    stopPerk(idx, dbdBucket.currentSpunPerks[idx - 1], path);
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
        let finalKillerId;
        
        if (dbdBucket.isRandomKiller && dbdBucket.selectedKillers.length > 0) {
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
            finalKillerId = dbdBucket.isRandomKiller && dbdBucket.selectedKillers.length > 0 
                ? dbdBucket.selectedKillers[Math.floor(Math.random() * dbdBucket.selectedKillers.length)]
                : (dbdBucket.selectedKillers[0] || 'trapper');
            
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

            let spinDuration = (dbdBucket.isRandomKiller && dbdBucket.selectedKillers.length > 1) ? 1200 : 700;

            setTimeout(() => {
                if (dbdBucket.isRandomKiller && dbdBucket.selectedKillers.length > 0) {
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
    const el = DOM.getPerkElements(idx);
    
    if (!item) {
        if (el.img) el.img.style.display = 'none';
        if (el.bg) el.bg.style.display = 'none';
        if (el.name) { el.name.innerText = '없음'; el.name.style.color = '#555'; }
        if (el.cat) el.cat.innerText = '-';
        if (el.card) {
            el.card.classList.remove('spinning');
            el.card.classList.remove('selected', 'killer_perk', 'survivor_perk');
        }
        if (el.tierBox) el.tierBox.style.display = 'none';
        return;
    }

    if (el.img) { el.img.src = path + item.file; el.img.style.display = 'block'; }
    if (el.name) { el.name.innerText = item.name; el.name.style.color = '#ccc'; }
    if (el.cat) el.cat.innerText = item.category;
    
    if (el.card) {
        el.card.classList.remove('spinning'); 
        el.card.classList.add('selected', dbdBucket.currentMode);
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
    dbdBucket.isSpinning = false; 
    const spinBtn = DOM.get('btnSpin');
    if (spinBtn) spinBtn.disabled = false; 
    
    if (dbdBucket.currentMode !== 'killer_addon' && dbdBucket.currentSpunPerks && dbdBucket.currentSpunPerks.length === 4) {
        let validPerks = dbdBucket.currentSpunPerks.filter(p => p !== null);
        const scoreDisplay = DOM.get('averageScoreDisplay');
        if (scoreDisplay) {
            if (validPerks.length > 0) {
                let sum = validPerks.reduce((acc, p) => acc + Number(p.tier || 3), 0);
                let avg = sum / validPerks.length;
                scoreDisplay.innerText = avg.toFixed(2);
                scoreDisplay.className = `avg-score show ${dbdBucket.currentMode === 'killer_perk' ? 'killer-score' : 'survivor-score'}`;
            } else {
                scoreDisplay.innerText = '-';
                scoreDisplay.className = 'avg-score';
            }
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

// 진입점 초기화 실행
try {
    renderKillerPicker();
    updateInterface();
} catch (e) {
    console.error("UI 초기화 구성 도중 에러가 발견되었습니다:", e);
}

// ============================================================================
// 9. 동적 DOM 이벤트 핸들링 허브
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
    // 9-0. 자물쇠(Lock) 동적 리스너 루프 바인딩
    for (let i = 1; i <= 4; i++) {
        const lockBtn = DOM.get(`card${i}`);
        if (lockBtn) {
            lockBtn.addEventListener('click', () => {
                toggleLock(i);
            });
        }
    }

    // 9-1. 헤더 타이틀 클릭 모드 변경
    const headerTitle = DOM.get('headerTitle');
    if (headerTitle) headerTitle.addEventListener('click', toggleMode);

    // 9-2. 우측 탭 스위치 로직 연동
    const tabTier = DOM.get('tabTier');
    const tabChosung = DOM.get('tabChosung');
    const tierContainer = DOM.get('tierFilterContainer');
    const chosungContainer = DOM.get('chosungFilterContainer');
    
    if (tabTier && tabChosung) {
        tabTier.addEventListener('click', () => {
            if (dbdBucket.isSpinning) return;
            dbdBucket.currentFilterType = 'tier';
            tabTier.classList.add('active');
            tabChosung.classList.remove('active');
            tierContainer.classList.remove('hide');
            chosungContainer.classList.add('hide');
        });
        
        tabChosung.addEventListener('click', () => {
            if (dbdBucket.isSpinning) return;
            dbdBucket.currentFilterType = 'chosung';
            tabChosung.classList.add('active');
            tabTier.classList.remove('active');
            chosungContainer.classList.remove('hide');
            tierContainer.classList.add('hide');
        });
    }

    // 9-3. 티어 및 초성 버튼 클릭 위임 처리
    if (tierContainer) {
        tierContainer.addEventListener('click', (e) => {
            if (dbdBucket.isSpinning) return;
            const targetBtn = e.target.closest('.tier-btn');
            if (targetBtn) {
                const tierVal = targetBtn.getAttribute('data-tier');
                if (tierVal) setTierFilter(tierVal);
            }
        });
    }

    if (chosungContainer) {
        chosungContainer.addEventListener('click', (e) => {
            if (dbdBucket.isSpinning) return;
            const targetBtn = e.target.closest('.cho-btn');
            
            if (targetBtn && !targetBtn.classList.contains('disabled-btn')) {
                if (targetBtn.classList.contains('clear-btn')) {
                    dbdBucket.currentChosungFilter = [];
                    document.querySelectorAll('.cho-grid .cho-btn').forEach(btn => btn.classList.remove('active'));
                } else {
                    const choVal = targetBtn.getAttribute('data-cho');
                    if (choVal) {
                        targetBtn.classList.toggle('active');
                        
                        if (targetBtn.classList.contains('active')) {
                            if (!dbdBucket.currentChosungFilter.includes(choVal)) {
                                dbdBucket.currentChosungFilter.push(choVal);
                            }
                        } else {
                            dbdBucket.currentChosungFilter = dbdBucket.currentChosungFilter.filter(v => v !== choVal);
                        }
                    }
                }
            }
        });
    }

    // 9-4. 나머지 이벤트 바인딩
    const btnUpdateNotes = DOM.get('btnUpdateNotes');
    if (btnUpdateNotes) btnUpdateNotes.addEventListener('click', openUpdateNotes);

    const watermarkBtn = DOM.get('watermarkBtn');
    if (watermarkBtn) watermarkBtn.addEventListener('click', openUpdateNotes);

    const btnRandomKiller = DOM.get('btnRandomKiller');
    if (btnRandomKiller) btnRandomKiller.addEventListener('click', toggleRandomKiller);

    const btnSelectAllKillers = DOM.get('btnSelectAllKillers');
    if (btnSelectAllKillers) btnSelectAllKillers.addEventListener('click', selectAllKillers);

    const btnSpin = DOM.get('btnSpin');
    if (btnSpin) btnSpin.addEventListener('click', startSequence);

    const speedRange = DOM.get('speedRange');
    if (speedRange) speedRange.addEventListener('input', updateSpeedText);

    const btnCloseModal = DOM.get('btnCloseModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeUpdateNotes);

    const updateModalOverlay = DOM.get('updateModalOverlay');
    if (updateModalOverlay) updateModalOverlay.addEventListener('click', closeUpdateNotes);

    const callKillerList = DOM.get('callKillerList');
    const addonRightPanel = DOM.get('addonRightPanel');
    if (callKillerList) callKillerList.addEventListener('click', () => {
        addonRightPanel.classList.contains('active') ? addonRightPanel.classList.remove('active') : addonRightPanel.classList.add('active');
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === "Escape") {
            const modal = DOM.get('updateModalOverlay');
            if (modal && modal.classList.contains('show')) {
                closeUpdateNotes();
            }
        }
    });

    // 페이지 진입 시 업데이트 노트 자동 출력
    openUpdateNotes();
});