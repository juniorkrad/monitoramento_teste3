// ==============================================================================
// boletim-gerencial.js - Gerador de Boletins em Formato Dashboard (PNG)
// Atualização: Refinamento das Regras Macro para o Boletim Geral da Rede
// ==============================================================================

window.gerarBoletimPop = async function(event) {
    if (event) event.stopPropagation();
    
    const select = document.getElementById('boletim-pop-select');
    const popName = select ? select.value : '';
    
    if (!popName) {
        alert('Por favor, selecione um POP para gerar o boletim.');
        return;
    }

    const btn = event ? event.currentTarget : document.querySelector('#boletim-gerencial-modal .search-btn');
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span> GERANDO...`;
        btn.disabled = true;
    }

    try {
        let targetOlts = [];
        if (typeof POP_MAP !== 'undefined') {
            targetOlts = Object.keys(POP_MAP).filter(key => POP_MAP[key] === popName);
        }

        let popTotal = 0, popOnline = 0, popOffline = 0, popEnergia = 0;
        let oltStatsList = [];

        targetOlts.forEach(oltId => {
            const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
            if (!oltConfig) return;

            let oltTotal = 0, oltOnline = 0, oltOffline = 0, oltEnergia = 0;
            let countCritico = 0, countProblema = 0, countAtencao = 0;
            const portDataMap = {};

            if (window.DATA_STORE && window.DATA_STORE.olts && window.DATA_STORE.olts[oltId]) {
                const rows = window.DATA_STORE.olts[oltId].slice(1);
                rows.forEach(col => {
                    if (col.length === 0) return;
                    const isOnline = DataMapper.isOnline(col[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                    if (isOnline) oltOnline++; else oltOffline++;
                    
                    const portInfo = DataMapper.extractPort(col[0], oltConfig.type);
                    if (portInfo) {
                        const portKey = `${portInfo.placa}/${portInfo.porta}`;
                        if (!portDataMap[portKey]) portDataMap[portKey] = { online: 0, offline: 0 };
                        if (isOnline) portDataMap[portKey].online++;
                        else portDataMap[portKey].offline++;
                    }
                });
                oltTotal = oltOnline + oltOffline;
            }

            for (const pk in portDataMap) {
                const p = portDataMap[pk];
                const pTotal = p.online + p.offline;
                if (pTotal >= 5) {
                    const percOffline = p.offline / pTotal;
                    if (percOffline === 1) countCritico++;
                    else if (percOffline >= 0.5 || p.offline >= 32) countProblema++;
                    else if (p.offline >= 16) countAtencao++;
                }
            }

            if (window.DATA_STORE && window.DATA_STORE.energia && oltConfig.energyCol !== undefined) {
                const rowsEnergia = window.DATA_STORE.energia.slice(1);
                rowsEnergia.forEach(row => {
                    if (row.length > oltConfig.energyCol + 2) {
                        const portaFull = row[oltConfig.energyCol + 1];
                        const qtd = parseInt(row[oltConfig.energyCol + 2]) || 0;
                        if (portaFull && qtd > 0) {
                            oltEnergia += qtd;
                        }
                    }
                });
            }

            popTotal += oltTotal;
            popOnline += oltOnline;
            popOffline += oltOffline;
            popEnergia += oltEnergia;

            let isCritico = (countCritico >= 1 || countProblema >= 4);
            let isProblema = ((countProblema >= 1 && countProblema <= 3) || countAtencao >= 4) && !isCritico;
            let isAtencao = (countAtencao >= 1 && countAtencao <= 3) && !isCritico && !isProblema;

            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">NORMAL</span>`;
            
            if (oltEnergia > 0 && oltEnergia >= (oltOffline * 0.5)) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ENERGIA</span>`;
            } else if (isCritico) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
            } else if (isProblema) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(248,113,113,0.15); color: #f87171;">PROBLEMA</span>`;
            } else if (isAtencao) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
            } else if (oltTotal === 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(255,255,255,0.1); color: #CAC4D0;">SEM CLIENTES</span>`;
            }

            oltStatsList.push({
                id: oltId,
                total: oltTotal,
                online: oltOnline,
                offline: oltOffline,
                energia: oltEnergia,
                statusHtml: statusBadgeHtml
            });
        });

        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-pop`;
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';
        wrapperDiv.style.backgroundColor = 'transparent';

        let tableRowsHtml = '';
        oltStatsList.forEach(stat => {
            tableRowsHtml += `
                <tr>
                    <td style="text-align: left; font-family: 'Montserrat', sans-serif; font-weight: bold;">${stat.id}</td>
                    <td style="text-align: left;">${stat.total.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.online.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.energia.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.statusHtml}</td>
                </tr>
            `;
        });

        wrapperDiv.innerHTML = `
            <div style="width: 1000px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;">
                        <div>
                            <h2 style="margin: 0; font-size: 1.8rem; color: #fbbf24; display: flex; align-items: center; gap: 10px;">
                                <span class="material-symbols-rounded" style="font-size: 32px;">domain</span> BOLETIM DE STATUS - POP
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${popName}</h3>
                        </div>
                    </div>
                    <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                        Gerado em: ${dataHora}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #ffffff; margin-bottom: 10px;">router</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${popTotal.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total</div>
                    </div>
                    <div style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #4ade80; margin-bottom: 10px;">wifi</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #4ade80;">${popOnline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Online</div>
                    </div>
                    <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #f87171; margin-bottom: 10px;">wifi_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${popOffline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Offline</div>
                    </div>
                    <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #fbbf24; margin-bottom: 10px;">power_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${popEnergia.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; margin-bottom: 25px; height: 250px; border: 1px solid rgba(255,255,255,0.05);">
                    <canvas id="canvas-pop-${Date.now()}"></canvas>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">OLT</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: left;">ONLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left;">ENERGIA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 0 8px 0 0;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody style="font-family: 'Roboto Mono', monospace;">
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

        const canvasEl = wrapperDiv.querySelector('canvas');
        new Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: oltStatsList.map(s => s.id),
                datasets: [
                    { label: 'Offline', data: oltStatsList.map(s => s.offline), backgroundColor: 'rgba(248, 113, 113, 0.8)', borderRadius: 4 },
                    { label: 'Sem Energia', data: oltStatsList.map(s => s.energia), backgroundColor: 'rgba(251, 191, 36, 0.8)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { labels: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } },
                    x: { grid: { display: false }, ticks: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } }
                }
            }
        });

        await new Promise(r => setTimeout(r, 500)); 

        const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });
        
        const link = document.createElement('a');
        link.download = `Boletim_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim de POP:', error);
        alert('Ocorreu um erro ao gerar o boletim.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};

window.gerarBoletimGeral = async function(event) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : document.querySelector('#boletim-gerencial-modal .search-btn:last-child');
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span> GERANDO...`;
        btn.disabled = true;
    }

    try {
        let globalTotal = 0, globalOnline = 0, globalOffline = 0, globalEnergia = 0;
        let popStatsMap = {};

        const uniquePops = [...new Set(Object.values(POP_MAP))].sort();
        uniquePops.forEach(pop => {
            popStatsMap[pop] = { 
                total: 0, online: 0, offline: 0, energia: 0, 
                totalPortasCriticas: 0, oltsCom5Problemas: 0, oltsCom3Problemas: 0 
            };
        });

        GLOBAL_MASTER_OLT_LIST.forEach(oltConfig => {
            const oltId = oltConfig.id;
            const popName = POP_MAP[oltId] || 'Outros';
            if (!popStatsMap[popName]) popStatsMap[popName] = { 
                total: 0, online: 0, offline: 0, energia: 0, 
                totalPortasCriticas: 0, oltsCom5Problemas: 0, oltsCom3Problemas: 0 
            };

            let oltTotal = 0, oltOnline = 0, oltOffline = 0, oltEnergia = 0;
            const portDataMap = {};
            let oltPortasCriticas = 0;
            let oltPortasProblema = 0;

            if (window.DATA_STORE && window.DATA_STORE.olts && window.DATA_STORE.olts[oltId]) {
                const rows = window.DATA_STORE.olts[oltId].slice(1);
                rows.forEach(col => {
                    if (col.length === 0) return;
                    const isOnline = DataMapper.isOnline(col[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                    if (isOnline) oltOnline++; else oltOffline++;
                    
                    const portInfo = DataMapper.extractPort(col[0], oltConfig.type);
                    if (portInfo) {
                        const portKey = `${portInfo.placa}/${portInfo.porta}`;
                        if (!portDataMap[portKey]) portDataMap[portKey] = { online: 0, offline: 0 };
                        if (isOnline) portDataMap[portKey].online++;
                        else portDataMap[portKey].offline++;
                    }
                });
                oltTotal = oltOnline + oltOffline;
            }

            for (const pk in portDataMap) {
                const p = portDataMap[pk];
                const pTotal = p.online + p.offline;
                if (pTotal >= 5) {
                    const percOffline = p.offline / pTotal;
                    if (percOffline === 1) {
                        oltPortasCriticas++;
                    } else if (percOffline >= 0.5 || p.offline >= 32) {
                        oltPortasProblema++;
                    }
                }
            }

            if (window.DATA_STORE && window.DATA_STORE.energia && oltConfig.energyCol !== undefined) {
                const rowsEnergia = window.DATA_STORE.energia.slice(1);
                rowsEnergia.forEach(row => {
                    if (row.length > oltConfig.energyCol + 2) {
                        const portaFull = row[oltConfig.energyCol + 1];
                        const qtd = parseInt(row[oltConfig.energyCol + 2]) || 0;
                        if (portaFull && qtd > 0) {
                            oltEnergia += qtd;
                        }
                    }
                });
            }

            popStatsMap[popName].total += oltTotal;
            popStatsMap[popName].online += oltOnline;
            popStatsMap[popName].offline += oltOffline;
            popStatsMap[popName].energia += oltEnergia;

            popStatsMap[popName].totalPortasCriticas += oltPortasCriticas;
            if (oltPortasProblema >= 5) popStatsMap[popName].oltsCom5Problemas++;
            if (oltPortasProblema >= 3) popStatsMap[popName].oltsCom3Problemas++;

            globalTotal += oltTotal;
            globalOnline += oltOnline;
            globalOffline += oltOffline;
            globalEnergia += oltEnergia;
        });

        let popStatsList = Object.keys(popStatsMap).map(pop => {
            let s = popStatsMap[pop];
            
            let isFalhaEletrica = s.energia > 0 && s.energia >= (s.offline * 0.5);
            let isCritico = s.totalPortasCriticas >= 3;
            let isProblema = s.totalPortasCriticas >= 1 && s.totalPortasCriticas <= 2;
            let isAtencao = s.oltsCom5Problemas >= 1 || s.oltsCom3Problemas >= 2;

            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">ESTÁVEL</span>`;
            
            if (isFalhaEletrica) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">FALHA ELÉTRICA</span>`;
            } else if (isCritico) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
            } else if (isProblema) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(248,113,113,0.15); color: #f87171;">PROBLEMA</span>`;
            } else if (isAtencao) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
            }

            return {
                id: pop,
                total: s.total,
                online: s.online,
                offline: s.offline,
                energia: s.energia,
                statusHtml: statusBadgeHtml
            };
        });

        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-geral`;
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';
        wrapperDiv.style.backgroundColor = 'transparent';

        let tableRowsHtml = '';
        popStatsList.forEach(stat => {
            if (stat.total === 0) return; 
            tableRowsHtml += `
                <tr>
                    <td style="text-align: left; font-family: 'Montserrat', sans-serif; font-weight: bold;">${stat.id}</td>
                    <td style="text-align: left;">${stat.total.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.online.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.energia.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.statusHtml}</td>
                </tr>
            `;
        });

        wrapperDiv.innerHTML = `
            <div style="width: 1000px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="material-symbols-rounded" style="font-size: 36px; color: #ffffff;">public</span>
                            <h2 style="margin: 0; font-size: 1.8rem; color: #67079f; background: #fff; padding: 5px 15px; border-radius: 8px;">
                                BOLETIM GERAL DA REDE
                            </h2>
                        </div>
                    </div>
                    <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                        Gerado em: ${dataHora}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #ffffff; margin-bottom: 10px;">router</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${globalTotal.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total</div>
                    </div>
                    <div style="background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #4ade80; margin-bottom: 10px;">wifi</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #4ade80;">${globalOnline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Online</div>
                    </div>
                    <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #f87171; margin-bottom: 10px;">wifi_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${globalOffline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Offline</div>
                    </div>
                    <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #fbbf24; margin-bottom: 10px;">power_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${globalEnergia.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; margin-bottom: 25px; height: 300px; border: 1px solid rgba(255,255,255,0.05);">
                    <canvas id="canvas-geral-${Date.now()}"></canvas>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(255,255,255,0.9); padding: 12px; color: #67079f; text-align: left; border-radius: 8px 0 0 0;">POP</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: left;">ONLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left;">ENERGIA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left; border-radius: 0 8px 0 0;">STATUS MACRO</th>
                        </tr>
                    </thead>
                    <tbody style="font-family: 'Roboto Mono', monospace;">
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

        // Filtrar pops para o gráfico (apenas com dados)
        const chartData = popStatsList.filter(s => s.total > 0);

        const canvasEl = wrapperDiv.querySelector('canvas');
        new Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartData.map(s => s.id.replace('POP ', '')),
                datasets: [
                    { label: 'Offline', data: chartData.map(s => s.offline), backgroundColor: 'rgba(248, 113, 113, 0.8)', borderRadius: 4 },
                    { label: 'Sem Energia', data: chartData.map(s => s.energia), backgroundColor: 'rgba(251, 191, 36, 0.8)', borderRadius: 4 }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false, animation: false,
                plugins: { legend: { labels: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } },
                    y: { grid: { display: false }, ticks: { color: '#CAC4D0', font: {family: "'Roboto Mono', monospace"} } }
                }
            }
        });

        await new Promise(r => setTimeout(r, 500)); 

        const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });
        
        const link = document.createElement('a');
        link.download = `Boletim_Geral_Rede_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim geral:', error);
        alert('Ocorreu um erro ao gerar o boletim.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};