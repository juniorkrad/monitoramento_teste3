/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Injeção de Detalhes (Circuito) no Alarme Múltiplo de Energia
   ========================================================================== */

let lastNotifiedState = ""; 

function watchHomeAlarms() {
    let networkProblems = new Set(window.NETWORK_PROBLEMS_STORE || []);
    let backboneProblems = new Set(window.NETWORK_BACKBONE_STORE || []);
    let hybridProblems = new Set(); 

    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        
        const hibridosPorOlt = {};
        const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];

        for (const oltId in window.ENERGY_DATA_STORE.olts) {
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            
            for (const placa in oltData.ports) {
                for (const porta in oltData.ports[placa]) {
                    const pData = oltData.ports[placa][porta];
                    const pt = `${placa}/${porta}`;

                    if (pData.offline >= 32 && pData.powerOff > 0) {
                        const overlap = pData.powerOff / pData.offline;
                        if (overlap >= 0.70) {
                            if (!hibridosPorOlt[oltId]) {
                                hibridosPorOlt[oltId] = [];
                            }
                            
                            hibridosPorOlt[oltId].push({
                                pt: pt,
                                placa: placa,
                                porta: porta,
                                offline: pData.offline,
                                powerOff: pData.powerOff
                            });
                        }
                    }
                }
            }
        }

        for (const oltId in hibridosPorOlt) {
            const portasAfetadas = hibridosPorOlt[oltId];
            
            let oltType = 'huawei'; 
            if (typeof GLOBAL_MASTER_OLT_LIST !== 'undefined') {
                const configOlt = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
                if (configOlt) oltType = configOlt.type;
            }
            const pseudoConfig = { id: oltId, oltName: oltId, type: oltType };
            
            if (portasAfetadas.length === 1) {
                const p = portasAfetadas[0];
                const circuitoNome = (typeof DataMapper !== 'undefined') ? DataMapper.getCircuitInfo(rowsCircuitos, pseudoConfig, p.placa, p.porta) : '-';

                hybridProblems.add(`[${oltId}] HIBRIDO::${p.pt}::${p.offline}::${p.powerOff}::${circuitoNome}`);
            } else if (portasAfetadas.length >= 2) {
                let totalOffline = 0;
                let totalPowerOff = 0;
                const listaPortas = [];
                const listaDetalhes = [];
                
                portasAfetadas.forEach(p => {
                    totalOffline += p.offline;
                    totalPowerOff += p.powerOff;
                    listaPortas.push(p.pt);
                    
                    const circ = (typeof DataMapper !== 'undefined') ? DataMapper.getCircuitInfo(rowsCircuitos, pseudoConfig, p.placa, p.porta) : '-';
                    let nomeCirc = circ;
                    if (nomeCirc && nomeCirc !== '-' && !nomeCirc.toLowerCase().startsWith('circ') && !nomeCirc.toLowerCase().startsWith('link')) {
                        nomeCirc = `Circ. ${nomeCirc}`;
                    } else if (!nomeCirc || nomeCirc === '-') {
                        nomeCirc = 'Circ. N/A';
                    }
                    
                    listaDetalhes.push(`<strong>${oltId}</strong>: ${p.pt} - ${nomeCirc}`);
                });
                
                const portasStr = listaPortas.join(',');
                const detalhesStr = listaDetalhes.join('<br>');
                
                hybridProblems.add(`[${oltId}] HIBRIDO_MULTIPLO::${portasStr}::${totalOffline}::${totalPowerOff}::${detalhesStr}`);
            }
        }
    }

    window.NETWORK_HYBRID_STORE = hybridProblems;

    const currentStateStr = 
        Array.from(networkProblems).sort().join('|') + "||" + 
        Array.from(backboneProblems).sort().join('|') + "||" + 
        Array.from(hybridProblems).sort().join('|');

    if (currentStateStr !== lastNotifiedState) {
        lastNotifiedState = currentStateStr;
        
        if (typeof checkAndNotifyForNewProblems === 'function') {
            checkAndNotifyForNewProblems(networkProblems, backboneProblems, new Set(), hybridProblems);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkIsHomePage === 'function' && checkIsHomePage()) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        if (typeof updateGlobalTimestamp === 'function') setTimeout(updateGlobalTimestamp, 500);
        
        watchHomeAlarms();
        setInterval(watchHomeAlarms, 2000); 
    }
});