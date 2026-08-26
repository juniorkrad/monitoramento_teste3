// ==============================================================================
// relatorio-pdf.js - Gerador de Relatório de Equipamentos e Status da Rede
// Identidade Visual (Roxo/Branco) - Impressão Nativa A4
// ==============================================================================

window.RELATORIO_SELECTIONS = [];

const PDF_EQP_MARCAS = [
    { nome: 'NOKIA', prefixos: 'ALCL' },
    { nome: 'CHINA MOBILE', prefixos: 'NBEL' },
    { nome: 'FURUKAWA', prefixos: 'FRKW, FIOG' },
    { nome: 'ASKEY', prefixos: 'ASKY, INVP, TLCM' },
    { nome: 'EURONET', prefixos: 'CIOT, YHTC' },
    { nome: 'HUAWEI', prefixos: 'HWTC' },
    { nome: 'MITRASTAR', prefixos: 'MSTC' },
    { nome: 'MAXPRINT / V-SOL', prefixos: 'GPON, VSOL, DE30' },
    { nome: 'PARKS', prefixos: 'PRKS' },
    { nome: 'TENDA', prefixos: 'TDTC' },
    { nome: 'SHORELINE', prefixos: 'SHLN' },
    { nome: 'ZTE', prefixos: 'ZTEG' }
];

const pdfPrefixToMarca = {};
PDF_EQP_MARCAS.forEach(marca => {
    marca.prefixos.split(',').forEach(p => {
        pdfPrefixToMarca[p.trim().toUpperCase()] = marca.nome;
    });
});

function getPdfLogoHtml(marcaNome) {
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    if (marcaNome === 'MAXPRINT / V-SOL') {
        return `<img src="${baseUrl}imagens/logos/v-sol.png" style="max-height: 20px; max-width: 90px; object-fit: contain; display: block;" onerror="this.outerHTML='<span style=\\'font-size:11px; font-weight:bold; color:#ffffff;\\'>V-SOL/MAXPRINT</span>'">`;
    } else {
        let logoFile = marcaNome.toLowerCase().replace(/\s+/g, '-') + '.png';
        if (marcaNome === 'CHINA MOBILE') logoFile = 'china-mobile.png';
        if (marcaNome === 'DESCONHECIDOS') logoFile = 'desconhecidos.png';
        return `<img src="${baseUrl}imagens/logos/${logoFile}" style="max-height: 20px; max-width: 90px; object-fit: contain; display: block;" onerror="this.outerHTML='<span style=\\'font-size:11px; font-weight:bold; color:#ffffff;\\'>${marcaNome}</span>'">`;
    }
}

function getPdfPillHtml(marcaNome, count) {
    return `
        <div class="avoid-break" style="display: inline-block; width: 31%; background-color: #2f0e51; border-radius: 8px; padding: 10px; margin-right: 1.5%; margin-bottom: 12px; box-sizing: border-box; vertical-align: top;">
            <table style="width: 100%; border: none; padding: 0; margin: 0; background-color: transparent;">
                <tr>
                    <td style="text-align: left; vertical-align: middle; border: none; padding: 0;">
                        ${getPdfLogoHtml(marcaNome)}
                    </td>
                    <td style="text-align: right; vertical-align: middle; border: none; padding: 0; font-family: 'Roboto Mono', monospace; font-weight: bold; font-size: 16px; color: #ffffff;">
                        ${count}
                    </td>
                </tr>
            </table>
        </div>
    `;
}

window.openRelatorioModal = function() {
    if (typeof injectRelatorioModal === 'function') injectRelatorioModal();
    window.RELATORIO_SELECTIONS = [];
    window.renderRelatorioSelections();
    
    const oltSelect = document.getElementById('relatorio-select-olt');
    oltSelect.innerHTML = '<option value="">1. Selecione a OLT</option>';
    
    if (typeof GLOBAL_MASTER_OLT_LIST !== 'undefined') {
        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            oltSelect.innerHTML += `<option value="${olt.id}">${olt.id}</option>`;
        });
    }

    document.getElementById('relatorio-pdf-modal').classList.add('active');
    
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
};

window.closeRelatorioModal = function(event) {
    if (event && event.target.id !== 'relatorio-pdf-modal' && event.type === 'click') return;
    const modal = document.getElementById('relatorio-pdf-modal');
    if (modal) modal.classList.remove('active');
};

window.updateRelatorioPlacas = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaSelect = document.getElementById('relatorio-select-placa');
    const portaSelect = document.getElementById('relatorio-select-porta');
    
    placaSelect.innerHTML = '<option value="">2. Placa</option>';
    portaSelect.innerHTML = '<option value="">3. Porta</option>';
    portaSelect.disabled = true;

    if (!oltId || !window.DATA_STORE || !window.DATA_STORE.olts[oltId]) {
        placaSelect.disabled = true;
        return;
    }

    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    if (oltConfig) {
        for (let i = 1; i <= oltConfig.boards; i++) {
            placaSelect.innerHTML += `<option value="${i}">Placa ${i}</option>`;
        }
        placaSelect.disabled = false;
    }
};

window.updateRelatorioPortas = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaId = document.getElementById('relatorio-select-placa').value;
    const portaSelect = document.getElementById('relatorio-select-porta');
    
    portaSelect.innerHTML = '<option value="">3. Porta</option>';

    if (!placaId || !window.DATA_STORE || !window.DATA_STORE.olts[oltId]) {
        portaSelect.disabled = true;
        return;
    }

    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    const rows = window.DATA_STORE.olts[oltId].slice(1);
    const portasEncontradas = new Set();

    rows.forEach(col => {
        if (col.length === 0) return;
        const portInfo = DataMapper.extractPort(col[0], oltConfig.type);
        if (portInfo && String(portInfo.placa) === String(placaId)) {
            portasEncontradas.add(parseInt(portInfo.porta));
        }
    });

    const portasArray = Array.from(portasEncontradas).sort((a, b) => a - b);
    portasArray.forEach(p => {
        portaSelect.innerHTML += `<option value="${p}">Porta ${String(p).padStart(2, '0')}</option>`;
    });

    portaSelect.disabled = false;
};

window.addRelatorioSelection = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaId = document.getElementById('relatorio-select-placa').value;
    const portaId = document.getElementById('relatorio-select-porta').value;

    if (!oltId || !placaId || !portaId) {
        alert('Por favor, selecione OLT, Placa e Porta.');
        return;
    }

    let circuitoNome = "N/A";
    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    if (oltConfig && window.DATA_STORE && window.DATA_STORE.circuitos) {
        const pseudoConfig = { id: oltId, type: oltConfig.type };
        circuitoNome = DataMapper.getCircuitInfo(window.DATA_STORE.circuitos, pseudoConfig, placaId, portaId);
    }

    const existe = window.RELATORIO_SELECTIONS.find(s => s.olt === oltId && s.placa === placaId && s.porta === portaId);
    if (existe) {
        alert('Esta porta já foi adicionada ao relatório.');
        return;
    }

    window.RELATORIO_SELECTIONS.push({
        olt: oltId,
        placa: placaId,
        porta: portaId,
        circuito: circuitoNome,
        type: oltConfig.type
    });

    window.renderRelatorioSelections();
    
    document.getElementById('relatorio-select-olt').value = '';
    document.getElementById('relatorio-select-placa').innerHTML = '<option value="">2. Placa</option>';
    document.getElementById('relatorio-select-placa').disabled = true;
    document.getElementById('relatorio-select-porta').innerHTML = '<option value="">3. Porta</option>';
    document.getElementById('relatorio-select-porta').disabled = true;
};

window.renderRelatorioSelections = function() {
    const area = document.getElementById('relatorio-selections-area');
    const actionButtons = document.getElementById('relatorio-action-buttons');
    area.innerHTML = '';

    if (window.RELATORIO_SELECTIONS.length === 0) {
        area.innerHTML = `<div style="text-align:center; color: var(--m3-on-surface-variant); padding: 10px; font-size: 0.9rem;">Nenhuma porta adicionada ainda.</div>`;
        if (actionButtons) actionButtons.style.display = 'none';
        return;
    }

    window.RELATORIO_SELECTIONS.forEach((sel, index) => {
        area.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--m3-outline); padding: 10px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: var(--m3-on-surface); font-size: 1rem;">${sel.olt} - Placa ${sel.placa} / Porta ${sel.porta}</strong>
                    <span style="color: var(--m3-on-surface-variant); font-size: 0.8rem; font-family: var(--font-family-mono);">Circuito: ${sel.circuito}</span>
                </div>
                <button onclick="window.removeRelatorioSelection(${index})" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 5px;">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        `;
    });

    if (actionButtons) actionButtons.style.display = 'flex';
};

window.removeRelatorioSelection = function(index) {
    window.RELATORIO_SELECTIONS.splice(index, 1);
    window.renderRelatorioSelections();
};

window.gerarImpressaoFinal = function() {
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    let globalMarcaContagem = {};
    let globalTotalEquipamentos = 0;

    const headerHtml = `
        <div style="display: block; width: 100%; text-align: center; border-bottom: 3px solid #67079f; padding-bottom: 15px; margin-bottom: 25px;">
            <img src="${baseUrl}imagens/banner_cor.png" style="max-width: 80%; max-height: 120px; object-fit: contain; margin-top: 5px;" onerror="this.style.display='none'">
            <h1 style="color: #67079f; margin: 10px 0 5px 0; font-size: 24px; text-transform: uppercase;">Relatório de Equipamentos em Campo</h1>
            <p style="color: #49454f; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 12px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
    `;

    let contentHtml = '';

    const agrupadoPorOlt = {};
    window.RELATORIO_SELECTIONS.forEach(sel => {
        if (!agrupadoPorOlt[sel.olt]) agrupadoPorOlt[sel.olt] = [];
        agrupadoPorOlt[sel.olt].push(sel);
    });

    for (const oltId of Object.keys(agrupadoPorOlt)) {
        const itens = agrupadoPorOlt[oltId];
        const rowsData = window.DATA_STORE.olts[oltId].slice(1);
        
        contentHtml += `
            <div class="avoid-break" style="display: block; background-color: #f3edf7; padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 6px solid #67079f;">
                <h2 style="margin: 0; color: #67079f; font-size: 20px;">
                    OLT: ${oltId}
                </h2>
            </div>
        `;

        for (const item of itens) {
            const marcaContagem = {};
            let totalEquipamentos = 0;

            rowsData.forEach(col => {
                if (col.length === 0) return;
                
                const portInfo = DataMapper.extractPort(col[0], item.type);
                if (!portInfo || String(portInfo.placa) !== String(item.placa) || String(portInfo.porta) !== String(item.porta)) return;

                let serial = '';
                if (item.type === 'nokia') {
                    serial = (col[2] || '').trim().toUpperCase();
                } else {
                    serial = (col[3] || '').trim().toUpperCase();
                }

                if (!serial || serial === '-' || serial === '') return;

                let prefix = serial.substring(0, 4);
                let marca = pdfPrefixToMarca[prefix] || 'DESCONHECIDOS';

                if (!marcaContagem[marca]) marcaContagem[marca] = 0;
                marcaContagem[marca]++;
                totalEquipamentos++;

                if (!globalMarcaContagem[marca]) globalMarcaContagem[marca] = 0;
                globalMarcaContagem[marca]++;
                globalTotalEquipamentos++;
            });

            contentHtml += `
                <div class="avoid-break" style="display: block; margin-bottom: 25px; padding-left: 10px; border-bottom: 1px dashed #cac4d0; padding-bottom: 15px;">
                    <h3 style="margin: 0 0 5px 0; color: #1c1b1f; font-size: 16px;">
                        Placa ${item.placa} / Porta ${String(item.porta).padStart(2, '0')}
                    </h3>
                    <p style="margin: 0 0 15px 0; color: #49454f; font-family: 'Roboto Mono', monospace; font-size: 14px; font-weight: bold;">
                        Circuito: ${item.circuito}
                    </p>
            `;

            if (totalEquipamentos === 0) {
                contentHtml += `<p style="color: #f56c6c; font-size: 13px; font-weight: bold;">Nenhum equipamento válido identificado nesta porta.</p>`;
            } else {
                contentHtml += `<div style="display: block; width: 100%; text-align: left;">`;
                
                Object.keys(marcaContagem).sort((a,b) => marcaContagem[b] - marcaContagem[a]).forEach(marcaNome => {
                    contentHtml += getPdfPillHtml(marcaNome, marcaContagem[marcaNome]);
                });
                
                contentHtml += `</div>`;
                contentHtml += `<p style="margin: 10px 0 0 0; text-align: right; font-size: 12px; color: #49454f;">Total na porta: <strong style="font-size: 14px;">${totalEquipamentos}</strong></p>`;
            }
            
            contentHtml += `</div>`;
        }
    }

    let summaryHtml = '';
    if (window.RELATORIO_SELECTIONS.length >= 2 && globalTotalEquipamentos > 0) {
        summaryHtml += `
            <div class="avoid-break" style="display: block; margin-top: 20px; padding-top: 15px; border-top: 2px solid #67079f;">
                <h2 style="margin: 0 0 15px 0; color: #67079f; font-size: 20px; text-transform: uppercase;">
                    Resumo Geral (Todas as Portas)
                </h2>
                <div style="display: block; width: 100%; text-align: left;">
        `;
        
        Object.keys(globalMarcaContagem).sort((a,b) => globalMarcaContagem[b] - globalMarcaContagem[a]).forEach(marcaNome => {
            summaryHtml += getPdfPillHtml(marcaNome, globalMarcaContagem[marcaNome]);
        });
        
        summaryHtml += `
                </div>
                <p style="margin: 15px 0 0 0; text-align: right; font-size: 14px; color: #1c1b1f;">
                    Total Geral Selecionado: <strong style="font-size: 18px; color: #67079f;">${globalTotalEquipamentos}</strong>
                </p>
            </div>
        `;
    }

    const footnoteHtml = `
        <div class="avoid-break" style="display: block; margin-top: 40px; padding-top: 15px; border-top: 1px solid #eaeaea; width: 100%;">
            <p style="margin: 0; font-size: 11px; color: #777; font-style: italic;">* Nota: Os equipamentos Maxprint e V-SOL utilizam o mesmo padrão de prefixo serial. A contagem correspondente abrange ambos os fabricantes.</p>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("O navegador bloqueou a abertura da janela. Permita pop-ups para gerar o relatório.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>Relatorio_Equipamentos</title>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                @page { 
                    size: A4 portrait; 
                    margin: 10mm; 
                }
                body { 
                    font-family: 'Montserrat', sans-serif; 
                    background-color: #ffffff;
                    color: #1c1b1f;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .report-container {
                    border: 3px solid #67079f;
                    border-radius: 12px;
                    padding: 25px 35px;
                    box-sizing: border-box;
                    min-height: 95vh;
                }
                .avoid-break {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                ${headerHtml}
                ${contentHtml}
                ${summaryHtml}
                ${footnoteHtml}
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    window.closeRelatorioModal();
};

window.gerarImpressaoStatusFinal = function() {
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    const headerHtml = `
        <div style="display: block; width: 100%; text-align: center; border-bottom: 3px solid #67079f; padding-bottom: 15px; margin-bottom: 25px;">
            <img src="${baseUrl}imagens/banner_cor.png" style="max-width: 80%; max-height: 120px; object-fit: contain; margin-top: 5px;" onerror="this.style.display='none'">
            <h1 style="color: #67079f; margin: 10px 0 5px 0; font-size: 24px; text-transform: uppercase;">Relatório de Status da Rede</h1>
            <p style="color: #49454f; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 12px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
    `;

    let contentHtml = '';

    const agrupadoPorOlt = {};
    window.RELATORIO_SELECTIONS.forEach(sel => {
        if (!agrupadoPorOlt[sel.olt]) agrupadoPorOlt[sel.olt] = [];
        agrupadoPorOlt[sel.olt].push(sel);
    });

    let tableRowsHtml = '';

    for (const oltId of Object.keys(agrupadoPorOlt)) {
        const itens = agrupadoPorOlt[oltId];
        const rowsData = window.DATA_STORE.olts[oltId].slice(1);
        const localidadesData = window.DATA_STORE.localidades || [];

        for (const item of itens) {
            let online = 0;
            let offline = 0;

            rowsData.forEach(col => {
                if (col.length === 0) return;
                
                const portInfo = DataMapper.extractPort(col[0], item.type);
                if (!portInfo || String(portInfo.placa) !== String(item.placa) || String(portInfo.porta) !== String(item.porta)) return;

                const isOnline = DataMapper.isOnline(col[item.type === 'nokia' ? 4 : 2], item.type);
                if (isOnline) online++; else offline++;
            });

            const total = online + offline;
            let energyOff = 0;

            if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.olts[oltId] && window.ENERGY_DATA_STORE.olts[oltId].ports[item.placa] && window.ENERGY_DATA_STORE.olts[oltId].ports[item.placa][item.porta]) {
                energyOff = window.ENERGY_DATA_STORE.olts[oltId].ports[item.placa][item.porta].powerOff || 0;
            }

            let bairro = DataMapper.getBairroInfo(localidadesData, oltId, item.placa, item.porta, item.type) || 'N/A';

            const percOffline = total > 0 ? (offline / total) : 0;
            let statusText = 'Normal';
            let pillClass = 'pill-normal';

            if (total >= 5) {
                if (percOffline === 1) {
                    statusText = 'Crítico';
                    pillClass = 'pill-critical';
                } else if (percOffline >= 0.5 || offline >= 32) {
                    statusText = 'Problema';
                    pillClass = 'pill-danger';
                } else if (offline >= 16) {
                    statusText = 'Atenção';
                    pillClass = 'pill-warning';
                }
            } else if (total === 0) {
                statusText = 'Sem Clientes';
                pillClass = 'pill-empty';
            }

            if (energyOff > 0 && percOffline < 1) {
                if (energyOff >= total * 0.5 || energyOff >= 10) {
                    statusText = 'Falha Elétrica';
                    pillClass = 'pill-danger';
                } else if (energyOff >= 5) {
                    if (statusText === 'Normal') {
                        statusText = 'Atenção';
                        pillClass = 'pill-warning';
                    }
                }
            }

            tableRowsHtml += `
                <tr>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: left; font-weight: bold; color: #67079f;">${oltId}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; font-family: 'Roboto Mono', monospace; font-weight: bold; color: #1c1b1f;">${item.placa}/${String(item.porta).padStart(2, '0')}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: left; font-family: 'Roboto Mono', monospace; font-weight: bold; color: #374151;">${item.circuito}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: left; color: #49454f; font-size: 11px;">${bairro}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; font-weight: bold; color: #1c1b1f;">${total}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; font-weight: bold; color: #2e7d32; background-color: rgba(74, 222, 128, 0.1);">${online}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; font-weight: bold; color: #d32f2f; background-color: rgba(248, 113, 113, 0.1);">${offline}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center; font-weight: bold; color: #e65100; background-color: rgba(251, 191, 36, 0.1);">${energyOff}</td>
                    <td style="border: 1px solid #e0e0e0; padding: 10px; text-align: center;">
                        <span class="pill ${pillClass}">${statusText}</span>
                    </td>
                </tr>
            `;
        }
    }

    contentHtml = `
        <div class="avoid-break" style="display: block; margin-bottom: 25px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: left;">OLT</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: center;">PLACA/PORTA</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: left;">CIRCUITO</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: left;">BAIRRO</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: center;">TOTAL</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #2e7d32; text-align: center;">ONLINE</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #d32f2f; text-align: center;">OFFLINE</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #d97706; text-align: center;">ENERGIA</th>
                        <th style="background-color: #e9ecef; border: 1px solid #d1d5db; padding: 10px; color: #374151; text-align: center;">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("O navegador bloqueou a abertura da janela. Permita pop-ups para gerar o relatório.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>Relatorio_Status_Rede</title>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body { font-family: 'Montserrat', sans-serif; background-color: #ffffff; color: #1c1b1f; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .report-container { border: 3px solid #67079f; border-radius: 12px; padding: 25px 35px; box-sizing: border-box; min-height: 95vh; }
                .avoid-break { page-break-inside: avoid; break-inside: avoid; }
                .pill { display: inline-block; padding: 5px 12px; border-radius: 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                .pill-normal { background: rgba(74, 222, 128, 0.15); color: #2e7d32; border: 1px solid rgba(74, 222, 128, 0.4); }
                .pill-warning { background: rgba(251, 191, 36, 0.15); color: #d97706; border: 1px solid rgba(251, 191, 36, 0.4); }
                .pill-danger { background: rgba(248, 113, 113, 0.15); color: #d32f2f; border: 1px solid rgba(248, 113, 113, 0.4); }
                .pill-critical { background: #000000; color: #ff3333; border: 1px solid #ff3333; }
                .pill-empty { background: #f3f4f6; color: #9ca3af; border: 1px solid #d1d5db; }
            </style>
        </head>
        <body>
            <div class="report-container">
                ${headerHtml}
                ${contentHtml}
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    window.closeRelatorioModal();
};