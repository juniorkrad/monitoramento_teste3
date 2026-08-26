// ==============================================================================
// notifications.js - Sistema Central de Alertas (Com Hierarquia de Backbone e POPs)
// ==============================================================================

// Memórias de Estado
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentHybridProblems = new Set(); 
let currentPopBackbones = new Set();
let currentPopHybrids = new Set();

// Helper para formatar o nome do circuito corretamente
function formatarNomeCircuito(nome) {
    if (!nome || nome === '-') return 'Circ. N/A';
    const lower = nome.toLowerCase();
    if (lower.startsWith('circ') || lower.startsWith('link')) return nome;
    return `Circ. ${nome}`;
}

function showToast(title, description, typeClass, icon, position = 'right') {
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    if (pageName && pageName !== 'index.html' && pageName !== '') {
        return; 
    }

    let containerId = position === 'left' ? 'toast-container-left' : 'toast-container-right';
    let container = document.getElementById(containerId);
    
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const slideClass = position === 'left' ? 'slide-left' : 'slide-right';
    toast.className = `toast ${typeClass} ${slideClass}`;
    
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon">${icon}</span>
        <div class="toast-content">
            <strong>${title}</strong>
            <span>${description}</span>
        </div>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    };

    container.prepend(toast); 

    setTimeout(() => toast.classList.add('show'), 50);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 400);
        }
    }, 10000); 
}

function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set(), newEnergyProblems = new Set(), newHybridProblems = new Set()) {
    
    // ============================================================
    // 0. AGRUPAMENTO POR POP (Pré-processamento: Backbone e Circuitos)
    // ============================================================
    const popBbMap = {};
    const individualBbs = [];
    const suppressedCircuits = new Set();
    
    // Ler Backbones Ativos 
    for (const bb of activeBackbones) {
        const match = bb.match(/^\[(.*?)\] BACKBONE::(\d+)(?:::([^|]+(?:\|\|[^|]+)*))?$/);
        if (match) {
            const oltId = match[1];
            const offCount = match[2];
            const detailsRaw = match[3];
            const pop = typeof POP_MAP !== 'undefined' ? POP_MAP[oltId] : null;
            
            let formattedDetails = [];
            if (detailsRaw) {
                const parts = detailsRaw.split('||');
                formattedDetails = parts.map(p => {
                    const splitP = p.split('::');
                    const porta = splitP[0];
                    const circ = splitP[1] || '-';
                    return `<strong>${oltId}</strong>: ${porta} - ${formatarNomeCircuito(circ)}`;
                });
            } else {
                formattedDetails.push(`<strong>${oltId}</strong>: Múltiplas portas DOWN`);
            }

            if (pop) {
                if (!popBbMap[pop]) popBbMap[pop] = { portsDown: 0, details: [] };
                popBbMap[pop].portsDown += formattedDetails.length > 0 ? formattedDetails.length : 2; 
                popBbMap[pop].details.push(...formattedDetails);
            } else {
                individualBbs.push({ raw: bb, oltId, details: formattedDetails, offCount });
            }
        } else {
            individualBbs.push({ raw: bb });
        }
    }

    // Ler Circuitos Individuais (1 porta down 100%) para ver se formam um Backbone de POP
    for (const prob of newProblems) {
        const matchCircuito = prob.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)::(\d+)$/);
        if (matchCircuito) {
            const oltId = matchCircuito[1];
            const circuitoNome = matchCircuito[2];
            const porta = matchCircuito[3];
            const pop = typeof POP_MAP !== 'undefined' ? POP_MAP[oltId] : null;

            if (pop) {
                if (!popBbMap[pop]) popBbMap[pop] = { portsDown: 0, details: [] };
                popBbMap[pop].portsDown += 1;
                const circText = formatarNomeCircuito(circuitoNome);
                popBbMap[pop].details.push(`<strong>${oltId}</strong>: ${porta} - ${circText}`);
            }
        }
    }

    const newPopBackbones = new Set();
    const activeIndividualBbs = new Set();

    for (const pop in popBbMap) {
        // Se a soma de portas caídas no POP for >= 2, vira POP_BACKBONE
        if (popBbMap[pop].portsDown >= 2) {
            newPopBackbones.add(`POP_BACKBONE::${pop}`);
            // Silenciar os alarmes de circuito individuais destas OLTs
            for (const prob of newProblems) {
                const matchCircuito = prob.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)::(\d+)$/);
                if (matchCircuito) {
                    const oltId = matchCircuito[1];
                    if (POP_MAP[oltId] === pop) suppressedCircuits.add(prob);
                }
            }
        }
    }

    for (const item of individualBbs) {
        activeIndividualBbs.add(item.raw);
    }

    // ============================================================
    // 0.1 AGRUPAMENTO POR POP (Pré-processamento: Energia Híbrida)
    // ============================================================
    const popEnergyMap = {};
    const individualHybrids = [];
    const suppressedHybrids = new Set();
    
    for (const hb of newHybridProblems) {
        const matchMulti = hb.match(/^\[(.*?)\] HIBRIDO_MULTIPLO::(.*?)::(\d+)::(\d+)(?:::([^|]+))?$/);
        const matchSingle = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)::(.*)$/);
        
        let oltId, pop, portsCount, textDetails, portasRaw;
        
        if (matchMulti) {
            oltId = matchMulti[1];
            portasRaw = matchMulti[2];
            portsCount = portasRaw.split(',').length;
            textDetails = matchMulti[5] || portasRaw;
        } else if (matchSingle) {
            oltId = matchSingle[1];
            portasRaw = matchSingle[2];
            portsCount = 1;
            const circName = formatarNomeCircuito(matchSingle[5]);
            textDetails = `${portasRaw} - ${circName}`;
        }

        if (oltId) {
            pop = typeof POP_MAP !== 'undefined' ? POP_MAP[oltId] : null;
            if (pop) {
                if (!popEnergyMap[pop]) popEnergyMap[pop] = { portsDown: 0, details: [], rawItems: [] };
                popEnergyMap[pop].portsDown += portsCount;
                if (!textDetails.includes('<strong>')) {
                    popEnergyMap[pop].details.push(`<strong>${oltId}</strong>: ${textDetails}`);
                } else {
                    popEnergyMap[pop].details.push(textDetails);
                }
                popEnergyMap[pop].rawItems.push({ raw: hb, portasRaw, oltId });
            } else {
                individualHybrids.push(hb);
            }
        }
    }

    const newPopHybrids = new Set();
    const activeIndividualHybrids = new Set(individualHybrids);

    for (const pop in popEnergyMap) {
        if (popEnergyMap[pop].portsDown >= 2) {
            newPopHybrids.add(`POP_ENERGIA::${pop}`);
            popEnergyMap[pop].rawItems.forEach(item => suppressedHybrids.add(item.raw));
        } else if (popEnergyMap[pop].portsDown === 1) {
            activeIndividualHybrids.add(popEnergyMap[pop].rawItems[0].raw);
        }
    }

    // ============================================================
    // 1. DETECTAR NORMALIZAÇÕES
    // ============================================================

    // Normalizações de Backbones de POP
    for (const oldPopBb of currentPopBackbones) {
        if (!newPopBackbones.has(oldPopBb)) {
            const popName = oldPopBb.split('::')[1];
            showToast('Backbone Normalizado', `${popName} operando normalmente`, 'status-normal', 'check_circle', 'right');
        }
    }

    // Normalizações de Backbones Individuais
    for (const oldBb of currentBackbones) {
        if (!activeIndividualBbs.has(oldBb)) {
            const matchBb = oldBb.match(/^\[(.*?)\] BACKBONE::/);
            if (matchBb) {
                const oltId = matchBb[1];
                const stillHas = Array.from(activeIndividualBbs).some(b => b.startsWith(`[${oltId}] BACKBONE::`));
                if (!stillHas) showToast('Backbone Normalizado', `${oltId} operando normalmente`, 'status-normal', 'check_circle', 'right');
            }
        }
    }

    // Normalizações de Energia de POP
    for (const oldPopHb of currentPopHybrids) {
        if (!newPopHybrids.has(oldPopHb)) {
            const popName = oldPopHb.split('::')[1];
            showToast('Energia Normalizada', `${popName} reestabelecida`, 'status-normal', 'check_circle', 'left');
        }
    }

    // Normalizações de Rede (Apenas Circuito - Os demais estão silenciados)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            if (oldProblem.includes("STATUS::CIRCUITO::")) {
                const matchCircuito = oldProblem.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)/);
                if (matchCircuito) {
                    const oltId = matchCircuito[1];
                    const circuitoNome = matchCircuito[2];
                    const porta = matchCircuito[3];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`) && p.includes(porta));
                    if (!stillHasIssue) showToast('Circuito Normalizado', `<strong>${oltId}</strong>: ${porta} - ${formatarNomeCircuito(circuitoNome)}`, 'status-normal', 'check_circle', 'right'); 
                }
            }
        }
    }

    // ============================================================
    // 2. DISPAROS: BACKBONE
    // ============================================================
    
    // Disparo Backbone POP Unificado
    for (const pop in popBbMap) {
        if (popBbMap[pop].portsDown >= 2) {
            const sig = `POP_BACKBONE::${pop}`;
            if (!currentPopBackbones.has(sig)) {
                let desc = popBbMap[pop].details.join('<br>');
                showToast(`BACKBONE - ${pop.toUpperCase()}`, desc, 'backbone-l2', 'sos', 'right');
            }
        }
    }
    currentPopBackbones = newPopBackbones;

    // Disparo Backbone Individual
    for (const item of individualBbs) {
        if (item.raw && !currentBackbones.has(item.raw)) {
            if (item.oltId) {
                let desc = item.details && item.details.length > 0 
                    ? item.details.join('<br>') 
                    : `<strong>${item.oltId}</strong>: Múltiplas portas DOWN`;
                
                showToast('BACKBONE', desc, 'backbone-l2', 'sos', 'right');
            }
        }
    }
    currentBackbones = new Set(activeIndividualBbs);

    // ============================================================
    // 3. DISPAROS: HÍBRIDO E SILENCIADOR
    // ============================================================
    const activeHybridPorts = new Set(); 

    for (const pop in popEnergyMap) {
        if (popEnergyMap[pop].portsDown >= 2) {
            popEnergyMap[pop].rawItems.forEach(item => {
                const pList = item.portasRaw.split(',');
                pList.forEach(p => activeHybridPorts.add(`${item.oltId}_${p}`));
            });
        }
    }
    
    for (const hb of activeIndividualHybrids) {
        const matchMulti = hb.match(/^\[(.*?)\] HIBRIDO_MULTIPLO::(.*?)::/);
        if (matchMulti) {
            const portas = matchMulti[2].split(',');
            portas.forEach(p => activeHybridPorts.add(`${matchMulti[1]}_${p}`));
        }
        const matchSingle = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::/);
        if (matchSingle) activeHybridPorts.add(`${matchSingle[1]}_${matchSingle[2]}`);
    }

    // Disparo Energia POP Unificado
    for (const pop in popEnergyMap) {
        if (popEnergyMap[pop].portsDown >= 2) {
            const sig = `POP_ENERGIA::${pop}`;
            if (!currentPopHybrids.has(sig)) {
                let desc = popEnergyMap[pop].details.join('<br>');
                showToast(`ENERGIA - ${pop.toUpperCase()}`, desc, 'hibrido-multiplo', 'electric_bolt', 'left');
            }
        }
    }
    currentPopHybrids = newPopHybrids;

    // Disparo Energia Individual
    for (const hb of activeIndividualHybrids) {
        if (suppressedHybrids.has(hb)) continue;
        
        const matchMultiplo = hb.match(/^\[(.*?)\] HIBRIDO_MULTIPLO::(.*?)::(\d+)::(\d+)(?:::([^|]+))?$/);
        if (matchMultiplo) {
            const oltId = matchMultiplo[1];
            const textDetails = matchMultiplo[5] || matchMultiplo[2].replace(/,/g, ', ');
            
            if (!currentHybridProblems.has(hb)) {
                let desc = textDetails.includes('<strong>') ? textDetails : `<strong>${oltId}</strong>: ${textDetails}`;
                showToast('Alarme Múltiplo de Energia', desc, 'hibrido-multiplo', 'electric_bolt', 'left');
            }
            continue;
        }

        const match = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)::(.*)$/);
        if (match) {
            const oltId = match[1];
            const porta = match[2];
            const circuitoNome = match[5];
            
            if (!currentHybridProblems.has(hb)) {
                showToast('Queda de Energia', `<strong>${oltId}</strong>: ${porta} - ${formatarNomeCircuito(circuitoNome)}`, 'hibrido', 'offline_bolt', 'left');
            }
        }
    }
    currentHybridProblems = new Set(activeIndividualHybrids);

    // ============================================================
    // 4. DISPAROS: REDE PURA (Somente Circuito)
    // ============================================================
    for (const problemKey of newProblems) {
        if (suppressedCircuits.has(problemKey)) continue;

        if (!currentProblems.has(problemKey)) {

            // Alarme de Circuito (Único Ativo)
            const matchCircuito = problemKey.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)::(\d+)$/);
            if (matchCircuito) {
                const oltId = matchCircuito[1];
                const circuitoNome = matchCircuito[2];
                const porta = matchCircuito[3];

                if (activeHybridPorts.has(`${oltId}_${porta}`)) continue;

                showToast('Alarme de Circuito', `<strong>${oltId}</strong>: ${porta} - ${formatarNomeCircuito(circuitoNome)}`, 'backbone-l1', 'crisis_alert', 'right');
            }
            
            // MULTI, WARN e CRIT foram removidos e silenciados intencionalmente.
        }
    }
    currentProblems = new Set(newProblems);
}