// ==============================================================================
// dashboard360-engine.js - Motor da Visão Unificada (Dashboard 360)
// Responsável por cruzar todas as variáveis globais e renderizar a tela.
// ==============================================================================

window.Dashboard360Engine = {
    currentOlt: null,
    currentType: null,
    currentBoards: 0,
    currentPlaca: null,
    clientsData: {}, 

    init: function() {
        window.addEventListener('dadosAtualizados', () => this.renderCards());
        
        if (window.DATA_STORE && window.DATA_STORE.isReady) {
            this.renderCards();
        }
    },

    renderCards: function() {
        const container = document.getElementById('dashboard-container');
        const isDashboard360Page = window.location.pathname.includes('dashboard360.html');
        
        if (!container || !isDashboard360Page) return;

        container.innerHTML = '';

        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            let up = 0, down = 0;
            if (window.GLOBAL_NET_STATS) {
                const netStat = window.GLOBAL_NET_STATS.find(s => s.id === olt.id);
                if (netStat) {
                    up = netStat.online;
                    down = netStat.offline;
                }
            }

            let energyOff = 0, signalOff = 0;
            if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.olts && window.ENERGY_DATA_STORE.olts[olt.id]) {
                energyOff = window.ENERGY_DATA_STORE.olts[olt.id].powerOff || 0;
                signalOff = window.ENERGY_DATA_STORE.olts[olt.id].offlineOther || 0;
            }

            let potMedia = "0.0";
            if (window.GLOBAL_POTENCIA_STATS) {
                const potStat = window.GLOBAL_POTENCIA_STATS.find(s => s.id === olt.id);
                if (potStat) potMedia = potStat.media;
            }

            let tempMax = 0;
            if (window.GLOBAL_TEMP_STATS) {
                const tempStat = window.GLOBAL_TEMP_STATS.find(s => s.id === olt.id);
                if (tempStat) tempMax = tempStat.maxTemp;
            }

            const totalClients = up + down;
            
            let upPct = 0;
            let downPct = 0;
            if (totalClients > 0) {
                upPct = Math.round((up / totalClients) * 100);
                downPct = 100 - upPct;
            }

            let lastUpdateStr = '--/--/---- --:--:--';
            
            if (window.OLT_LAST_UPDATES && window.OLT_LAST_UPDATES[olt.id]) {
                lastUpdateStr = window.OLT_LAST_UPDATES[olt.id];
            } else {
                const values = window.DATA_STORE?.olts?.[olt.id] || [];
                if (values.length > 0) {
                    const firstRow = values[0];
                    let cellData = firstRow[10] ? String(firstRow[10]) : '';
                    if (!cellData) {
                        for (let i = firstRow.length - 1; i >= 0; i--) {
                            let val = firstRow[i] ? String(firstRow[i]) : '';
                            if (val.match(/\d{2}\/\d{2}/) && val.match(/\d{2}:\d{2}/)) {
                                cellData = val; break;
                            }
                        }
                    }
                    if (cellData) {
                        const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
                        const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);
                        if (dateMatch && timeMatch) lastUpdateStr = `${dateMatch[0]} ${timeMatch[0]}`;
                    }
                }
            }
            const dateVal = lastUpdateStr.split(' ')[0] || '--/--/----';
            const timeVal = lastUpdateStr.split(' ')[1] || '--:--:--';

            const potValue = parseFloat(potMedia);
            const potColor = potValue <= -28.00 ? 'text-error' : (potValue <= -26.00 ? 'text-warning' : 'text-success');
            const tempColor = tempMax >= 80 ? (tempMax >= 90 ? 'text-error' : 'text-warning') : 'text-success';
            
            const isCritical = (down > 30 || energyOff > 10 || tempMax >= 90);
            const cardBorder = isCritical ? 'border-color: rgba(248, 113, 113, 0.4); box-shadow: 0 0 15px rgba(248, 113, 113, 0.1);' : '';
            const titleColor = isCritical ? 'color: var(--m3-color-error);' : '';

            const cardHTML = `
                <div class="card-360" style="${cardBorder}">
                    <div class="card-header">
                        <h3 style="${titleColor}"><span class="material-symbols-rounded">dns</span> ${olt.id}</h3>
                        <button class="btn-action" onclick="Dashboard360Engine.openModal('${olt.id}', '${olt.type}', ${olt.boards})" title="Ver Detalhes">
                            <span class="material-symbols-rounded">manage_search</span>
                        </button>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 12px;">
                        <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; display: flex; align-items: center; gap: 5px;">
                            <span class="material-symbols-rounded" style="font-size: 16px;">groups</span> Total OLT
                        </span>
                        <span style="font-family: var(--font-family-mono); font-weight: bold; font-size: 1.2rem; color: var(--m3-on-surface);">${totalClients}</span>
                    </div>

                    <div class="progress-container">
                        <div class="progress-labels">
                            <span class="text-success">${upPct}% ON</span>
                            <span class="text-error">${downPct}% OFF</span>
                        </div>
                        <div class="progress-bar-wrapper">
                            <div class="progress-bar-online" style="width: ${upPct}%;"></div>
                            <div class="progress-bar-offline" style="width: ${downPct}%;"></div>
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="quadrant" title="Conectividade (UP / DOWN)">
                            <span class="material-symbols-rounded quad-icon">router</span>
                            <div class="quad-content">
                                <div class="stat-row">
                                    <span class="material-symbols-rounded text-success">arrow_upward</span>
                                    <span class="text-success">${up}</span>
                                </div>
                                <div class="stat-row">
                                    <span class="material-symbols-rounded text-error">arrow_downward</span>
                                    <span class="text-error">${down}</span>
                                </div>
                            </div>
                        </div>

                        <div class="quadrant" title="Falhas (Sem Sinal / Sem Energia)">
                            <span class="material-symbols-rounded quad-icon">bolt</span>
                            <div class="quad-content">
                                <div class="stat-row">
                                    <span class="material-symbols-rounded text-orange">wifi_off</span>
                                    <span class="${signalOff > 0 ? 'text-orange' : 'text-muted'}">${signalOff}</span>
                                </div>
                                <div class="stat-row">
                                    <span class="material-symbols-rounded text-warning">power_off</span>
                                    <span class="${energyOff > 0 ? 'text-warning' : 'text-muted'}">${energyOff}</span>
                                </div>
                            </div>
                        </div>

                        <div class="quadrant" title="Média de Potência Óptica">
                            <span class="material-symbols-rounded quad-icon">vital_signs</span>
                            <div class="quad-content">
                                <div class="big-val ${potColor}">${potMedia}</div>
                                <span class="val-unit">dBm</span>
                            </div>
                        </div>

                        <div class="quadrant" title="Temperatura Máxima">
                            <span class="material-symbols-rounded quad-icon">device_thermostat</span>
                            <div class="quad-content">
                                <div class="big-val ${tempColor}">${tempMax}°</div>
                                <span class="val-unit">Temp.</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="border-top: 1px solid var(--m3-outline); padding-top: 12px; margin-top: 12px; display: flex; justify-content: center; align-items: center; gap: 15px; width: 100%; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span> ${dateVal}
                        </div>
                        <span style="color: rgba(255,255,255,0.1);">|</span>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${timeVal}
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHTML;
        });
    },

    openModal: function(oltId, type, boards) {
        this.currentOlt = oltId;
        this.currentType = type;
        this.currentBoards = boards;
        this.clientsData = {}; 

        document.getElementById('modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${oltId}`;
        document.getElementById('super-modal').style.display = 'flex';
        
        const btnBoletimOlt = document.getElementById('btn-gerar-boletim-olt-360');
        if (btnBoletimOlt) btnBoletimOlt.style.display = 'block';
        
        const pContainer = document.getElementById('placas-container');
        pContainer.className = 'mini-cards-grid'; 
        pContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--m3-on-surface-variant);">Cruzando dados das placas...</div>';
        
        this.showPlacas();

        setTimeout(() => {
            const rows = window.DATA_STORE.olts[oltId]?.slice(1) || [];
            let placaData = {};
            
            for (let i = 1; i <= boards; i++) placaData[i] = { ports: {} };

            rows.forEach(cols => {
                if (cols.length === 0) return;
                const pInfo = DataMapper.extractPort(cols[0], type);
                if (!pInfo) return;
                
                const placa = parseInt(pInfo.placa);
                const porta = parseInt(pInfo.porta);
                
                if (placa > boards || placa < 1) return;

                const isOnline = DataMapper.isOnline(cols[type === 'nokia' ? 4 : 2], type);
                const power = DataMapper.parsePowerValue(cols[5]);

                if (!placaData[placa].ports[porta]) {
                    placaData[placa].ports[porta] = { online: 0, offline: 0, validPowerCount: 0, sumPower: 0 };
                }

                if (isOnline) placaData[placa].ports[porta].online++;
                else placaData[placa].ports[porta].offline++;

                if (DataMapper.isValidPower(power)) {
                    placaData[placa].ports[porta].validPowerCount++;
                    placaData[placa].ports[porta].sumPower += power;
                }
            });

            pContainer.innerHTML = '';

            for (let i = 1; i <= boards; i++) {
                let pOnline = 0, pOffline = 0, pPowerOff = 0;
                let sumPot = 0, countPot = 0;
                let countCritico = 0, countProblema = 0, countAtencao = 0;

                const ports = placaData[i].ports;
                for (const pt in ports) {
                    const pd = ports[pt];
                    const total = pd.online + pd.offline;
                    
                    pOnline += pd.online;
                    pOffline += pd.offline;
                    sumPot += pd.sumPower;
                    countPot += pd.validPowerCount;

                    if (total >= 5) {
                        const percOffline = pd.offline / total;
                        if (percOffline === 1) countCritico++;
                        else if (percOffline >= 0.5 || pd.offline >= 32) countProblema++;
                        else if (pd.offline >= 16) countAtencao++;
                    }

                    if (window.ENERGY_DATA_STORE?.olts?.[oltId]?.ports?.[i]?.[pt]) {
                        pPowerOff += window.ENERGY_DATA_STORE.olts[oltId].ports[i][pt].powerOff || 0;
                    }
                }

                let redeBadge = '<span class="status status-normal">Normal</span>';
                if (countCritico >= 1 || countProblema >= 4) redeBadge = '<span class="status status-critico">Crítico</span>';
                else if ((countProblema >= 1 && countProblema <= 3) || countAtencao >= 4) redeBadge = '<span class="status status-problema">Problema</span>';
                else if (countAtencao >= 1 && countAtencao <= 3) redeBadge = '<span class="status status-atencao">Atenção</span>';
                else if (pOnline + pOffline === 0) redeBadge = '<span class="status" style="color:var(--m3-on-surface-variant); background:rgba(255,255,255,0.1);">S/ Clientes</span>';

                let energiaBadge = '<span class="status status-normal">Normal</span>';
                if (pPowerOff > 0) {
                    energiaBadge = `<span class="status status-atencao">${pPowerOff} Sem Energia</span>`;
                } else if (pOnline + pOffline === 0) {
                    energiaBadge = '<span class="status" style="color:var(--m3-on-surface-variant); background:rgba(255,255,255,0.1);">-</span>';
                }

                let potMedia = countPot > 0 ? (sumPot / countPot).toFixed(1) : 0;
                let potBadge = '<span class="status status-normal">N/A</span>';
                if (potMedia !== 0) {
                    if (potMedia <= -28.0) potBadge = `<span class="status status-critico">${potMedia} dBm</span>`;
                    else if (potMedia <= -26.0) potBadge = `<span class="status status-atencao">${potMedia} dBm</span>`;
                    else potBadge = `<span class="status status-normal">${potMedia} dBm</span>`;
                } else if (pOnline + pOffline === 0) {
                    potBadge = '<span class="status" style="color:var(--m3-on-surface-variant); background:rgba(255,255,255,0.1);">-</span>';
                }

                pContainer.innerHTML += `
                    <div class="placa-mini-card" onclick="Dashboard360Engine.openPortas(${i})">
                        <div class="placa-mini-card-header">
                            <span class="material-symbols-rounded">developer_board</span>
                            Placa ${i}
                        </div>
                        <div class="placa-mini-card-body">
                            <div class="placa-mini-card-row">
                                <span class="label">Rede:</span>
                                ${redeBadge}
                            </div>
                            <div class="placa-mini-card-row">
                                <span class="label">Energia:</span>
                                ${energiaBadge}
                            </div>
                            <div class="placa-mini-card-row">
                                <span class="label">Potência:</span>
                                ${potBadge}
                            </div>
                        </div>
                    </div>
                `;
            }
        }, 50);
    },

    showPlacas: function() {
        document.getElementById('view-placas').style.display = 'block';
        document.getElementById('view-portas').style.display = 'none';
        
        const btnBack = document.getElementById('btn-back');
        if (btnBack) btnBack.style.display = 'none';
        
        const btnBoletimOlt = document.getElementById('btn-gerar-boletim-olt-360');
        if (btnBoletimOlt) btnBoletimOlt.style.display = 'block';
        
        document.getElementById('modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${this.currentOlt}`;
    },

    closeModal: function() {
        document.getElementById('super-modal').style.display = 'none';
        const btnBoletimOlt = document.getElementById('btn-gerar-boletim-olt-360');
        if (btnBoletimOlt) btnBoletimOlt.style.display = 'none';
    },

    openPortas: function(placa) {
        this.currentPlaca = placa;
        this.clientsData = {}; 

        document.getElementById('view-placas').style.display = 'none';
        document.getElementById('view-portas').style.display = 'block';
        
        const btnBack = document.getElementById('btn-back');
        if (btnBack) btnBack.style.display = 'flex';
        
        const btnBoletimOlt = document.getElementById('btn-gerar-boletim-olt-360');
        if (btnBoletimOlt) btnBoletimOlt.style.display = 'none';
        
        document.getElementById('modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${this.currentOlt} <span style="color:var(--m3-on-surface-variant); margin: 0 5px;">/</span> Placa ${placa}`;

        const tbody = document.getElementById('portas-tbody');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;">Cruzando dados da placa...</td></tr>';

        setTimeout(() => {
            const rows = window.DATA_STORE.olts[this.currentOlt]?.slice(1) || [];
            const rowsCircuitos = window.DATA_STORE.circuitos || [];
            const rowsLocalidades = window.DATA_STORE.localidades || [];
            
            const portData = {};

            rows.forEach(cols => {
                if (cols.length === 0) return;
                
                const pInfo = DataMapper.extractPort(cols[0], this.currentType);
                if (!pInfo || parseInt(pInfo.placa) !== placa) return;

                const pNum = parseInt(pInfo.porta);
                const isOnline = DataMapper.isOnline(cols[this.currentType === 'nokia' ? 4 : 2], this.currentType);
                const power = DataMapper.parsePowerValue(cols[5]);
                
                let onuPos = String(cols[1] || '').trim();
                let serialVal = '', codigoVal = '', statusRefVal = '';
                let potenciaVal = String(cols[5] || '').replace(/dbm/ig, '').replace(/\s+/g, '');
                
                if (this.currentType === 'nokia') {
                    const onuParts = onuPos.split('/');
                    if (onuParts.length > 0) {
                        onuPos = onuParts[onuParts.length - 1];
                    }
                    serialVal = cols[2] || '';
                    codigoVal = cols[8] || '';
                    statusRefVal = cols[4] || '';
                } else {
                    serialVal = cols[3] || '';
                    codigoVal = cols[7] || '';
                    statusRefVal = cols[2] || '';
                }

                if (!portData[pNum]) {
                    portData[pNum] = { online: 0, offline: 0, validPowerCount: 0, sumPower: 0 };
                    this.clientsData[pNum] = [];
                }

                if (isOnline) portData[pNum].online++;
                else portData[pNum].offline++;

                if (DataMapper.isValidPower(power)) {
                    portData[pNum].validPowerCount++;
                    portData[pNum].sumPower += power;
                }

                this.clientsData[pNum].push({
                    onu: onuPos,
                    serial: String(serialVal).trim(),
                    codigo: String(codigoVal).trim(),
                    potenciaStr: potenciaVal,
                    potenciaNum: power,
                    statusRef: String(statusRefVal).trim(),
                    isOnline: isOnline
                });
            });

            tbody.innerHTML = '';
            const sortedPorts = Object.keys(portData).sort((a,b) => parseInt(a) - parseInt(b));

            if(sortedPorts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 30px;">Nenhuma porta ativa com clientes encontrada nesta placa.</td></tr>';
                return;
            }

            sortedPorts.forEach(pt => {
                const pd = portData[pt];
                const totalClients = pd.online + pd.offline;
                const percOffline = totalClients > 0 ? (pd.offline / totalClients) : 0;
                
                const circuito = DataMapper.getCircuitInfo(rowsCircuitos, { id: this.currentOlt, type: this.currentType }, placa, pt);
                const bairro = DataMapper.getBairroInfo(rowsLocalidades, this.currentOlt, placa, pt, this.currentType) || 'N/A';
                const safeInfo = circuito.replace(/'/g, "\\'");
                
                let redeStatusClass = 'status-normal';
                let redeStatusText = 'Normal';
                if (totalClients >= 5) {
                    if (percOffline === 1) { 
                        redeStatusClass = 'status-critico'; 
                        redeStatusText = 'Crítico'; 
                    } else if (percOffline >= 0.5 || pd.offline >= 32) { 
                        redeStatusClass = 'status-problema'; 
                        redeStatusText = 'Problema'; 
                    } else if (pd.offline >= 16) { 
                        redeStatusClass = 'status-atencao'; 
                        redeStatusText = 'Atenção'; 
                    }
                }

                let energyOff = 0;
                if (window.ENERGY_DATA_STORE?.olts?.[this.currentOlt]?.ports?.[placa]?.[pt]) {
                    energyOff = window.ENERGY_DATA_STORE.olts[this.currentOlt].ports[placa][pt].powerOff || 0;
                }
                
                let energiaClass = 'status-normal';
                let energiaText = 'Normal';
                if (totalClients > 0 && energyOff > 0) {
                    const percEnergy = energyOff / totalClients;
                    if ((percEnergy >= 0.5 && energyOff >= 10) || (percEnergy === 1 && totalClients >= 5)) {
                        energiaClass = 'status-critico';
                        energiaText = 'Crítico';
                    } else if (percEnergy >= 0.15 && energyOff >= 5) {
                        energiaClass = 'status-atencao';
                        energiaText = 'Atenção';
                    } else {
                        energiaClass = 'status-atencao';
                        energiaText = 'Atenção';
                    }
                }

                let potMedia = pd.validPowerCount > 0 ? (pd.sumPower / pd.validPowerCount).toFixed(1) : 0;
                let potClass = 'status-normal';
                if (potMedia !== 0) {
                    if (potMedia <= -28.0) potClass = 'status-critico';
                    else if (potMedia <= -26.0) potClass = 'status-atencao';
                }
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:bold;">Porta ${String(pt).padStart(2, '0')}</td>
                        <td>
                            <span class="circuit-badge circuit-clickable" style="cursor: pointer;" onclick="Dashboard360Engine.openCircuitClients('${pt}', '${safeInfo}')" title="Ver clientes deste circuito">
                                ${circuito}
                            </span>
                        </td>
                        <td style="color:var(--m3-on-surface-variant); font-size: 0.9rem;">${bairro}</td>
                        <td style="text-align: center;"><span class="status ${redeStatusClass} clickable-badge" onclick="Dashboard360Engine.openQuickViewModal('${this.currentOlt}', '${placa}', '${pt}', '${safeInfo}', ${totalClients}, ${pd.online}, ${pd.offline}, ${energyOff})" title="Ver Resumo da Porta">${redeStatusText}</span></td>
                        <td style="text-align: center;"><span class="status ${energiaClass} clickable-badge" onclick="Dashboard360Engine.openQuickViewModal('${this.currentOlt}', '${placa}', '${pt}', '${safeInfo}', ${totalClients}, ${pd.online}, ${pd.offline}, ${energyOff})" title="Ver Resumo da Porta">${energiaText}</span></td>
                        <td style="text-align: center;"><span class="status ${potClass}">${potMedia !== 0 ? potMedia + ' dBm' : 'N/A'}</span></td>
                    </tr>
                `;
            });
        }, 50);
    },

    openCircuitClients: function(porta, circuitoNome) {
        let modal = document.getElementById('client-modal-360');
        if (!modal) {
            const modalHTML = `
                <div id="client-modal-360" class="modal-overlay" style="display: none; z-index: 4000;" onclick="Dashboard360Engine.closeClientModal(event)">
                    <div class="modal-content modal-large">
                        <div class="modal-header">
                            <h3 id="client-modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-rounded">manage_search</span> Pesquisa de Clientes
                            </h3>
                            <button class="close-modal" onclick="Dashboard360Engine.closeClientModal()" title="Fechar">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="filter-bar">
                                <input type="text" id="client-search-input" class="filter-input" placeholder="Buscar por Serial ou Código..." onkeyup="Dashboard360Engine.filterClients()">
                                <select id="client-status-filter" class="filter-select" onchange="Dashboard360Engine.filterClients()">
                                    <option value="all">Todos Status</option>
                                    <option value="online">Online (UP)</option>
                                    <option value="offline">Offline (DOWN)</option>
                                </select>
                            </div>
                            <div class="table-container">
                                <table class="noc-table">
                                    <thead>
                                        <tr class="table-header-row">
                                            <th style="text-align: center; width: 80px;">ONU</th>
                                            <th style="text-align: left;">Serial</th>
                                            <th style="text-align: left;">Código</th>
                                            <th style="text-align: center;">Rede</th>
                                            <th style="text-align: center;">Energia</th>
                                            <th style="text-align: center;">Potência</th>
                                        </tr>
                                    </thead>
                                    <tbody id="client-tbody-360"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('client-modal-360');
        }

        const textoCircuito = (circuitoNome && circuitoNome !== "-") ? ` - ${circuitoNome}` : "";
        document.getElementById('client-modal-title').innerHTML = `<span class="material-symbols-rounded">manage_search</span> ${this.currentOlt} - ${this.currentPlaca}/${porta}${textoCircuito}`;
        
        document.getElementById('client-search-input').value = '';
        document.getElementById('client-status-filter').value = 'all';

        const tbody = document.getElementById('client-tbody-360');
        tbody.innerHTML = '';

        const clients = this.clientsData[porta] || [];

        if (clients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nenhum cliente encontrado.</td></tr>`;
        } else {
            let energyOff = 0;
            if (window.ENERGY_DATA_STORE?.olts?.[this.currentOlt]?.ports?.[this.currentPlaca]?.[porta]) {
                energyOff = window.ENERGY_DATA_STORE.olts[this.currentOlt].ports[this.currentPlaca][porta].powerOff || 0;
            }

            clients.forEach(c => {
                let redeClass = c.isOnline ? 'filter-online status-normal' : 'filter-offline status-critico';
                let redeText = c.isOnline ? 'UP' : 'DOWN';

                let potClass = 'status-normal';
                let potDisplay = c.potenciaStr ? `${c.potenciaStr} dBm` : 'N/A';
                if (c.potenciaNum !== null) {
                    if (c.potenciaNum <= -28.0) potClass = 'status-critico';
                    else if (c.potenciaNum <= -26.0) potClass = 'status-atencao';
                }

                let energiaClass = 'status-normal';
                let energiaText = 'OK';
                
                if (!c.isOnline && energyOff > 0) {
                    energiaClass = 'status-atencao';
                    energiaText = 'Verificar';
                    energyOff--; 
                }

                let rowHTML = `
                    <tr class="client-row-360 ${c.isOnline ? 'filter-online' : 'filter-offline'}" data-serial="${c.serial}" data-codigo="${c.codigo}">
                        <td style="text-align: center; font-weight: bold; color: var(--m3-on-surface-variant);">${c.onu || '-'}</td>
                        <td style="font-family: var(--font-family-mono); font-weight: 600; color: var(--m3-on-surface);">${c.serial || 'N/A'}</td>
                        <td style="font-family: var(--font-family-mono);">${c.codigo || 'N/A'}</td>
                        <td style="text-align: center;">
                            <span class="status ${redeClass}">${redeText}</span>
                        </td>
                        <td style="text-align: center;">
                            <span class="status ${energiaClass}">${energiaText}</span>
                        </td>
                        <td style="text-align: center; font-family: var(--font-family-mono);">
                            <span class="status ${potClass}">${potDisplay}</span>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += rowHTML;
            });
        }
        modal.style.display = 'flex';
    },

    filterClients: function() {
        const searchText = document.getElementById('client-search-input').value.toLowerCase().trim();
        const statusFilter = document.getElementById('client-status-filter').value;
        const rows = document.querySelectorAll('.client-row-360');
        
        rows.forEach(row => {
            const serial = (row.dataset.serial || '').toLowerCase();
            const codigo = (row.dataset.codigo || '').toLowerCase();
            
            let matchesSearch = searchText === '' || serial.includes(searchText) || codigo.includes(searchText);
            
            let matchesStatus = true;
            if (statusFilter === 'online') matchesStatus = row.classList.contains('filter-online');
            if (statusFilter === 'offline') matchesStatus = row.classList.contains('filter-offline');
            
            if (matchesSearch && matchesStatus) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    closeClientModal: function(event) {
        if (event && event.target.id !== 'client-modal-360' && !event.target.classList.contains('close-modal')) return;
        const modal = document.getElementById('client-modal-360');
        if (modal) modal.style.display = 'none';
    },

    openQuickViewModal: function(olt, placa, porta, circuito, total, up, down, energy) {
        document.getElementById('quick-view-title').innerHTML = `<span class="material-symbols-rounded">info</span> ${olt} - ${placa}/${porta} - ${circuito}`;
        document.getElementById('qv-total').textContent = total;
        document.getElementById('qv-up').textContent = up;
        document.getElementById('qv-down').textContent = down;
        document.getElementById('qv-energy').textContent = energy;
        document.getElementById('quick-view-modal').style.display = 'flex';
    },

    closeQuickViewModal: function(event) {
        if (event && event.target.id !== 'quick-view-modal' && !event.target.classList.contains('close-btn')) return;
        const modal = document.getElementById('quick-view-modal');
        if (modal) modal.style.display = 'none';
    },

    exportarPlacaTxt: function() {
        if (!this.currentOlt || !this.currentPlaca) {
            alert("Nenhuma placa selecionada.");
            return;
        }

        const oltName = this.currentOlt;
        const placa = this.currentPlaca;
        
        let txtContent = `=================================================\n`;
        txtContent += `   RELATÓRIO 360º - ${oltName} (PLACA ${placa})\n`;
        txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
        txtContent += `=================================================\n\n`;
        
        const tbody = document.getElementById('portas-tbody');
        const rows = tbody.querySelectorAll('tr');
        
        if (rows.length === 0 || rows[0].innerText.includes('Nenhuma porta')) {
            alert('Nenhum dado disponível para exportação.');
            return;
        }
        
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 6) { 
                const porta = cols[0].innerText.trim();
                const circuito = cols[1].innerText.trim();
                const bairro = cols[2].innerText.trim();
                const rede = cols[3].innerText.trim();
                const energia = cols[4].innerText.trim();
                const potencia = cols[5].innerText.trim();
                
                txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(10, ' ')} | Bairro: ${bairro.padEnd(45, ' ')} | Rede: ${rede.padEnd(10, ' ')} | Energia: ${energia.padEnd(10, ' ')} | Potência: ${potencia}\n`;
            }
        });
        
        txtContent += `\n=================================================\n`;
        
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_360_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_Placa_${placa}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    gerarBoletimPlaca360Offscreen: async function(event) {
        if (event) event.stopPropagation();
        
        if (!this.currentOlt || !this.currentPlaca) {
            alert("Nenhuma placa selecionada.");
            return;
        }

        const oltId = this.currentOlt;
        const type = this.currentType;
        const placa = this.currentPlaca;
        
        const btn = event ? event.currentTarget : null;
        let originalContent = '';
        if (btn) {
            originalContent = btn.innerHTML;
            btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
            btn.disabled = true;
        }

        try {
            const rows = window.DATA_STORE.olts[oltId]?.slice(1) || [];
            const rowsCircuitos = window.DATA_STORE.circuitos || [];
            const rowsLocalidades = window.DATA_STORE.localidades || [];

            const portData = {};
            let globalTotal = 0, globalOnline = 0, globalOffline = 0, globalPowerOff = 0, globalSumPower = 0, globalValidPowerCount = 0;

            rows.forEach(cols => {
                if (cols.length === 0) return;
                const pInfo = DataMapper.extractPort(cols[0], type);
                if (!pInfo || parseInt(pInfo.placa) !== parseInt(placa)) return;

                const pNum = parseInt(pInfo.porta);
                const isOnline = DataMapper.isOnline(cols[type === 'nokia' ? 4 : 2], type);
                const power = DataMapper.parsePowerValue(cols[5]);

                if (!portData[pNum]) {
                    portData[pNum] = { online: 0, offline: 0, validPowerCount: 0, sumPower: 0, powerOff: 0 };
                }

                if (isOnline) {
                    portData[pNum].online++;
                    globalOnline++;
                } else {
                    portData[pNum].offline++;
                    globalOffline++;
                }
                globalTotal++;

                if (DataMapper.isValidPower(power)) {
                    portData[pNum].validPowerCount++;
                    portData[pNum].sumPower += power;
                    globalValidPowerCount++;
                    globalSumPower += power;
                }
            });

            if (window.ENERGY_DATA_STORE?.olts?.[oltId]?.ports?.[placa]) {
                const energyPorts = window.ENERGY_DATA_STORE.olts[oltId].ports[placa];
                for (const pt in energyPorts) {
                    if (portData[pt]) {
                        portData[pt].powerOff = energyPorts[pt].powerOff || 0;
                        globalPowerOff += portData[pt].powerOff;
                    }
                }
            }

            let globalMedia = globalValidPowerCount > 0 ? (globalSumPower / globalValidPowerCount).toFixed(1) : "0.0";
            
            let portasList = [];
            const sortedPorts = Object.keys(portData).sort((a,b) => parseInt(a) - parseInt(b));

            sortedPorts.forEach(pt => {
                const pd = portData[pt];
                const totalClients = pd.online + pd.offline;
                const circuito = DataMapper.getCircuitInfo(rowsCircuitos, { id: oltId, type: type }, placa, pt);
                const bairro = DataMapper.getBairroInfo(rowsLocalidades, oltId, placa, pt, type) || 'N/A';
                const potMedia = pd.validPowerCount > 0 ? (pd.sumPower / pd.validPowerCount).toFixed(1) : 0;

                portasList.push({
                    porta: pt,
                    circuito: circuito,
                    bairro: bairro,
                    total: totalClients,
                    online: pd.online,
                    offline: pd.offline,
                    powerOff: pd.powerOff,
                    media: potMedia !== 0 ? potMedia + ' dBm' : 'N/A'
                });
            });

            const dataHora = new Date().toLocaleString('pt-BR');
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-boletim-placa-360`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px';
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent';

            let tableRowsHtml = '';
            portasList.forEach(stat => {
                const circuitoPilula = `<span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: var(--font-family-mono); font-size: 0.85rem;">${stat.circuito}</span>`;

                tableRowsHtml += `
                    <tr>
                        <td style="text-align: left; font-family: var(--font-family); font-weight: bold;">Porta ${String(stat.porta).padStart(2, '0')}</td>
                        <td style="text-align: left;">${circuitoPilula}</td>
                        <td style="text-align: left; font-size: 0.85rem; color: #CAC4D0;">${stat.bairro}</td>
                        <td style="text-align: center;">${stat.total}</td>
                        <td style="text-align: center; color: #4ade80;">${stat.online}</td>
                        <td style="text-align: center; color: #f87171;">${stat.offline}</td>
                        <td style="text-align: center; color: #fbbf24;">${stat.powerOff}</td>
                        <td style="text-align: center; font-family: var(--font-family-mono);">${stat.media}</td>
                    </tr>
                `;
            });

            wrapperDiv.innerHTML = `
                <div style="width: 1200px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;" onerror="this.style.display='none';">
                            <div>
                                <h2 style="margin: 0; font-size: 1.8rem; color: #fbbf24; display: flex; align-items: center; gap: 10px;">
                                    <span class="material-symbols-rounded" style="font-size: 32px;">dashboard</span> BOLETIM 360º - PLACA ${placa}
                                </h2>
                                <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltId}</h3>
                            </div>
                        </div>
                        <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                            Gerado em: ${dataHora}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px;">
                        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #ffffff; margin-bottom: 5px;">search</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px;">${globalTotal}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Total Analisado</div>
                        </div>
                        <div style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #4ade80; margin-bottom: 5px;">arrow_upward</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #4ade80;">${globalOnline}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Online</div>
                        </div>
                        <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #f87171; margin-bottom: 5px;">arrow_downward</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${globalOffline}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Offline</div>
                        </div>
                        <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #fbbf24; margin-bottom: 5px;">power_off</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${globalPowerOff}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                        </div>
                        <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #a855f7; margin-bottom: 5px;">vital_signs</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #a855f7;">${globalMedia}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Média (dBm)</div>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PORTA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">CIRCUITO</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">BAIRRO</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: center;">TOTAL</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: center;">ONLINE</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: center;">OFFLINE</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: center;">ENERGIA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #a855f7; text-align: center; border-radius: 0 8px 0 0;">POTÊNCIA</th>
                            </tr>
                        </thead>
                        <tbody style="font-family: 'Montserrat', sans-serif;">
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
            `;

            document.body.appendChild(wrapperDiv);

            const tds = wrapperDiv.querySelectorAll('td');
            tds.forEach(td => {
                td.style.padding = '12px';
                td.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            });

            await new Promise(r => setTimeout(r, 500)); 

            const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });
            
            const link = document.createElement('a');
            link.download = `Boletim_360_${oltId}_Placa_${placa}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            document.body.removeChild(wrapperDiv);

        } catch (error) {
            console.error('Erro ao gerar boletim da Placa 360:', error);
            alert('Ocorreu um erro ao gerar o boletim da Placa.');
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    },

    gerarBoletimOlt360Offscreen: async function(event) {
        if (event) event.stopPropagation();

        if (!this.currentOlt) {
            alert("Nenhuma OLT selecionada.");
            return;
        }

        const oltId = this.currentOlt;
        const type = this.currentType;
        const boards = this.currentBoards;

        const btn = event ? event.currentTarget : null;
        let originalContent = '';
        if (btn) {
            originalContent = btn.innerHTML;
            btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 26px;">hourglass_empty</span>`;
            btn.disabled = true;
        }

        try {
            const rows = window.DATA_STORE.olts[oltId]?.slice(1) || [];

            let placaData = {};
            for (let i = 1; i <= boards; i++) {
                placaData[i] = { total: 0, online: 0, offline: 0, powerOff: 0, sumPower: 0, validPowerCount: 0 };
            }

            let globalTotal = 0, globalOnline = 0, globalOffline = 0, globalPowerOff = 0, globalSumPower = 0, globalValidPowerCount = 0;

            rows.forEach(cols => {
                if (cols.length === 0) return;
                const pInfo = DataMapper.extractPort(cols[0], type);
                if (!pInfo) return;

                const placa = parseInt(pInfo.placa);
                if (placa > boards || placa < 1) return;

                const isOnline = DataMapper.isOnline(cols[type === 'nokia' ? 4 : 2], type);
                const power = DataMapper.parsePowerValue(cols[5]);

                placaData[placa].total++;
                globalTotal++;

                if (isOnline) {
                    placaData[placa].online++;
                    globalOnline++;
                } else {
                    placaData[placa].offline++;
                    globalOffline++;
                }

                if (DataMapper.isValidPower(power)) {
                    placaData[placa].validPowerCount++;
                    placaData[placa].sumPower += power;
                    globalValidPowerCount++;
                    globalSumPower += power;
                }
            });

            if (window.ENERGY_DATA_STORE?.olts?.[oltId]?.ports) {
                const energyBoards = window.ENERGY_DATA_STORE.olts[oltId].ports;
                for (const placa in energyBoards) {
                    const energyPorts = energyBoards[placa];
                    for (const pt in energyPorts) {
                        const poff = energyPorts[pt].powerOff || 0;
                        if (placaData[placa]) {
                            placaData[placa].powerOff += poff;
                        }
                        globalPowerOff += poff;
                    }
                }
            }

            let globalMedia = globalValidPowerCount > 0 ? (globalSumPower / globalValidPowerCount).toFixed(1) : "0.0";

            let tableRowsHtml = '';
            for (let i = 1; i <= boards; i++) {
                const pd = placaData[i];
                const potMedia = pd.validPowerCount > 0 ? (pd.sumPower / pd.validPowerCount).toFixed(1) : 0;
                const potDisplay = potMedia !== 0 ? potMedia + ' dBm' : 'N/A';

                tableRowsHtml += `
                    <tr>
                        <td style="text-align: left; font-family: var(--font-family); font-weight: bold;">Placa ${i}</td>
                        <td style="text-align: center;">${pd.total}</td>
                        <td style="text-align: center; color: #4ade80;">${pd.online}</td>
                        <td style="text-align: center; color: #f87171;">${pd.offline}</td>
                        <td style="text-align: center; color: #fbbf24;">${pd.powerOff}</td>
                        <td style="text-align: center; font-family: var(--font-family-mono);">${potDisplay}</td>
                    </tr>
                `;
            }

            const dataHora = new Date().toLocaleString('pt-BR');
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-boletim-olt-360`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px';
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent';

            wrapperDiv.innerHTML = `
                <div style="width: 1200px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;" onerror="this.style.display='none';">
                            <div>
                                <h2 style="margin: 0; font-size: 1.8rem; color: #fbbf24; display: flex; align-items: center; gap: 10px;">
                                    <span class="material-symbols-rounded" style="font-size: 32px;">dashboard</span> BOLETIM 360º - OLT
                                </h2>
                                <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltId}</h3>
                            </div>
                        </div>
                        <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                            Gerado em: ${dataHora}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px;">
                        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #ffffff; margin-bottom: 5px;">search</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px;">${globalTotal}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Total Analisado</div>
                        </div>
                        <div style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #4ade80; margin-bottom: 5px;">arrow_upward</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #4ade80;">${globalOnline}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Online</div>
                        </div>
                        <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #f87171; margin-bottom: 5px;">arrow_downward</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${globalOffline}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Offline</div>
                        </div>
                        <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #fbbf24; margin-bottom: 5px;">power_off</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${globalPowerOff}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                        </div>
                        <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 15px; text-align: center;">
                            <div class="material-symbols-rounded" style="font-size: 28px; color: #a855f7; margin-bottom: 5px;">vital_signs</div>
                            <div style="font-family: 'Roboto Mono', monospace; font-size: 1.8rem; font-weight: 700; margin-bottom: 5px; color: #a855f7;">${globalMedia}</div>
                            <div style="font-size: 0.8rem; color: #CAC4D0; text-transform: uppercase;">Média (dBm)</div>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PLACA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: center;">TOTAL</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: center;">ONLINE</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: center;">OFFLINE</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: center;">ENERGIA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #a855f7; text-align: center; border-radius: 0 8px 0 0;">POTÊNCIA</th>
                            </tr>
                        </thead>
                        <tbody style="font-family: 'Montserrat', sans-serif;">
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
            `;

            document.body.appendChild(wrapperDiv);

            const tds = wrapperDiv.querySelectorAll('td');
            tds.forEach(td => {
                td.style.padding = '12px';
                td.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            });

            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });

            const link = document.createElement('a');
            link.download = `Boletim_360_OLT_${oltId}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            document.body.removeChild(wrapperDiv);

        } catch (error) {
            console.error('Erro ao gerar boletim da OLT 360:', error);
            alert('Ocorreu um erro ao gerar o boletim da OLT.');
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    },

    gerarBoletimEmergencia360Offscreen: async function(event) {
        if (event) event.stopPropagation();

        if (!this.currentOlt) {
            alert("Nenhuma OLT selecionada.");
            return;
        }

        const oltId = this.currentOlt;
        const type = this.currentType;
        const boards = this.currentBoards;

        const btn = event ? event.currentTarget : null;
        let originalContent = '';
        if (btn) {
            originalContent = btn.innerHTML;
            btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 26px;">hourglass_empty</span>`;
            btn.disabled = true;
        }

        try {
            const rows = window.DATA_STORE.olts[oltId]?.slice(1) || [];
            const rowsCircuitos = window.DATA_STORE.circuitos || [];
            const rowsLocalidades = window.DATA_STORE.localidades || [];

            let portData = {};
            for (let i = 1; i <= boards; i++) {
                portData[i] = {};
            }

            rows.forEach(cols => {
                if (cols.length === 0) return;
                const pInfo = DataMapper.extractPort(cols[0], type);
                if (!pInfo) return;

                const placa = parseInt(pInfo.placa);
                const porta = parseInt(pInfo.porta);
                if (placa > boards || placa < 1) return;

                const isOnline = DataMapper.isOnline(cols[type === 'nokia' ? 4 : 2], type);
                const power = DataMapper.parsePowerValue(cols[5]);

                if (!portData[placa][porta]) {
                    portData[placa][porta] = { online: 0, offline: 0, sumPower: 0, validPowerCount: 0, powerOff: 0 };
                }

                if (isOnline) portData[placa][porta].online++;
                else portData[placa][porta].offline++;

                if (DataMapper.isValidPower(power)) {
                    portData[placa][porta].validPowerCount++;
                    portData[placa][porta].sumPower += power;
                }
            });

            if (window.ENERGY_DATA_STORE?.olts?.[oltId]?.ports) {
                const energyBoards = window.ENERGY_DATA_STORE.olts[oltId].ports;
                for (const placa in energyBoards) {
                    const energyPorts = energyBoards[placa];
                    for (const pt in energyPorts) {
                        const poff = energyPorts[pt].powerOff || 0;
                        if (portData[placa] && portData[placa][pt]) {
                            portData[placa][pt].powerOff = poff;
                        }
                    }
                }
            }

            let portasCriticas = [];

            for (let i = 1; i <= boards; i++) {
                const ports = portData[i];
                for (const pt in ports) {
                    const pd = ports[pt];
                    const total = pd.online + pd.offline;
                    
                    if (total >= 5 && pd.offline === total) {
                        const circuito = DataMapper.getCircuitInfo(rowsCircuitos, { id: oltId, type: type }, i, pt);
                        const bairro = DataMapper.getBairroInfo(rowsLocalidades, oltId, i, pt, type) || 'N/A';
                        const potMedia = pd.validPowerCount > 0 ? (pd.sumPower / pd.validPowerCount).toFixed(1) : 0;
                        const potDisplay = potMedia !== 0 ? potMedia + ' dBm' : 'N/A';

                        portasCriticas.push({
                            placa: i,
                            porta: pt,
                            circuito: circuito,
                            bairro: bairro,
                            total: total,
                            offline: pd.offline,
                            powerOff: pd.powerOff,
                            media: potDisplay
                        });
                    }
                }
            }

            const dataHora = new Date().toLocaleString('pt-BR');
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-boletim-emergencia-360`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px';
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent';

            let conteudoHtml = '';

            if (portasCriticas.length === 0) {
                conteudoHtml = `
                    <div style="text-align: center; padding: 60px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 25px;">
                        <span class="material-symbols-rounded" style="font-size: 64px; color: #4ade80; margin-bottom: 15px; display:block;">check_circle</span>
                        <h2 style="margin: 0; color: #4ade80; font-size: 2rem;">OLT Estável</h2>
                        <p style="color: #CAC4D0; margin-top: 10px; font-size: 1.1rem;">Nenhuma porta em estado crítico (100% offline) detectada nesta OLT.</p>
                    </div>
                `;
            } else {
                let tableRowsHtml = '';
                portasCriticas.forEach(p => {
                    const circuitoPilula = `<span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: var(--font-family-mono); font-size: 0.9rem;">${p.circuito}</span>`;

                    tableRowsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 12px; font-family: 'Roboto Mono', monospace; font-weight: bold; text-align: left;">${p.placa}/${String(p.porta).padStart(2, '0')}</td>
                            <td style="padding: 12px; text-align: left;">${circuitoPilula}</td>
                            <td style="padding: 12px; text-align: left; color: #CAC4D0; font-size: 0.85rem;">${p.bairro}</td>
                            <td style="padding: 12px; text-align: center; color: #f87171; font-family: 'Roboto Mono', monospace; font-weight: bold;">100%</td>
                            <td style="padding: 12px; text-align: center; color: #fbbf24;">${p.powerOff}</td>
                            <td style="padding: 12px; text-align: center; font-family: 'Roboto Mono', monospace;">${p.media}</td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem; background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>
                            </td>
                        </tr>
                    `;
                });
                
                conteudoHtml = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PLACA/PORTA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">CIRCUITO</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">BAIRRO</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ff3333; text-align: center;">IMPACTO</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: center;">ENERGIA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #a855f7; text-align: center;">POTÊNCIA</th>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ff3333; text-align: center; border-radius: 0 8px 0 0;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody style="font-family: 'Montserrat', sans-serif;">
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                `;
            }

            wrapperDiv.innerHTML = `
                <div style="width: 1200px; min-height: 850px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;" onerror="this.style.display='none';">
                            <div>
                                <h2 style="margin: 0; font-size: 1.8rem; color: #ff3333; display: flex; align-items: center; gap: 10px;">
                                    <span class="material-symbols-rounded" style="font-size: 32px;">warning</span> BOLETIM 360º - EMERGÊNCIA
                                </h2>
                                <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltId}</h3>
                            </div>
                        </div>
                        <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                            Gerado em: ${dataHora}
                        </div>
                    </div>

                    ${conteudoHtml}
                </div>
            `;

            document.body.appendChild(wrapperDiv);

            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });

            const link = document.createElement('a');
            link.download = `Boletim_Emergencia_360_${oltId}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            document.body.removeChild(wrapperDiv);

        } catch (error) {
            console.error('Erro ao gerar boletim de emergência 360:', error);
            alert('Ocorreu um erro ao gerar o boletim de emergência.');
        } finally {
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard360Engine.init());