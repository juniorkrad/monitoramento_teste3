// ==============================================================================
// olt-relatorio.js - Gerador de Boletim Visual (PNG Off-screen) e TXT para OLTs
// Atualização: Escopo Unificado por POP, Resumo Placa, OLT e Boletim de Emergência (Altura Fixa)
// ==============================================================================

window.gerarRelatorioOltOffscreen = async function(event, directPopName) {
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

            const values = window.DATA_STORE.olts[targetOltId] || [];
            const rows = values.slice(1);
            const portDataMap = {};

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                const portInfo = DataMapper.extractPort(columns[0], oltConfig.type);
                if (!portInfo) return;

                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;

                if (!portDataMap[portKey]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, targetOltId, placa, porta, oltConfig.type);
                    portDataMap[portKey] = { 
                        online: 0, offline: 0, 
                        info: infoExtra, bairro: bairroExtra, 
                        placa: placaNum, porta: portaNum 
                    };
                }

                if (isOnline) portDataMap[portKey].online++;
                else portDataMap[portKey].offline++;
            });

            for (const pk in portDataMap) {
                const pData = portDataMap[pk];
                const total = pData.online + pData.offline;
                
                if (total >= 5) {
                    const percOffline = pData.offline / total;
                    if (percOffline === 1) { 
                        portasCriticas.push({
                            olt: targetOltId,
                            placa: pData.placa,
                            porta: String(pData.porta).padStart(2, '0'),
                            circuito: pData.info,
                            bairro: pData.bairro && pData.bairro !== '-' ? pData.bairro : 'N/A',
                            perc: Math.round(percOffline * 100) + '%',
                            status: 'CRÍTICO'
                        });
                    }
                }
            }
        });

        let tituloBoletim = "REDE ESTÁVEL";
        if (portasCriticas.length > 1) {
            tituloBoletim = "ROMPIMENTO BACKBONE";
        } else if (portasCriticas.length === 1) {
            tituloBoletim = "ROMPIMENTO CIRCUITO";
        }

        portasCriticas.sort((a, b) => a.olt.localeCompare(b.olt) || parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        const LIMITE_LINHAS = 12;
        const totalPaginas = Math.max(1, Math.ceil(portasCriticas.length / LIMITE_LINHAS));
        const dataHora = new Date().toLocaleString('pt-BR');

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-wrapper-pag-${paginaAtual}`;
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
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 64px; color: #4ade80; margin-bottom: 15px; display:block;">check_circle</span>
                        <h2 style="margin: 0; color: #4ade80; font-size: 2rem;">Rede Estável</h2>
                        <p style="color: #CAC4D0; margin-top: 10px; font-size: 1.1rem;">Nenhum alarme crítico de queda total (100%) detectado no ${popName} no momento.</p>
                    </div>
                `;
            } else {
                let rowsHtml = '';
                
                const startIndex = (paginaAtual - 1) * LIMITE_LINHAS;
                const endIndex = startIndex + LIMITE_LINHAS;
                const fatiaCriticas = portasCriticas.slice(startIndex, endIndex);
                
                fatiaCriticas.forEach(p => {
                    const statusColor = '#ff3333';
                    const statusBg = 'rgba(0, 0, 0, 0.6)';
                    const statusBorder = '1px solid #ff3333';
                    
                    rowsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 12px 10px; font-weight: bold; text-align: left; width: 12%; color: #fbbf24;">${p.olt}</td>
                            <td style="padding: 12px 10px; font-family: 'Roboto Mono', monospace; text-align: left; width: 14%;">${p.placa}/${p.porta}</td>
                            
                            <td style="padding: 12px 10px; text-align: left; width: 20%;">
                                <span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: 'Roboto Mono', monospace; font-size: 0.9rem;">${p.circuito}</span>
                            </td>
                            
                            <td style="padding: 12px 10px; text-align: left; font-size: 0.85rem; color: #CAC4D0; width: 28%; word-break: break-word;">${p.bairro}</td>
                            
                            <td style="padding: 12px 10px; text-align: left; font-family: 'Roboto Mono', monospace; font-size: 0.95rem; font-weight: bold; width: 12%; border-left: 1px solid rgba(255,255,255,0.1); background-color: rgba(248, 113, 113, 0.04);">${p.perc}</td>
                            <td style="padding: 12px 10px; text-align: left; width: 14%; background-color: rgba(248, 113, 113, 0.04);">
                                <span style="background: ${statusBg}; color: ${statusColor}; border: ${statusBorder}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${p.status}</span>
                            </td>
                        </tr>
                    `;
                });

                tableHtml = `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: left; border-radius: 8px 0 0 0; width: 12%; color: #fbbf24;">OLT</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: left; width: 14%;">PLACA/PORTA</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: left; width: 20%;">CIRCUITO</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: left; width: 28%;">BAIRRO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: left; border-left: 1px solid rgba(255,255,255,0.1); width: 12%;">IMPACTO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: left; border-radius: 0 8px 0 0; width: 14%;">STATUS</th>
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
                            <h2 style="margin: 0; font-size: 1.6rem; color: #f87171; display: flex; align-items: center; gap: 10px;">
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

            let nomeArquivo = `Boletim_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            document.body.removeChild(wrapperDiv);
        }

    } catch (error) {
        console.error('Erro ao gerar relatório off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
        }
    }
};

window.gerarRelatorioTxtOffscreen = function(event, directPopName) {
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

            const values = window.DATA_STORE.olts[targetOltId] || [];
            const rows = values.slice(1);
            const portDataMap = {};

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                const portInfo = DataMapper.extractPort(columns[0], oltConfig.type);
                if (!portInfo) return;

                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;

                if (!portDataMap[portKey]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, targetOltId, placa, porta, oltConfig.type);
                    portDataMap[portKey] = { 
                        online: 0, offline: 0, 
                        info: infoExtra, bairro: bairroExtra, 
                        placa: placaNum, porta: portaNum 
                    };
                }

                if (isOnline) portDataMap[portKey].online++;
                else portDataMap[portKey].offline++;
            });

            for (const pk in portDataMap) {
                const pData = portDataMap[pk];
                const total = pData.online + pData.offline;
                
                if (total >= 5) {
                    const percOffline = pData.offline / total;
                    if (percOffline === 1) { 
                        portasCriticas.push({
                            olt: targetOltId,
                            placa: pData.placa,
                            porta: String(pData.porta).padStart(2, '0'),
                            circuito: pData.info,
                            bairro: pData.bairro && pData.bairro !== '-' ? pData.bairro : 'N/A'
                        });
                    }
                }
            }
        });

        let tituloBoletim = "REDE ESTÁVEL";
        if (portasCriticas.length > 1) {
            tituloBoletim = "ROMPIMENTO BACKBONE";
        } else if (portasCriticas.length === 1) {
            tituloBoletim = "ROMPIMENTO CIRCUITO";
        }

        portasCriticas.sort((a, b) => a.olt.localeCompare(b.olt) || parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        let txtContent = `=================================================\n`;
        txtContent += `   BOLETIM DE ALARMES - ${popName.toUpperCase()}\n`;
        txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
        txtContent += `   Status Geral: ${tituloBoletim}\n`;
        txtContent += `=================================================\n\n`;

        if (portasCriticas.length === 0) {
            txtContent += `   Nenhum alarme crítico (100% offline) detectado.\n   A rede encontra-se estável neste POP.\n`;
        } else {
            txtContent += `   PORTAS AFETADAS:\n\n`;
            portasCriticas.forEach(p => {
                txtContent += `   • OLT: ${p.olt.padEnd(8, ' ')} | Placa/Porta: ${p.placa}/${p.porta}\n`;
                txtContent += `     Circuito: ${p.circuito}\n`;
                txtContent += `     Bairro: ${p.bairro}\n`;
                txtContent += `     Impacto: 100% OFFLINE (CRÍTICO)\n\n`;
            });
        }

        txtContent += `=================================================\n`;

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Geral_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Erro ao gerar relatório TXT off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório TXT.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
        }
    }
};

window.gerarBoletimResumoOltOffscreen = async function(event) {
    if (event) event.stopPropagation();
    
    if (!window.CURRENT_MONITORING_CONFIG) {
        alert("Nenhuma OLT selecionada.");
        return;
    }
    
    const oltConfig = window.CURRENT_MONITORING_CONFIG;
    const oltName = oltConfig.oltName || oltConfig.id;
    
    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
        btn.disabled = true;
    }

    try {
        let globalTotal = 0, globalOnline = 0, globalOffline = 0;
        let placasList = [];

        for (let i = 1; i <= oltConfig.boards; i++) {
            const ports = window.CURRENT_OLT_PORT_DATA[i] || {};
            let pTotal = 0, pOnline = 0, pOffline = 0;
            
            let countCritico = 0;
            let countProblema = 0;
            let countAtencao = 0;
            
            for (const pt in ports) {
                const portOnline = ports[pt].online;
                const portOffline = ports[pt].offline;
                const portTotal = portOnline + portOffline;
                
                pOnline += portOnline;
                pOffline += portOffline;
                
                if (portTotal >= 5) {
                    const percOffline = portTotal > 0 ? (portOffline / portTotal) : 0;
                    if (percOffline === 1) {
                        countCritico++;
                    } else if (percOffline >= 0.5 || portOffline >= 32) {
                        countProblema++;
                    } else if (portOffline >= 16) {
                        countAtencao++;
                    }
                }
            }
            pTotal = pOnline + pOffline;
            
            globalTotal += pTotal;
            globalOnline += pOnline;
            globalOffline += pOffline;
            
            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">NORMAL</span>`;
            
            let isCritico = (countCritico >= 1 || countProblema >= 4);
            let isProblema = ((countProblema >= 1 && countProblema <= 3) || countAtencao >= 4) && !isCritico;
            let isAtencao = (countAtencao >= 1 && countAtencao <= 3) && !isCritico && !isProblema;

            if (pTotal === 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(255,255,255,0.1); color: #CAC4D0;">SEM CLIENTES</span>`;
            } else if (isCritico) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
            } else if (isProblema) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(248,113,113,0.15); color: #f87171;">PROBLEMA</span>`;
            } else if (isAtencao) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
            }

            placasList.push({
                placa: i,
                total: pTotal,
                online: pOnline,
                offline: pOffline,
                statusHtml: statusBadgeHtml
            });
        }

        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-olt`;
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
                    <td style="text-align: left;">${stat.online.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
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
                                <span class="material-symbols-rounded" style="font-size: 32px;">dns</span> BOLETIM DE STATUS - OLT
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltName}</h3>
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
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Clientes</div>
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
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PLACA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: left;">ONLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
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
        link.download = `Boletim_${oltName}_${new Date().getTime()}.png`;
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

window.gerarBoletimResumoPlacaOffscreen = async function(event) {
    if (event) event.stopPropagation();
    
    if (!window.CURRENT_MONITORING_CONFIG || !window.CURRENT_VIEW_PLACA) {
        alert("Nenhuma OLT ou Placa selecionada.");
        return;
    }

    const oltConfig = window.CURRENT_MONITORING_CONFIG;
    const oltName = oltConfig.oltName || oltConfig.id;
    const placa = window.CURRENT_VIEW_PLACA;
    
    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
        btn.disabled = true;
    }

    try {
        const ports = window.CURRENT_OLT_PORT_DATA[placa] || {};
        const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
        
        let globalTotal = 0, globalOnline = 0, globalOffline = 0;
        let portasList = [];

        sortedPorts.forEach(pt => {
            const { online, offline, info } = ports[pt];
            const total = online + offline;
            
            globalTotal += total;
            globalOnline += online;
            globalOffline += offline;

            const percOffline = total > 0 ? (offline / total) : 0;
            const baseBadgeStyle = "padding: 6px 14px; border-radius: 99px; font-weight: bold; font-size: 0.85rem; display: inline-block; font-family: 'Montserrat', sans-serif;";
            let statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(74,222,128,0.15); color: #4ade80;">NORMAL</span>`;

            if (total >= 5) {
                if (percOffline === 1) { 
                    statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(0,0,0,0.6); color: #ff3333; border: 1px solid #ff3333;">CRÍTICO</span>`;
                } else if (percOffline >= 0.5 || offline >= 32) { 
                    statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(248,113,113,0.15); color: #f87171;">PROBLEMA</span>`;
                } else if (offline >= 16) { 
                    statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(251,191,36,0.15); color: #fbbf24;">ATENÇÃO</span>`;
                }
            } else if (total === 0) {
                statusBadgeHtml = `<span class="status-badge" style="${baseBadgeStyle} background: rgba(255,255,255,0.1); color: #CAC4D0;">SEM CLIENTES</span>`;
            }

            portasList.push({
                porta: pt,
                circuito: info,
                total: total,
                online: online,
                offline: offline,
                statusHtml: statusBadgeHtml
            });
        });
        
        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-placa`;
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
                    <td style="text-align: left;">${stat.online.toLocaleString('pt-BR')}</td>
                    <td style="text-align: left;">${stat.offline.toLocaleString('pt-BR')}</td>
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
                                <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span> BOLETIM DE STATUS - PLACA ${placa}
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltName}</h3>
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
                        <div style="font-size: 0.85rem; color: #CAC4D0; text-transform: uppercase;">Total Clientes</div>
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
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                    <thead>
                        <tr>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 8px 0 0 0;">PORTA</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">CIRCUITO</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ffffff; text-align: left;">TOTAL</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #4ade80; text-align: left;">ONLINE</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #f87171; text-align: left;">OFFLINE</th>
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
        link.download = `Boletim_${oltName}_Placa_${placa}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim da Placa:', error);
        alert('Ocorreu um erro ao gerar o boletim da Placa.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};

window.gerarBoletimEmergenciaOltOffscreen = async function(event) {
    if (event) event.stopPropagation();
    
    if (!window.CURRENT_MONITORING_CONFIG) {
        alert("Nenhuma OLT selecionada.");
        return;
    }
    
    const oltConfig = window.CURRENT_MONITORING_CONFIG;
    const oltName = oltConfig.oltName || oltConfig.id;
    
    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
        btn.disabled = true;
    }

    try {
        let globalTotal = 0, globalOnline = 0, globalOffline = 0;
        let portasCriticas = [];

        for (let i = 1; i <= oltConfig.boards; i++) {
            const ports = window.CURRENT_OLT_PORT_DATA[i] || {};
            for (const pt in ports) {
                const pData = ports[pt];
                const total = pData.online + pData.offline;
                
                globalTotal += total;
                globalOnline += pData.online;
                globalOffline += pData.offline;
                
                if (total >= 5 && pData.offline === total) {
                    portasCriticas.push({
                        placa: i,
                        porta: pt,
                        circuito: pData.info,
                        bairro: pData.bairro && pData.bairro !== '-' ? pData.bairro : 'N/A',
                        total: total,
                        offline: pData.offline
                    });
                }
            }
        }

        const dataHora = new Date().toLocaleString('pt-BR');
        const wrapperDiv = document.createElement('div');
        wrapperDiv.id = `offscreen-boletim-emergencia`;
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
                tableRowsHtml += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 12px; font-family: 'Roboto Mono', monospace; text-align: left;">${p.placa}/${String(p.porta).padStart(2, '0')}</td>
                        <td style="padding: 12px; text-align: left;">
                            <span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: 'Roboto Mono', monospace; font-size: 0.9rem;">${p.circuito}</span>
                        </td>
                        <td style="padding: 12px; text-align: left; color: #CAC4D0; font-size: 0.85rem;">${p.bairro}</td>
                        <td style="padding: 12px; text-align: left; font-family: 'Roboto Mono', monospace; font-weight: bold; color: #ff3333;">100%</td>
                        <td style="padding: 12px; text-align: left;">
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
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #ff3333; text-align: left;">IMPACTO</th>
                            <th style="background: rgba(0,0,0,0.3); padding: 12px; color: #fbbf24; text-align: left; border-radius: 0 8px 0 0;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody style="font-family: 'Montserrat', sans-serif;">
                        ${tableRowsHtml}
                    </tbody>
                </table>
            `;
        }

        wrapperDiv.innerHTML = `
            <div style="width: 1000px; min-height: 850px; background-color: #2f0e51; color: #ffffff; padding: 30px; border-radius: 24px; box-sizing: border-box; font-family: 'Montserrat', sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="logo-relatorio.png" alt="Logo" style="height: 60px; object-fit: contain;">
                        <div>
                            <h2 style="margin: 0; font-size: 1.8rem; color: #ff3333; display: flex; align-items: center; gap: 10px;">
                                <span class="material-symbols-rounded" style="font-size: 32px;">warning</span> BOLETIM DE EMERGÊNCIA
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; text-transform: uppercase; color: #fff;">${oltName}</h3>
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
        link.download = `Boletim_Emergencia_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(wrapperDiv);

    } catch (error) {
        console.error('Erro ao gerar boletim de emergência:', error);
        alert('Ocorreu um erro ao gerar o boletim de emergência.');
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
};