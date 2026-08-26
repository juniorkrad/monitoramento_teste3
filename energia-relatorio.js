// ==============================================================================
// energia-relatorio.js - Gerador de Boletim Visual (PNG Off-screen) para Energia
// Atualização: Escopo Unificado por POP, OLT e Placa com Parâmetros Dinâmicos
// ==============================================================================

window.gerarRelatorioEnergiaOffscreen = async function(event, directPopName) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 30px;">hourglass_empty</span>`;
    }

    try {
        let popName = directPopName;
        
        if (!popName && btn && btn.dataset.pop) {
            popName = btn.dataset.pop;
        }

        if (!popName) {
            const titleEl = document.getElementById('super-modal-title');
            let oltName = 'OLT_Desconhecida';
            if (titleEl) {
                oltName = titleEl.innerText.replace('dns', '').trim();
            }
            popName = (typeof POP_MAP !== 'undefined' && POP_MAP[oltName]) ? POP_MAP[oltName] : oltName;
        }

        let targetOlts = [];
        if (typeof POP_MAP !== 'undefined') {
            targetOlts = Object.keys(POP_MAP).filter(key => POP_MAP[key] === popName);
        }
        
        if (targetOlts.length === 0) targetOlts.push(popName);

        const portasCriticas = [];
        const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];
        const rowsLocalidades = window.DATA_STORE.localidades || [];

        targetOlts.forEach(targetOltId => {
            const oltConfig = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === targetOltId) : null;
            if (!oltConfig) return;

            const oltData = window.ENERGY_DATA_STORE.olts[targetOltId];
            if (!oltData || !oltData.ports) return;

            const portsMap = oltData.ports;

            for (const placa in portsMap) {
                for (const porta in portsMap[placa]) {
                    const pData = portsMap[placa][porta];
                    const calcTotal = pData.total || (pData.online + pData.offline);
                    
                    if (calcTotal > 0) {
                        const percOff = pData.powerOff / calcTotal;
                        
                        if (percOff >= 0.5) {
                            const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                            const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, targetOltId, placa, porta, oltConfig.type);
                            
                            portasCriticas.push({
                                olt: targetOltId,
                                placa: placa,
                                porta: String(porta).padStart(2, '0'),
                                circuito: infoExtra,
                                bairro: bairroExtra && bairroExtra !== '-' ? bairroExtra : 'N/A',
                                powerOff: pData.powerOff,
                                perc: Math.round(percOff * 100) + '%',
                                status: 'SEM ENERGIA'
                            });
                        }
                    }
                }
            }
        });

        let tituloBoletim = "ENERGIA ESTÁVEL";
        if (portasCriticas.length > 0) {
            tituloBoletim = "FALHA ELÉTRICA MASSIVA";
        }

        portasCriticas.sort((a, b) => a.olt.localeCompare(b.olt) || parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        const LIMITE_LINHAS = 12;
        const totalPaginas = Math.max(1, Math.ceil(portasCriticas.length / LIMITE_LINHAS));
        const dataHora = new Date().toLocaleString('pt-BR');

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-wrapper-energy-pag-${paginaAtual}`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px'; 
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent'; 
            wrapperDiv.style.padding = '0';

            const offscreenDiv = document.createElement('div');
            offscreenDiv.style.width = '1000px'; 
            offscreenDiv.style.height = '750px'; 
            offscreenDiv.style.backgroundColor = '#2f0e51'; 
            offscreenDiv.style.color = '#ffffff';
            offscreenDiv.style.padding = '30px';
            offscreenDiv.style.borderRadius = '24px'; 
            offscreenDiv.style.overflow = 'hidden'; 
            offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
            offscreenDiv.style.boxSizing = 'border-box';
            offscreenDiv.style.display = 'flex'; 
            offscreenDiv.style.flexDirection = 'column';
            offscreenDiv.style.justifyContent = 'flex-start';

            let tableHtml = '';
            
            if (portasCriticas.length === 0) {
                tableHtml = `
                    <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-top: 20px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 64px; color: #4ade80; margin-bottom: 15px; display:block;">bolt</span>
                        <h2 style="margin: 0; color: #4ade80; font-size: 2rem;">Energia Estável</h2>
                        <p style="color: #CAC4D0; margin-top: 10px; font-size: 1.1rem;">Nenhum alarme massivo de falta de energia (> 50%) detectado no ${popName} no momento.</p>
                    </div>
                `;
            } else {
                let rowsHtml = '';
                
                const startIndex = (paginaAtual - 1) * LIMITE_LINHAS;
                const endIndex = startIndex + LIMITE_LINHAS;
                const fatiaCriticas = portasCriticas.slice(startIndex, endIndex);
                
                fatiaCriticas.forEach(p => {
                    const statusColor = '#fbbf24'; 
                    const statusBg = 'rgba(251, 191, 36, 0.15)';
                    
                    rowsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 12px 10px; font-weight: bold; text-align: left; width: 12%; color: #fbbf24;">${p.olt}</td>
                            <td style="padding: 12px 10px; font-family: 'Roboto Mono', monospace; text-align: left; width: 14%;">${p.placa}/${p.porta}</td>
                            
                            <td style="padding: 12px 10px; text-align: left; width: 20%;">
                                <span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: 'Roboto Mono', monospace; font-size: 0.9rem;">${p.circuito}</span>
                            </td>
                            
                            <td style="padding: 12px 10px; text-align: left; font-size: 0.85rem; color: #CAC4D0; width: 28%; word-break: break-word;">${p.bairro}</td>
                            
                            <td style="padding: 12px 10px; text-align: left; font-family: 'Roboto Mono', monospace; font-size: 0.95rem; font-weight: bold; width: 12%; border-left: 1px solid rgba(255,255,255,0.1); background-color: rgba(251, 191, 36, 0.04); color: #fbbf24;">${p.perc}</td>
                            <td style="padding: 12px 10px; text-align: left; width: 14%; background-color: rgba(251, 191, 36, 0.04);">
                                <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${p.status}</span>
                            </td>
                        </tr>
                    `;
                });

                tableHtml = `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0; width: 12%; color: #fbbf24;">OLT</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.3); text-align: left; width: 14%;">PLACA/PORTA</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.3); text-align: left; width: 20%;">CIRCUITO</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.3); text-align: left; width: 28%;">BAIRRO</th>
                                <th style="padding: 12px 10px; background: rgba(251, 191, 36, 0.1); text-align: left; border-left: 1px solid rgba(255,255,255,0.1); width: 12%; color: #fbbf24;">IMPACTO</th>
                                <th style="padding: 12px 10px; background: rgba(251, 191, 36, 0.1); text-align: left; border-radius: 0 8px 0 0; width: 14%; color: #fbbf24;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                `;
            }

            let indicadorPaginaHtml = '';
            if (totalPaginas > 1) {
                indicadorPaginaHtml = `
                    <div style="font-size: 0.85rem; color: #fbbf24; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                        Página ${paginaAtual} de ${totalPaginas}
                    </div>
                `;
            }

            offscreenDiv.innerHTML = `
                <div style="border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="logo-relatorio.png" style="max-height: 60px; width: auto; object-fit: contain;" onerror="this.style.display='none'">
                        <div>
                            ${indicadorPaginaHtml}
                            <h2 style="margin: 0; font-size: 1.6rem; color: #fbbf24; display: flex; align-items: center; gap: 10px;">
                                ${portasCriticas.length > 0 ? `<span style="font-family: 'Material Symbols Rounded'; font-weight: normal; font-size: 28px;">warning</span>` : ''}
                                ${tituloBoletim}
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; color: #ffffff; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
                                <span style="font-family: 'Material Symbols Rounded'; font-weight: normal; font-size: 24px;">domain</span> ${popName}
                            </h3>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.85rem; color: #CAC4D0; font-family: 'Roboto Mono', monospace;">Gerado em: ${dataHora}</span>
                    </div>
                </div>
                ${tableHtml}
            `;

            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, 
                scale: 2, 
                logging: false
            });

            let nomeArquivo = `BoletimEnergia_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            document.body.removeChild(wrapperDiv);
        }

    } catch (error) {
        console.error('Erro ao gerar relatório off-screen de energia:', error);
        alert('Ocorreu um erro ao gerar o relatório de energia.');
    } finally {
        if (btn) btn.innerHTML = originalContent;
    }
};

window.gerarBoletimResumoEnergiaOltOffscreen = async function(event) {
    if (event) event.stopPropagation();

    if (!window.CURRENT_ENERGY_OLT) {
        alert("Nenhuma OLT selecionada.");
        return;
    }

    const oltId = window.CURRENT_ENERGY_OLT;
    const oltData = window.ENERGY_DATA_STORE.olts[oltId];
    
    if (!oltData) {
        alert("Dados da OLT não encontrados.");
        return;
    }

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
        btn.disabled = true;
    }

    try {
        let globalTotal = 0, globalOffline = 0, globalPowerOff = 0;
        let placasList = [];
        const pltData = oltData.ports || {};

        for (let i = 1; i <= oltData.boards; i++) {
            const placaNum = i;
            const ports = pltData[placaNum] || {};
            
            let pTotal = 0, pOffline = 0, pPowerOff = 0;
            let hasCritico = false;
            
            for (const pt in ports) {
                const pData = ports[pt];
                const portPowerOff = pData.powerOff;
                const portOffline = pData.offline;
                const portTotal = pData.total || (pData.online + pData.offline);
                
                pPowerOff += portPowerOff;
                pOffline += portOffline;
                pTotal += portTotal;
                
                if (portTotal > 0) {
                    const perc = portPowerOff / portTotal;
                    if ((perc >= 0.5 && portPowerOff >= 10) || (perc === 1 && portTotal >= 5)) {
                        hasCritico = true;
                    }
                }
            }

            globalTotal += pTotal;
            globalOffline += pOffline;
            globalPowerOff += pPowerOff;

            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">NORMAL</span>`;

            if (pTotal === 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(255,255,255,0.1); color: #CAC4D0;">SEM CLIENTES</span>`;
            } else if (hasCritico) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
            } else if (pPowerOff > 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
            }

            placasList.push({
                placa: placaNum,
                total: pTotal,
                offline: pOffline,
                powerOff: pPowerOff,
                statusHtml: statusBadgeHtml
            });
        }

        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-energia-olt`;
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';
        wrapperDiv.style.backgroundColor = 'transparent';

        let tableRowsHtml = '';
        placasList.forEach(stat => {
            tableRowsHtml += `
                <tr>
                    <td style="text-align: left; font-family: 'Montserrat', sans-serif; font-weight: bold;">Placa ${stat.placa}</td>
                    <td style="text-align: left;">${stat.total.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.powerOff.toLocaleString('pt-BR')}</td>
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
                                <span class="material-symbols-rounded" style="font-size: 32px;">bolt</span> BOLETIM DE ENERGIA - OLT
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltId}</h3>
                        </div>
                    </div>
                    <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                        Gerado em: ${dataHora}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #ffffff; margin-bottom: 10px;">router</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${globalTotal.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Analisado</div>
                    </div>
                    <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #f87171; margin-bottom: 10px;">router_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${globalOffline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Offline</div>
                    </div>
                    <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #fbbf24; margin-bottom: 10px;">power_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${globalPowerOff.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PLACA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left;">SEM ENERGIA</th>
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

        await new Promise(r => setTimeout(r, 500)); 

        const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });
        
        const link = document.createElement('a');
        link.download = `BoletimEnergia_${oltId}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim da OLT:', error);
        alert('Ocorreu um erro ao gerar o boletim.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};

window.gerarBoletimResumoEnergiaPlacaOffscreen = async function(event) {
    if (event) event.stopPropagation();
    
    if (!window.CURRENT_ENERGY_OLT || !window.CURRENT_ENERGY_PLACA) {
        alert("Nenhuma OLT ou Placa selecionada.");
        return;
    }

    const oltId = window.CURRENT_ENERGY_OLT;
    const placa = window.CURRENT_ENERGY_PLACA;
    const oltData = window.ENERGY_DATA_STORE.olts[oltId];
    
    if (!oltData) return;
    
    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
        btn.disabled = true;
    }

    try {
        const ports = oltData.ports[placa] || {};
        const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
        
        let globalTotal = 0, globalOffline = 0, globalPowerOff = 0;
        let portasList = [];

        const rowsCircuitos = window.DATA_STORE.circuitos || [];
        const rowsLocalidades = window.DATA_STORE.localidades || [];

        sortedPorts.forEach(pt => {
            const { online, offline, powerOff, total } = ports[pt];
            const calcTotal = total || (online + offline);
            
            globalTotal += calcTotal;
            globalOffline += offline;
            globalPowerOff += powerOff;

            const info = DataMapper.getCircuitInfo(rowsCircuitos, { id: oltId, type: oltData.type }, placa, pt);
            const bairro = DataMapper.getBairroInfo(rowsLocalidades, oltId, placa, pt, oltData.type);
            
            const safeInfo = info.replace(/'/g, "\\'");
            const textoBairro = bairro && bairro !== '-' ? bairro : 'N/A';

            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">NORMAL</span>`;

            if (calcTotal > 0) {
                const perc = powerOff / calcTotal;
                if ((perc >= 0.5 && powerOff >= 10) || (perc === 1 && calcTotal >= 5)) {
                    statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
                } else if (perc >= 0.15 && powerOff >= 5) {
                    statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
                }
            } else if (calcTotal === 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(255,255,255,0.1); color: #CAC4D0;">SEM CLIENTES</span>`;
            }

            portasList.push({
                porta: pt,
                circuito: info,
                total: calcTotal,
                offline: offline,
                powerOff: powerOff,
                statusHtml: statusBadgeHtml
            });
        });
        
        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-energia-placa`;
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';
        wrapperDiv.style.backgroundColor = 'transparent';

        let tableRowsHtml = '';
        portasList.forEach(stat => {
            tableRowsHtml += `
                <tr>
                    <td style="text-align: left; font-family: 'Montserrat', sans-serif; font-weight: bold;">Porta ${String(stat.porta).padStart(2, '0')}</td>
                    <td style="text-align: left;">${stat.circuito}</td>
                    <td style="text-align: left;">${stat.total.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.powerOff.toLocaleString('pt-BR')}</td>
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
                                <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span> BOLETIM DE ENERGIA - PLACA ${placa}
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltId}</h3>
                        </div>
                    </div>
                    <div style="text-align: right; color: #CAC4D0; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">
                        Gerado em: ${dataHora}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #ffffff; margin-bottom: 10px;">router</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px;">${globalTotal.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Analisado</div>
                    </div>
                    <div style="background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #f87171; margin-bottom: 10px;">router_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #f87171;">${globalOffline.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Offline</div>
                    </div>
                    <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 12px; padding: 20px; text-align: center;">
                        <div class="material-symbols-rounded" style="font-size: 32px; color: #fbbf24; margin-bottom: 10px;">power_off</div>
                        <div style="font-family: 'Roboto Mono', monospace; font-size: 2rem; font-weight: 700; margin-bottom: 5px; color: #fbbf24;">${globalPowerOff.toLocaleString('pt-BR')}</div>
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Sem Energia</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PORTA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">CIRCUITO</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left;">SEM ENERGIA</th>
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

        await new Promise(r => setTimeout(r, 500)); 

        const canvas = await html2canvas(wrapperDiv, { backgroundColor: null, scale: 2, logging: false });
        
        const link = document.createElement('a');
        link.download = `BoletimEnergia_${oltId}_Placa_${placa}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim de energia da Placa:', error);
        alert('Ocorreu um erro ao gerar o boletim da Placa.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};