// ==============================================================================
// relatorio-hibrido.js - Geração de Relatório Híbrido (Rede vs Energia)
// Metodologia: Abertura de Nova Guia e Impressão Nativa (Fundo Branco Isolado)
// ==============================================================================

window.gerarRelatorioHibridoOffscreen = function(event) {
    if (event) event.stopPropagation();

    const titleEl = document.getElementById('super-modal-title');
    if (!titleEl) {
        alert('Não foi possível identificar o POP.');
        return;
    }
    const popName = titleEl.innerText.replace('dns', '').trim();
    
    const popConfig = typeof POP_MAP_CONFIG !== 'undefined' ? POP_MAP_CONFIG.find(p => p.name === popName) : null;
    if (!popConfig) {
        alert('Configuração do POP não encontrada.');
        return;
    }

    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    let html = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>Relatorio_Hibrido_${popName.replace(/\s+/g, '_')}</title>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                @page { 
                    size: A4 portrait; 
                    margin: 15mm 10mm; 
                }
                body {
                    font-family: 'Montserrat', sans-serif;
                    background-color: #ffffff;
                    color: #000000;
                    margin: 0; 
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .header-container { text-align: center; margin-bottom: 25px; }
                .header-container img { max-height: 70px; margin-bottom: 10px; }
                .header-title { color: #67079f; font-size: 22px; font-weight: 700; text-transform: uppercase; margin: 0 0 5px 0; }
                .header-subtitle { color: #555555; font-size: 13px; margin: 0; font-family: 'Roboto Mono', monospace; }
                
                .olt-title { color: #67079f; font-size: 20px; font-weight: 700; margin: 30px 0 15px 0; padding-bottom: 5px; border-bottom: 2px solid #67079f; page-break-after: avoid; text-align: center; }
                
                /* Estrutura de Tabela em Blocos (Cards Flutuantes e Elásticos) */
                table { 
                    width: auto; /* Permite que a tabela encolha/estique conforme o conteúdo */
                    margin: 0 auto 25px auto; /* Centraliza a tabela no meio da página A4 */
                    max-width: 100%;
                    border-collapse: separate; 
                    border-spacing: 0 6px; 
                    font-size: 11.5px; 
                }
                th, td { 
                    padding: 8px 16px; /* Aumentado o respiro interno para compensar a largura automática */
                    text-align: center; 
                    vertical-align: middle; 
                    background-color: #f8f9fa; 
                    border-top: 1px solid #e0e0e0; 
                    border-bottom: 1px solid #e0e0e0;
                    white-space: nowrap; /* Garante que o texto de nenhuma coluna quebre linha */
                }
                
                /* Bordas arredondadas para simular Cards */
                .b-left { border-left: 1px solid #e0e0e0; border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
                .b-right { border-right: 1px solid #e0e0e0; border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
                
                /* Coluna Espaçadora Transparente (Tamanho Fixo para os vãos) */
                .spacer { background-color: transparent !important; border: none !important; width: 15px; min-width: 15px; padding: 0 !important; }
                
                /* Cabeçalho das Colunas */
                th.b-left, th.b-right, th.b-center { background-color: #e9ecef; border-color: #d1d5db; color: #374151; font-weight: 700; text-transform: uppercase; font-size: 10px; }
                
                /* Título da Placa (Fora do padrão de cards) */
                .placa-title td { background-color: transparent !important; color: #67079f; font-size: 15px; font-weight: 700; text-align: left; border: none; border-bottom: 2px solid #67079f; padding: 20px 5px 5px 5px; border-radius: 0; }
                
                /* Destaque Linha Crítica */
                .row-critical td:not(.spacer) { background-color: #ffebee !important; border-color: #ffcdd2 !important; }
                
                .circuito-text { font-family: 'Roboto Mono', monospace; font-size: 11px; font-weight: 600; color: #333333; }
                
                /* Estilo Pílula */
                .pill { display: inline-block; padding: 5px 14px; border-radius: 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .pill-normal { background: rgba(74, 222, 128, 0.15); color: #2e7d32; border: 1px solid rgba(74, 222, 128, 0.4); }
                .pill-warning { background: rgba(251, 191, 36, 0.15); color: #d97706; border: 1px solid rgba(251, 191, 36, 0.4); }
                .pill-danger { background: rgba(248, 113, 113, 0.15); color: #d32f2f; border: 1px solid rgba(248, 113, 113, 0.4); }
                .pill-critical { background: rgba(0, 0, 0, 0.8); color: #ff3333; border: 1px solid #ff3333; }
                .pill-empty { display: none; }
            </style>
        </head>
        <body>
            <div class="header-container">
                <img src="${baseUrl}logo-comunicado.png" alt="Logo">
                <h1 class="header-title">Análise Híbrida de Impacto</h1>
                <p class="header-subtitle">POP: <b>${popName}</b> | Data: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
    `;

    let hasData = false;

    popConfig.olts.forEach(oltId => {
        const oltConf = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId) : null;
        if (!oltConf) return;

        let portNetworkStats = {};
        if (window.DATA_STORE && window.DATA_STORE.olts && window.DATA_STORE.olts[oltId]) {
            const rows = window.DATA_STORE.olts[oltId].slice(1);
            rows.forEach(col => {
                if (col.length === 0) return;
                const isOnline = DataMapper.isOnline(col[oltConf.type === 'nokia' ? 4 : 2], oltConf.type);
                const portInfo = DataMapper.extractPort(col[0], oltConf.type);
                
                if (portInfo) {
                    const placa = parseInt(portInfo.placa);
                    const porta = parseInt(portInfo.porta);
                    
                    if (!portNetworkStats[placa]) portNetworkStats[placa] = {};
                    if (!portNetworkStats[placa][porta]) portNetworkStats[placa][porta] = { off: 0, total: 0 };
                    
                    portNetworkStats[placa][porta].total++;
                    if (!isOnline) portNetworkStats[placa][porta].off++;
                }
            });
        }

        let portEnergyStats = {};
        if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.olts && window.ENERGY_DATA_STORE.olts[oltId] && window.ENERGY_DATA_STORE.olts[oltId].ports) {
            portEnergyStats = window.ENERGY_DATA_STORE.olts[oltId].ports;
        }

        const allPlacas = new Set([...Object.keys(portNetworkStats), ...Object.keys(portEnergyStats)]);
        const sortedPlacas = Array.from(allPlacas).sort((a, b) => parseInt(a) - parseInt(b));

        if (sortedPlacas.length > 0) {
            hasData = true;
            html += `<div class="olt-title">Equipamento: ${oltId}</div>`;

            sortedPlacas.forEach(placa => {
                html += `
                <table>
                    <thead>
                        <tr class="placa-title">
                            <td colspan="9">PLACA ${placa}</td>
                        </tr>
                        <tr>
                            <!-- Bloco 1: Base -->
                            <th class="b-left">Porta</th>
                            <th class="b-center" style="text-align: left;">Circuito</th>
                            <th class="b-right">Total</th>
                            
                            <th class="spacer"></th>
                            
                            <!-- Bloco 2: Rede -->
                            <th class="b-left">Offline</th>
                            <th class="b-right">Status</th>
                            
                            <th class="spacer"></th>
                            
                            <!-- Bloco 3: Energia -->
                            <th class="b-left">Sem Energia</th>
                            <th class="b-right">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

                const nwPorts = portNetworkStats[placa] || {};
                const enPorts = portEnergyStats[placa] || {};
                
                const allPortas = new Set([...Object.keys(nwPorts), ...Object.keys(enPorts)]);
                const sortedPortas = Array.from(allPortas).sort((a, b) => parseInt(a) - parseInt(b));

                sortedPortas.forEach(porta => {
                    const nw = nwPorts[porta] || { off: 0, total: 0 };
                    const en = enPorts[porta] || { powerOff: 0 };

                    let circuitoNome = "-";
                    if (window.DATA_STORE && window.DATA_STORE.circuitos) {
                        circuitoNome = DataMapper.getCircuitInfo(window.DATA_STORE.circuitos, {id: oltId, type: oltConf.type}, placa, porta);
                    }

                    const totalStr = nw.total > 0 ? nw.total : 0;
                    const offStr = nw.off;
                    let percOff = nw.total > 0 ? (nw.off / nw.total) * 100 : 0;
                    
                    let statusOffText = 'Normal';
                    let statusOffClass = 'pill-normal';
                    let isCriticalRow = false;

                    if (nw.total >= 5) {
                        if (percOff === 100) {
                            statusOffText = 'Crítico';
                            statusOffClass = 'pill-critical';
                            isCriticalRow = true;
                        } else if (percOff >= 50 || nw.off >= 32) {
                            statusOffText = 'Problema';
                            statusOffClass = 'pill-danger';
                        } else if (nw.off >= 16) {
                            statusOffText = 'Atenção';
                            statusOffClass = 'pill-warning';
                        }
                    } else if (nw.total > 0 && nw.off > 0) {
                         statusOffText = 'Atenção';
                         statusOffClass = 'pill-warning';
                    } else if (nw.total === 0) {
                         statusOffText = '-';
                         statusOffClass = 'pill-empty';
                    }

                    const pwrStr = en.powerOff;
                    let percPwr = nw.total > 0 ? (en.powerOff / nw.total) * 100 : 0;
                    if (percPwr > 100) percPwr = 100; 

                    let statusPwrText = 'OK';
                    let statusPwrClass = 'pill-normal';
                    
                    if (en.powerOff > 0) {
                        if (percPwr >= 80) {
                            statusPwrText = 'Crítico ' + percPwr.toFixed(0) + '%';
                            statusPwrClass = 'pill-critical';
                        } else if (percPwr >= 40) {
                            statusPwrText = 'Impacto ' + percPwr.toFixed(0) + '%';
                            statusPwrClass = 'pill-danger';
                        } else {
                            statusPwrText = 'Atenção ' + percPwr.toFixed(0) + '%';
                            statusPwrClass = 'pill-warning';
                        }
                    } else if (nw.total === 0) {
                        statusPwrText = '-';
                        statusPwrClass = 'pill-empty';
                    }

                    const rowClass = isCriticalRow ? 'row-critical' : '';

                    html += `
                        <tr class="${rowClass}">
                            <!-- Bloco 1: Base -->
                            <td class="b-left" style="font-weight: 700; font-size: 12px;">${String(porta).padStart(2, '0')}</td>
                            <td class="circuito-text" style="text-align: left;">${circuitoNome}</td>
                            <td class="b-right" style="font-weight: 600;">${totalStr}</td>
                            
                            <td class="spacer"></td>
                            
                            <!-- Bloco 2: Rede -->
                            <td class="b-left" style="color: ${nw.off > 0 ? '#d32f2f' : '#374151'}; font-weight: ${nw.off > 0 ? '700' : '600'}; font-size: 13px;">${offStr}</td>
                            <td class="b-right"><span class="pill ${statusOffClass}">${statusOffText}</span></td>
                            
                            <td class="spacer"></td>
                            
                            <!-- Bloco 3: Energia -->
                            <td class="b-left" style="color: ${en.powerOff > 0 ? '#e65100' : '#374151'}; font-weight: ${en.powerOff > 0 ? '700' : '600'}; font-size: 13px;">${pwrStr}</td>
                            <td class="b-right"><span class="pill ${statusPwrClass}">${statusPwrText}</span></td>
                        </tr>
                    `;
                });

                html += `
                    </tbody>
                </table>
                `;
            });
        }
    });

    if (!hasData) {
        html += `<p style="text-align:center; padding: 40px; font-size: 15px; color: #555;">Nenhum dado encontrado para as OLTs deste POP.</p>`;
    }

    html += `
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("O navegador bloqueou a abertura da janela. Permita pop-ups para gerar o relatório.");
        return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = function() {
        setTimeout(function() {
            printWindow.print();
        }, 500);
    };
};