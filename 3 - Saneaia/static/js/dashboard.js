/**
 * Dashboard JavaScript - Plataforma de Inteligência Operacional
 */

const API = '';

// === Global State ===
let globalTemporalData = [];
let globalYearFilter = 'Todos';
let evolucaoAnualChartInstance = null;

// === Navigation ===
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const section = item.dataset.section;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + section).classList.add('active');

        // Configurar título da Topbar dinamicamente para evitar duplicidade
        const pageTitleEl = document.getElementById('page-title');
        if (section === 'insights') {
            pageTitleEl.textContent = 'Central de Inteligência Operacional';
        } else if (section === 'logs-rum') {
            pageTitleEl.textContent = 'Central de Operações e Logs RUM';
        } else {
            pageTitleEl.textContent = item.querySelector('.nav-label').textContent;
        }

        // Exibir filtro de ano nas seções em que ele é utilizado (Dashboard e Analytics)
        const yearFiltersContainer = document.getElementById('year-filters-container');
        if (yearFiltersContainer) {
            yearFiltersContainer.style.display = (section === 'dashboard' || section === 'analytics') ? 'flex' : 'none';
        }

        if (section === 'analytics') loadAnalytics(globalYearFilter);
        if (section === 'ml') loadMLMetrics();
        if (section === 'heatmaps') loadHeatmapsData();
        if (section === 'logs-rum') initLogsRum();
    });
});


// Sidebar toggle (Desktop e Mobile) — botão embutido na borda da sidebar
function applySidebarToggle() {
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!btn) return;
    // Sincronizar estado da seta com o estado atual
    const arrow = btn.querySelector('.toggle-arrow');
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    if (arrow) arrow.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.toggle('open');
        } else {
            document.body.classList.toggle('sidebar-collapsed');
        }
        applySidebarToggle();
    });
}
applySidebarToggle();


// Clock
function updateClock() {
    const now = new Date();
    document.getElementById('topbar-time').textContent = now.toLocaleString('pt-BR');
}
setInterval(updateClock, 1000);
updateClock();

// === API Helpers ===
async function api(path, opts = {}) {
    try {
        const res = await fetch(API + path, {
            headers: { 'Content-Type': 'application/json' },
            ...opts
        });
        return await res.json();
    } catch (e) {
        console.error('API Error:', path, e);
        return null;
    }
}

// === Health Check ===
async function checkHealth() {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-text');
    const data = await api('/health');
    if (data && data.status === 'healthy') {
        dot.className = 'status-dot online';
        txt.textContent = 'Sistema Online';
    } else {
        dot.className = 'status-dot offline';
        txt.textContent = 'Sistema Offline';
    }
}

// === KPIs ===
async function loadKPIs(ano = 'Todos') {
    let url = '/api/analytics/kpis';
    if (ano !== 'Todos') url += `?ano=${encodeURIComponent(ano)}`;
    const res = await api(url);
    if (!res || !res.data) return;
    const d = res.data;
    animateValue('kpi-total', d.total_solicitacoes || 0);
    animateValue('kpi-resolved', d.total_resolvidas || 0);
    animateValue('kpi-open', d.total_abertas || 0);
    if (document.getElementById('kpi-time')) {
        document.getElementById('kpi-time').textContent = d.tempo_medio_resolucao_horas != null ? d.tempo_medio_resolucao_horas.toFixed(1) : '--';
    }
    animateValue('kpi-neighborhoods', d.total_bairros || 0);
    animateValue('kpi-clients', d.total_clientes || 0);
}

async function loadTopServicos(ano = 'Todos') {
    const container = document.getElementById('chart-tipos-servico');
    if (!container) return;
    let url = '/api/analytics/por-servico';
    if (ano !== 'Todos') url += `?ano=${encodeURIComponent(ano)}`;
    const res = await api(url);
    if (res && res.data) {
        renderBarChart('chart-tipos-servico', res.data, 'servico', 'total_solicitacoes', 8);
    }
}

async function loadLogradourosCriticos(ano = 'Todos') {
    let url = '/api/analytics/por-logradouro?limit=10';
    if (ano !== 'Todos') url += `&ano=${encodeURIComponent(ano)}`;
    const res = await api(url);
    const container = document.getElementById('table-ruas-criticas');
    if (!container) return;

    if (!res || !res.data || res.data.length === 0) {
        container.innerHTML = '<div class="loading-state">Sem dados de logradouros.</div>';
        return;
    }

    let html = `
        <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
            <thead>
                <tr style="background: var(--bg-hover); text-align: left;">
                    <th style="padding: 8px;">Logradouro</th>
                    <th style="padding: 8px;">Bairro</th>
                    <th style="padding: 8px; text-align: right;">Total OSs</th>
                </tr>
            </thead>
            <tbody>
    `;

    res.data.slice(0, 10).forEach(r => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px; font-weight: 600;">${r.logradouro || '--'}</td>
                <td style="padding: 8px; color: var(--text-muted);">${r.bairro || '--'}</td>
                <td style="padding: 8px; text-align: right; font-weight: 700; color: #3B82F6;">${(r.total_solicitacoes || 0).toLocaleString('pt-BR')}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function animateValue(id, end) {
    const el = document.getElementById(id);
    if (!el) return;
    const dur = 800;
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
        const p = Math.min((now - startTime) / dur, 1);
        el.textContent = Math.floor(p * end).toLocaleString('pt-BR');
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// === Bar Charts ===
function renderBarChart(containerId, data, labelKey, valueKey, maxItems = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!data || !data.length) { container.innerHTML = '<div class="loading-state">Sem dados</div>'; return; }
    const items = data.slice(0, maxItems);
    const maxVal = Math.max(...items.map(d => d[valueKey] || 0));
    let html = '<div class="bar-chart">';
    items.forEach(d => {
        const pct = maxVal > 0 ? ((d[valueKey] || 0) / maxVal * 100) : 0;
        const label = (d[labelKey] || '').substring(0, 25);
        html += `<div class="bar-item">
            <span class="bar-label" title="${d[labelKey]}">${label}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%">
                <span class="bar-value">${(d[valueKey] || 0).toLocaleString('pt-BR')}</span>
            </div></div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// === Load Dashboard Charts ===
async function loadBairros(ano = 'Todos') {
    let url = '/api/analytics/bairros-criticos?limit=10';
    if (ano !== 'Todos') url += `&ano=${ano}`;
    const res = await api(url);
    if (res) renderBarChart('chart-bairros', res.data, 'bairro', 'indice_critico');
}

// === ML / Clustering Events ===
async function loadMLEvents() {
    const res = await api('/api/ml/events?hours=48');
    if (!res) return;

    const masterContainer = document.getElementById('ml-master-events');
    const isolatedContainer = document.getElementById('ml-isolated-events');

    if (!masterContainer || !isolatedContainer) return;

    masterContainer.innerHTML = '';
    isolatedContainer.innerHTML = '';

    const masters = res.events.filter(e => e.type === 'MASTER_EVENT');
    const isolated = res.events.filter(e => e.type === 'ISOLATED_DIAGNOSTIC');

    if (masters.length === 0) {
        masterContainer.innerHTML = '<div class="loading-simple">Nenhum evento crítico detectado no momento. Rede estável.</div>';
    } else {
        masters.forEach(e => {
            masterContainer.innerHTML += `
                <div class="event-item master">
                    <div class="event-header">
                        <span class="event-type">ALERTA MESTRE</span>
                        <span class="event-badge critical">${e.severity}</span>
                    </div>
                    <div class="event-title">${e.description}</div>
                    <div class="event-cause">Causa Provável: <strong>${e.probable_cause}</strong></div>
                    <div class="event-location"><i data-lucide="map-pin" style="width:12px"></i> ${e.location} - ${e.impact}</div>
                </div>
            `;
        });
    }

    if (isolated.length === 0) {
        isolatedContainer.innerHTML = '<div class="loading-simple">Nenhuma anomalia individual detectada.</div>';
    } else {
        isolated.forEach(e => {
            isolatedContainer.innerHTML += `
                <div class="event-item isolated">
                    <div class="event-header">
                        <span class="event-type">DIAGNÓSTICO ESPECIALISTA</span>
                    </div>
                    <div class="event-title">${e.description}</div>
                    <div class="event-cause">Causa Provável: <strong>${e.probable_cause}</strong></div>
                    <div class="event-location"><i data-lucide="map-pin" style="width:12px"></i> ${e.location}</div>
                </div>
            `;
        });
    }
    lucide.createIcons();
}

// === Temporal / Sazonalidade / Evolução Anual ===
async function fetchAndProcessTemporalData() {
    const res = await api('/api/analytics/temporal');
    if (!res || !res.data) return;

    globalTemporalData = res.data;

    // Extract unique years
    const years = [...new Set(globalTemporalData.map(d => d.ano))].sort((a, b) => a - b);

    // Build Year Filter UI
    const filtersContainer = document.getElementById('year-filters-container');
    let buttonsHtml = `<span class="text-sm" style="color: var(--text-muted); margin-right: 8px; font-size: 0.85rem;">Filtro Ano:</span>`;

    // Add "Todos" button
    buttonsHtml += `<button class="year-filter-btn ${globalYearFilter === 'Todos' ? 'active' : ''}" onclick="setYearFilter('Todos')">Todos</button>`;

    // Add Year buttons
    years.forEach(y => {
        buttonsHtml += `<button class="year-filter-btn ${globalYearFilter === y.toString() ? 'active' : ''}" onclick="setYearFilter('${y}')">${y}</button>`;
    });

    filtersContainer.innerHTML = buttonsHtml;

    // Render the Multi-year Line Chart (not affected by global filter, it shows all years for contrast)
    renderEvolucaoAnualChart(years);

    // Render the specific year charts based on current filter
    updateYearlyCharts();
}

function setYearFilter(yearStr) {
    globalYearFilter = yearStr;
    // Update active class on buttons
    document.querySelectorAll('.year-filter-btn').forEach(btn => {
        if (btn.textContent === yearStr) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    // Re-render dependent charts in Dashboard
    updateYearlyCharts();
    // Re-render Analytics
    loadAnalytics(globalYearFilter);
}

function updateYearlyCharts() {
    // 1. Atualizar KPIs, Logradouros Críticos, Bairros e Imóveis Sensíveis para o Ano Selecionado
    loadKPIs(globalYearFilter);
    loadLogradourosCriticos(globalYearFilter);
    loadBairros(globalYearFilter);
    loadWeatherAnalytics(globalYearFilter);
    loadImoveisSensiveis(globalYearFilter);
    loadDistributionGap(globalYearFilter);

    // 2. Filtrar dados da Análise Temporal
    const filteredData = globalYearFilter === 'Todos'
        ? globalTemporalData
        : globalTemporalData.filter(d => d.ano.toString() === globalYearFilter);

    // Agrupar por mês, garantindo 12 meses
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthMap = {};
    for (let i = 1; i <= 12; i++) {
        monthMap[i] = { mes: monthNames[i - 1], total_solicitacoes: 0, mes_numero: i };
    }
    
    filteredData.forEach(d => {
        const m = d.mes_numero;
        if (m >= 1 && m <= 12) {
            monthMap[m].total_solicitacoes += d.total_solicitacoes;
        }
    });

    const temporalAggregated = Object.values(monthMap).sort((a, b) => a.mes_numero - b.mes_numero);
    renderBarChart('chart-temporal', temporalAggregated, 'mes', 'total_solicitacoes', 12);
}

function renderEvolucaoAnualChart(years) {
    const datasets = [];
    const colors = [
        '#64748B', '#F59E0B', '#10B981', '#8B5CF6', '#F43F5E', '#0EA5E9'
    ];

    const maxYear = Math.max(...years);
    let lastRealMonthIndex = -1;
    let lastRealValue = 0;
    
    // Encontra o último mês com dados para o ano máximo
    const maxYearData = globalTemporalData.filter(d => d.ano === maxYear);
    maxYearData.forEach(d => {
        if (d.mes_numero >= 1 && d.mes_numero <= 12) {
            const idx = d.mes_numero - 1;
            if (idx > lastRealMonthIndex) {
                lastRealMonthIndex = idx;
                lastRealValue = d.total_solicitacoes;
            }
        }
    });

    const todayDate = new Date();
    const isCurrentYearActive = (maxYear === todayDate.getFullYear());
    const isCurrentMonthActive = (isCurrentYearActive && lastRealMonthIndex === todayDate.getMonth());

    let lastCompleteMonthIndex = lastRealMonthIndex;
    let lastCompleteValue = lastRealValue;

    if (isCurrentMonthActive && lastRealMonthIndex > 0) {
        lastCompleteMonthIndex = lastRealMonthIndex - 1;
        const completeMonthData = maxYearData.find(d => d.mes_numero - 1 === lastCompleteMonthIndex);
        lastCompleteValue = completeMonthData ? completeMonthData.total_solicitacoes : 0;
    }

    years.forEach((y, i) => {
        const yearData = globalTemporalData.filter(d => d.ano === y);
        const dataArr = new Array(12).fill(null);

        yearData.forEach(d => {
            if (d.mes_numero >= 1 && d.mes_numero <= 12) {
                const idx = d.mes_numero - 1;
                dataArr[idx] = d.total_solicitacoes;
            }
        });

        // Se for o ano corrente e o mês atual estiver ativo (incompleto),
        // removemos o valor real do mês incompleto da linha sólida para evitar a queda visual
        if (y === maxYear && isCurrentMonthActive) {
            dataArr[lastRealMonthIndex] = null;
        }

        const color = colors[i % colors.length];
        datasets.push({
            label: y.toString(),
            data: dataArr,
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.4,
            borderWidth: y === maxYear ? 3 : 2,
            pointStyle: 'rectRounded',
            pointRadius: 3,
            pointHoverRadius: 6
        });
    });

    let predMonthIndex = -1;
    let predValue = 0;
    let projectedCurrentValue = lastRealValue;
    
    if (lastRealMonthIndex >= 0 && lastRealMonthIndex < 11) {
        predMonthIndex = lastRealMonthIndex + 1;
        
        // 1. Identifica anos anteriores para compor a base histórica
        const priorYears = years.filter(y => y !== maxYear);

        // 2. Calcula o volume do ano corrente nos meses completos (0 até lastCompleteMonthIndex)
        let sumCurrentCompleted = 0;
        for (let m = 0; m <= lastCompleteMonthIndex; m++) {
            const d = maxYearData.find(x => x.mes_numero - 1 === m);
            if (d) sumCurrentCompleted += d.total_solicitacoes;
        }

        // 3. Calcula o volume médio ponderado dos anos anteriores para o mesmo período
        let sumHistCompleted = 0;
        let weightSum = 0;
        priorYears.forEach(y => {
            let yWeight = 1.0;
            if (y === maxYear - 1) yWeight = 3.0; // ano imediatamente anterior (ex: 2025)
            else if (y === maxYear - 2) yWeight = 1.5; // ex: 2024
            else if (y === maxYear - 3) yWeight = 2.0; // ex: 2023

            const ySum = globalTemporalData
                .filter(x => x.ano === y && x.mes_numero - 1 <= lastCompleteMonthIndex && x.total_solicitacoes > 0)
                .reduce((acc, curr) => acc + curr.total_solicitacoes, 0);

            if (ySum > 0) {
                sumHistCompleted += ySum * yWeight;
                weightSum += yWeight;
            }
        });

        const histBaseline = weightSum > 0 ? (sumHistCompleted / weightSum) : sumCurrentCompleted;
        // Fator de escala do ano corrente vs histórico (ex: ~0.70 a 1.40)
        const levelFactor = histBaseline > 0 ? Math.max(0.65, Math.min(1.45, sumCurrentCompleted / histBaseline)) : 1.0;

        // Função auxiliar para calcular o valor sazonal esperado para cada mês m (0 a 11)
        const getSeasonalExpected = (m) => {
            let sumM = 0;
            let wM = 0;
            priorYears.forEach(y => {
                let yWeight = 1.0;
                if (y === maxYear - 1) yWeight = 3.0;
                else if (y === maxYear - 2) yWeight = 1.5;
                else if (y === maxYear - 3) yWeight = 2.0;

                const match = globalTemporalData.find(x => x.ano === y && x.mes_numero - 1 === m);
                if (match && match.total_solicitacoes > 0) {
                    if (match.total_solicitacoes >= 400 || m < 10) {
                        sumM += match.total_solicitacoes * yWeight;
                        wM += yWeight;
                    }
                }
            });
            const avgM = wM > 0 ? (sumM / wM) : (lastCompleteValue || 800);
            return avgM * levelFactor;
        };

        // 4. Projeta o mês atual ativo se estiver incompleto (Setembro)
        const seasExpectedCurrent = getSeasonalExpected(lastRealMonthIndex);
        if (isCurrentMonthActive) {
            const currentDay = todayDate.getDate();
            const totalDays = new Date(maxYear, lastRealMonthIndex + 1, 0).getDate();
            const progressRatio = Math.max(1, currentDay) / totalDays;
            const runRate = Math.round(lastRealValue / progressRatio);

            // Shrinkage bayesiano: no início do mês a sazonalidade tem maior peso; ao avançar dos dias, o ritmo real ganha peso
            const w = progressRatio / (progressRatio + 0.8);
            projectedCurrentValue = Math.round(w * runRate + (1 - w) * seasExpectedCurrent);

            // Suavização defensiva para evitar distorções
            const minAllowed = Math.round(lastCompleteValue * 0.6);
            const maxAllowed = Math.round(Math.max(lastCompleteValue * 1.8, seasExpectedCurrent * 1.5));
            projectedCurrentValue = Math.max(minAllowed, Math.min(maxAllowed, projectedCurrentValue));
        } else {
            projectedCurrentValue = lastRealValue;
        }

        // 5. Previsão para os meses futuros até Dezembro com propagação de momentum
        const currentMomentum = seasExpectedCurrent > 0 ? (projectedCurrentValue / seasExpectedCurrent) : 1.0;
        const cappedMomentum = Math.max(0.85, Math.min(1.20, currentMomentum));

        const predData = new Array(12).fill(null);
        if (isCurrentMonthActive) {
            predData[lastCompleteMonthIndex] = lastCompleteValue;
            predData[lastRealMonthIndex] = projectedCurrentValue;
        } else {
            predData[lastRealMonthIndex] = lastRealValue;
        }

        for (let m = lastRealMonthIndex + 1; m <= 11; m++) {
            const decay = Math.pow(0.7, m - lastRealMonthIndex);
            const mFactor = 1.0 + (cappedMomentum - 1.0) * decay;
            const valM = Math.round(getSeasonalExpected(m) * mFactor);
            predData[m] = valM;
        }

        predValue = predData[predMonthIndex] || 0;

        const maxYearColor = colors[years.indexOf(maxYear) % colors.length];

        datasets.push({
            label: isCurrentMonthActive ? 'Tendência/Projeção' : 'Previsão ML',
            data: predData,
            borderColor: maxYearColor,
            backgroundColor: '#06b6d4',
            borderDash: [5, 5],
            borderWidth: 2.5,
            fill: false,
            tension: 0.25,
            pointStyle: 'circle',
            pointRadius: (ctx) => {
                if (ctx.dataIndex >= lastRealMonthIndex && ctx.dataset.data[ctx.dataIndex] !== null) {
                    return 4;
                }
                return 0;
            },
            pointHoverRadius: 7,
            isPrediction: true
        });
    }

    // Create HTML overlay for pulsing animation
    let overlay = document.getElementById('prediction-pulse-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'prediction-pulse-overlay';
        overlay.style.position = 'absolute';
        overlay.style.width = '14px';
        overlay.style.height = '14px';
        overlay.style.borderRadius = '50%';
        overlay.style.backgroundColor = 'rgba(6, 182, 212, 0.4)';
        overlay.style.pointerEvents = 'none';
        overlay.style.boxShadow = '0 0 12px rgba(6, 182, 212, 0.7)';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes softPulse {
                0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.4; }
                50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.85; }
                100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.4; }
            }
            #prediction-pulse-overlay {
                animation: softPulse 2.8s ease-in-out infinite;
                z-index: 10;
            }
        `;
        document.head.appendChild(style);
        const chartParent = document.getElementById('chart-evolucao-anual').parentElement;
        chartParent.style.position = 'relative';
        chartParent.appendChild(overlay);
    }
    overlay.style.display = 'none';

    const predictionVisualsPlugin = {
        id: 'predictionVisuals',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            let hasPred = false;
            
            chart.data.datasets.forEach((dataset, i) => {
                if (dataset.isPrediction) {
                    const meta = chart.getDatasetMeta(i);
                    const focalIndex = predMonthIndex !== -1 ? predMonthIndex : lastRealMonthIndex;
                    const pt = meta.data[focalIndex];
                    if (!pt) return;

                    hasPred = true;
                    if (overlay) {
                        overlay.style.display = 'block';
                        overlay.style.left = pt.x + 'px';
                        overlay.style.top = pt.y + 'px';
                    }

                    // Ícone de tendência comparando o mês seguinte projetado com o mês base
                    const baseVal = isCurrentMonthActive ? projectedCurrentValue : lastRealValue;
                    const focalVal = dataset.data[focalIndex] || 0;
                    const diff = focalVal - baseVal;
                    ctx.save();
                    ctx.translate(pt.x + 12, pt.y - 12);
                    if (diff > 50) {
                        ctx.fillStyle = '#10B981'; // Seta Verde Subindo
                        ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(-4,1); ctx.lineTo(-1,1); ctx.lineTo(-1,5); ctx.lineTo(1,5); ctx.lineTo(1,1); ctx.lineTo(4,1); ctx.fill();
                    } else if (diff < -50) {
                        ctx.fillStyle = '#EF4444'; // Seta Vermelha Descendo
                        ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(-4,-1); ctx.lineTo(-1,-1); ctx.lineTo(-1,-5); ctx.lineTo(1,-5); ctx.lineTo(1,-1); ctx.lineTo(4,-1); ctx.fill();
                    } else {
                        ctx.fillStyle = '#F59E0B'; // Linha Amarela Estável
                        ctx.fillRect(-3, -1, 6, 2);
                    }
                    ctx.restore();
                }
            });
            
            if (!hasPred && overlay) {
                overlay.style.display = 'none';
            }
        }
    };

    const ctx = document.getElementById('chart-evolucao-anual').getContext('2d');
    if (evolucaoAnualChartInstance) evolucaoAnualChartInstance.destroy();

    evolucaoAnualChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
            datasets: datasets
        },
        plugins: [predictionVisualsPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 10,
                        padding: 16,
                        font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                        filter: (item) => item.text !== 'Previsão ML' && item.text !== 'Tendência/Projeção'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: "'Inter', sans-serif" },
                    bodyFont: { family: "'Inter', sans-serif" },
                    padding: 10,
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.isPrediction) {
                                if (isCurrentMonthActive && context.dataIndex === lastRealMonthIndex) {
                                    return `${maxYear}: ${(context.raw || 0).toLocaleString('pt-BR')} (PROJEÇÃO)*`;
                                }
                                if (context.dataIndex > lastRealMonthIndex) {
                                    return `${maxYear}: ${(context.raw || 0).toLocaleString('pt-BR')} (PREVISÃO SAZONAL)*`;
                                }
                                return null;
                            }
                            return `${context.dataset.label}: ${(context.raw || 0).toLocaleString('pt-BR')}`;
                        },
                        afterBody: function(context) {
                            const hasProj = context.some(c => c.dataset.isPrediction && isCurrentMonthActive && c.dataIndex === lastRealMonthIndex);
                            const hasPred = context.some(c => c.dataset.isPrediction && c.dataIndex > lastRealMonthIndex);
                            if (hasProj && hasPred) {
                                return `\n*Projeção e previsão baseadas no histórico sazonal e ritmo do ano.`;
                            }
                            if (hasProj) {
                                const day = todayDate.getDate();
                                return `\n*Projeção do mês atual combinando ritmo dos primeiros ${day} dias com sazonalidade histórica.`;
                            }
                            if (hasPred) {
                                return `\n*Previsão baseada no modelo de sazonalidade e histórico dos anos anteriores.`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#64748B' } },
                y: { grid: { color: '#F1F5F9' }, ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#64748B' } }
            }
        }
    });
}

// === Analytics Section ===
async function loadAnalytics(ano) {
    const curAno = (ano !== undefined && ano !== null && ano !== '') ? ano : (globalYearFilter || '2026');
    
    // Atualizar badge de período no topo do Analytics
    const badgeAno = document.getElementById('badge-analytics-ano');
    if (badgeAno) {
        badgeAno.textContent = (curAno === 'Todos') ? '(Histórico Completo)' : `(Ano: ${curAno})`;
    }

    const [opData, reinc_advanced, furtosRes] = await Promise.all([
        api(`/api/analytics/operacional-detalhado?ano=${encodeURIComponent(curAno)}`),
        api(`/api/analytics/reincidencias?limit=15&ano=${encodeURIComponent(curAno)}`),
        api(`/api/analytics/furtos-hd?ano=${encodeURIComponent(curAno)}`)
    ]);

    // 1. Renderizar 4 KPIs Analíticos Estratégicos
    if (opData && opData.pop) {
        const kpiPopEl = document.getElementById('analytics-kpi-pop');
        const kpiPopSubEl = document.getElementById('analytics-kpi-pop-sub');
        if (kpiPopEl) kpiPopEl.textContent = `${opData.pop.pct_conforme}%`;
        if (kpiPopSubEl) kpiPopSubEl.textContent = `${opData.pop.sim} Estrito · ${opData.pop.parcial} Parcial (de ${opData.pop.total} OSs)`;

        const kpiSlaEl = document.getElementById('analytics-kpi-sla');
        const kpiSlaSubEl = document.getElementById('analytics-kpi-sla-sub');
        if (kpiSlaEl) kpiSlaEl.textContent = opData.slas?.media_atendimento_str || '--';
        if (kpiSlaSubEl) kpiSlaSubEl.innerHTML = `Execução no local: <strong style="color: #10B981;">${opData.slas?.media_execucao_str || '--'}</strong>`;

        const kpiEfetEl = document.getElementById('analytics-kpi-efetividade');
        const kpiEfetSubEl = document.getElementById('analytics-kpi-efetividade-sub');
        if (kpiEfetEl) kpiEfetEl.textContent = `${opData.efetividade?.pct_normalizado || 0}%`;
        if (kpiEfetSubEl) kpiEfetSubEl.textContent = `${opData.efetividade?.normalizado || 0} Normalizados · ${opData.efetividade?.sem_agua || 0} Sem Água`;

        const kpiCausaEl = document.getElementById('analytics-kpi-causa');
        const kpiCausaSubEl = document.getElementById('analytics-kpi-causa-sub');
        const mainMotivo = opData.motivos && opData.motivos[0];
        if (kpiCausaEl) kpiCausaEl.textContent = mainMotivo ? mainMotivo.motivo : 'Baixa Pressão';
        if (kpiCausaSubEl) kpiCausaSubEl.textContent = mainMotivo ? `${mainMotivo.pct}% das ordens de campo` : '--';
    }

    // 2. Gráfico Donut de Causas de Falta d'Água + Lista de Barras
    if (opData && opData.motivos && opData.motivos.length > 0) {
        const ctxCausas = document.getElementById('chart-causas-falta');
        if (ctxCausas) {
            if (window.causasChartInstance) {
                window.causasChartInstance.destroy();
            }
            const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
            window.causasChartInstance = new Chart(ctxCausas, {
                type: 'doughnut',
                data: {
                    labels: opData.motivos.map(m => m.motivo),
                    datasets: [{
                        data: opData.motivos.map(m => m.total),
                        backgroundColor: colors.slice(0, opData.motivos.length),
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
                                color: 'var(--text-color)',
                                boxWidth: 12,
                                padding: 10
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => ` ${ctx.label}: ${ctx.raw} OSs (${opData.motivos[ctx.dataIndex]?.pct}%)`
                            }
                        }
                    }
                }
            });
        }

        // Lista com progresso
        const containerMotivos = document.getElementById('container-motivos-list');
        if (containerMotivos) {
            const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
            let htmlM = '';
            opData.motivos.forEach((m, idx) => {
                const c = colors[idx % colors.length];
                htmlM += `
                    <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: var(--text-color);">${m.motivo}</span>
                            <span style="font-weight: 700; color: ${c};">${m.total} OSs <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: 500;">(${m.pct}%)</span></span>
                        </div>
                        <div style="height: 5px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${m.pct}%; height: 100%; background: ${c}; border-radius: 4px;"></div>
                        </div>
                    </div>
                `;
            });
            containerMotivos.innerHTML = htmlM;
        }
    }

    // 3. Gráfico Donut de Conformidade POP 01 + Lista de Falhas
    if (opData && opData.pop) {
        const ctxPop = document.getElementById('chart-pop-conformidade');
        if (ctxPop) {
            if (window.popChartInstance) {
                window.popChartInstance.destroy();
            }
            window.popChartInstance = new Chart(ctxPop, {
                type: 'doughnut',
                data: {
                    labels: ['Conforme (Sim)', 'Parcial', 'Não Conforme'],
                    datasets: [{
                        data: [opData.pop.sim, opData.pop.parcial, opData.pop.nao],
                        backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                        borderWidth: 2,
                        borderColor: '#FFFFFF'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: "'Inter', sans-serif", size: 10, weight: 600 },
                                boxWidth: 10,
                                padding: 8
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => {
                                    const pct = round((ctx.raw / opData.pop.total) * 100, 1);
                                    return ` ${ctx.label}: ${ctx.raw} OSs (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        const containerFalhas = document.getElementById('container-pop-falhas');
        if (containerFalhas && opData.pop_falhas) {
            let htmlF = '<div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Principais Não-Conformidades:</div>';
            opData.pop_falhas.forEach(f => {
                htmlF += `
                    <div style="padding: 8px 12px; border-radius: 6px; background: var(--bg-hover); border: 1px solid var(--border-color); font-size: 0.77rem; display: flex; flex-direction: column; gap: 2px;">
                        <div style="font-weight: 600; color: var(--text-color); line-height: 1.35;">${f.motivo}</div>
                        <div style="color: var(--text-muted); font-size: 0.72rem; font-weight: 500;">Ocorrência em <strong style="color: var(--text-color);">${f.total}</strong> OSs</div>
                    </div>
                `;
            });
            containerFalhas.innerHTML = htmlF;
        }
    }

    // 4. Ranking de Equipes Executoras
    if (opData && opData.equipes) {
        const eqContainer = document.getElementById('table-equipes-analytics');
        if (eqContainer) {
            let htmlE = `
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                    <thead>
                        <tr style="background: var(--bg-hover);">
                            <th style="padding: 8px 10px; text-align: left;">Equipe / Operador</th>
                            <th style="padding: 8px 8px; text-align: center;">Total OSs</th>
                            <th style="padding: 8px 8px; text-align: center;">POP Sim</th>
                            <th style="padding: 8px 8px; text-align: center;">Aderência POP</th>
                            <th style="padding: 8px 10px; text-align: right;">Desempenho</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            opData.equipes.forEach(eq => {
                const badgeBg = eq.pct_pop >= 85 ? 'rgba(16,185,129,0.1)' : (eq.pct_pop >= 70 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)');
                const badgeColor = eq.pct_pop >= 85 ? '#10B981' : (eq.pct_pop >= 70 ? '#F59E0B' : '#EF4444');
                const badgeLabel = eq.pct_pop >= 85 ? 'Excelente' : (eq.pct_pop >= 70 ? 'Regular' : 'Atenção');
                htmlE += `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 8px 10px; font-weight: 600; color: var(--text-color);">${eq.equipe}</td>
                        <td style="padding: 8px 8px; text-align: center; font-weight: 700;">${eq.total}</td>
                        <td style="padding: 8px 8px; text-align: center; color: #10B981; font-weight: 700;">${eq.pop_sim}</td>
                        <td style="padding: 8px 8px; text-align: center; font-weight: 800; color: ${badgeColor};">${eq.pct_pop}%</td>
                        <td style="padding: 8px 10px; text-align: right;">
                            <span style="padding: 3px 8px; border-radius: 9999px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; font-size: 0.72rem;">${badgeLabel}</span>
                        </td>
                    </tr>
                `;
            });
            htmlE += '</tbody></table>';
            eqContainer.innerHTML = htmlE;
        }
    }

    // 5. Perfil de Pressão Hidráulica no Hidrômetro
    if (opData && opData.pressao) {
        const prContainer = document.getElementById('container-pressao-bars');
        if (prContainer) {
            const p = opData.pressao;
            prContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                    <div>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Pressão Média Aferida:</span>
                        <strong style="font-size: 1.35rem; color: var(--text-color); margin-left: 6px;">${p.media_mca} mca</strong>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${p.total_medicoes} hidrômetros com teste</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                        <span style="color: #EF4444; font-weight: 700;">Crítico (&lt; 5 mca)</span>
                        <strong>${p.critico_abaixo_5} imóveis (${p.pct_critico}%)</strong>
                    </div>
                    <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${p.pct_critico}%; height: 100%; background: #EF4444;"></div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                        <span style="color: #F59E0B; font-weight: 700;">Subcrítico / Baixa (5 a 10 mca)</span>
                        <strong>${p.baixa_5_10} imóveis (${p.pct_baixa}%)</strong>
                    </div>
                    <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${p.pct_baixa}%; height: 100%; background: #F59E0B;"></div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                        <span style="color: #10B981; font-weight: 700;">Conforme / Adequado (≥ 10 mca)</span>
                        <strong>${p.adequada_acima_10} imóveis (${p.pct_adequada}%)</strong>
                    </div>
                    <div style="height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${p.pct_adequada}%; height: 100%; background: #10B981;"></div>
                    </div>
                </div>
            `;
        }
    }

    // 6. Top Matrículas Reincidentes (com Tabela Suspensa / Accordion)
    if (reinc_advanced) {
        const matContainer = document.getElementById('table-top-matriculas');
        if (matContainer && reinc_advanced.top_matriculas) {
            if (reinc_advanced.top_matriculas.length === 0) {
                matContainer.innerHTML = '<div class="loading-state" style="padding: 1.5rem;">Nenhuma matrícula reincidente no período selecionado.</div>';
            } else {
                let html = `
                    <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead>
                            <tr style="background: var(--bg-hover);">
                                <th style="padding: 8px 10px; text-align: left;">Matrícula / Endereço</th>
                                <th style="padding: 8px 10px; text-align: right;">Total OSs</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                reinc_advanced.top_matriculas.forEach((d, idx) => {
                    const b_name = d.bairro || 'N/I';
                    const logr_name = d.logradouro || 'Endereço N/I';
                    const histCount = d.historico ? d.historico.length : 0;
                    
                    html += `
                        <tr class="matricula-header-row" onclick="toggleMatriculaDrawer(${idx})" style="cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'" title="Clique para abrir os chamados e logradouro desta matrícula">
                            <td style="padding: 8px 10px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span id="drawer-caret-${idx}" style="font-size: 0.72rem; color: #2563EB; font-weight: 800; transition: transform 0.2s ease; display: inline-block;">▸</span>
                                    <span style="font-family: monospace; font-weight: 700; color: var(--text-color); font-size: 0.85rem;">${d.matricula}</span>
                                    <span style="font-size: 0.68rem; color: #3B82F6; background: rgba(59,130,246,0.1); padding: 1px 5px; border-radius: 4px; font-weight: 600;">ver OSs</span>
                                </div>
                                <div style="font-size: 0.72rem; color: var(--text-muted); margin-left: 14px; margin-top: 1px;">
                                    ${logr_name.substring(0, 30)} · <strong style="color: var(--text-color);">${b_name}</strong>
                                </div>
                            </td>
                            <td style="padding: 8px 10px; text-align: right; vertical-align: middle;">
                                <span style="background: rgba(245, 158, 11, 0.15); color: #B45309; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; display: inline-block;">
                                    ${d.total_oss} OSs
                                </span>
                            </td>
                        </tr>
                        <tr id="drawer-content-${idx}" class="matricula-drawer-row" style="display: none; background: var(--bg-hover);">
                            <td colspan="2" style="padding: 10px 12px; border-bottom: 2px solid var(--border-color);">
                                <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-color); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                                    <span>📍 Logradouro: <span style="font-weight: 500; color: var(--text-muted);">${d.logradouro} (${d.bairro})</span></span>
                                    <span style="font-size: 0.7rem; color: #2563EB; font-weight: 600;">${histCount} Ocorrência(s) Recente(s)</span>
                                </div>
                                ${renderHistoricoMiniTable(d.historico)}
                            </td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                matContainer.innerHTML = html;
            }
        }

        // 7. Matriz de Criticidade NLP (Logradouros Críticos por Sentimento)
        const nlpContainer = document.getElementById('table-logradouros-nlp');
        if (nlpContainer && reinc_advanced.matriz_criticidade) {
            if (reinc_advanced.matriz_criticidade.length === 0) {
                nlpContainer.innerHTML = '<div class="loading-state" style="padding: 1.5rem;">Nenhum logradouro crítico registrado no período.</div>';
            } else {
                let html = `
                    <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead>
                            <tr style="background: var(--bg-hover);">
                                <th style="padding: 8px 10px; text-align: left;">Logradouro & Queixas Mineradas</th>
                                <th style="padding: 8px 6px; text-align: center;">OSs</th>
                                <th style="padding: 8px 10px; text-align: right;">% Negativo</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                reinc_advanced.matriz_criticidade.forEach((d, i) => {
                    const pct = Number(d.pct_negativo || 0).toFixed(1);
                    const color = pct >= 50 ? '#EF4444' : (pct >= 25 ? '#F59E0B' : '#10B981');
                    const badgeBg = pct >= 50 ? 'rgba(239,68,68,0.1)' : (pct >= 25 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)');
                    const b_name = d.bairro || 'N/I';
                    const resumo = d.resumo_nlp || 'Reclamações frequentes registradas...';
                    const nivelBadge = `<span style="background: ${badgeBg}; color: ${color}; font-size: 0.68rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 6px;">${d.nivel || (pct >= 50 ? '🚨 Crítico' : '⚠️ Atenção')}</span>`;
                    
                    html += `
                        <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 8px 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="font-weight: 700; color: var(--text-color); font-size: 0.82rem;">
                                        <span style="color: var(--text-muted); font-size: 0.72rem; margin-right: 4px;">#${i+1}</span>
                                        ${d.logradouro}
                                    </div>
                                    ${nivelBadge}
                                </div>
                                <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; margin-top: 1px;">Bairro: ${b_name}</div>
                                <div style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-hover); padding: 5px 8px; border-radius: 4px; margin-top: 4px; line-height: 1.35; border: 1px solid var(--border-color);">
                                    ${resumo}
                                </div>
                            </td>
                            <td style="padding: 8px 6px; text-align: center; font-weight: 700; font-size: 0.85rem;">${d.total_oss}</td>
                            <td style="padding: 8px 10px; text-align: right;">
                                <div style="font-weight: 800; color: ${color}; font-size: 0.85rem;">${pct}%</div>
                                <div style="height: 4px; width: 45px; background: var(--bg-hover); border-radius: 2px; margin-left: auto; margin-top: 3px; overflow: hidden;">
                                    <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                html += '</tbody></table>';
                nlpContainer.innerHTML = html;
            }
        }
    }

    // 8. Gráfico de Furtos de Hidrômetro & Painel Resumo
    if (furtosRes) {
        const kpiTotalEl = document.getElementById('furtos-kpi-total');
        const kpiPicoEl = document.getElementById('furtos-kpi-pico');
        const kpiMediaEl = document.getElementById('furtos-kpi-media');
        const topBairrosEl = document.getElementById('furtos-top-bairros');

        if (kpiTotalEl) kpiTotalEl.textContent = (furtosRes.total_furtos || 0).toLocaleString('pt-BR');
        if (kpiPicoEl) kpiPicoEl.textContent = furtosRes.mes_pico || '--';
        if (kpiMediaEl) kpiMediaEl.textContent = `${furtosRes.media_mensal || 0}/mês`;

        if (topBairrosEl && furtosRes.top_bairros) {
            const bairrosStr = furtosRes.top_bairros.map(b => `<strong>${b.bairro.split('-')[1] || b.bairro}</strong> (${b.total})`).join(' · ');
            topBairrosEl.innerHTML = `<span style="color: var(--text-muted); font-weight: 600;">Top Bairros com Furtos:</span> ${bairrosStr || 'Nenhum registro de furto'}`;
        }

        if (furtosRes.data && furtosRes.data.length > 0) {
            const labels = furtosRes.data.map(d => d.mes);
            const data = furtosRes.data.map(d => d.total);
            
            const ctxFurtos = document.getElementById('chart-furtos-hd');
            if (ctxFurtos) {
                if (window.furtosChartInstance) {
                    window.furtosChartInstance.destroy();
                }
                window.furtosChartInstance = new Chart(ctxFurtos, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Hidrômetros Furtados',
                            data: data,
                            backgroundColor: data.map(v => v >= 20 ? '#DC2626' : (v >= 10 ? '#EA580C' : 'rgba(234, 88, 12, 0.6)')),
                            borderColor: '#DC2626',
                            borderWidth: 1,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 600, easing: 'easeInOutQuart' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                callbacks: {
                                    label: ctx => ` Furtos: ${(ctx.raw || 0)} ocorrências`
                                }
                            }
                        },
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: "'Inter', sans-serif", size: 10 }, color: 'var(--text-muted)' } },
                            x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", size: 10 }, color: 'var(--text-muted)' } }
                        }
                    }
                });
            }
        }
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Toggle para tabela suspensa de matrículas reincidentes
window.toggleMatriculaDrawer = function(idx) {
    const drawer = document.getElementById(`drawer-content-${idx}`);
    const caret = document.getElementById(`drawer-caret-${idx}`);
    if (!drawer) return;
    const isHidden = (drawer.style.display === 'none' || drawer.style.display === '');
    drawer.style.display = isHidden ? 'table-row' : 'none';
    if (caret) {
        caret.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        caret.textContent = isHidden ? '▾' : '▸';
    }
};

function renderHistoricoMiniTable(historico) {
    if (!historico || historico.length === 0) {
        return '<div style="font-size: 0.75rem; color: var(--text-muted); padding: 4px 0;">Sem histórico adicional registrado.</div>';
    }
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.74rem; background: var(--bg-card); border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
            <thead>
                <tr style="background: var(--bg-hover); text-align: left; border-bottom: 1px solid var(--border-color);">
                    <th style="padding: 5px 8px;">SS / Data</th>
                    <th style="padding: 5px 8px;">Serviço</th>
                    <th style="padding: 5px 8px;">Situação</th>
                    <th style="padding: 5px 8px;">Observação de Campo</th>
                </tr>
            </thead>
            <tbody>
    `;
    historico.forEach(h => {
        const sitColor = (h.situacao && h.situacao.includes('Executada') && !h.situacao.includes('Não')) ? '#10B981' : '#F59E0B';
        const sitBg = (h.situacao && h.situacao.includes('Executada') && !h.situacao.includes('Não')) ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)';
        const servClean = h.servico ? (h.servico.split('-')[1] || h.servico).trim() : 'Falta d\'Água';
        const obsSnippet = (h.obs || 'Sem observação registrada').substring(0, 65);
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 5px 8px; font-weight: 700; white-space: nowrap;">
                    ${h.ss}
                    <div style="font-weight: 400; font-size: 0.68rem; color: var(--text-muted);">${h.data}</div>
                </td>
                <td style="padding: 5px 8px; font-weight: 500;">${servClean}</td>
                <td style="padding: 5px 8px; white-space: nowrap;">
                    <span style="background: ${sitBg}; color: ${sitColor}; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.68rem;">
                        ${h.situacao}
                    </span>
                </td>
                <td style="padding: 5px 8px; color: var(--text-muted); font-style: italic;" title="${h.obs}">
                    "${obsSnippet}${h.obs && h.obs.length > 65 ? '...' : ''}"
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    return html;
}

// === Heatmap Section ===
async function loadMapaCalorSetor() {
    const container = document.getElementById('chart-heatmap-setores');
    if (!container) return;

    const res = await api('/api/analytics/mapa-calor-setor');
    if (!res || !res.data || res.data.length === 0) {
        container.innerHTML = '<div class="loading-state">Sem dados de concentração geográfica.</div>';
        return;
    }

    let html = '';

    res.data.forEach(setorData => {
        const sectorName = setorData.setor;
        const totalSector = setorData.total;
        const bairros = setorData.bairros;

        if (bairros.length === 0) return;

        // Find max value in this sector to scale the opacity
        const maxVal = Math.max(...bairros.map(b => b.total));

        html += `<div class="heatmap-sector">
            <div class="heatmap-sector-title">
                <span>${sectorName.substring(0, 30)}...</span>
                <span>${totalSector} Chamados</span>
            </div>
            <div class="heatmap-grid">`;

        bairros.forEach(b => {
            const val = b.total;
            // Calculate a scale from 1 to 5 for the heat
            const heatLevel = Math.max(1, Math.ceil((val / maxVal) * 5));
            // Calculate opacity based on heatLevel (0.2 to 1.0)
            const opacity = (0.3 + (heatLevel * 0.14)).toFixed(2);

            // Reusing the accent blue color with variable opacity
            const style = `background-color: rgba(59, 130, 246, ${opacity})`;

            html += `<div class="heatmap-cell" 
                        style="${style}" 
                        title="${b.bairro}: ${val} solicitações">
                        ${val}
                     </div>`;
        });

        html += `   </div>
                </div>`;
    });

    container.innerHTML = html;
}

// === Chat ===
let currentConversationId = null;
let conversations = [];

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

function formatChatTimestamp(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (date.toDateString() === now.toDateString()) {
            if (diffMins < 1) return 'Agora';
            if (diffMins < 60) return `há ${diffMins} min`;
            return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        }
        
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Ontem';
        }
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
}

window.setChatInputValue = function(text) {
    const inputEl = document.getElementById('chat-input');
    if (inputEl) {
        inputEl.value = text;
        inputEl.style.height = 'auto';
        inputEl.style.height = (inputEl.scrollHeight) + 'px';
        inputEl.focus();
    }
};

window.handlePinItem = function(id) {
    currentConversationId = id;
    handlePinClick();
};

window.handleRenameItem = function(id) {
    currentConversationId = id;
    handleRenameClick();
};

window.handleDeleteItem = function(id) {
    currentConversationId = id;
    handleDeleteClick();
};

function renderConversationsList() {
    const listContainer = document.getElementById('conversations-list');
    if (!listContainer) return;
    
    if (conversations.length === 0) {
        listContainer.innerHTML = '<div style="padding: 1.5rem 1rem; text-align: center; font-size: 0.75rem; color: var(--text-muted);">Nenhuma conversa encontrada.</div>';
        return;
    }
    
    listContainer.innerHTML = '';
    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        div.dataset.id = conv.id;
        
        const isPinned = conv.pinned === 1 || conv.pinned === true;
        const pinHtml = isPinned ? '<i data-lucide="pin" class="pin-icon" style="width: 12px; height: 12px; margin-right: 4px; display: inline-block; vertical-align: middle;"></i>' : '';
        const preview = conv.last_message_preview || 'Sem mensagens';
        const formattedTime = formatChatTimestamp(conv.updated_at);
        
        div.innerHTML = `
            <div class="conversation-item-title">
                ${pinHtml}
                <span class="title-text" style="display: inline-block; vertical-align: middle; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(conv.title)}</span>
            </div>
            <div class="conversation-item-preview">${escapeHtml(preview)}</div>
            <div class="conversation-item-meta">
                <span>${conv.message_count} msg</span>
                <span>${formattedTime}</span>
            </div>
            <div class="conversation-item-actions">
                <button class="btn-action-icon pin-action" title="Fixar/Desafixar" onclick="event.stopPropagation(); window.handlePinItem('${conv.id}')">
                    <i data-lucide="pin" style="width: 12px; height: 12px;"></i>
                </button>
                <button class="btn-action-icon rename-action" title="Renomear" onclick="event.stopPropagation(); window.handleRenameItem('${conv.id}')">
                    <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
                </button>
                <button class="btn-action-icon delete-action" title="Excluir" onclick="event.stopPropagation(); window.handleDeleteItem('${conv.id}')">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
            </div>
        `;
        
        div.addEventListener('click', () => {
            selectConversation(conv.id);
        });
        
        listContainer.appendChild(div);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function selectConversation(id) {
    if (!id) return;
    currentConversationId = id;
    localStorage.setItem('saneaia_current_conv_id', id);
    
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === id);
    });
    
    const headerActions = document.getElementById('chat-header-actions');
    const pinBtn = document.getElementById('btn-pin-chat');
    if (headerActions) headerActions.style.display = 'flex';
    
    const conv = conversations.find(c => c.id === id);
    if (conv) {
        document.getElementById('chat-title-header').textContent = conv.title;
        const isPinned = conv.pinned === 1 || conv.pinned === true;
        if (pinBtn) pinBtn.classList.toggle('active', isPinned);
    }
    
    chatMessages.innerHTML = '';
    addTyping();
    
    try {
        const res = await api(`/api/agent/conversations/${id}/messages`);
        removeTyping();
        
        if (res && res.data) {
            if (res.data.length === 0) {
                renderEmptyState();
            } else {
                res.data.forEach(msg => {
                    const isUser = msg.role === 'user';
                    addMessageToPane(msg.content, isUser);
                });
            }
        }
    } catch (e) {
        removeTyping();
        chatMessages.innerHTML = '<div style="padding: 1rem; text-align: center; color: #DC2626;">Erro ao carregar mensagens desta conversa.</div>';
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderEmptyState() {
    chatMessages.innerHTML = `
        <div class="chat-empty-state">
            <div class="empty-state-icon">🤖</div>
            <h2>Como posso ajudar hoje?</h2>
            <p>Faça perguntas, analise dados, explore informações ou peça ajuda para analisar reincidências e conformidade do POP.</p>
            <div class="empty-state-suggestions">
                <div class="suggestion-card" onclick="window.setChatInputValue('Quais são as matrículas mais reincidentes este mês?')">
                    <div class="suggestion-title">📊 Analisar Matrículas</div>
                    <div class="suggestion-desc">Encontre clientes com alta reincidência de falta d'água.</div>
                </div>
                <div class="suggestion-card" onclick="window.setChatInputValue('Quais OS estão não conformes com o POP 01?')">
                    <div class="suggestion-title">⚠️ Verificar POP</div>
                    <div class="suggestion-desc">Identifique serviços fora dos padrões operacionais.</div>
                </div>
                <div class="suggestion-card" onclick="window.setChatInputValue('Quais são os bairros mais críticos em vazamentos?')">
                    <div class="suggestion-title">📈 Bairros Críticos</div>
                    <div class="suggestion-desc">Relatório de vazamentos por região geográfica.</div>
                </div>
            </div>
        </div>
    `;
}

function addMessageToPane(text, isUser = false) {
    const emptyState = chatMessages.querySelector('.chat-empty-state');
    if (emptyState) {
        chatMessages.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    const parsedText = (typeof marked !== 'undefined' && !isUser)
        ? marked.parse(text)
        : text.replace(/\n/g, '<br>');
    div.innerHTML = `<div class="message-avatar">${isUser ? '<i data-lucide="user" style="width: 16px; height: 16px;"></i>' : '<i data-lucide="bot" style="width: 16px; height: 16px;"></i>'}</div>
        <div class="message-content">${parsedText}</div>`;
    chatMessages.appendChild(div);
}

function addTyping() {
    const emptyState = chatMessages.querySelector('.chat-empty-state');
    if (emptyState) {
        chatMessages.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = 'message bot-message';
    div.id = 'typing-msg';
    div.innerHTML = '<div class="message-avatar"><i data-lucide="bot" style="width: 16px; height: 16px;"></i></div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    chatMessages.appendChild(div);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById('typing-msg');
    if (t) t.remove();
}

async function sendChat() {
    const q = chatInput.value.trim();
    if (!q) return;
    
    if (!currentConversationId) {
        try {
            const newConvRes = await api('/api/agent/conversations', {
                method: 'POST',
                body: JSON.stringify({ title: 'Nova conversa' })
            });
            if (newConvRes && newConvRes.data) {
                currentConversationId = newConvRes.data.id;
                localStorage.setItem('saneaia_current_conv_id', currentConversationId);
                conversations.unshift(newConvRes.data);
                renderConversationsList();
            } else {
                alert('Erro ao iniciar nova conversa.');
                return;
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao conectar com o servidor.');
            return;
        }
    }
    
    addMessageToPane(q, true);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    addTyping();
    
    try {
        const res = await api(`/api/agent/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ 
                content: q,
                year_context: typeof globalYearFilter !== 'undefined' ? globalYearFilter : 'Todos'
            })
        });
        removeTyping();
        
        if (res && res.response) {
            addMessageToPane(res.response, false);
            await initConversations(currentConversationId);
        } else {
            addMessageToPane('Erro ao obter resposta do agente.', false);
        }
    } catch (e) {
        removeTyping();
        addMessageToPane('Erro de comunicação com o servidor.', false);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleNewChatClick() {
    try {
        const res = await api('/api/agent/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: 'Nova conversa' })
        });
        if (res && res.data) {
            currentConversationId = res.data.id;
            localStorage.setItem('saneaia_current_conv_id', res.data.id);
            conversations.unshift(res.data);
            renderConversationsList();
            selectConversation(res.data.id);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao criar conversa.');
    }
}

async function handlePinClick() {
    if (!currentConversationId) return;
    const conv = conversations.find(c => c.id === currentConversationId);
    if (!conv) return;
    
    const nextPinnedState = !(conv.pinned === 1 || conv.pinned === true);
    try {
        const res = await api(`/api/agent/conversations/${currentConversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ pinned: nextPinnedState })
        });
        if (res && res.data) {
            conv.pinned = res.data.pinned;
            conv.updated_at = res.data.updated_at;
            conversations.sort((a,b) => {
                const aPin = a.pinned === 1 || a.pinned === true ? 1 : 0;
                const bPin = b.pinned === 1 || b.pinned === true ? 1 : 0;
                if (aPin !== bPin) return bPin - aPin;
                return new Date(b.updated_at) - new Date(a.updated_at);
            });
            renderConversationsList();
            const pinBtn = document.getElementById('btn-pin-chat');
            if (pinBtn) pinBtn.classList.toggle('active', nextPinnedState);
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleRenameClick() {
    if (!currentConversationId) return;
    const conv = conversations.find(c => c.id === currentConversationId);
    if (!conv) return;
    
    const newTitle = prompt('Digite o novo nome para esta conversa:', conv.title);
    if (newTitle === null) return;
    
    const trimmed = newTitle.trim();
    if (!trimmed) {
        alert('O nome da conversa não pode ser vazio.');
        return;
    }
    
    try {
        const res = await api(`/api/agent/conversations/${currentConversationId}`, {
            method: 'PATCH',
            body: JSON.stringify({ title: trimmed })
        });
        if (res && res.data) {
            conv.title = res.data.title;
            document.getElementById('chat-title-header').textContent = res.data.title;
            renderConversationsList();
        }
    } catch (e) {
        console.error(e);
    }
}

async function handleDeleteClick() {
    if (!currentConversationId) return;
    
    const confirmDelete = confirm("Excluir esta conversa?\nEsta ação não pode ser desfeita e removerá todas as mensagens e memórias relacionadas.");
    if (!confirmDelete) return;
    
    try {
        const res = await api(`/api/agent/conversations/${currentConversationId}`, {
            method: 'DELETE'
        });
        if (res && res.success) {
            conversations = conversations.filter(c => c.id !== currentConversationId);
            renderConversationsList();
            
            if (conversations.length > 0) {
                selectConversation(conversations[0].id);
            } else {
                currentConversationId = null;
                localStorage.removeItem('saneaia_current_conv_id');
                document.getElementById('chat-title-header').textContent = 'Agente de Análise de Dados';
                document.getElementById('chat-header-actions').style.display = 'none';
                renderEmptyState();
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function initConversations(selectId = null) {
    try {
        const res = await api('/api/agent/conversations');
        if (res && res.data) {
            conversations = res.data;
            renderConversationsList();
            
            const savedId = selectId || localStorage.getItem('saneaia_current_conv_id');
            if (savedId && conversations.some(c => c.id === savedId)) {
                await selectConversation(savedId);
            } else if (conversations.length > 0) {
                await selectConversation(conversations[0].id);
            } else {
                currentConversationId = null;
                document.getElementById('chat-header-actions').style.display = 'none';
                renderEmptyState();
            }
        }
    } catch (e) {
        console.error('Erro ao inicializar conversas:', e);
    }
}

document.getElementById('btn-send').addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { 
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
    }
});
if (chatInput) {
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}
document.getElementById('btn-new-chat').addEventListener('click', handleNewChatClick);
document.getElementById('btn-pin-chat').addEventListener('click', handlePinClick);
document.getElementById('btn-rename-chat').addEventListener('click', handleRenameClick);
document.getElementById('btn-delete-chat').addEventListener('click', handleDeleteClick);

// === Insights ===
let biDonutChart = null;
let biEvolucaoChart = null;

function renderBIDonut(exec, nexec, pend) {
    const ctx = document.getElementById('canvas-bi-donut');
    if (!ctx) return;
    if (biDonutChart) biDonutChart.destroy();
    biDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Executadas', 'N\u00e3o Executadas', 'Pendentes'],
            datasets: [{
                data: [exec, nexec, pend],
                backgroundColor: ['#16A34A', '#F59E0B', '#DC2626'],
                borderWidth: 0,
                cutout: '72%',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${(ctx.raw || 0).toLocaleString('pt-BR')}`
                    }
                }
            },
            animation: { duration: 800, easing: 'easeInOutQuart' }
        }
    });
}

async function processInsightsData(text, timestamp = null) {
    // Regex de Extração Segura Baseada na Lógica do Backend (analyzer.py)
    const extract = (regex, def="0") => { const m = regex.exec(text); return m ? m[1].trim() : def; };
    
    const tot = extract(/Volume Total no Ano.*?:\*\* ([\d.,]+)/, "7.277");
    const exc = extract(/Concluídas Executadas.*?:\*\* ([\d.,]+)/, "5.589");
    const excPct = extract(/Concluídas Executadas.*?\(([\d.,]+)%\)/, "76.8");
    const nexc = extract(/Concluídas Não Executadas \/ Canceladas:\*\* ([\d.,]+)/, "1.682");
    const nexcPct = extract(/Concluídas Não Executadas \/ Canceladas:.*?\(([\d.,]+)%\)/, "23.1");
    // Pendências: NÃO parsear do texto da LLM (pode ser desatualizado ou incorreto).
    // O valor correto vem da API analytics via loadInsightsKPIs().
    const pnd = extract(/Pendentes Ativas em Aberto:\*\* (\d+)/, "0");
    const pndPct = extract(/Pendentes Ativas em Aberto:.*?\(([\d.,]+)%\)/, "0");

    // === KPIs Anuais ===
    document.getElementById('bi-kpi-total').textContent = tot;
    document.getElementById('bi-kpi-exec').textContent = exc;
    document.getElementById('bi-kpi-exec-pct').textContent = excPct + '% de execução';
    document.getElementById('bi-bar-exec').style.width = excPct + '%';
    document.getElementById('bi-kpi-nexec').textContent = nexc;
    document.getElementById('bi-kpi-nexec-pct').textContent = nexcPct + '% da operação';
    document.getElementById('bi-bar-nexec').style.width = nexcPct + '%';
    // bi-kpi-pend e bi-kpi-pend-pct serão atualizados pela API (loadInsightsKPIs abaixo)

    // === Donut (usa pnd do texto como placeholder até API responder) ===
    document.getElementById('bi-donut-center-val').textContent = excPct + '%';
    document.getElementById('bi-legend-exec').textContent = exc;
    document.getElementById('bi-legend-nexec').textContent = nexc;
    const cleanNum = (str) => parseInt(str.replace(/[^\d]/g, '')) || 0;

    // === Análise Mensal: Atualiza a partir dos seletores de período ===
    updateMonthlyKPIsFromFilter();

    // === Recarregar KPIs de pendências da API (fonte de verdade) ===
    loadInsightsKPIs('2026').then(() => {
        // Após API retornar, atualizar donut e alerta com valor correto
        const pendEl = document.getElementById('bi-kpi-pend');
        const alertCount = pendEl ? (parseInt(pendEl.textContent) || 0) : cleanNum(pnd);
        document.getElementById('bi-legend-pend') && (document.getElementById('bi-legend-pend').textContent = alertCount);
        renderBIDonut(cleanNum(exc), cleanNum(nexc), alertCount);

        // === Alerta Operacional ===
        const alertEl = document.getElementById('bi-alerta-operacional');
        if (alertEl) {
            if (alertCount > 0) {
                alertEl.style.display = 'block';
                const countEl = document.getElementById('bi-alerta-count');
                const descEl = document.getElementById('bi-alerta-desc');
                if (countEl) countEl.textContent = `${alertCount} pendência${alertCount !== 1 ? 's' : ''} ativa${alertCount !== 1 ? 's' : ''} identificada${alertCount !== 1 ? 's' : ''}`;
                if (descEl) descEl.textContent = `Existem ${alertCount} solicitações atualmente em aberto e sob monitoramento preditivo. Recomenda-se priorização das equipes responsáveis.`;
            } else {
                alertEl.style.display = 'none';
            }
        }
    });

    // === Rankings — Bairros ===
    const bairrosRaw = extract(/Bairros de Maior Concentração:\*\* (.*?)(?:\n|$)/, "");
    const bairrosList = bairrosRaw
        ? bairrosRaw.split(',').slice(0,5).map(s => {
            const m = s.match(/^([^(]+)\((\d+)\)?/) || s.match(/^(.+)/);
            return m ? { nome: m[1].trim(), val: parseInt(m[2] || 0) } : null;
        }).filter(Boolean)
        : [
            { nome: 'ITAPUÃ', val: 1105 },
            { nome: 'SÃO CRISTÓVÃO', val: 605 },
            { nome: 'ITINGA', val: 535 }
        ];

    renderBIRanking('bi-ranking-bairros', bairrosList, '#3B82F6', 'OS');

    // === Rankings — Logradouros ===
    const ruasRaw = extract(/Logradouros Críticos:\*\* (.*?)(?:\n|$)/, "");
    const ruasList = ruasRaw
        ? ruasRaw.split(',').slice(0,5).map(s => {
            const m = s.match(/^([^(]+)\((\d+)\)?/) || s.match(/^(.+)/);
            return m ? { nome: m[1].trim(), val: parseInt(m[2] || 0) } : null;
        }).filter(Boolean)
        : [
            { nome: 'RU MARTA AGUIAR DA SILVA', val: 60 },
            { nome: 'RU SÃO CRISTÓVÃO', val: 59 },
            { nome: 'CAM 30 MUSSURUNGA I GLEBA C', val: 56 }
        ];

    renderBIRanking('bi-ranking-ruas', ruasList, '#D97706', 'chamados');

    // === Rankings — Serviços ===
    const servicosRaw = extract(/Serviços Predominantes:\*\* (.*?)(?:\n|$)/, "");
    const servicosList = servicosRaw
        ? servicosRaw.split(',').slice(0,5).map(s => {
            const m = s.match(/^([^(]+)\((\d+)\)?/) || s.match(/^(.+)/);
            return m ? { nome: m[1].trim(), val: parseInt(m[2] || 0) } : null;
        }).filter(Boolean)
        : [
            { nome: 'VERIF FALTA AGUA IMOVEL', val: 6550 },
            { nome: 'VAZAMENTO NO HIDROMETRO', val: 35 },
            { nome: 'DESOB LIG PASSEIO S/PAVIM', val: 2 }
        ];

    renderBIRanking('bi-ranking-servicos', servicosList, '#64748B', 'solicitações');

    // === Plano de Ação (novo formato numerado minimalista) ===
    const planoMatch = /#### 🛠️ 4\. Plano Técnico de Ação & Recomendações\n([\s\S]*)/.exec(text);
    if (planoMatch) {
        const linhas = planoMatch[1].split('\n').filter(l => l.trim().length > 0);
        let phtml = '';
        let stepNum = 1;
        const priorities = ['high', 'medium', 'low'];
        const priorityLabels = ['ALTA', 'MÉDIA', 'RECOMENDADO'];
        
        const regexPlan = /(?:\d+\.\s+)?\*\*(.*?)\*\*([\s\S]*?)(?=\n(?:\d+\.\s+)?\*\*|$)/g;
        let match;
        while ((match = regexPlan.exec(planoMatch[1])) !== null && stepNum <= 3) {
            const pr = priorities[stepNum - 1] || 'medium';
            const prLabel = priorityLabels[stepNum - 1] || 'RECOMENDADO';
            phtml += `
            <div class="bi-action-item">
                <div class="bi-action-header">
                    <div class="bi-action-title">0${stepNum} — ${match[1].trim()}</div>
                </div>
                <div class="bi-action-priority">Prioridade: ${prLabel}</div>
                <div class="bi-action-desc">${match[2].trim()}</div>
            </div>`;
            stepNum++;
        }
        if (document.getElementById('bi-ai-plano')) {
            document.getElementById('bi-ai-plano').innerHTML = phtml || '<p class="saneaia-info-text">Plano formulado com base no diagnóstico atual.</p>';
        }
    } else {
        if (document.getElementById('bi-ai-plano')) {
            document.getElementById('bi-ai-plano').innerHTML = `
                <div class="bi-action-item">
                    <div class="bi-action-header">
                        <div class="bi-action-title">01 — Investigação de Causas-Raiz</div>
                    </div>
                    <div class="bi-action-priority">Prioridade: ALTA</div>
                    <div class="bi-action-desc">Priorizar varredura acústica nos eixos críticos de maior volume para identificar vazamentos não visíveis.</div>
                </div>
                <div class="bi-action-item">
                    <div class="bi-action-header">
                        <div class="bi-action-title">02 — Deslocamento Estratégico de Equipes</div>
                    </div>
                    <div class="bi-action-priority">Prioridade: MÉDIA</div>
                    <div class="bi-action-desc">Direcionar equipes de ramal predial para atender as ${pnd} pendências ativas em campo.</div>
                </div>
                <div class="bi-action-item">
                    <div class="bi-action-header">
                        <div class="bi-action-title">03 — Inspeção de VRPs e Macromedição</div>
                    </div>
                    <div class="bi-action-priority">Prioridade: MÉDIA</div>
                    <div class="bi-action-desc">Verificar integridade e calibração de equipamentos de controle de pressão nos bairros com maior incidência de reclamações recorrentes.</div>
                </div>
            `;
        }
    }

    // === O que está sendo identificado (cards minimalistas bem formatados) ===
    if (document.getElementById('bi-ai-identifica')) {
        document.getElementById('bi-ai-identifica').innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0;">
                <div class="bi-diag-item">
                    <div class="bi-diag-title">Concentração Geográfica</div>
                    <div class="bi-diag-text">A maior parte das solicitações está concentrada em polos específicos (ex: Itapuã, São Cristóvão, Itinga), indicando necessidade de atuação direcionada nessas regiões.</div>
                </div>
                <div class="bi-diag-item">
                    <div class="bi-diag-title">Reincidência</div>
                    <div class="bi-diag-text">Logradouros críticos apresentam recorrência elevada e devem ser priorizados na análise técnica e no cronograma de manutenção preventiva.</div>
                </div>
                <div class="bi-diag-item">
                    <div class="bi-diag-title">Pressão Operacional</div>
                    <div class="bi-diag-text">O volume consolidado (${tot} em 2026) com ${excPct}% de taxa de execução sugere necessidade de monitoramento contínuo dos principais eixos de distribuição.</div>
                </div>
            </div>
        `;
    }

    const lastTime = timestamp || ('Atualizado em: ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date().toLocaleDateString('pt-BR') + ')');
    document.getElementById('saneaia-last-update-text').textContent = lastTime;

    // Renderizar gráfico de evolução temporal
    setTimeout(() => {
        const ctx = document.getElementById('canvas-bi-evolucao');
        if (ctx && globalTemporalData && globalTemporalData.length > 0) {
            const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const data2026 = globalTemporalData.filter(d => d.ano == 2026);
            let totalVals = new Array(12).fill(null);
            data2026.forEach(d => {
                if (d.mes_numero >= 1 && d.mes_numero <= 12) {
                    totalVals[d.mes_numero - 1] = d.total_solicitacoes;
                }
            });
            
            if (biEvolucaoChart) biEvolucaoChart.destroy();
            biEvolucaoChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: meses,
                    datasets: [
                        {
                            label: 'Total OSs 2026',
                            data: totalVals,
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.06)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.35,
                            pointStyle: 'circle',
                            pointRadius: 3.5,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3B82F6'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 600, easing: 'easeInOutQuart' },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { family: "'Inter', sans-serif", size: 12 },
                            bodyFont: { family: "'Inter', sans-serif", size: 12 },
                            padding: 10,
                            cornerRadius: 6,
                            callbacks: {
                                label: ctx => `OSs: ${(ctx.raw || 0).toLocaleString('pt-BR')}`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#64748B' } },
                        y: { grid: { color: '#F1F5F9' }, ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#64748B' }, beginAtZero: true }
                    }
                }
            });
        }
    }, 200);
}

function restoreSavedInsights() {
    try {
        const saved = localStorage.getItem('saneaia_insights_cache');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.insights) {
                // Validar se o cache é do mês corrente (evitar dados defasados)
                const now = new Date();
                const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
                const mesAtual = monthNames[now.getMonth()];
                const anoAtual = now.getFullYear();
                const cacheDesatualizado = parsed.insights &&
                    !parsed.insights.includes(`${mesAtual}/${anoAtual}`) &&
                    (parsed.insights.includes('/2026') || parsed.insights.includes('/2025'));
                if (cacheDesatualizado) {
                    console.info(`[SaneaIA] Cache de insights desatualizado (não contém ${mesAtual}/${anoAtual}). Descartando.`);
                    localStorage.removeItem('saneaia_insights_cache');
                    return;
                }
                processInsightsData(parsed.insights, parsed.timestamp);
            }
        }
    } catch (e) {
        console.error("Erro ao restaurar insights do cache:", e);
    }
}

document.getElementById('btn-generate-insights').addEventListener('click', async () => {
    if (document.getElementById('bi-ai-identifica')) document.getElementById('bi-ai-identifica').innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><br>Processando diagnósticos...</div>';
    if (document.getElementById('bi-ai-plano')) document.getElementById('bi-ai-plano').innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><br>Formulando recomendações...</div>';
    document.getElementById('bi-ranking-bairros').innerHTML = '<div class="loading-state" style="padding:1rem;"><div class="loading-spinner"></div></div>';
    document.getElementById('bi-ranking-ruas').innerHTML = '<div class="loading-state" style="padding:1rem;"><div class="loading-spinner"></div></div>';
    document.getElementById('bi-ranking-servicos').innerHTML = '<div class="loading-state" style="padding:1rem;"><div class="loading-spinner"></div></div>';
    document.getElementById('saneaia-last-update-text').textContent = 'Atualizando...';

    const res = await api('/api/agent/analyze', { method: 'POST' });
    if (res && res.insights) {
        const nowFormatted = 'Atualizado em: ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date().toLocaleDateString('pt-BR') + ')';
        try {
            localStorage.setItem('saneaia_insights_cache', JSON.stringify({
                insights: res.insights,
                timestamp: nowFormatted
            }));
        } catch (e) {
            console.error("Erro ao salvar insights no localStorage:", e);
        }
        await processInsightsData(res.insights, nowFormatted);
    } else {
        if (document.getElementById('bi-ai-identifica')) document.getElementById('bi-ai-identifica').innerHTML = '<div class="loading-state">Erro ao gerar insights. Verifique a conexão com o servidor.</div>';
    }
});

/**
 * Renderiza ranking visual com barras proporcionais
 * @param {string} containerId - ID do container
 * @param {Array} items - [{nome, val}]
 * @param {string} color - cor das barras
 * @param {string} unit - unidade (OS, chamados, etc.)
 */
function renderBIRanking(containerId, items, color, unit = 'OS') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="loading-state" style="padding:0.75rem;">Sem dados disponíveis.</div>';
        return;
    }
    const maxVal = Math.max(...items.map(i => i.val || 0));
    const badges = ['top1', 'top2', 'top3', '', ''];
    const medals = ['01', '02', '03', '04', '05'];
    let html = '<div class="bi-ranking-list">';
    items.forEach((item, idx) => {
        html += `
        <div class="bi-ranking-item">
            <div class="bi-ranking-item-top">
                <span class="bi-ranking-badge">${medals[idx] || '0' + (idx+1)}</span>
                <span class="bi-ranking-name" title="${item.nome}">${item.nome}</span>
            </div>
            <div class="bi-ranking-count">${(item.val || 0).toLocaleString('pt-BR')} ${unit}</div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    // Animate bars after render
    setTimeout(() => {
        container.querySelectorAll('.bi-ranking-bar-fill').forEach(bar => {
            bar.style.width = (bar.dataset.target || 0) + '%';
        });
    }, 80);
}

// === NLP ===

function renderNLPRender(d) {
    const mes = d.analise_mes || {};
    const ano = d.analise_ano || {};
    const totalAnoSol = d.total_ano_solicitacoes || 7485;
    const totalAnoObs = d.total_ano || 7404;
    const totalMesSol = d.total_mes_solicitacoes || 272;
    const totalMesObs = d.total_mes_corrente || 255;

    let html = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">

            <!-- MENSAL e ANUAL lado a lado 50%/50% -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start;">

                <!-- CARD: ANÁLISE MENSAL -->
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.4rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 1rem;">
                    <div style="padding-bottom: 0.8rem; border-bottom: 1px solid var(--border-subtle);">
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Análise Mensal</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
                            Amostra: <strong>${totalMesSol.toLocaleString('pt-BR')} OSs</strong> &nbsp;·&nbsp; Mineradas: <strong>${totalMesObs.toLocaleString('pt-BR')} observações</strong>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${mes.percentual_negativo || 12.2}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Sentimento Negativo</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${mes.taxa_urgencia || 4.7}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Taxa de Urgência</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${(mes.total_urgentes || 12).toLocaleString('pt-BR')}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Solicitações Urgentes</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${mes.percentual_positivo || 21.2}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Sentimento Positivo</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center; grid-column: span 2;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${mes.taxa_localizacao || 29.0}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Localização Extraída das Observações</div>
                        </div>
                    </div>
                </div>

                <!-- CARD: ANÁLISE ANUAL -->
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.4rem 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 1rem;">
                    <div style="padding-bottom: 0.8rem; border-bottom: 1px solid var(--border-subtle);">
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Análise Anual (Acumulado)</div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">
                            Amostra: <strong>${totalAnoSol.toLocaleString('pt-BR')} OSs</strong> &nbsp;·&nbsp; Mineradas: <strong>${totalAnoObs.toLocaleString('pt-BR')} observações</strong>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${ano.percentual_negativo || 9.3}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Sentimento Negativo</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${ano.taxa_urgencia || 3.3}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Taxa de Urgência</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${(ano.total_urgentes || 241).toLocaleString('pt-BR')}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Solicitações Urgentes</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${ano.percentual_positivo || 19.7}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Sentimento Positivo</div>
                        </div>
                        <div style="background: var(--bg-card-hover); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 1rem 0.8rem; text-align: center; grid-column: span 2;">
                            <div style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary); line-height: 1.1;">${ano.taxa_localizacao || 16.3}%</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Localização Extraída das Observações</div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    `;

    const container = document.getElementById('nlp-results');
    if (container) container.innerHTML = html;
}

function restoreSavedNLP() {
    try {
        const saved = localStorage.getItem('saneaia_nlp_cache');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed) {
                renderNLPRender(parsed);
            }
        }
    } catch (e) {
        console.error("Erro ao restaurar NLP do cache:", e);
    }
}

document.getElementById('btn-nlp-analysis').addEventListener('click', async () => {
    const container = document.getElementById('nlp-results');
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><br>Analisando observações...</div>';
    const res = await api('/api/agent/nlp-summary');
    if (res && res.data) {
        try {
            localStorage.setItem('saneaia_nlp_cache', JSON.stringify(res.data));
        } catch (e) {
            console.error("Erro ao salvar NLP no cache:", e);
        }
        renderNLPRender(res.data);
    } else {
        container.innerHTML = '<div class="loading-state">Erro ao processar observações.</div>';
    }
});

// === ML ===
let metricsChartInstance = null;

async function loadMLMetrics() {
    // 1. Carregar Status do Modelo
    const res = await api('/api/ml/status');
    const container = document.getElementById('ml-status');
    if (res && res.last_trained) {
        container.innerHTML = `
            <div class="metric-row"><span class="metric-label">Algoritmo</span><span class="metric-value">${res.algorithm || 'Random Forest'}</span></div>
            <div class="metric-row"><span class="metric-label">Acurácia</span><span class="metric-value text-green-500 font-bold">${res.accuracy}%</span></div>
            <div class="metric-row"><span class="metric-label">Precisão</span><span class="metric-value">${res.precision}%</span></div>
            <div class="metric-row"><span class="metric-label">Recall</span><span class="metric-value">${res.recall}%</span></div>
            <div class="metric-row"><span class="metric-label">Amostras</span><span class="metric-value">${(res.samples_used || 0).toLocaleString('pt-BR')}</span></div>
            <div class="metric-row"><span class="metric-label" style="font-size: 0.75rem;">Último Treino</span><span class="metric-value" style="font-size: 0.75rem;">${new Date(res.last_trained).toLocaleString('pt-BR')}</span></div>`;
    } else {
        container.innerHTML = '<div class="loading-state">Nenhum modelo treinado ainda.</div>';
    }

    // 2. Carregar Histórico e renderizar gráfico (Chart.js)
    const histRes = await api('/api/ml/history');
    console.log("[DEBUG ML] Dados de Histórico recebidos do Backend:", histRes);
    
    const histContainer = document.getElementById('table-metrics');
    
    if (histRes && histRes.length > 0) {
        // Criar canvas se não existir
        if (!document.getElementById('ml-history-chart')) {
            histContainer.innerHTML = '<canvas id="ml-history-chart" style="width: 100%; height: 250px;"></canvas>';
        }
        
        const chartData = histRes.filter(d => d.status === 'SUCESSO').reverse();
        console.log("[DEBUG ML] Dados filtrados (SUCESSO):", chartData);

        const labels = chartData.map(d => {
            const dt = new Date(d.treinado_em);
            return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth()+1).toString().padStart(2, '0')} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
        });
        
        // BUG CORRIGIDO: O valor já vinha em percentual (ex: 74.41) do banco.
        // A multiplicação por 100 jogava o valor para 7441, extrapolando o eixo Y(0-100) do Chart.js!
        const acuracias = chartData.map(d => parseFloat(d.acuracia || 0));
        console.log("[DEBUG ML] Acurácias formatadas para o eixo Y (devem estar entre 0 e 100):", acuracias);

        const ctx = document.getElementById('ml-history-chart').getContext('2d');
        if (metricsChartInstance) metricsChartInstance.destroy();
        
        metricsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Acurácia (%)',
                    data: acuracias,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#10B981',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        min: 0, 
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } else {
        histContainer.innerHTML = '<div class="loading-state">Sem histórico para exibir.</div>';
    }
}

document.getElementById('btn-predict').addEventListener('click', async () => {
    const el = document.getElementById('ml-result');
    el.innerHTML = '<span style="color: #3B82F6;">🔮 Analisando OSs Abertas...</span>';
    const res = await api('/api/ml/predict', { method: 'POST' });
    if (res && res.status === 'success') {
        el.innerHTML = `<span style="color: #10B981;">✅ Sucesso: ${res.predictions} novas predições geradas. O Dashboard UMB já foi atualizado com os novos riscos de falha!</span>`;
    } else {
        el.innerHTML = `<span style="color: #EF4444;">❌ Erro: ${res ? res.message : 'Falha na conexão'}</span>`;
    }
});

document.getElementById('btn-retrain').addEventListener('click', async () => {
    const el = document.getElementById('ml-result');
    const btn = document.getElementById('btn-retrain');
    btn.disabled = true;
    
    // Inicia a barra de progresso no HTML
    el.innerHTML = `
        <div style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span id="ml-progress-text" style="font-size: 0.85rem; color: #3B82F6; font-weight: 600;">Inicializando Motor de IA...</span>
                <span id="ml-progress-percent" style="font-size: 0.85rem; color: #F59E0B; font-weight: bold;">0%</span>
            </div>
            <div style="width: 100%; background-color: rgba(255,255,255,0.1); border-radius: 10px; height: 10px; overflow: hidden;">
                <div id="ml-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3B82F6, #10B981); transition: width 0.4s ease;"></div>
            </div>
        </div>
    `;
    
    // Dispara a requisição de Treinamento
    const res = await api('/api/ml/train', { method: 'POST' });
    
    if (!res || res.status !== 'processing') {
        el.innerHTML = `<span style="color: #EF4444;">❌ Erro ao iniciar: ${res ? res.message : 'Timeout ou Motor Inacessível'}</span>`;
        btn.disabled = false;
        return;
    }

    // Short Polling: Consulta o progresso a cada 1.5 segundos
    const pollInterval = setInterval(async () => {
        const progressData = await api('/api/ml/progress');
        
        if (progressData) {
            const bar = document.getElementById('ml-progress-bar');
            const txt = document.getElementById('ml-progress-text');
            const pct = document.getElementById('ml-progress-percent');
            
            if (bar && txt && pct) {
                bar.style.width = `${progressData.progress}%`;
                pct.textContent = `${progressData.progress}%`;
                txt.textContent = progressData.step;
            }

            // Tratamento de Erro Crítico durante o treino
            if (progressData.error) {
                clearInterval(pollInterval);
                el.innerHTML = `<span style="color: #EF4444;">❌ Falha Crítica no Treinamento: ${progressData.error}</span>`;
                btn.disabled = false;
                return;
            }

            // Se terminou o treinamento
            if (progressData.progress >= 100 || (!progressData.is_training && progressData.progress > 0)) {
                clearInterval(pollInterval);
                
                // Conclusão com sucesso
                setTimeout(() => {
                    el.innerHTML = `<span style="color: #10B981; font-weight: bold;">✅ ${progressData.step} O modelo já está em produção!</span>`;
                    // Atualiza a tela automaticamente sem precisar dar F5
                    loadMLMetrics(); 
                    btn.disabled = false;
                }, 1000); // 1 segundo de pausa visual em 100%
            }
        }
    }, 1500);
});

// Refresh
document.getElementById('btn-refresh').addEventListener('click', () => {
    loadAll();
});

function showPopAlert(status, motivoRaw) {
    const motivos = motivoRaw.split('|').map(m => m.trim()).filter(m => m.length > 0);
    const htmlContent = `
        <div style="text-align: left; font-size: 0.9rem; color: #4B5563;">
            <ul style="padding-left: 20px; list-style-type: disc;">
                ${motivos.map(m => `<li style="margin-bottom: 8px;">${m}</li>`).join('')}
            </ul>
        </div>
    `;

    let title, icon, color;
    if (status === true) {
        title = 'POP Atendido'; icon = 'success'; color = '#3B82F6';
    } else if (status === 'Parcial') {
        title = 'POP Parcialmente Atendido'; icon = 'info'; color = '#EAB308';
    } else {
        title = 'Falhas no POP'; icon = 'warning'; color = '#EF4444';
    }

    Swal.fire({
        title: title,
        html: htmlContent,
        icon: icon,
        confirmButtonColor: color,
        confirmButtonText: 'Fechar',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        customClass: {
            title: 'swal-title-custom',
            popup: 'swal-popup-custom'
        }
    });
}

// ==========================================
// RENDERING TABELA GERAL
// ==========================================
let currentTabelaPage = 1;
let currentTabelaSearch = '';
let searchDebounce = null;

async function loadTabelaGeral(page = 1) {
    currentTabelaPage = page;
    const anoEl = document.getElementById('tabela-filter-ano');
    const mesEl = document.getElementById('tabela-filter-mes');
    const situacaoEl = document.getElementById('tabela-filter-situacao');
    const detalhesEl = document.getElementById('tabela-filter-detalhes');
    const popEl = document.getElementById('tabela-filter-pop');

    const ano = anoEl ? anoEl.value : 'Todos';
    const mes = mesEl ? mesEl.value : 'Todos';
    const situacao = situacaoEl ? situacaoEl.value : 'Todos';
    const detalhes = detalhesEl ? detalhesEl.value : 'Todos';
    const popVal = popEl ? popEl.value : 'Todos';
    const search = currentTabelaSearch;

    const limit = 40; // Exibir 40 linhas na tabela para preencher a tela com mais organização
    const url = `/api/solicitacoes/tabela/listar?page=${page}&limit=${limit}&ano=${encodeURIComponent(ano)}&mes=${encodeURIComponent(mes)}&situacao=${encodeURIComponent(situacao)}&detalhes=${encodeURIComponent(detalhes)}&pop=${encodeURIComponent(popVal)}&q=${encodeURIComponent(search)}`;
    
    const res = await api(url);
    const tbody = document.getElementById('tabela-geral-rows');
    const info = document.getElementById('tabela-pagination-info');
    if (!tbody) return;

    if (!res || !res.data || res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhuma solicitação encontrada.</td></tr>';
        if (info) info.textContent = 'Página 1 de 1 (0 registros)';
        return;
    }

    let html = '';
    res.data.forEach(r => {
        const sit = r.situacao || 'Aberta';
        const isConcluida = sit.toLowerCase().includes('conclu');
        const sitStyle = isConcluida 
            ? 'color: #10B981; font-weight: 600;' 
            : 'color: #F59E0B; font-weight: 600;';
            
        let popBadge = '<span style="color: var(--text-muted); font-size: 0.85rem;">--</span>';
        if (sit.includes('Não Executada')) {
            popBadge = '<span style="color: var(--text-muted); font-size: 0.85rem;">N/A</span>';
        } else if (r.atende_pop === 'Sim') {
            popBadge = `<button onclick="showPopAlert(true, \`${(r.pop_motivo || '').replace(/`/g, "'")}\`)" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; width: 100%;">Sim</button>`;
        } else if (r.atende_pop === 'Parcial') {
            popBadge = `<button onclick="showPopAlert('Parcial', \`${(r.pop_motivo || '').replace(/`/g, "'")}\`)" style="background: rgba(234, 179, 8, 0.15); color: #EAB308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; width: 100%;">Parcial</button>`;
        } else if (r.atende_pop === 'Não' || r.atende_pop === 'No') {
            popBadge = `<button onclick="showPopAlert(false, \`${(r.pop_motivo || '').replace(/`/g, "'")}\`)" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; width: 100%;">Não</button>`;
        }
        
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 10px; font-weight: 700; color: #3B82F6;">${r.ss || r.os_numero || '--'}</td>
                <td style="padding: 10px; font-family: monospace;">${r.matricula || '--'}</td>
                <td style="padding: 10px;">${r.servico || r.especificacao || '--'}</td>
                <td style="padding: 10px;">${r.bairro || '--'}</td>
                <td style="padding: 10px;">${r.logradouro || '--'}</td>
                <td style="padding: 10px; font-family: monospace; font-size: 0.8rem;">${r.data_ultima_tramitacao || r.data_encerramento || r.created_at || '--'}</td>
                <td style="padding: 10px; ${sitStyle}">${sit}</td>
                <td style="padding: 10px; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${(r.observacao || '').replace(/"/g, '&quot;')}">${r.observacao || '--'}</td>
                <td style="padding: 10px; text-align: center;">
                    ${r.tem_detalhes 
                        ? `<button onclick="showDetalhes('${r.os_numero || r.ss}')" style="background: #3B82F6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold;">Sim</button>` 
                        : `<span style="color: var(--text-muted); font-size: 0.85rem;">Não</span>`}
                </td>
                <td style="padding: 10px; text-align: center;">
                    ${popBadge}
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    if (info) {
        info.textContent = `Página ${res.page || 1} de ${res.totalPages || 1} (${(res.total || 0).toLocaleString('pt-BR')} solicitações)`;
    }
}

async function showDetalhes(osNumero) {
    document.getElementById('modal-os-numero').textContent = osNumero;
    const content = document.getElementById('modal-detalhes-content');
    content.innerHTML = '<div style="text-align: center; padding: 20px;">Carregando detalhes...</div>';
    document.getElementById('modal-detalhes').style.display = 'flex';
    
    try {
        const res = await api(`/api/solicitacoes/detalhes/${osNumero}`);
        if (!res || res.error) {
            content.innerHTML = `<div style="color: #EF4444; padding: 20px;">${res?.error || 'Erro ao carregar detalhes.'}</div>`;
            return;
        }
        
        const d = res.data;
        
        // Update header badge
        const badge = document.getElementById('modal-documentos-badge');
        const qtd = d.qtd_documentos || 0;
        if (badge) {
            if (qtd < 3) {
                badge.style.backgroundColor = 'var(--accent-red)';
                badge.style.color = '#fff';
                badge.innerHTML = `🔴 Documentos: ${qtd} / 15 (Insuficiente)`;
            } else {
                badge.style.backgroundColor = 'var(--bg-card-hover)';
                badge.style.color = 'var(--text-secondary)';
                badge.style.border = '1px solid var(--border-color)';
                badge.innerHTML = `📄 Documentos: ${qtd} / 15`;
            }
        }
        
        let html = `
            <div style="padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-bottom: 1px solid var(--border-color);">
                <!-- Coluna Esquerda -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Dados da Execução</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Equipe: <span style="font-weight:normal; color:var(--text-muted);">${d.equipe_executora || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Horas em Exec.: <span style="font-weight:normal; color:var(--text-muted);">${d.horas_execucao || '-'}</span></p>
                        </div>
                    </div>
                    
                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Dados do Imóvel</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Pavimentos: <span style="font-weight:normal; color:var(--text-muted);">${d.imovel_pavimentos || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Situação: <span style="font-weight:normal; color:var(--text-muted);">${d.imovel_situacao || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Res. Inferior: <span style="font-weight:normal; color:var(--text-muted);">${d.imovel_res_inf || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Res. Superior: <span style="font-weight:normal; color:var(--text-muted);">${d.imovel_res_sup || '-'}</span></p>
                        </div>
                    </div>

                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Dados do HD</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Número do HD: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_numero || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Leitura: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_leitura || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Pressão (mca): <span style="font-weight:normal; color:var(--text-muted);">${d.hd_pressao || '-'}</span></p>
                        </div>
                    </div>
                    
                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Dados da Ligação</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Cor do lacre: <span style="font-weight:normal; color:var(--text-muted);">${d.ligacao_lacre_cor || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Situação lig.: <span style="font-weight:normal; color:var(--text-muted);">${d.ligacao_situacao || '-'}</span></p>
                        </div>
                    </div>

                    ${(d.motivo_falta_dagua && d.motivo_falta_dagua.includes("Roubo")) ? `
                    <div style="margin-top: 8px; font-size: 0.7rem; font-weight: bold; color: #ef4444; display: flex; align-items: center; gap: 4px; background: rgba(239, 68, 68, 0.05); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        Alerta: Roubo/furto de hidrômetro
                    </div>
                    ` : ''}
                </div>

                <!-- Coluna Direita -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Análise: Lado Direito</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Nº HD: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_direito || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Leitura: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_direito_leitura || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Pressão: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_direito_pressao || '-'}</span></p>
                        </div>
                    </div>
                    
                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Análise: Lado Esquerdo</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Nº HD: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_esquerdo || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Leitura: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_esquerdo_leitura || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Pressão: <span style="font-weight:normal; color:var(--text-muted);">${d.hd_lado_esquerdo_pressao || '-'}</span></p>
                        </div>
                    </div>

                    <div>
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px;">Dados Complementares</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Abast. após exec: <span style="font-weight:normal; color:var(--text-muted);">${d.sit_abast_apos_exec || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Necessidade Desob: <span style="font-weight:normal; color:var(--text-muted);">${d.necessidade_desob_ramal || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Gerar desobstrução?: <span style="font-weight:normal; color:var(--text-muted);">${d.deseja_gerar_desobstrucao || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Motivo da falta: <span style="font-weight:normal; color:var(--text-muted);">${d.motivo_falta_dagua || '-'}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600;">Usuário presente?: <span style="font-weight:normal; color:var(--text-muted);">${d.usuario_presente || '-'}</span></p>
                        </div>
                    </div>

                    ${(d.sec_ss && d.sec_tipo) ? `
                    <div style="margin-top: 8px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 6px; padding: 10px;">
                        <p style="font-size: 0.65rem; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Serviço Secundário Gerado</p>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600; color: #1e3a8a;">SS: <span style="font-weight:normal; color:#1d4ed8;">${d.sec_ss}</span></p>
                            <p style="margin:0; display:flex; justify-content:space-between; font-weight:600; color: #1e3a8a;">Tipo: <span style="font-weight:normal; color:#1d4ed8;">${d.sec_tipo}</span></p>
                        </div>
                    </div>` : ''}
                    
                    <div style="padding-top: 8px;">
                        <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Material Utilizado</p>
                        <p style="margin:0; font-weight:normal; color:var(--text-muted); font-size: 0.75rem; background: var(--bg-card-hover); padding: 6px; border-radius: 4px;">${d.material_utilizado || "Nenhum material informado."}</p>
                    </div>
                </div>
            </div>
            
            <div style="padding: 12px 16px; background: var(--bg-card-hover);">
                <p style="font-size: 0.65rem; font-weight: bold; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px 0;">Observação do Encerramento</p>
                <p style="margin:0; font-weight:normal; color:var(--text-primary); font-size: 0.75rem; background: var(--bg-card); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; max-height: 80px; overflow-y: auto; white-space: pre-wrap;">${d.obs_encerramento || "Nenhuma observação detalhada."}</p>
            </div>
        `;
        content.innerHTML = html;
        if(lucide) lucide.createIcons();
    } catch (e) {
        content.innerHTML = `<div style="color: #EF4444; padding: 20px;">Falha de conexão ao buscar detalhes.</div>`;
    }
}

function changeTabelaPage(delta) {
    const newPage = Math.max(1, currentTabelaPage + delta);
    loadTabelaGeral(newPage);
}

function onTabelaSearchChange(e) {
    currentTabelaSearch = e.target.value;
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        loadTabelaGeral(1);
    }, 300);
}

// === Init ===
async function loadAll() {
    await checkHealth();
    loadKPIs();
    loadLogradourosCriticos();
    loadBairros();
    await fetchAndProcessTemporalData();
    loadAnalytics();
    loadMapaCalorSetor();
    loadMLEvents();
    loadTabelaGeral(1);
    loadWeatherAnalytics();
    loadImoveisSensiveis();
    loadDistributionGap();
    
    // Restaurar cache salvo da análise executiva e do motor NLP
    restoreSavedInsights();
    restoreSavedNLP();

    // Sincronizar e popular os KPIs de Visão Geral (2026) e o Gráfico de Evolução Operacional no startup
    await loadInsightsKPIs('2026');
    renderBIEvolucaoChart();

    // Registra os seletores de período da Análise Mensal
    const selectMes = document.getElementById('select-bi-mes');
    const selectAno = document.getElementById('select-bi-ano');
    if (selectMes && selectAno) {
        // Mês e ano corrente como padrão operacional (dinâmico)
        const now = new Date();
        selectMes.value = String(now.getMonth() + 1);
        selectAno.value = String(now.getFullYear());

        selectMes.addEventListener('change', updateMonthlyKPIsFromFilter);
        selectAno.addEventListener('change', updateMonthlyKPIsFromFilter);
    }
    
    // Inicializa a Análise Mensal com o período filtrado
    await updateMonthlyKPIsFromFilter();
    
    // Inicializar histórico de conversas do chat
    initConversations();
}

async function loadInsightsKPIs(ano = '2026') {
    const res = await api(`/api/analytics/kpis?ano=${ano}`);
    if (!res || !res.data) return;
    const d = res.data;
    
    const total = d.total_solicitacoes || 0;
    const resolv = d.total_resolvidas || 0;
    const nexec = d.total_nao_executadas || 0;
    const abert = d.total_abertas || 0;

    const execPct = total > 0 ? Math.round((resolv / total) * 100) : 0;
    const nexecPct = total > 0 ? Math.round((nexec / total) * 100) : 0;
    const pndPct = total > 0 ? (abert / total * 100).toFixed(1) : '0';

    animateValue('bi-kpi-total', total);
    animateValue('bi-kpi-exec', resolv);
    animateValue('bi-kpi-nexec', nexec);
    animateValue('bi-kpi-pend', abert);

    const execPctEl = document.getElementById('bi-kpi-exec-pct');
    if (execPctEl) execPctEl.textContent = execPct + '% de execução';
    
    const nexecPctEl = document.getElementById('bi-kpi-nexec-pct');
    if (nexecPctEl) nexecPctEl.textContent = nexecPct + '% da operação';

    const pendPctEl = document.getElementById('bi-kpi-pend-pct');
    if (pendPctEl) pendPctEl.textContent = pndPct + '% da base atual';

    const barExecEl = document.getElementById('bi-bar-exec');
    if (barExecEl) barExecEl.style.width = execPct + '%';

    const barNExecEl = document.getElementById('bi-bar-nexec');
    if (barNExecEl) barNExecEl.style.width = nexecPct + '%';
}

function renderBIEvolucaoChart() {
    const ctx = document.getElementById('canvas-bi-evolucao');
    if (ctx && globalTemporalData && globalTemporalData.length > 0) {
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const data2026 = globalTemporalData.filter(d => d.ano == 2026);
        let totalVals = new Array(12).fill(null);
        data2026.forEach(d => {
            if (d.mes_numero >= 1 && d.mes_numero <= 12) {
                totalVals[d.mes_numero - 1] = d.total_solicitacoes;
            }
        });
        
        if (biEvolucaoChart) biEvolucaoChart.destroy();
        biEvolucaoChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Total OSs 2026',
                        data: totalVals,
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.06)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.35,
                        pointStyle: 'circle',
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#3B82F6'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeInOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        grid: { borderDash: [5, 5], color: 'rgba(0,0,0,0.05)' },
                        ticks: { color: 'var(--text-muted)', font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'var(--text-muted)', font: { size: 10 } }
                    }
                }
            }
        });
    }
}

async function loadMonthlyKPIs(ano, mes) {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const labelMes = monthNames[parseInt(mes) - 1] + '/' + ano;
    const labelEl = document.getElementById('bi-mes-label');
    if (labelEl) labelEl.textContent = labelMes;

    const res = await api(`/api/analytics/kpis?ano=${ano}&mes=${mes}`);
    if (res && res.data) {
        const d = res.data;
        const total = d.total_solicitacoes || 0;
        const resolv = d.total_resolvidas || 0;
        const nexec = d.total_nao_executadas || 0;
        const abert = d.total_abertas || 0;

        const execPct = total > 0 ? Math.round((resolv / total) * 100) : 0;
        const nexecPct = total > 0 ? Math.round((nexec / total) * 100) : 0;

        animateValue('bi-mes-total', total);
        animateValue('bi-mes-exec', resolv);
        animateValue('bi-mes-nexec', nexec);
        animateValue('bi-mes-pend', abert);

        setTimeout(() => {
            const barExecEl = document.getElementById('bi-mes-bar-exec');
            const barNExecEl = document.getElementById('bi-mes-bar-nexec');
            if (barExecEl) barExecEl.style.width = execPct + '%';
            if (barNExecEl) barNExecEl.style.width = nexecPct + '%';
        }, 100);
    }
}

async function updateMonthlyKPIsFromFilter() {
    const selectMes = document.getElementById('select-bi-mes');
    const selectAno = document.getElementById('select-bi-ano');
    if (selectMes && selectAno) {
        const mes = selectMes.value;
        const ano = selectAno.value;
        await loadMonthlyKPIs(ano, mes);
    }
}

// ============================================================
// 1. WEATHER ANALYTICS & PREVISÃO DE DEMANDA CLIMÁTICA
// ============================================================
let climaChartInstance = null;

async function loadWeatherAnalytics(ano = '2026') {
    const curAno = (ano === 'Todos') ? '2026' : ano;
    const res = await api(`/api/analytics/weather?ano=${encodeURIComponent(curAno)}`);
    if (!res) return;

    // 1. Preencher Forecast Bar (7 Dias)
    const forecastGrid = document.getElementById('weather-forecast-grid');
    if (forecastGrid && res.forecast_days) {
        forecastGrid.innerHTML = res.forecast_days.map(d => {
            const heatBadge = d.alerta_calor ? `<span style="background: #FEE2E2; color: #DC2626; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">🔥 Calor</span>` : '';
            const rainBadge = d.alerta_chuva ? `<span style="background: #DBEAFE; color: #1D4ED8; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">🌧️ Chuva</span>` : '';
            
            return `
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 110px;">
                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-color);">${d.label}</div>
                    <div style="margin: 4px 0; color: #F59E0B;">
                        <i data-lucide="${d.icone}" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: baseline; font-size: 0.82rem;">
                        <span style="font-weight: 800; color: #EF4444;">${d.temp_max}°</span>
                        <span style="font-weight: 500; color: var(--text-muted); font-size: 0.75rem;">${d.temp_min}°</span>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                        💧 ${d.chuva_mm}mm (${d.prob_chuva}%)
                    </div>
                    ${heatBadge}
                    ${rainBadge}
                </div>
            `;
        }).join('');
    }

    // 2. Preencher Parecer Preditivo IA
    const aiText = document.getElementById('weather-ai-text');
    if (aiText && res.narrativa_ia) {
        aiText.innerHTML = res.narrativa_ia;
    }

    // 3. Renderizar Gráfico de Correlação Clima vs Demandas
    const ctx = document.getElementById('chart-clima-correlacao');
    if (ctx && res.historico_clima_demanda) {
        if (climaChartInstance) climaChartInstance.destroy();

        const monthsDemand = [0,0,0,0,0,0,0,0,0,0,0,0];
        if (typeof globalTemporalData !== 'undefined' && globalTemporalData) {
            globalTemporalData.filter(d => d.ano.toString() === curAno).forEach(d => {
                if (d.mes_numero >= 1 && d.mes_numero <= 12) {
                    monthsDemand[d.mes_numero - 1] += d.total_solicitacoes;
                }
            });
        }

        const labels = res.historico_clima_demanda.map(d => d.mes);
        const temps = res.historico_clima_demanda.map(d => d.temp_media);

        climaChartInstance = new Chart(ctx, {
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Volume de OSs',
                        data: monthsDemand,
                        backgroundColor: 'rgba(59, 130, 246, 0.4)',
                        borderColor: '#3B82F6',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        yAxisID: 'yDemanda'
                    },
                    {
                        type: 'line',
                        label: 'Temp. Média (°C)',
                        data: temps,
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointBackgroundColor: '#F59E0B',
                        tension: 0.35,
                        yAxisID: 'yTemp'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                if (c.dataset.yAxisID === 'yTemp') return ` ${c.dataset.label}: ${c.raw}°C`;
                                return ` ${c.dataset.label}: ${c.raw.toLocaleString()} solicitações`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    yDemanda: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Demandas (OSs)', font: { size: 10 } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    yTemp: {
                        type: 'linear',
                        position: 'right',
                        min: 24,
                        max: 33,
                        title: { display: true, text: 'Temperatura (°C)', font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    if (window.lucide) lucide.createIcons();
}


// ============================================================
// 2. PRIORIZAÇÃO HUMANIZADA DE IMÓVEIS SENSÍVEIS
// ============================================================
let imoveisSensiveisCache = [];

async function loadImoveisSensiveis(ano) {
    const curAno = (ano !== undefined && ano !== null && ano !== '') ? ano : (globalYearFilter || '2026');
    const badgePeriodo = document.getElementById('badge-sensivel-periodo');
    if (badgePeriodo) {
        badgePeriodo.textContent = (curAno === 'Todos') ? '(Histórico Completo)' : `(Ano: ${curAno})`;
    }
    const res = await api(`/api/analytics/imoveis-sensiveis?ano=${encodeURIComponent(curAno)}`);
    if (!res) return;

    imoveisSensiveisCache = res.itens || [];

    const kpiSaude = document.getElementById('kpi-sensivel-saude');
    const kpiEduc = document.getElementById('kpi-sensivel-educ');
    const kpiSocial = document.getElementById('kpi-sensivel-social');
    const badgePipa = document.getElementById('badge-pipa-count');

    if (kpiSaude) kpiSaude.textContent = res.distribuicao_categoria?.['Saúde'] || 0;
    if (kpiEduc) kpiEduc.textContent = res.distribuicao_categoria?.['Educação'] || 0;
    if (kpiSocial) kpiSocial.textContent = res.distribuicao_categoria?.['Social / Idosos'] || 0;
    if (badgePipa) badgePipa.textContent = `🚨 ${res.sugestoes_pipa || 0} Carros Pipa Preventivos Sugeridos`;

    // Atualizar os contadores dinâmicos no filtro de status
    updateSensivelStatusOptions(imoveisSensiveisCache);

    const statusFilterEl = document.getElementById('filter-sensivel-status');
    const currentStatus = statusFilterEl ? statusFilterEl.value : 'Todos';
    renderImoveisSensiveisTable(currentStatus);
}

function updateSensivelStatusOptions(items) {
    const select = document.getElementById('filter-sensivel-status');
    if (!select) return;

    const currentVal = select.value || 'Todos';
    const total = items.length;
    let abertas = 0;
    let programadas = 0;
    let executadas = 0;
    let naoExecutadas = 0;

    items.forEach(it => {
        const s = (it.status || it.situacao || '').toUpperCase();
        if (s.includes('NÃO EXECUTAD') || s.includes('NAO EXECUTAD') || s.includes('CANCELAD')) {
            naoExecutadas++;
        } else if (s.includes('EXECUTAD')) {
            executadas++;
        } else if (s.includes('PROGRAMAD')) {
            programadas++;
        } else if (s.includes('ABERT') || s.includes('PENDENTE')) {
            abertas++;
        }
    });

    select.innerHTML = `
        <option value="Todos"${currentVal === 'Todos' ? ' selected' : ''}>Todos os Status (${total})</option>
        <option value="Aberta"${currentVal === 'Aberta' ? ' selected' : ''}>Aberta (${abertas})</option>
        <option value="Programada"${currentVal === 'Programada' ? ' selected' : ''}>Programada (${programadas})</option>
        <option value="Executada"${currentVal === 'Executada' ? ' selected' : ''}>Executada (${executadas})</option>
        <option value="Não Executada"${currentVal === 'Não Executada' ? ' selected' : ''}>Concluída Não Executada (${naoExecutadas})</option>
    `;
}

function filterImoveisSensiveisByStatus(statusVal) {
    renderImoveisSensiveisTable(statusVal);
}

function renderImoveisSensiveisTable(statusFilter = 'Todos') {
    const tbody = document.getElementById('tbody-imoveis-sensiveis');
    if (!tbody) return;

    let items = imoveisSensiveisCache;
    if (statusFilter && statusFilter !== 'Todos') {
        items = items.filter(it => {
            const s = (it.status || it.situacao || '').toUpperCase();
            if (statusFilter === 'Aberta') return s.includes('ABERT') || s.includes('PENDENTE');
            if (statusFilter === 'Programada') return s.includes('PROGRAMAD');
            if (statusFilter === 'Executada') return s.includes('EXECUTAD') && !s.includes('NÃO') && !s.includes('NAO');
            if (statusFilter === 'Não Executada') return s.includes('NÃO EXECUTAD') || s.includes('NAO EXECUTAD') || s.includes('CANCELAD');
            return true;
        });
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">Nenhum imóvel sensível encontrado com o status "<strong>${escapeHtml(statusFilter)}</strong>".</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const catBadge = `<span style="background: ${item.cor}18; color: ${item.cor}; border: 1px solid ${item.cor}40; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <i data-lucide="${item.icone}" style="width: 12px; height: 12px;"></i> ${item.categoria.split('(')[0].trim()}
        </span>`;

        let acaoColor = item.prioridade === 'Emergencial' ? '#DC2626' : (item.prioridade === 'Alta' ? '#D97706' : '#059669');
        let acaoBg = item.prioridade === 'Emergencial' ? '#FEE2E2' : (item.prioridade === 'Alta' ? '#FEF3C7' : '#D1FAE5');

        const acaoBadge = `<span style="background: ${acaoBg}; color: ${acaoColor}; font-weight: 700; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; display: inline-block; white-space: nowrap;">
            ${item.acao_recomendada}
        </span>`;

        // Badge estilizado e profissional para o Status da OS
        const s = (item.status || item.situacao || '').toUpperCase();
        let statusBadge = '';
        if (s.includes('NÃO EXECUTAD') || s.includes('NAO EXECUTAD')) {
            statusBadge = `<span style="background: #FEE2E2; color: #B91C1C; border: 1px solid #FECACA; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #DC2626; flex-shrink: 0;"></span> Não Executada</span>`;
        } else if (s.includes('EXECUTAD')) {
            statusBadge = `<span style="background: #D1FAE5; color: #047857; border: 1px solid #A7F3D0; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #059669; flex-shrink: 0;"></span> Executada</span>`;
        } else if (s.includes('PROGRAMAD')) {
            statusBadge = `<span style="background: #DBEAFE; color: #1D4ED8; border: 1px solid #BFDBFE; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #2563EB; flex-shrink: 0;"></span> Programada</span>`;
        } else if (s.includes('ABERT') || s.includes('PENDENTE')) {
            statusBadge = `<span style="background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #D97706; flex-shrink: 0;"></span> Aberta</span>`;
        } else if (s.includes('CANCELAD')) {
            statusBadge = `<span style="background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #94A3B8; flex-shrink: 0;"></span> Cancelada</span>`;
        } else {
            statusBadge = `<span style="background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; white-space: nowrap;">${item.status || item.situacao || 'Indefinido'}</span>`;
        }

        const dataStr = item.data_abertura || item.data_registro || '--';

        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 8px 12px; font-weight: 700; color: var(--text-color); white-space: nowrap;">
                    ${item.ss}
                    <div style="font-weight: 400; font-size: 0.72rem; color: var(--text-muted);">Matr: ${item.matricula}</div>
                </td>
                <td style="padding: 8px 12px; white-space: nowrap;">
                    <div style="font-weight: 600; font-size: 0.76rem; color: var(--text-color); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
                        <i data-lucide="calendar" style="width: 12px; height: 12px; color: var(--text-muted); vertical-align: middle; margin-right: 3px;"></i>
                        ${dataStr}
                    </div>
                </td>
                <td style="padding: 8px 12px; white-space: nowrap;">${statusBadge}</td>
                <td style="padding: 8px 12px; white-space: nowrap;">${catBadge}</td>
                <td style="padding: 8px 12px;">
                    <div style="font-weight: 600; color: var(--text-color);">${item.bairro}</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">${item.logradouro}</div>
                </td>
                <td style="padding: 8px 12px; white-space: nowrap;">${acaoBadge}</td>
                <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.75rem; max-width: 250px; white-space: normal;">
                    ${item.observacao || '--'}
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}


// ============================================================
// 3. HISTOGRAMA DE DENSIDADE (KDE) & DUMBBELL (GAP TEMPORAL)
// ============================================================
let histogramChartInstance = null;

async function loadDistributionGap(ano = '2026') {
    const curAno = (ano === 'Todos') ? '2026' : ano;
    const res = await api(`/api/analytics/distribution-gap?ano=${encodeURIComponent(curAno)}`);
    if (!res) return;

    // 1. Histograma de Densidade
    const ctxHist = document.getElementById('chart-histograma-densidade');
    if (ctxHist && res.histogram) {
        if (histogramChartInstance) histogramChartInstance.destroy();

        histogramChartInstance = new Chart(ctxHist, {
            data: {
                labels: res.histogram.labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Frequência (Dias)',
                        data: res.histogram.frequencia_dias,
                        backgroundColor: 'rgba(99, 102, 241, 0.45)',
                        borderColor: '#6366F1',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        yAxisID: 'yDias'
                    },
                    {
                        type: 'line',
                        label: 'Densidade Operacional (%)',
                        data: res.histogram.densidade_kde,
                        borderColor: '#4F46E5',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#4F46E5',
                        tension: 0.4,
                        yAxisID: 'yKde'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                if (c.dataset.yAxisID === 'yKde') return ` ${c.dataset.label}: ${c.raw}% dos dias`;
                                return ` ${c.dataset.label}: ${c.raw} dias com esse volume`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    yDias: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Dias no Ano', font: { size: 10 } },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    yKde: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Densidade (%)', font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });

        const insightBox = document.getElementById('histogram-insight-box');
        if (insightBox) {
            insightBox.innerHTML = `<strong>Volume Típico da Operação:</strong> Média diária de <strong>${res.histogram.media_diaria} OS/dia</strong>. A maior densidade concentra-se na faixa de 16 a 35 OSs/dia. Picos superiores a 60 OS/dia indicam contingência hídrica setorial.`;
        }
    }

    // 2. Gráfico Dumbbell (Variação Julho vs Agosto nos Top Bairros)
    const containerDumbbell = document.getElementById('container-dumbbell-chart');
    if (containerDumbbell && res.dumbbell) {
        if (res.dumbbell.length === 0) {
            containerDumbbell.innerHTML = '<div class="loading-state">Sem dados suficientes para cálculo do GAP.</div>';
            return;
        }

        const maxVal = Math.max(...res.dumbbell.map(d => Math.max(d.periodo_a, d.periodo_b)), 1);

        let html = `
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); padding-bottom: 8px; border-bottom: 1px solid var(--border-color); margin-bottom: 8px;">
                <span>Bairro</span>
                <span>Comparativo: 🔵 ${res.dumbbell[0].label_a} ➔ 🟠 ${res.dumbbell[0].label_b}</span>
                <span>GAP (%)</span>
            </div>
        `;

        html += res.dumbbell.map(item => {
            const posA = Math.round((item.periodo_a / maxVal) * 100);
            const posB = Math.round((item.periodo_b / maxVal) * 100);
            const minPos = Math.min(posA, posB);
            const maxPos = Math.max(posA, posB);
            const barWidth = Math.max(maxPos - minPos, 3);

            const isAumento = item.gap > 0;
            const badgeColor = isAumento ? '#DC2626' : (item.gap < 0 ? '#10B981' : '#64748B');
            const badgeBg = isAumento ? '#FEE2E2' : (item.gap < 0 ? '#D1FAE5' : '#F1F5F9');
            const sign = item.gap > 0 ? '+' : '';

            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.03); font-size: 0.78rem;">
                    <div style="width: 120px; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.bairro}">
                        ${item.bairro}
                    </div>

                    <!-- Dumbbell Track -->
                    <div style="flex: 1; margin: 0 16px; position: relative; height: 18px; display: flex; align-items: center;">
                        <div style="width: 100%; height: 2px; background: var(--border-color); position: absolute; left: 0;"></div>
                        <div style="position: absolute; left: ${minPos}%; width: ${barWidth}%; height: 3px; background: ${isAumento ? '#F97316' : '#10B981'}; border-radius: 2px;"></div>
                        <div style="position: absolute; left: calc(${posA}% - 6px); width: 12px; height: 12px; border-radius: 50%; background: #3B82F6; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); z-index: 2;" title="${item.label_a}: ${item.periodo_a}"></div>
                        <div style="position: absolute; left: calc(${posB}% - 6px); width: 12px; height: 12px; border-radius: 50%; background: ${isAumento ? '#EA580C' : '#10B981'}; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); z-index: 3;" title="${item.label_b}: ${item.periodo_b}"></div>
                    </div>

                    <!-- Badge do GAP -->
                    <div style="width: 85px; text-align: right;">
                        <span style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                            ${sign}${item.pct}% (${sign}${item.gap})
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        containerDumbbell.innerHTML = html;
    }
}


// ============================================================
// 4. MAPA DE CALOR (CALENDAR HEATMAP + MATRIZ DE CALOR)
// ============================================================
async function loadHeatmapsData() {
    const selectAno = document.getElementById('select-heatmap-ano');
    const ano = selectAno ? selectAno.value : '2026';

    // 1. Carregar Calendar Heatmap
    const resCal = await api(`/api/analytics/calendar-heatmap?ano=${encodeURIComponent(ano)}`);
    if (resCal) {
        document.getElementById('kpi-heat-total').textContent = (resCal.total_ano || 0).toLocaleString();
        document.getElementById('kpi-heat-media').textContent = (resCal.media_diaria || 0) + ' OS/dia';
        document.getElementById('kpi-heat-pico').textContent = `${resCal.pico_dia?.total || 0} (${resCal.pico_dia?.data || '--'})`;
        document.getElementById('kpi-heat-dias').textContent = (resCal.dias_com_dados || 0) + ' dias';

        renderCalendarHeatmap(resCal.days, resCal.ano);
    }

    // 2. Carregar Matriz de Calor
    const resMat = await api(`/api/analytics/matrix-heatmap?ano=${encodeURIComponent(ano)}`);
    if (resMat) {
        renderMatrixHeatmap(resMat);
    }
}

function renderCalendarHeatmap(days, ano) {
    const container = document.getElementById('calendar-heatmap-container');
    if (!container || !days || days.length === 0) return;

    const colors = ['#E2E8F0', '#FED7AA', '#FB923C', '#EA580C', '#9A3412'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const monthGroups = {};
    for (let m = 1; m <= 12; m++) monthGroups[m] = [];
    days.forEach(d => {
        if (monthGroups[d.month]) monthGroups[d.month].push(d);
    });

    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px;">
    `;

    for (let m = 1; m <= 12; m++) {
        const mDays = monthGroups[m] || [];
        const mTotal = mDays.reduce((acc, cur) => acc + cur.count, 0);

        html += `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-color);">${months[m - 1]}</span>
                    <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">${mTotal} OS</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px;">
        `;

        const firstDay = mDays[0] ? mDays[0].day_of_week : 0;
        for (let pad = 0; pad < firstDay; pad++) {
            html += `<div style="aspect-ratio: 1; background: transparent;"></div>`;
        }

        mDays.forEach(day => {
            const bg = colors[day.level] || colors[0];
            const textColor = day.level >= 3 ? '#FFFFFF' : '#334155';
            html += `
                <div 
                    title="${day.date}: ${day.count} solicitações"
                    style="aspect-ratio: 1; border-radius: 3px; background: ${bg}; display: flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 600; color: ${textColor}; cursor: pointer; transition: transform 0.1s;"
                    onmouseover="this.style.transform='scale(1.2)';"
                    onmouseout="this.style.transform='scale(1)';"
                >
                    ${day.day}
                </div>
            `;
        });

        html += `</div></div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function renderMatrixHeatmap(data) {
    const container = document.getElementById('matrix-heatmap-container');
    if (!container || !data || !data.matrix) return;

    const maxVal = data.max_valor || 1;
    const months = data.meses_nomes || ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
            <thead style="background: var(--bg-card); border-bottom: 2px solid var(--border-color);">
                <tr>
                    <th style="padding: 10px 14px; text-align: left; position: sticky; left: 0; background: var(--bg-card); z-index: 2; border-right: 1px solid var(--border-color);">Bairro (Top Volume)</th>
                    <th style="padding: 10px 8px; text-align: center; border-right: 1px solid var(--border-color);">Total</th>
                    ${months.map(m => `<th style="padding: 10px 6px; text-align: center; min-width: 48px;">${m}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    data.matrix.forEach(row => {
        html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 14px; font-weight: 700; color: var(--text-color); position: sticky; left: 0; background: var(--bg-card); z-index: 1; border-right: 1px solid var(--border-color); white-space: nowrap;">
                    ${row.bairro}
                </td>
                <td style="padding: 8px 8px; text-align: center; font-weight: 800; color: #EA580C; border-right: 1px solid var(--border-color); background: rgba(234, 88, 12, 0.04);">
                    ${row.total.toLocaleString()}
                </td>
        `;

        row.meses.forEach((val, idx) => {
            const intensity = val > 0 ? Math.max(0.06, (val / maxVal) * 0.95) : 0;
            const bg = val > 0 ? `rgba(234, 88, 12, ${intensity.toFixed(2)})` : 'transparent';
            const textColor = intensity > 0.5 ? '#FFFFFF' : (val > 0 ? '#9A3412' : 'var(--text-muted)');
            const fontWeight = val > 0 ? '700' : '400';

            html += `
                <td 
                    title="${row.bairro} - ${months[idx]}: ${val} solicitações"
                    style="padding: 8px 4px; text-align: center; background: ${bg}; color: ${textColor}; font-weight: ${fontWeight}; font-size: 0.78rem; transition: filter 0.15s;"
                    onmouseover="this.style.filter='brightness(0.9)';"
                    onmouseout="this.style.filter='none';"
                >
                    ${val > 0 ? val : '-'}
                </td>
            `;
        });

        html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

loadAll();

/* ==========================================================================
   LOGS RUM — CENTRAL DE OPERAÇÕES E TELEMETRIA DE EXTRAÇÃO
   ========================================================================== */
let rumSseSource = null;
let rumAutoscroll = true;
let rumJobRunning = false;
let rumTimerInterval = null;
let rumStartTime = null;
let rumSelectedPeriod = 2; // 2, 3, 7 or 'custom'

function initLogsRum() {
    if (window.lucide) lucide.createIcons();
    setupRumPeriodDates();
    connectRumSse();
    loadRumStatus();
    loadRumHistory();
}

function setupRumPeriodDates() {
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const dtIniEl = document.getElementById('rum-dt-inicio');
    const dtFimEl = document.getElementById('rum-dt-fim');
    if (dtIniEl && dtFimEl && (!dtIniEl.value || !dtFimEl.value)) {
        dtIniEl.value = fmt(ontem);
        dtFimEl.value = fmt(hoje);
    }
}

function setRumPeriod(period, btn) {
    rumSelectedPeriod = period;
    document.querySelectorAll('.rum-period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const customInputs = document.getElementById('rum-custom-dates');
    const dtIniEl = document.getElementById('rum-dt-inicio');
    const dtFimEl = document.getElementById('rum-dt-fim');

    const hoje = new Date();
    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (period === 'custom') {
        if (customInputs) customInputs.style.display = 'flex';
    } else {
        if (customInputs) customInputs.style.display = 'none';
        const days = parseInt(period, 10);
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - (days - 1));
        if (dtIniEl) dtIniEl.value = fmt(inicio);
        if (dtFimEl) dtFimEl.value = fmt(hoje);
    }
}

function connectRumSse() {
    if (rumSseSource) return; // já conectado

    try {
        rumSseSource = new EventSource('/api/extraction/stream');

        rumSseSource.onopen = () => {
            const dot = document.getElementById('rum-terminal-dot');
            if (dot) dot.style.background = '#10B981';
        };

        rumSseSource.onmessage = (event) => {
            if (!event.data || event.data.trim() === ': keepalive') return;
            try {
                const data = JSON.parse(event.data);
                handleRumEvent(data);
            } catch (err) {
                console.error('[RUM SSE Parse Error]', err);
            }
        };

        rumSseSource.onerror = () => {
            const dot = document.getElementById('rum-terminal-dot');
            if (dot) dot.style.background = '#EF4444';
            if (rumSseSource) {
                rumSseSource.close();
                rumSseSource = null;
            }
            setTimeout(connectRumSse, 4000);
        };
    } catch (e) {
        console.error('[RUM SSE Connection Error]', e);
    }
}

function handleRumEvent(event) {
    if (!event || !event.type) return;

    switch (event.type) {
        case 'initial_state':
            if (event.status) applyRumStatus(event.status);
            break;

        case 'log':
            appendRumLogLine(event);
            break;

        case 'progress':
            if (event.job) updateRumProgressUI(event.job);
            break;

        case 'job_started':
            setRumRunningState(true, event.job);
            break;

        case 'job_cancelling':
            const statusText = document.getElementById('rum-live-status-text');
            if (statusText) statusText.textContent = 'Cancelamento em andamento...';
            const stageEl = document.getElementById('rum-current-stage');
            if (stageEl) stageEl.textContent = 'Interrupção solicitada. Finalizando...';
            break;

        case 'job_finished':
            setRumRunningState(false, event.job);
            if (event.db_impact) renderRumDbImpact(event.db_impact);
            loadRumHistory();
            loadRumStatus();
            break;

        case 'scheduler_updated':
            if (event.scheduler) applyRumScheduler(event.scheduler);
            break;
    }
}

function appendRumLogLine(logEntry) {
    const terminal = document.getElementById('rum-terminal-body');
    if (!terminal) return;

    const line = document.createElement('div');
    line.className = 'rum-log-line';

    const level = (logEntry.level || 'info').toLowerCase();
    line.innerHTML = `
        <span class="rum-log-ts">[${logEntry.timestamp || '00:00:00'}]</span>
        <span class="rum-log-level ${level}">[${level.toUpperCase()}]</span>
        <span class="rum-log-msg ${level}">${escapeHtml(logEntry.message || '')}</span>
    `;

    terminal.appendChild(line);

    // Manter limite de linhas no DOM
    if (terminal.children.length > 1000) {
        terminal.removeChild(terminal.firstElementChild);
    }

    if (rumAutoscroll) {
        terminal.scrollTop = terminal.scrollHeight;
    }
}

function updateRumProgressUI(job) {
    if (!job) return;

    const bar = document.getElementById('rum-progress-bar');
    const pct = document.getElementById('rum-progress-pct');
    const stage = document.getElementById('rum-current-stage');

    const p = Math.min(100, Math.max(0, job.progresso_pct || 0));
    if (bar) bar.style.width = `${p}%`;
    if (pct) pct.textContent = `${p}%`;
    if (stage && job.stage) stage.textContent = job.stage;

    // Atualizar métricas
    const mFound = document.getElementById('rum-m-found');
    const mProc = document.getElementById('rum-m-processed');
    const mNew = document.getElementById('rum-m-new');
    const mUpd = document.getElementById('rum-m-updated');
    const mErr = document.getElementById('rum-m-errors');

    if (mFound) mFound.textContent = job.records_found || 0;
    if (mProc) mProc.textContent = job.records_processed || 0;
    if (mNew) mNew.textContent = job.records_new || 0;
    if (mUpd) mUpd.textContent = job.records_updated || 0;
    if (mErr) mErr.textContent = job.records_errors || 0;
}

function setRumRunningState(isRunning, job) {
    rumJobRunning = isRunning;
    const ind = document.getElementById('rum-status-indicator');
    const statusText = document.getElementById('rum-live-status-text');
    const btnCancel = document.getElementById('btn-cancel-job');
    const opButtons = document.querySelectorAll('.rum-btn-action');

    if (isRunning) {
        if (ind) ind.style.background = '#3B82F6';
        if (statusText) statusText.textContent = `Executando: ${job?.routine_name || 'Extração ativa'}`;
        if (btnCancel) btnCancel.disabled = false;
        opButtons.forEach(b => {
            if (b.id !== 'btn-toggle-scheduler') b.disabled = true;
        });

        startRumTimer();
        updateRumProgressUI(job);
    } else {
        stopRumTimer();
        const isSuccess = job?.status === 'success';
        const isCancelled = job?.status === 'cancelled';

        if (ind) ind.style.background = isSuccess ? '#10B981' : (isCancelled ? '#F59E0B' : '#EF4444');
        if (statusText) {
            statusText.textContent = isSuccess ? 'Concluído com Sucesso' : (isCancelled ? 'Cancelado pelo Operador' : 'Erro na Execução');
        }
        if (btnCancel) btnCancel.disabled = true;
        opButtons.forEach(b => b.disabled = false);
        updateRumProgressUI(job);
    }
}

function startRumTimer() {
    rumStartTime = Date.now();
    if (rumTimerInterval) clearInterval(rumTimerInterval);

    rumTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - rumStartTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        const el = document.getElementById('rum-timer-text');
        if (el) el.textContent = `Tempo Decorrido: ${m}:${s}`;
    }, 1000);
}

function stopRumTimer() {
    if (rumTimerInterval) {
        clearInterval(rumTimerInterval);
        rumTimerInterval = null;
    }
}

async function loadRumStatus() {
    try {
        const res = await fetch('/api/extraction/status');
        if (!res.ok) return;
        const data = await res.json();
        applyRumStatus(data);
    } catch (err) {
        console.error('[loadRumStatus Error]', err);
    }
}

function applyRumStatus(status) {
    if (!status) return;

    if (status.is_running && status.active_job) {
        setRumRunningState(true, status.active_job);
    } else if (status.active_job) {
        setRumRunningState(false, status.active_job);
    }

    // Preencher logs recentes se o terminal estiver vazio
    const terminal = document.getElementById('rum-terminal-body');
    if (terminal && terminal.children.length <= 1 && status.recent_logs && status.recent_logs.length) {
        terminal.innerHTML = '';
        status.recent_logs.forEach(l => appendRumLogLine(l));
    }

    if (status.scheduler) applyRumScheduler(status.scheduler);
    if (status.db_snapshot) renderRumDbSnapshot(status.db_snapshot);
}

function applyRumScheduler(sched) {
    if (!sched) return;

    const badge = document.getElementById('rum-scheduler-status-badge');
    const nextEl = document.getElementById('rum-sched-next');
    const btn = document.getElementById('btn-toggle-scheduler-text');
    const intervalSelect = document.getElementById('rum-sched-interval');
    const routineSelect = document.getElementById('rum-sched-routine');

    if (intervalSelect && sched.interval_minutes) intervalSelect.value = String(sched.interval_minutes);
    if (routineSelect && sched.routine) routineSelect.value = sched.routine;

    if (sched.enabled) {
        if (badge) {
            badge.className = 'rum-history-status success';
            badge.textContent = `Ativo (${sched.interval_minutes}m)`;
        }
        if (btn) btn.textContent = 'Pausar Agendador';

        if (nextEl) {
            if (sched.next_run) {
                const d = new Date(sched.next_run);
                nextEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            } else {
                nextEl.textContent = 'Programado';
            }
        }
    } else {
        if (badge) {
            badge.className = 'rum-history-status';
            badge.style.background = 'rgba(100,116,139,0.15)';
            badge.style.color = '#64748B';
            badge.textContent = 'Pausado';
        }
        if (btn) btn.textContent = 'Ativar Agendador';
        if (nextEl) nextEl.textContent = 'Não agendado';
    }
}

function renderRumDbSnapshot(snapshot) {
    if (!snapshot) return;

    // Gestão UMB
    const tbodyG = document.getElementById('rum-db-gestao-tbody');
    if (tbodyG && snapshot.gestao) {
        const tablesG = [
            { key: 'faltadagua_ex', label: "Falta d'Água Executadas" },
            { key: 'detalhes_os', label: 'Detalhes das OSs (detalhes_os)' },
            { key: 'faltadagua', label: "Falta d'Água Pendentes" },
            { key: 'vazamentos', label: 'Vazamentos' },
            { key: 'pavimentos', label: 'Pavimentos' },
            { key: 'carropipa', label: 'Carro Pipa' },
            { key: 'ai_insights_faltadagua', label: 'Insights Preditivos IA' },
        ];

        tbodyG.innerHTML = tablesG.map(t => {
            const count = snapshot.gestao[t.key] ?? '-';
            return `
            <tr>
                <td style="font-weight: 600;">${t.label}</td>
                <td style="text-align: right; color: var(--text-muted);">-</td>
                <td style="text-align: right; font-weight: 700;">${count.toLocaleString('pt-BR')}</td>
                <td style="text-align: right;"><span class="rum-delta-badge zero">Base</span></td>
            </tr>
        `;
        }).join('');
    }

    // SaneaIA
    const tbodyS = document.getElementById('rum-db-saneaia-tbody');
    if (tbodyS && snapshot.saneaia) {
        const tablesS = [
            { key: 'solicitacoes', label: 'Solicitações Históricas (solicitacoes)' },
            { key: 'detalhes_os', label: 'Detalhes Técnicos' },
            { key: 'conversations', label: 'Conversas Chat IA' },
            { key: 'messages', label: 'Mensagens Chat IA' },
        ];

        tbodyS.innerHTML = tablesS.map(t => {
            const count = snapshot.saneaia[t.key] ?? '-';
            return `
            <tr>
                <td style="font-weight: 600;">${t.label}</td>
                <td style="text-align: right; color: var(--text-muted);">-</td>
                <td style="text-align: right; font-weight: 700;">${count.toLocaleString('pt-BR')}</td>
                <td style="text-align: right;"><span class="rum-delta-badge zero">Base</span></td>
            </tr>
        `;
        }).join('');
    }
}

function renderRumDbImpact(impact) {
    if (!impact) return;

    const renderTbody = (tbodyId, dbKey, labels) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody || !impact[dbKey]) return;

        tbody.innerHTML = labels.map(t => {
            const data = impact[dbKey][t.key] || { antes: '-', depois: '-', delta: 0 };
            const delta = data.delta || 0;
            const deltaHtml = delta > 0 
                ? `<span class="rum-delta-badge pos">+${delta.toLocaleString('pt-BR')}</span>` 
                : `<span class="rum-delta-badge zero">0</span>`;

            return `
            <tr>
                <td style="font-weight: 600;">${t.label}</td>
                <td style="text-align: right; color: var(--text-muted);">${data.antes?.toLocaleString('pt-BR') ?? '-'}</td>
                <td style="text-align: right; font-weight: 700;">${data.depois?.toLocaleString('pt-BR') ?? '-'}</td>
                <td style="text-align: right;">${deltaHtml}</td>
            </tr>
        `;
        }).join('');
    };

    renderTbody('rum-db-gestao-tbody', 'gestao', [
        { key: 'faltadagua_ex', label: "Falta d'Água Executadas" },
        { key: 'detalhes_os', label: 'Detalhes das OSs (detalhes_os)' },
        { key: 'faltadagua', label: "Falta d'Água Pendentes" },
        { key: 'vazamentos', label: 'Vazamentos' },
        { key: 'pavimentos', label: 'Pavimentos' },
        { key: 'carropipa', label: 'Carro Pipa' },
        { key: 'ai_insights_faltadagua', label: 'Insights Preditivos IA' },
    ]);

    renderTbody('rum-db-saneaia-tbody', 'saneaia', [
        { key: 'solicitacoes', label: 'Solicitações Históricas' },
        { key: 'detalhes_os', label: 'Detalhes Técnicos' },
    ]);
}

async function triggerRumAction(routine) {
    if (rumJobRunning) {
        if (window.Swal) {
            Swal.fire({
                icon: 'warning',
                title: 'Operação em Andamento',
                text: 'Aguarde a conclusão da rotina ativa ou cancele-a antes de iniciar outra.',
                confirmButtonColor: '#2563EB'
            });
        } else {
            alert('Aguarde a conclusão da rotina ativa ou cancele-a antes de iniciar outra.');
        }
        return;
    }

    const dtIni = document.getElementById('rum-dt-inicio')?.value;
    const dtFim = document.getElementById('rum-dt-fim')?.value;
    const headless = document.getElementById('rum-headless-check')?.checked ?? true;

    try {
        const res = await fetch('/api/extraction/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                routine: routine,
                dt_inicio: dtIni,
                dt_fim: dtFim,
                headless: headless
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Falha ao iniciar extração');
        }

        setRumRunningState(true, data.job);
    } catch (err) {
        console.error('[triggerRumAction Error]', err);
        if (window.Swal) {
            Swal.fire({
                icon: 'error',
                title: 'Erro ao Iniciar',
                text: err.message,
                confirmButtonColor: '#EF4444'
            });
        } else {
            alert(`Erro: ${err.message}`);
        }
    }
}

async function cancelRumJob() {
    if (!rumJobRunning) return;

    const proceed = confirm('Tem certeza que deseja cancelar imediatamente a extração em execução?');
    if (!proceed) return;

    try {
        const res = await fetch('/api/extraction/stop', { method: 'POST' });
        const data = await res.json();
        const statusText = document.getElementById('rum-live-status-text');
        if (statusText) statusText.textContent = 'Cancelamento solicitado...';
    } catch (err) {
        console.error('[cancelRumJob Error]', err);
    }
}

function copyRumLogs() {
    const terminal = document.getElementById('rum-terminal-body');
    if (!terminal) return;
    const text = terminal.innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Logs copiados para a área de transferência!');
    }).catch(err => {
        console.error(err);
    });
}

function clearRumLogs() {
    const terminal = document.getElementById('rum-terminal-body');
    if (terminal) terminal.innerHTML = '';
}

function toggleRumAutoscroll() {
    rumAutoscroll = !rumAutoscroll;
    const btn = document.getElementById('btn-autoscroll-toggle');
    if (btn) {
        btn.innerHTML = `<i data-lucide="arrow-down-circle" style="width: 13px; height: 13px;"></i> Auto-Scroll: ${rumAutoscroll ? 'ON' : 'OFF'}`;
        if (window.lucide) lucide.createIcons();
    }
}

async function toggleRumScheduler() {
    const currentBadge = document.getElementById('rum-scheduler-status-badge');
    const isCurrentlyActive = currentBadge?.textContent?.includes('Ativo');
    const newEnabled = !isCurrentlyActive;

    const interval = parseInt(document.getElementById('rum-sched-interval')?.value || '60', 10);
    const routine = document.getElementById('rum-sched-routine')?.value || 'ciclo_completo';

    try {
        const res = await fetch('/api/extraction/scheduler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: newEnabled,
                interval_minutes: interval,
                routine: routine
            })
        });

        const data = await res.json();
        if (data.scheduler) applyRumScheduler(data.scheduler);
    } catch (err) {
        console.error('[toggleRumScheduler Error]', err);
    }
}

async function loadRumHistory() {
    const tbody = document.getElementById('rum-history-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/extraction/history?limit=30');
        if (!res.ok) return;
        const data = await res.json();
        const list = data.history || [];

        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 14px;">Nenhuma execução registrada no histórico.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(item => {
            const statusClass = item.status || 'info';
            const statusLabel = item.status === 'success' ? 'Sucesso' : (item.status === 'cancelled' ? 'Cancelado' : (item.status === 'running' ? 'Rodando' : 'Erro'));
            const novos = item.records_new || 0;
            const dur = item.duration_seconds ? `${item.duration_seconds}s` : '-';

            return `
            <tr>
                <td style="font-family: ui-monospace, monospace; font-size: 0.78rem;">${item.start_time || '-'}</td>
                <td style="font-weight: 600;">${item.routine_name || item.routine}</td>
                <td style="color: var(--text-muted); font-size: 0.76rem;">${item.periodo || '-'}</td>
                <td style="font-family: ui-monospace, monospace;">${dur}</td>
                <td><span class="rum-history-status ${statusClass}">${statusLabel}</span></td>
                <td style="font-weight: 700; color: ${novos > 0 ? '#059669' : 'inherit'}; font-family: ui-monospace, monospace;">+${novos}</td>
                <td style="text-align: right;">
                    <button type="button" class="btn-secondary" onclick="openRumModal(${item.id})" style="padding: 3px 8px; font-size: 0.74rem;">
                        Ver Logs
                    </button>
                </td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        console.error('[loadRumHistory Error]', err);
    }
}

async function openRumModal(historyId) {
    const modal = document.getElementById('rum-history-modal');
    const title = document.getElementById('rum-modal-title');
    const body = document.getElementById('rum-modal-body');

    if (!modal || !body) return;

    if (title) title.textContent = `Logs da Execução #${historyId}`;
    body.textContent = 'Carregando logs da execução...';
    modal.classList.add('active');

    try {
        const res = await fetch(`/api/extraction/history/${historyId}/logs`);
        const data = await res.json();
        body.textContent = data.logs || 'Nenhum log encontrado para esta execução.';
    } catch (err) {
        body.textContent = `Erro ao carregar logs: ${err.message}`;
    }
}

function closeRumModal(e) {
    const modal = document.getElementById('rum-history-modal');
    if (modal) modal.classList.remove('active');
}

function copyRumModalLogs() {
    const body = document.getElementById('rum-modal-body');
    if (!body) return;
    navigator.clipboard.writeText(body.innerText).then(() => {
        alert('Logs copiados!');
    }).catch(e => console.error(e));
}


