// ==========================================
// ✅ V246: 순수 로직 및 완벽한 이벤트 바인딩
// HTML과 완벽하게 호환되며 멈춤 현상(프리징)을 방지합니다.
// ==========================================

const App = {
    state: {
        currentMode: 'killer_perk',
        isSpinning: false,
        tierFilter: 'all',
        isRandomKiller: false,
        selectedKillers: ['trapper'],
        currentSpunPerks: [],
        spinIntervals: {},
        spinPools: { p1: [], p2: [], p3: [], p4: [], a1: [], a2: [] }
    },

    ui: {},

    init() {
        try {
            // 1. 티어 점수 자동 할당 (데이터 파일에서 불러온 값에 티어 세팅)
            this.assignTiersToData();
            
            // 2. 화면 요소 찾기
            this.cacheDOM();
            
            // 3. 살인마 리스트 화면에 그리기
            this.renderKillerPicker();
            this.updateInterface();
            this.ui.perkWrapper.style.display = 'flex';

            // 4. 비동기 백그라운드 프리로드 (체감 렉 제로화, 1초 뒤 시작)
            setTimeout(() => this.preloadImagesSequentially(), 1000);
            
            // 5. 샌드캣 전용: 비동기 데이터 검사기 (1.5초 뒤 시작)
            setTimeout(() => this.validateData(), 1500);
            
            console.log("✅ 앱(로직)이 완벽하게 초기화되었습니다!");
        } catch (e) {
            console.error("🚨 앱 초기화 중 에러 발생:", e);
        }
    },

    assignTiersToData() {
        const assign = (dataArray, tierDict) => {
            if(!dataArray || !tierDict) return;
            dataArray.forEach(perk => {
                perk.tier = 3; 
                for(let t = 1; t <= 5; t++) {
                    if(tierDict[t] && tierDict[t].includes(perk.name)) {
                        perk.tier = t; break;
                    }
                }
            });
        };
        assign(killerPerkData, killerTiers);
        assign(survivorPerkData, survivorTiers);
    },

    cacheDOM() {
        this.ui.h1 = document.getElementById('headerTitle');
        this.ui.btnSpin = document.getElementById('btnSpin');
        this.ui.speedRange = document.getElementById('speedRange');
        this.ui.speedStatus = document.getElementById('speedStatus');
        this.ui.rightPanel = document.getElementById('rightPanel');
        this.ui.perkWrapper = document.getElementById('perkWrapper');
        this.ui.addonWrapper = document.getElementById('addonWrapper');
        this.ui.scoreDisplay = document.getElementById('averageScoreDisplay');
        this.ui.mainKillerImg = document.getElementById('mainKillerImg');
        this.ui.mainKillerName = document.getElementById('mainKillerName');
        this.ui.killerListContainer = document.getElementById('killerListContainer');
        this.ui.modalOverlay = document.getElementById('updateModalOverlay');
    },

    preloadImagesSequentially(delay = 20) {
        const allImgs = [
            ...killerPerkData.map(p => PATHS.PERK_K + p.file),
            ...survivorPerkData.map(p => PATHS.PERK_S + p.file),
            ...killers.map(k => PATHS.PORTRAIT + k.id + '.webp')
        ];
        
        killers.forEach(k => {
            const addons = killerAddons[k.id];
            if (addons) {
                let folderId = k.id === 'theFirst' ? 'theFirst' : k.id;
                addons.forEach(ad => allImgs.push(`${PATHS.ADDON}${folderId}/${ad.file}`));
            }
        });

        let index = 0;
        const interval = setInterval(() => {
            if (index >= allImgs.length) {
                clearInterval(interval);
                return;
            }
            const img = new Image();
            img.src = allImgs[index]; 
            index++;
        }, delay);
    },

    toggleMode() {
        if (this.state.isSpinning) return;
        
        if (this.state.currentMode === 'killer_perk') {
            this.state.currentMode = 'survivor_perk';
            this.ui.perkWrapper.style.display = 'flex'; this.ui.addonWrapper.style.display = 'none';
        } else if (this.state.currentMode === 'survivor_perk') {
            this.state.currentMode = 'killer_addon';
            this.ui.perkWrapper.style.display = 'none'; this.ui.addonWrapper.style.display = 'flex'; 
        } else {
            this.state.currentMode = 'killer_perk';
            this.ui.perkWrapper.style.display = 'flex'; this.ui.addonWrapper.style.display = 'none';
        }
        this.updateInterface();
        this.resetSlots();
    },

    updateInterface() {
        document.body.className = this.state.currentMode === 'killer_perk' ? 'mode-killer' : 'mode-survivor';
        
        if (this.state.currentMode === 'killer_addon') {
            this.ui.h1.innerText = "🟣 KILLER ADDON 🟣"; this.ui.h1.style.color = "#E040FB";
            this.ui.btnSpin.className = "start-btn addon-btn"; this.ui.speedStatus.style.color = "#aaa";
            this.ui.speedRange.disabled = true; this.ui.speedStatus.innerText = "고정";
            if(this.ui.rightPanel) this.ui.rightPanel.style.display = 'none';
        } else {
            this.ui.h1.innerText = this.state.currentMode === 'killer_perk' ? "🩸 KILLER PERK 🩸" : "🔹 SURVIVOR PERK 🔹";
            this.ui.h1.style.color = this.state.currentMode === 'killer_perk' ? "#ff3333" : "#4da6ff";
            this.ui.btnSpin.className = this.state.currentMode === 'killer_perk' ? "start-btn killer-btn" : "start-btn survivor-btn";
            this.ui.speedStatus.style.color = this.state.currentMode === 'killer_perk' ? "#ff3333" : "#4da6ff";
            this.ui.speedRange.disabled = false; this.updateSpeedText(this.ui.speedRange ? this.ui.speedRange.value : "2");
            if(this.ui.rightPanel) this.ui.rightPanel.style.display = 'flex';
            
            document.querySelectorAll('.perk-bg').forEach(bg => {
                bg.src = this.state.currentMode === 'killer_perk' ? "assets/perk_bg.png" : "assets/perk_bg_survivor.png";
            });
        }
    },

    updateSpeedText(val) {
        const texts = ["동시", "빠름", "보통", "느림"];
        if(this.ui.speedStatus) this.ui.speedStatus.innerText = texts[val];
    },

    resetSlots() {
        if(this.ui.scoreDisplay) {
            this.ui.scoreDisplay.innerText = '-';
            this.ui.scoreDisplay.className = 'avg-score';
        }
        this.state.currentSpunPerks = [];
        
        for(let i=1; i<=4; i++){
            document.getElementById(`img${i}`).style.display='none';
            document.getElementById(`bg${i}`).style.display='none';
            document.getElementById(`name${i}`).innerText='';
            document.getElementById(`cat${i}`).innerText='';
            document.getElementById(`card${i}`).className = 'perk-card';
            document.getElementById(`tierBox${i}`).style.display = 'none';
        }
        for(let i=1; i<=2; i++){
            document.getElementById(`adImg${i}`).style.display='none';
            document.getElementById(`adBg${i}`).style.display='none';
            document.getElementById(`adName${i}`).innerText='';
            const slot = document.getElementById(`slot${i}`);
            if (slot) {
                slot.className = 'addon-slot';
                slot.classList.remove('selected', 'spinning');
            }
        }
        if(this.ui.mainKillerImg) this.ui.mainKillerImg.classList.remove('spinning');
        if(this.ui.mainKillerName && this.state.selectedKillers.length > 0) {
            this.ui.mainKillerName.innerText = killerNameMap[this.state.selectedKillers[0]] || '';
        }
    },

    renderKillerPicker() {
        if(this.ui.killerListContainer.innerHTML !== "") return; 
        killers.forEach(k => {
            const btn = document.createElement('button');
            btn.className = 'killer-list-btn killer-item-btn';
            btn.id = 'kbtn_' + k.id;
            btn.innerText = k.name;
            // 리스트에서 직접 클릭 시 동작하도록 바인딩
            btn.onclick = () => this.selectKiller(k.id);
            this.ui.killerListContainer.appendChild(btn);
        });
        const initId = this.state.selectedKillers[0] || 'trapper';
        document.getElementById('kbtn_' + initId).classList.add('active');
        this.ui.mainKillerImg.src = PATHS.PORTRAIT + initId + ".webp";
        this.ui.mainKillerName.innerText = killerNameMap[initId];
    },

    selectKiller(id) {
        if(this.state.isSpinning) return;
        
        if(this.state.isRandomKiller) {
            const idx = this.state.selectedKillers.indexOf(id);
            if(idx > -1) {
                if(this.state.selectedKillers.length > 1) { 
                    this.state.selectedKillers.splice(idx, 1);
                    document.getElementById('kbtn_' + id).classList.remove('active');
                }
            } else {
                this.state.selectedKillers.push(id);
                document.getElementById('kbtn_' + id).classList.add('active');
            }
        } else {
            this.state.selectedKillers = [id];
            document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('kbtn_' + id).classList.add('active');
            this.ui.mainKillerImg.src = PATHS.PORTRAIT + id + ".webp";
            this.ui.mainKillerName.innerText = killerNameMap[id];
            this.resetSlots();
        }
    },

    selectAllKillers() {
        if(this.state.isSpinning) return;
        this.state.isRandomKiller = true;
        const btnRandomKiller = document.getElementById('btnRandomKiller');
        if(btnRandomKiller) btnRandomKiller.classList.add('active');
        this.state.selectedKillers = killers.map(k => k.id);
        document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.add('active'));
    },

    toggleRandomKiller() {
        if(this.state.isSpinning) return;
        this.state.isRandomKiller = !this.state.isRandomKiller;
        const btnRandomKiller = document.getElementById('btnRandomKiller');
        if(btnRandomKiller) btnRandomKiller.classList.toggle('active', this.state.isRandomKiller);
        
        if(!this.state.isRandomKiller) {
            const idToKeep = this.state.selectedKillers[0] || 'trapper';
            this.state.selectedKillers = [idToKeep];
            document.querySelectorAll('.killer-item-btn').forEach(btn => btn.classList.remove('active'));
            const keepBtn = document.getElementById('kbtn_' + idToKeep);
            if(keepBtn) keepBtn.classList.add('active');
            this.ui.mainKillerImg.src = PATHS.PORTRAIT + idToKeep + ".webp";
            this.ui.mainKillerName.innerText = killerNameMap[idToKeep];
        }
    },

    setTierFilter(val) {
        if(this.state.isSpinning) return;
        this.state.tierFilter = val;
        document.querySelectorAll('.tier-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('btnFilter_' + val).classList.add('active');
    },

    openUpdateNotes() {
        this.ui.modalOverlay.classList.add('show');
        try { document.getElementById('notesIframe').contentWindow.location.reload(true); } catch(e) {}
    },

    closeUpdateNotes() {
        if(this.ui.modalOverlay) this.ui.modalOverlay.classList.remove('show');
    },

    buildSpinPool(sourceData, size) {
        if (!sourceData || sourceData.length === 0) return [];
        let pool = [];
        let temp = [...sourceData];
        for (let i = temp.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [temp[i], temp[j]] = [temp[j], temp[i]];
        }
        while(pool.length < size) {
            pool = pool.concat(temp);
        }
        return pool.slice(0, size);
    },

    getRandomPerks(data, filterVal) {
        if (!data || data.length === 0) return [];
        let tempArray = [...data];
        for (let i = tempArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tempArray[i], tempArray[j]] = [tempArray[j], tempArray[i]];
        }

        if (filterVal === 'all') return tempArray.slice(0, 4);

        let pools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        data.forEach(p => { 
            const t = p.tier || 3;
            if (pools[t]) pools[t].push(p); 
        });

        let minSum = 0, maxSum = 20, targetTiers = [];
        if (filterVal === '4') { minSum = 16; maxSum = 20; targetTiers = [3, 4, 4, 5, 5]; }
        else if (filterVal === '3') { minSum = 12; maxSum = 15; targetTiers = [2, 3, 3, 4, 4]; }
        else if (filterVal === '2') { minSum = 8; maxSum = 11; targetTiers = [1, 2, 2, 3, 3]; }
        else if (filterVal === '1') { minSum = 4; maxSum = 7; targetTiers = [1, 1, 2]; }

        let attempts = 0;
        while(attempts < 2000) {
            attempts++;
            let selectedTiers = [];
            for(let i=0; i<4; i++) selectedTiers.push(targetTiers[Math.floor(Math.random() * targetTiers.length)]);
            
            let sum = selectedTiers.reduce((a,b) => a+b, 0);
            if (sum >= minSum && sum <= maxSum) {
                let combo = [];
                let usedIndices = { 1:new Set(), 2:new Set(), 3:new Set(), 4:new Set(), 5:new Set() };
                let isValid = true;
                
                for(let t of selectedTiers) {
                    let pool = pools[t];
                    if (!pool || pool.length === 0 || usedIndices[t].size >= pool.length) { isValid = false; break; }
                    let r;
                    do { r = Math.floor(Math.random() * pool.length); } while(usedIndices[t].has(r));
                    usedIndices[t].add(r);
                    combo.push(pool[r]);
                }
                if (isValid) return combo;
            }
        }
        return tempArray.slice(0, 4);
    },

    startSequence() {
        if (this.state.isSpinning) return;
        
        try {
            for (let key in this.state.spinIntervals) clearInterval(this.state.spinIntervals[key]);
            this.state.spinIntervals = {};

            this.state.isSpinning = true;
            if(this.ui.btnSpin) this.ui.btnSpin.disabled = true;
            this.resetSlots(); 

            let activeData, path, type;
            if (this.state.currentMode === 'killer_perk') { activeData = killerPerkData; path = PATHS.PERK_K; type = 'perk'; }
            else if (this.state.currentMode === 'survivor_perk') { activeData = survivorPerkData; path = PATHS.PERK_S; type = 'perk'; }
            else { type = 'addon'; }

            if (type === 'perk') {
                const speedVal = parseInt(this.ui.speedRange ? this.ui.speedRange.value : 2);
                const currentDelay = [0, 600, 1300, 2600][speedVal];
                
                this.state.currentSpunPerks = this.getRandomPerks(activeData, this.state.tierFilter);

                for(let i=1; i<=4; i++) {
                    this.state.spinPools[`p${i}`] = this.buildSpinPool(activeData, 30);
                    document.getElementById(`card${i}`).classList.add('spinning');
                    this.spinPerk(i, this.state.spinPools[`p${i}`], path, i * 5);
                }

                if (speedVal === 0) { 
                    setTimeout(() => {
                        for(let i=1; i<=4; i++) this.stopPerk(i, this.state.currentSpunPerks[i-1], path);
                        this.finalizeSpin();
                    }, 500);
                } else { 
                    let currentIdx = 1;
                    const stopSequentially = () => {
                        this.stopPerk(currentIdx, this.state.currentSpunPerks[currentIdx-1], path);
                        if (currentIdx === 4) { this.finalizeSpin(); return; }
                        currentIdx++; setTimeout(stopSequentially, currentDelay);
                    };
                    setTimeout(stopSequentially, 1000);
                }
            } else {
                let finalKillerId = this.state.isRandomKiller && this.state.selectedKillers.length > 0
                    ? this.state.selectedKillers[Math.floor(Math.random() * this.state.selectedKillers.length)]
                    : (this.state.selectedKillers[0] || 'trapper');

                activeData = killerAddons[finalKillerId] || [];
                
                if (activeData.length === 0) {
                    alert(`🚨 [${killerNameMap[finalKillerId]}] 의 애드온 데이터가 비어있습니다!`);
                    this.finalizeSpin();
                    return;
                }

                let folderId = finalKillerId === 'theFirst' ? 'theFirst' : finalKillerId;
                path = `${PATHS.ADDON}${folderId}/`;

                let shuffled = [...activeData];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }

                let mixedAddonData = [];
                if (this.state.isRandomKiller && this.state.selectedKillers.length > 0) {
                    this.state.selectedKillers.forEach(kId => {
                        const kData = killerAddons[kId];
                        if(kData && kData.length > 0) {
                            kData.forEach(ad => {
                                let fId = kId === 'theFirst' ? 'theFirst' : kId;
                                mixedAddonData.push({ ...ad, fullPath: `${PATHS.ADDON}${fId}/${ad.file}` });
                            });
                        }
                    });
                } else {
                    mixedAddonData = activeData.map(ad => ({ ...ad, fullPath: path + ad.file }));
                }

                if (this.state.isRandomKiller && this.state.selectedKillers.length > 0) {
                    this.ui.mainKillerImg.classList.add('spinning');
                    this.state.spinIntervals['killer'] = setInterval(() => {
                        const tempId = this.state.selectedKillers[Math.floor(Math.random() * this.state.selectedKillers.length)];
                        this.ui.mainKillerImg.src = `${PATHS.PORTRAIT}${tempId}.webp`;
                        this.ui.mainKillerName.innerText = killerNameMap[tempId];
                    }, 80);
                }

                for(let i=1; i<=2; i++) {
                    document.getElementById(`slot${i}`).classList.add('spinning');
                    this.state.spinPools[`a${i}`] = this.buildSpinPool(mixedAddonData, 30);
                    this.spinAddon(i, this.state.spinPools[`a${i}`], i * 7); 
                }

                // 💡 단일 살인마 선택 시 스핀 시간 단축 (1200ms -> 700ms, 약 3/5 수준)
                let addonSpinDuration = 1200;
                if (!this.state.isRandomKiller || this.state.selectedKillers.length <= 1) {
                    addonSpinDuration = 700;
                }

                setTimeout(() => {
                    if (this.state.isRandomKiller && this.state.selectedKillers.length > 0) {
                        clearInterval(this.state.spinIntervals['killer']);
                        this.ui.mainKillerImg.classList.remove('spinning');
                        this.ui.mainKillerImg.src = `${PATHS.PORTRAIT}${finalKillerId}.webp`;
                        this.ui.mainKillerName.innerText = killerNameMap[finalKillerId];
                    } else {
                        this.ui.mainKillerName.innerText = killerNameMap[finalKillerId];
                    }

                    this.stopAddon(1, shuffled[0], path); 
                    this.stopAddon(2, shuffled[1], path);
                    this.finalizeSpin();
                }, addonSpinDuration); 
            }
        } catch (e) {
            console.error("🚨 시퀀스 실행 중 치명적 에러 발생:", e);
            this.finalizeSpin();
        }
    },

    spinPerk(idx, poolData, path, offset) {
        if (!poolData || poolData.length === 0) return;
        let localTick = offset;
        this.state.spinIntervals[`p${idx}`] = setInterval(() => {
            localTick++;
            const rnd = poolData[localTick % poolData.length]; 
            if(!rnd) return;
            document.getElementById(`img${idx}`).src = path + rnd.file;
            document.getElementById(`img${idx}`).style.display = 'block'; 
            document.getElementById(`bg${idx}`).style.display = 'block';
            document.getElementById(`name${idx}`).innerText = rnd.name;
            document.getElementById(`cat${idx}`).innerText = rnd.category;
        }, 45); 
    },

    stopPerk(idx, item, path) {
        clearInterval(this.state.spinIntervals[`p${idx}`]);
        if (!item) return;

        document.getElementById(`img${idx}`).src = path + item.file;
        document.getElementById(`img${idx}`).style.display = 'block'; 
        document.getElementById(`name${idx}`).innerText = item.name;
        document.getElementById(`cat${idx}`).innerText = item.category;
        
        const card = document.getElementById(`card${idx}`);
        card.classList.remove('spinning'); 
        card.classList.add('selected', this.state.currentMode);

        document.getElementById(`bg${idx}`).style.display = 'block';

        const tierBox = document.getElementById(`tierBox${idx}`);
        document.getElementById(`tierImg${idx}`).src = `assets/tier_logo${item.tier || 3}.png`; 
        tierBox.style.display = 'block';
    },

    spinAddon(idx, poolData, offset) {
        if (!poolData || poolData.length === 0) return;
        let localTick = offset;
        this.state.spinIntervals[`a${idx}`] = setInterval(() => {
            localTick++;
            const rnd = poolData[localTick % poolData.length];
            if(!rnd) return;
            document.getElementById(`adImg${idx}`).src = rnd.fullPath;
            document.getElementById(`adImg${idx}`).style.display = 'block'; 
            document.getElementById(`adBg${idx}`).src = PATHS.ADDON_BG + rarityBgs[rnd.rarity];
            document.getElementById(`adBg${idx}`).style.display = 'block';
            document.getElementById(`adName${idx}`).innerText = rnd.name;
        }, 55);
    },

    stopAddon(idx, item, path) {
        clearInterval(this.state.spinIntervals[`a${idx}`]);
        if(!item) return;

        document.getElementById(`adImg${idx}`).src = path + item.file;
        document.getElementById(`adImg${idx}`).style.display = 'block'; 
        document.getElementById(`adBg${idx}`).src = PATHS.ADDON_BG + rarityBgs[item.rarity];
        document.getElementById(`adBg${idx}`).style.display = 'block'; 
        document.getElementById(`adName${idx}`).innerText = item.name;
        
        const slot = document.getElementById(`slot${idx}`);
        slot.classList.remove('spinning');
        slot.classList.add('selected');
    },

    finalizeSpin() {
        this.state.isSpinning = false; 
        if(this.ui.btnSpin) this.ui.btnSpin.disabled = false; 
        
        if (this.state.currentMode !== 'killer_addon' && this.state.currentSpunPerks.length === 4) {
            let avg = this.state.currentSpunPerks.reduce((sum, p) => sum + Number(p.tier || 3), 0) / 4;
            if(this.ui.scoreDisplay) {
                this.ui.scoreDisplay.innerText = avg.toFixed(2);
                this.ui.scoreDisplay.className = `avg-score show ${this.state.currentMode === 'killer_perk' ? 'killer-score' : 'survivor-score'}`;
            }
        }
    },

    // ==========================================
    // 🛡️ 비동기 데이터 무결성 검증기
    // ==========================================
    validateData() {
        let errorLogs = [];
        let totalAddons = 0;
        
        // 1. 살인마 애드온 누락 및 개수 검사
        killers.forEach(k => {
            const addons = killerAddons[k.id];
            if (!addons) errorLogs.push(`[${k.name}] 애드온 누락`);
            else {
                totalAddons += addons.length;
                if (addons.length !== 20) errorLogs.push(`[${k.name}] 애드온 개수 불일치(${addons.length}개)`);
            }
        });

        // 2. 살인마 퍽 카테고리(오타) 검사
        const validKillerCategories = [...Object.values(killerNameMap), "공용 퍽"];
        killerPerkData.forEach(p => {
            if (!validKillerCategories.includes(p.category)) errorLogs.push(`[킬러 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });

        // 3. 생존자 퍽 카테고리(오타) 검사 (✨ 신규 추가)
        const validSurvivorCategories = [...Object.values(survivorNameMap), "공용 퍽"];
        survivorPerkData.forEach(p => {
            if (!validSurvivorCategories.includes(p.category)) errorLogs.push(`[생존자 퍽: ${p.name}] 카테고리명(${p.category}) 오타`);
        });

        const infoArea = document.querySelector('.bottom-info-area');
        if(infoArea) {
            const dataDash = document.createElement('div');
            dataDash.style.fontSize = '11px';
            dataDash.style.color = 'rgba(255,255,255,0.3)';
            dataDash.style.marginTop = '5px';
            // ✨ 생존자 총 인원수(S)도 대시보드에 함께 표시하도록 수정
            dataDash.innerText = `K:${killers.length} | S:${survivors.length} | KP:${killerPerkData.length} | SP:${survivorPerkData.length} | AD:${totalAddons}`;
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
};

// ==========================================
// 전역 바인딩 (index.html의 onclick에서 호출)
// ==========================================
window.toggleMode = () => App.toggleMode();
window.startSequence = () => App.startSequence();
window.selectAllKillers = () => App.selectAllKillers();
window.toggleRandomKiller = () => App.toggleRandomKiller();
window.setTierFilter = (val) => App.setTierFilter(val);
window.updateSpeedText = (val) => App.updateSpeedText(val);
window.openUpdateNotes = () => App.openUpdateNotes();
window.closeUpdateNotes = (event) => App.closeUpdateNotes(event);

// 앱 시동!
window.addEventListener('DOMContentLoaded', () => App.init());