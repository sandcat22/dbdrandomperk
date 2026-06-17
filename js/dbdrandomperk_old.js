// ==========================================
// ✅ V251: 최적화 애니메이션 엔진 + 샌드캣님 커스텀 로직 융합본
// 친구분의 rAF 엔진에 단일 살인마 속도업 및 데이터 검사기 탑재 완료
// ==========================================

// 전역 맵 및 데이터 초기화
const killerNameMap = typeof killers !== 'undefined' ? Object.fromEntries(killers.map(k => [k.id, k.name])) : {};
const survivorNameMap = typeof survivors !== 'undefined' ? Object.fromEntries(survivors.map(s => [s.id, s.name])) : {};

// 티어 할당 함수 정의 및 실행
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

if (typeof killerPerkData !== 'undefined' && typeof killerTiers !== 'undefined') {
    assignTiers(killerPerkData, killerTiers);
}
if (typeof survivorPerkData !== 'undefined' && typeof survivorTiers !== 'undefined') {
    assignTiers(survivorPerkData, survivorTiers);
}

// 상태 제어 변수군
let currentMode = 'killer_perk'; 
let isSpinning = false;
let currentTierFilter = 'all';
let currentSpunPerks = [];
let currentSpinPools = {}; // 💡 룰렛 회전 시 사용할 가변 데이터 풀 (애드온 다중 선택 시 사용)

// requestAnimationFrame 관리를 위한 애니메이션 상태 객체
const animationContext = {
    activeIds: new Set(), // 현재 애니메이션이 구동 중인 슬롯 ID들
    lastTimes: {},        // 슬롯별 마지막 프레임 업데이트 시간 기록
    currentItems: {}      // 중복 DOM 업데이트 방지를 위한 현재 아이템 캐시
};

let isRandomKiller = false;
let selectedKillers = ['trapper'];
let spinTick = 0;

window.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof PATHS !== 'undefined') {
            for (let i = 0; i < 15; i++) {
                if (typeof killerPerkData !== 'undefined' && killerPerkData[i]) {
                    new Image().src = PATHS.PERK_K + killerPerkData[i].file;
                }
                if (typeof survivorPerkData !== 'undefined' && survivorPerkData[i]) {
                    new Image().src = PATHS.PERK_S + survivorPerkData[i].file;
                }
            }
            if (typeof killers !== 'undefined') {
                killers.slice(0, 10).forEach(k => {
                    new Image().src = PATHS.PORTRAIT + k.id + '.webp';
                });
            }
        }
        
        // 💡 비동기 데이터 무결성 검사기 실행 (1.5초 뒤)
        setTimeout(() => validateData(), 1500);

    } catch (e) {
        console.error("사전 이미지 로딩 중 에러 발생:", e);
    }
});

// 티어 필터 UI 변경
function setTierFilter(val) {
    if (isSpinning) return;
    currentTierFilter = val;
    document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById('btnFilter_' + val);
    if (targetBtn) targetBtn.classList.add('active');
}

function toggleMode() {
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
}

// UI 스타일 인터페이스 업데이트
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
        updateSpeedText();
        
        if (rightPanel) rightPanel.style.display = 'flex'; 
        document.querySelectorAll('.perk-bg').forEach(bg => {
            bg.src = isKiller ? "images/perk_bg.png" : "images/perk_bg_survivor.png";
        });
    }
}

function resetSlots() {
    const scoreDisplay = document.getElementById('averageScoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.innerText = '-';
        scoreDisplay.className = 'avg-score';
    }
    currentSpunPerks = [];
    currentSpinPools = {};
    
    // 기존 모든 애니메이션 루프 중지 및 캐시 제거
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
            slot.classList.remove('selected', 'spinning', 'error-active');
        }
    }
    
    const killerImg = document.getElementById('mainKillerImg');
    if (killerImg) killerImg.classList.remove('spinning');
    
    const kName = document.getElementById('mainKillerName');
    if (kName && selectedKillers.length > 0) {
        kName.innerText = killerNameMap[selectedKillers[0]] || '';
    }
}

// 이미지 핸들러
function handleImgError(img) { 
    if (!img) return;
    img.style.display = 'none'; 
    if (img.parentElement) img.parentElement.classList.add('error-active'); 
}
function handleImgLoad(img) { 
    if (!img) return;
    if (img.parentElement) img.parentElement.classList.remove('error-active'); 
    img.style.display = 'block'; 
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
        btn.onclick = () => selectKiller(k.id);
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

function selectAllKillers() {
    if (isSpinning || typeof killers === 'undefined') return;
    isRandomKiller = true;
    const rndBtn = document.getElementById('btnRandomKiller');
    if (rndBtn) rndBtn.classList.add('active');
    
    selectedKillers = killers.map(k => k.id);
    document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.add('active'));
}

function toggleRandomKiller() {
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
}

function selectKiller(id) {
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
}

// 셔플 알고리즘
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

// 티어 필터 룰렛 추출 연산
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
                    isValid = false; 
                    break;
                }
                let r;
                do { 
                    r = Math.floor(Math.random() * pool.length); 
                } while (usedIndices[t].has(r));
                usedIndices[t].add(r);
                combo.push(pool[r]);
            }
            if (isValid) return combo;
        }
    }
    
    let tempArray = [...data];
    return shuffleArray(tempArray).slice(0, 4);
}

// 통합 고성능 프레임 가로채기 틱 애니메이션 엔진 (rAF 기반)
function loopAnimation(timestamp) {
    animationContext.activeIds.forEach(id => {
        if (!animationContext.lastTimes[id]) animationContext.lastTimes[id] = timestamp;
        
        // 50ms마다 1프레임 전환 기획 규격 동기화
        if (timestamp - animationContext.lastTimes[id] >= 50) {
            animationContext.lastTimes[id] = timestamp;
            spinTick++;

            if (id.startsWith('p')) {
                // 💡 버그 픽스: 퍽 슬롯 스핀 제어 로직 완전 정상화
                const idx = id.slice(1);
                const data = currentMode === 'killer_perk' ? killerPerkData : survivorPerkData;
                const path = currentMode === 'killer_perk' ? PATHS.PERK_K : PATHS.PERK_S;
                
                if (data && data.length > 0) {
                    const rnd = data[spinTick % Math.min(15, data.length)];
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
                // 💡 버그 픽스: 트래퍼만 나오던 하드코딩 제거, 선택된 살인마 기반 풀 사용
                const idx = id.slice(1);
                let spinData = currentSpinPools[id] || []; 
                
                if (spinData && spinData.length > 0) {
                    const rnd = spinData[spinTick % Math.min(15, spinData.length)];
                    if (rnd && animationContext.currentItems[id] !== rnd.file) {
                        animationContext.currentItems[id] = rnd.file;

                        const img = document.getElementById(`adImg${idx}`);
                        const bg = document.getElementById(`adBg${idx}`);
                        const name = document.getElementById(`adName${idx}`);

                        // mixedData의 경우 fullPath를 지니도록 설계됨
                        if (img) { img.src = rnd.fullPath; img.style.display = 'block'; }
                        if (bg && typeof PATHS !== 'undefined' && typeof rarityBgs !== 'undefined') {
                            bg.src = PATHS.ADDON_BG + rarityBgs[rnd.rarity]; 
                            bg.style.display = 'block';
                        }
                        if (name) name.innerText = rnd.name;
                    }
                }
            } else if (id === 'killer') {
                // 살인마 초상화 스핀 제어
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

    // 구동 중인 애니메이션이 남아있는 경우 재귀적 서브 루틴 요청
    if (animationContext.activeIds.size > 0) {
        requestAnimationFrame(loopAnimation);
    }
}

// 애니메이션 구동 신호소 등록
function startRAF(id) {
    animationContext.activeIds.add(id);
    animationContext.lastTimes[id] = 0;
    if (animationContext.activeIds.size === 1) {
        requestAnimationFrame(loopAnimation);
    }
}

// 애니메이션 해제 신호소 등록
function stopRAF(id) {
    animationContext.activeIds.delete(id);
    delete animationContext.lastTimes[id];
    delete animationContext.currentItems[id];
}

// 메인 시퀀스 스타트 핸들러
function startSequence() {
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

        // V230 핵심 프리로드 캐싱 호출
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
        // ADDON 모드 시작
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
        
        // 💡 샌드캣 커스텀: 다중 살인마 선택 시 짬뽕 애드온 풀 구성
        let mixedAddonData = [];
        if (isRandomKiller && selectedKillers.length > 0) {
            selectedKillers.forEach(kId => {
                const kData = killerAddons[kId];
                if (kData && kData.length > 0) {
                    let fId = kId === 'theFirst' ? 'theFirst' : kId;
                    kData.forEach(ad => {
                        mixedAddonData.push({ ...ad, fullPath: `${PATHS.ADDON}${fId}/${ad.file}` });
                    });
                }
            });
            shuffleArray(mixedAddonData);
        } else {
            mixedAddonData = activeData.map(ad => ({ ...ad, fullPath: path + ad.file }));
        }

        // 스핀 엔진이 참고할 수 있도록 풀 저장
        currentSpinPools['a1'] = mixedAddonData;
        currentSpinPools['a2'] = [...mixedAddonData].reverse();

        // 살인마 초상화 스핀 애니메이션 활성화 (rAF 기반)
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

        // 💡 샌드캣 커스텀: 단일 살인마 선택 시 스핀 시간 단축 (1200ms -> 700ms)
        const addonSpinDuration = (!isRandomKiller || selectedKillers.length <= 1) ? 700 : 1200;

        // 타이머 타임아웃 종료 스케줄링
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
                alert(`🚨 [${killerNameMap[finalKillerId]}] 의 애드온 데이터가 비어있습니다!`); 
                finalize();
            } else {
                stopAddon(1, shuffled[0], path); 
                stopAddon(2, shuffled[1], path);
                finalize();
            }
        }, addonSpinDuration); 
    }
}

// 스핀 정지 및 값 동기화 확정
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

// 애드온 스핀 정지 및 확정
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

// 결과 분석 연산 종료 및 비활성화 처리
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

// 속도 텍스트 레이블 갱신
function updateSpeedText() {
    const slider = document.getElementById('speedRange');
    const status = document.getElementById('speedStatus');
    if (!slider || !status) return;
    
    const val = slider.value;
    const texts = ["동시", "빠름", "보통", "느림"];
    status.innerText = texts[val] || "보통";
}

// 모달 이벤트 제어기
function openUpdateNotes() {
    const modal = document.getElementById('updateModalOverlay');
    if (modal) modal.classList.add('show');
    try {
        const iframe = document.getElementById('notesIframe');
        if (iframe) iframe.contentWindow.location.reload(true);
    } catch (e) {
        console.error("업데이트 노트 프레임 리로드 실패:", e);
    }
}

function closeUpdateNotes(event) {
    if (!event || event.target.id === 'updateModalOverlay' || event.target.className === 'close-modal') {
        const modal = document.getElementById('updateModalOverlay');
        if (modal) modal.classList.remove('show');
    }
}

// ESC 키 모달 닫기
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        const modal = document.getElementById('updateModalOverlay');
        if (modal && modal.classList.contains('show')) {
            closeUpdateNotes();
        }
    }
});

function validateData() {
    let errorLogs = [];
    let totalAddons = 0;
    
    if (typeof killers !== 'undefined' && typeof killerAddons !== 'undefined') {
        killers.forEach(k => {
            const addons = killerAddons[k.id];
            if (!addons) errorLogs.push(`[${k.name}] 애드온 누락`);
            else {
                totalAddons += addons.length;
                if (addons.length !== 20) errorLogs.push(`[${k.name}] 애드온 개수 불일치(${addons.length}개)`);
            }
        });
    }

    if (typeof killerPerkData !== 'undefined' && typeof killerNameMap !== 'undefined') {
        const validKillerCategories = [...Object.values(killerNameMap), "공용 퍽"];
        killerPerkData.forEach(p => {
            if (!validKillerCategories.includes(p.category)) errorLogs.push(`[킬러 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });
    }

    if (typeof survivorPerkData !== 'undefined' && typeof survivorNameMap !== 'undefined') {
        const validSurvivorCategories = [...Object.values(survivorNameMap), "공용 퍽"];
        survivorPerkData.forEach(p => {
            if (!validSurvivorCategories.includes(p.category)) errorLogs.push(`[생존자 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });
    }

    const infoArea = document.querySelector('.bottom-info-area');
    if (infoArea) {
        const dataDash = document.createElement('div');
        dataDash.style.fontSize = '11px';
        dataDash.style.color = 'rgba(255,255,255,0.3)';
        dataDash.style.marginTop = '5px';
        
        const kLen = typeof killers !== 'undefined' ? killers.length : 0;
        const sLen = typeof survivors !== 'undefined' ? survivors.length : 0;
        const kpLen = typeof killerPerkData !== 'undefined' ? killerPerkData.length : 0;
        const spLen = typeof survivorPerkData !== 'undefined' ? survivorPerkData.length : 0;
        
        dataDash.innerText = `K:${kLen} | S:${sLen} | KP:${kpLen} | SP:${spLen} | AD:${totalAddons}`;
        infoArea.appendChild(dataDash);
        
        if (errorLogs.length > 0) {
            const errorBtn = document.createElement('button');
            errorBtn.innerHTML = '🚨 DATA ERROR';
            errorBtn.style.cssText = 'background: #ff3333; color: white; border: none; padding: 5px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 5px; font-size: 11px; animation: blink 1s infinite;';
            errorBtn.onclick = () => alert("🚨 발견된 데이터 오류 내역 🚨\n\n" + errorLogs.join('\n'));
            infoArea.appendChild(errorBtn);

            const style = document.createElement('style');
            style.innerHTML = `@keyframes blink { 50% { opacity: 0.5; } }`;
            document.head.appendChild(style);
        }
    }
}