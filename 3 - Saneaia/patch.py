import os

base_dir = r'C:\Users\t034183\Desktop\UMBMAS\3 - Saneaia'

# 1. API - append to solicitacoes.py
api_file = os.path.join(base_dir, 'api', 'routes', 'solicitacoes.py')
with open(api_file, 'a', encoding='utf-8') as f:
    f.write('''

@router.get("/graph/neural")
def get_neural_graph(ano: Optional[str] = None):
    import sqlite3, os
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "database", "saneaia.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    where_clause = "1=1"
    params = []
    if ano and ano != "Todos":
        where_clause += " AND data_ultima_tramitacao LIKE ?"
        params.append(f"%{ano}%")

    # 1. Top 15 bairros
    cursor.execute(f"""
        SELECT bairro, COUNT(*) as count 
        FROM solicitacoes_analise 
        WHERE {where_clause} AND bairro IS NOT NULL AND bairro != ''
        GROUP BY bairro 
        ORDER BY count DESC 
        LIMIT 15
    """, params)
    bairros_data = cursor.fetchall()
    
    nodes = []
    links = []
    bairros_set = set()
    bairros_counts = {}
    
    for r in bairros_data:
        b_name = r[0]
        count = r[1]
        bairros_set.add(b_name)
        bairros_counts[b_name] = count
        nodes.append({"id": f"bairro_{b_name}", "name": b_name, "type": "bairro", "val": count, "count": count, "group": 1})

    # 2. Top 5 logradouros for each bairro
    logradouros_set = set()
    logradouros_bairro = {}
    
    for b_name in bairros_set:
        cursor.execute(f"""
            SELECT logradouro, COUNT(*) as count 
            FROM solicitacoes_analise 
            WHERE {where_clause} AND bairro = ? AND logradouro IS NOT NULL AND logradouro != ''
            GROUP BY logradouro 
            ORDER BY count DESC 
            LIMIT 5
        """, params + [b_name])
        for r in cursor.fetchall():
            logr = r[0]
            count = r[1]
            log_id = f"log_{logr}"
            if log_id not in logradouros_set:
                logradouros_set.add(log_id)
                logradouros_bairro[logr] = b_name
                nodes.append({"id": log_id, "name": logr, "type": "logradouro", "val": count, "count": count, "bairro": b_name, "group": 2})
                links.append({"source": f"bairro_{b_name}", "target": log_id, "value": count, "type": "bairro_log"})

    # 3. Top 30 matriculas (reincidentes)
    cursor.execute(f"""
        SELECT matricula, logradouro, COUNT(*) as count 
        FROM solicitacoes_analise 
        WHERE {where_clause} AND matricula IS NOT NULL AND matricula != ''
        GROUP BY matricula, logradouro 
        HAVING count > 2
        ORDER BY count DESC 
        LIMIT 30
    """, params)
    matriculas_data = cursor.fetchall()
    matricula_ids = set()
    
    for r in matriculas_data:
        mat = r[0]
        logr = r[1]
        count = r[2]
        mat_id = f"mat_{mat}"
        if mat_id not in matricula_ids:
            matricula_ids.add(mat_id)
            nodes.append({"id": mat_id, "name": f"Mat. {mat}", "type": "matricula", "val": count, "count": count, "group": 3})
            log_id = f"log_{logr}"
            if log_id in logradouros_set:
                links.append({"source": log_id, "target": mat_id, "value": count, "type": "log_mat"})

    # 4. Todas as OSs com situacao = 'Aberta' ou 'Programada'
    cursor.execute(f"""
        SELECT os_numero, matricula, bairro 
        FROM solicitacoes_analise 
        WHERE {where_clause} AND situacao IN ('Aberta', 'Programada')
    """, params)
    abertas_data = cursor.fetchall()
    
    total_abertas = len(abertas_data)
    for r in abertas_data:
        os_num = r[0]
        mat = r[1]
        bairro = r[2]
        os_id = f"os_{os_num}"
        nodes.append({"id": os_id, "name": f"OS {os_num}", "type": "os_aberta", "val": 2, "count": 1, "bairro": bairro, "group": 4})
        mat_id = f"mat_{mat}"
        if mat_id in matricula_ids:
            links.append({"source": mat_id, "target": os_id, "value": 1, "type": "mat_os"})

    conn.close()

    return {
        "nodes": nodes,
        "links": links,
        "stats": {
            "total_nodes": len(nodes),
            "total_links": len(links),
            "ano": ano,
            "total_abertas": total_abertas
        }
    }
''')

# 2. CSS - append to dashboard.css
css_file = os.path.join(base_dir, 'static', 'css', 'dashboard.css')
with open(css_file, 'a', encoding='utf-8') as f:
    f.write('''
/* ============================
   REDE NEURAL 3D
   ============================ */
#section-neural {
    position: relative;
    padding: 0;
    height: calc(100vh - var(--topbar-height));
    background: #050a14;
    overflow: hidden;
}

#neural-graph-container {
    width: 100%;
    height: 100%;
    position: relative;
}

#neural-3d-canvas {
    width: 100% !important;
    height: 100% !important;
    display: block;
}

.neural-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 10;
}

.neural-header {
    position: absolute;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 20;
    pointer-events: all;
}

.neural-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.02em;
    margin: 0 0 0.25rem 0;
    text-shadow: 0 0 20px rgba(59,130,246,0.8);
}

.neural-subtitle {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    font-variant-numeric: tabular-nums;
}

.neural-legend {
    position: absolute;
    bottom: 1.5rem;
    left: 1.5rem;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    pointer-events: none;
}

.neural-legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.7);
}

.neural-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.neural-controls {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: all;
}

.neural-btn {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    color: rgba(255,255,255,0.8);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(8px);
    white-space: nowrap;
}

.neural-btn:hover {
    background: rgba(59,130,246,0.2);
    border-color: rgba(59,130,246,0.5);
    color: #fff;
}

.neural-btn.active {
    background: rgba(59,130,246,0.3);
    border-color: rgba(59,130,246,0.6);
    color: #fff;
}

.neural-tooltip {
    position: absolute;
    background: rgba(10,15,30,0.95);
    border: 1px solid rgba(59,130,246,0.4);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    font-size: 0.78rem;
    color: #fff;
    pointer-events: none;
    z-index: 30;
    max-width: 220px;
    backdrop-filter: blur(12px);
    box-shadow: 0 0 20px rgba(59,130,246,0.3);
    display: none;
}

.neural-tooltip-title {
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
    color: #60A5FA;
}

.neural-tooltip-stat {
    color: rgba(255,255,255,0.6);
    line-height: 1.6;
}

.neural-stats-bar {
    position: absolute;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 20;
    display: flex;
    gap: 1rem;
    pointer-events: none;
}

.neural-stat-pill {
    background: rgba(10,15,30,0.85);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 0.4rem 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: rgba(255,255,255,0.7);
    backdrop-filter: blur(8px);
}

.neural-stat-value {
    font-weight: 700;
    font-size: 0.85rem;
    color: #fff;
}

.neural-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #050a14;
    z-index: 40;
    gap: 1rem;
}

.neural-loading-text {
    color: rgba(255,255,255,0.6);
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: neural-pulse 1.5s ease-in-out infinite;
}

.neural-loading-ring {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(59,130,246,0.15);
    border-top-color: #3B82F6;
    border-radius: 50%;
    animation: neural-spin 0.8s linear infinite;
}

@keyframes neural-spin {
    to { transform: rotate(360deg); }
}

@keyframes neural-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
}
''')

# 3. HTML - replace sections
html_file = os.path.join(base_dir, 'static', 'index.html')
with open(html_file, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Add to head
if '3d-force-graph' not in html_content:
    head_end = html_content.find('</head>')
    if head_end != -1:
        scripts = '''
    <!-- 3D Force Graph -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.167/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1/dist/3d-force-graph.min.js"></script>
'''
        html_content = html_content[:head_end] + scripts + html_content[head_end:]

# Add nav item
if 'id="nav-neural"' not in html_content:
    nav_ml = '''<a href="#" class="nav-item" data-section="ml" id="nav-ml">
                <i data-lucide="settings" class="nav-icon"></i>
                <span class="nav-label">Machine Learning</span>
            </a>'''
    nav_neural = '''
            <a href="#" class="nav-item" data-section="neural" id="nav-neural">
                <i data-lucide="network" class="nav-icon"></i>
                <span class="nav-label">Rede Neural</span>
            </a>'''
    html_content = html_content.replace(nav_ml, nav_ml + nav_neural)

# Add section
if 'id="section-neural"' not in html_content:
    section_ml = '''</section>'''
    # Find the end of section-ml
    idx_ml = html_content.find('id="section-ml"')
    if idx_ml != -1:
        idx_end_ml = html_content.find('</section>', idx_ml)
        if idx_end_ml != -1:
            idx_end_ml += len('</section>')
            section_neural = '''
        <!-- Neural Graph Section -->
        <section class="content-section" id="section-neural">
            <div id="neural-graph-container">
                <!-- Conteúdo injetado pelo JS -->
            </div>
        </section>'''
            html_content = html_content[:idx_end_ml] + section_neural + html_content[idx_end_ml:]

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html_content)

# 4. JS - add listener and function
js_file = os.path.join(base_dir, 'static', 'js', 'dashboard.js')
with open(js_file, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Add to nav click listener
if "if (section === 'neural') activateNeuralSection();" not in js_content:
    hook_str = "if (section === 'ml') loadMLMetrics();"
    js_content = js_content.replace(hook_str, hook_str + "\n        if (section === 'neural') activateNeuralSection();")

# Add JS implementation at the bottom
if "function activateNeuralSection()" not in js_content:
    js_implementation = '''
// ============================================================
// REDE NEURAL 3D — 3d-force-graph
// ============================================================
let neuralGraph = null;
let neuralGraphData = null;
let neuralFilterMode = 'all';

// Cores por tipo de nó
const NEURAL_COLORS = {
    bairro: '#3B82F6',      // Azul — bairros
    logradouro: '#06B6D4',  // Ciano — logradouros  
    matricula: '#F59E0B',   // Âmbar — matrículas reincidentes
    os_aberta: '#EF4444',   // Vermelho — OSs pendentes ativas
};

const NEURAL_LABELS = {
    bairro: 'Bairros Críticos',
    logradouro: 'Logradouros',
    matricula: 'Matrículas Reincidentes',
    os_aberta: 'OSs Pendentes Ativas',
};

async function initNeuralGraph() {
    const container = document.getElementById('neural-graph-container');
    if (!container) return;

    // Criar estrutura HTML interna
    container.innerHTML = `
        <div class="neural-loading" id="neural-loading">
            <div class="neural-loading-ring"></div>
            <span class="neural-loading-text">Computando Rede Neural...</span>
        </div>
        <div id="neural-3d-canvas"></div>
        <div class="neural-overlay">
            <div class="neural-header">
                <h2 class="neural-title">🧠 Rede Neural de Demandas</h2>
                <div class="neural-subtitle" id="neural-subtitle">Carregando dados...</div>
            </div>
            <div class="neural-controls">
                <button class="neural-btn active" id="neural-btn-all" onclick="neuralSetFilter('all')">Todos os Nós</button>
                <button class="neural-btn" id="neural-btn-bairro" onclick="neuralSetFilter('bairro')">Bairros</button>
                <button class="neural-btn" id="neural-btn-rua" onclick="neuralSetFilter('logradouro')">Logradouros</button>
                <button class="neural-btn" id="neural-btn-pend" onclick="neuralSetFilter('os_aberta')">Pendências Ativas</button>
                <button class="neural-btn" style="margin-top:0.5rem;" onclick="neuralGraph && neuralGraph.zoomToFit(800)">Centralizar</button>
            </div>
            <div class="neural-legend">
                <div class="neural-legend-item">
                    <div class="neural-legend-dot" style="background:#3B82F6;box-shadow:0 0 6px #3B82F6"></div>
                    <span>Bairros Críticos</span>
                </div>
                <div class="neural-legend-item">
                    <div class="neural-legend-dot" style="background:#06B6D4;box-shadow:0 0 6px #06B6D4"></div>
                    <span>Logradouros</span>
                </div>
                <div class="neural-legend-item">
                    <div class="neural-legend-dot" style="background:#F59E0B;box-shadow:0 0 6px #F59E0B"></div>
                    <span>Matrículas Reincidentes</span>
                </div>
                <div class="neural-legend-item">
                    <div class="neural-legend-dot" style="background:#EF4444;box-shadow:0 0 6px #EF4444"></div>
                    <span>OSs Pendentes Ativas</span>
                </div>
            </div>
            <div class="neural-stats-bar">
                <div class="neural-stat-pill">
                    <span class="neural-stat-value" id="neural-stat-nodes">—</span>
                    <span>nós</span>
                </div>
                <div class="neural-stat-pill">
                    <span class="neural-stat-value" id="neural-stat-links">—</span>
                    <span>conexões</span>
                </div>
                <div class="neural-stat-pill" style="border-color:rgba(239,68,68,0.4)">
                    <span class="neural-stat-value" id="neural-stat-abertas" style="color:#EF4444">—</span>
                    <span>pendentes</span>
                </div>
            </div>
        </div>
        <div class="neural-tooltip" id="neural-tooltip">
            <div class="neural-tooltip-title" id="neural-tt-title"></div>
            <div class="neural-tooltip-stat" id="neural-tt-stat"></div>
        </div>
    `;

    // Buscar dados da API
    let data;
    try {
        const res = await fetch('/api/graph/neural?ano=2026');
        data = await res.json();
        neuralGraphData = data;
    } catch(e) {
        container.querySelector('#neural-loading').innerHTML = \`<span style="color:rgba(255,100,100,0.8);font-size:0.85rem;">Erro ao carregar dados do grafo. Verifique se a API está online.</span>\`;
        return;
    }

    // Atualizar stats
    const stats = data.stats || {};
    const subtitle = document.getElementById('neural-subtitle');
    if (subtitle) subtitle.textContent = \`\${stats.ano || 2026} · \${stats.total_nodes || data.nodes?.length || 0} nós · \${stats.total_abertas || 0} pendências ativas\`;
    const nStats = document.getElementById('neural-stat-nodes');
    const lStats = document.getElementById('neural-stat-links');
    const aStats = document.getElementById('neural-stat-abertas');
    if (nStats) nStats.textContent = data.nodes?.length || 0;
    if (lStats) lStats.textContent = data.links?.length || 0;
    if (aStats) aStats.textContent = stats.total_abertas || 0;

    // Ocultar loading
    const loading = document.getElementById('neural-loading');
    if (loading) loading.style.display = 'none';

    // Verificar se a lib está disponível
    if (typeof ForceGraph3D === 'undefined') {
        const canvas = document.getElementById('neural-3d-canvas');
        if (canvas) canvas.innerHTML = \`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.4);font-size:0.85rem;">Biblioteca 3D não carregada. Verifique a conexão.</div>\`;
        return;
    }

    // Montar o grafo 3D
    const canvasEl = document.getElementById('neural-3d-canvas');
    const w = canvasEl.clientWidth || window.innerWidth - 240;
    const h = canvasEl.clientHeight || window.innerHeight - 64;

    neuralGraph = ForceGraph3D()(canvasEl)
        .width(w)
        .height(h)
        .backgroundColor('#050a14')
        .graphData(data)
        // Nós
        .nodeColor(node => {
            if (neuralFilterMode !== 'all' && node.type !== neuralFilterMode) return 'rgba(255,255,255,0.05)';
            return NEURAL_COLORS[node.type] || '#888';
        })
        .nodeVal(node => {
            // Tamanho proporcional ao volume, limitado
            const base = {
                bairro: Math.min(Math.max(node.count / 60, 3), 20),
                logradouro: Math.min(Math.max(node.count / 8, 2), 10),
                matricula: Math.min(Math.max(node.count / 2, 1.5), 6),
                os_aberta: 3,
            };
            return base[node.type] || 2;
        })
        .nodeLabel(node => '')
        .nodeResolution(16)
        // Brilho nos nós de OS pendente
        .nodeThreeObject(node => {
            if (!window.THREE) return null;
            const color = NEURAL_COLORS[node.type] || '#888';
            const size = node.type === 'bairro' ? Math.min(Math.max(node.count / 60, 3), 20)
                       : node.type === 'logradouro' ? Math.min(Math.max(node.count / 8, 2), 10)
                       : node.type === 'matricula' ? Math.min(Math.max(node.count / 2, 1.5), 6)
                       : 3;

            const geometry = new THREE.SphereGeometry(size, 16, 16);
            const material = new THREE.MeshLambertMaterial({
                color: color,
                transparent: true,
                opacity: neuralFilterMode === 'all' || node.type === neuralFilterMode ? 0.92 : 0.05,
            });
            const sphere = new THREE.Mesh(geometry, material);

            // Adicionar brilho (sprite) para OSs abertas e bairros
            if (node.type === 'os_aberta' || node.type === 'bairro') {
                const spriteMaterial = new THREE.SpriteMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.25,
                });
                const sprite = new THREE.Sprite(spriteMaterial);
                const glowSize = size * 5;
                sprite.scale.set(glowSize, glowSize, 1);
                sphere.add(sprite);
            }

            return sphere;
        })
        .nodeThreeObjectExtend(false)
        // Links
        .linkColor(link => {
            const typeColors = {
                bairro_log: 'rgba(59,130,246,0.25)',
                log_mat: 'rgba(6,182,212,0.2)',
                mat_os: 'rgba(239,68,68,0.4)',
            };
            return typeColors[link.type] || 'rgba(255,255,255,0.1)';
        })
        .linkWidth(link => link.type === 'mat_os' ? 0.8 : 0.4)
        .linkDirectionalParticles(link => link.type === 'mat_os' ? 3 : link.value > 50 ? 2 : 0)
        .linkDirectionalParticleWidth(1.5)
        .linkDirectionalParticleColor(link => link.type === 'mat_os' ? '#EF4444' : '#60A5FA')
        .linkDirectionalParticleSpeed(link => link.type === 'mat_os' ? 0.008 : 0.003)
        // Tooltip no hover
        .onNodeHover(node => {
            const tooltip = document.getElementById('neural-tooltip');
            if (!tooltip) return;
            if (node) {
                tooltip.style.display = 'block';
                document.getElementById('neural-tt-title').textContent = node.name;
                const typeLabel = NEURAL_LABELS[node.type] || node.type;
                let statText = \`Tipo: \${typeLabel}\`;
                if (node.count > 1) statText += \`\\nVolume: \${node.count.toLocaleString('pt-BR')} OSs\`;
                if (node.type === 'os_aberta') statText += '\\n🔴 Pendência Ativa — Aguardando execução';
                if (node.type === 'bairro') statText += \`\\nBairro mais crítico: \${node.count > 800 ? 'Alta concentração' : 'Concentração moderada'}\`;
                document.getElementById('neural-tt-stat').textContent = statText;
                canvasEl.style.cursor = 'pointer';
            } else {
                tooltip.style.display = 'none';
                canvasEl.style.cursor = 'default';
            }
        })
        // Mover tooltip com mouse
        .onNodeClick(node => {
            // Zoom no nó clicado
            if (!neuralGraph) return;
            const dist = 150;
            const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
            neuralGraph.cameraPosition(
                { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                node,
                1200
            );
        })
        // Ajuste de câmera inicial
        .cameraPosition({ z: 500 });

    // Mover tooltip com mouse no container
    canvasEl.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('neural-tooltip');
        if (tooltip && tooltip.style.display === 'block') {
            tooltip.style.left = (e.offsetX + 16) + 'px';
            tooltip.style.top = (e.offsetY + 16) + 'px';
        }
    });

    // Auto-zoom depois de montar
    setTimeout(() => {
        if (neuralGraph) neuralGraph.zoomToFit(1200, 80);
    }, 2500);

    // Redimensionar com janela
    window._neuralResizeHandler = () => {
        if (neuralGraph && canvasEl) {
            neuralGraph.width(canvasEl.clientWidth).height(canvasEl.clientHeight);
        }
    };
    window.addEventListener('resize', window._neuralResizeHandler);
}

function neuralSetFilter(mode) {
    neuralFilterMode = mode;
    // Atualizar botões
    ['all','bairro','logradouro','os_aberta'].forEach(m => {
        const suffix = m === 'all' ? 'all' : m === 'bairro' ? 'bairro' : m === 'logradouro' ? 'rua' : 'pend';
        const btn = document.getElementById(\`neural-btn-\${suffix}\`);
        if (btn) btn.classList.toggle('active', m === mode);
    });
    // Atualizar o grafo — re-renderizar os nós com novas opacidades
    if (neuralGraph && neuralGraphData) {
        neuralGraph.nodeThreeObject(node => {
            if (!window.THREE) return null;
            const color = NEURAL_COLORS[node.type] || '#888';
            const size = node.type === 'bairro' ? Math.min(Math.max(node.count / 60, 3), 20)
                       : node.type === 'logradouro' ? Math.min(Math.max(node.count / 8, 2), 10)
                       : node.type === 'matricula' ? Math.min(Math.max(node.count / 2, 1.5), 6)
                       : 3;
            const geometry = new THREE.SphereGeometry(size, 16, 16);
            const isVisible = mode === 'all' || node.type === mode;
            const material = new THREE.MeshLambertMaterial({
                color: color,
                transparent: true,
                opacity: isVisible ? 0.92 : 0.04,
            });
            return new THREE.Mesh(geometry, material);
        });
    }
}

// Inicializar quando o menu Neural for ativado
function activateNeuralSection() {
    if (!neuralGraph) {
        initNeuralGraph();
    } else if (neuralGraph) {
        // Re-ajustar tamanho
        const canvasEl = document.getElementById('neural-3d-canvas');
        if (canvasEl) {
            setTimeout(() => {
                neuralGraph.width(canvasEl.clientWidth).height(canvasEl.clientHeight);
                neuralGraph.zoomToFit(800);
            }, 100);
        }
    }
}
'''
    
    # Let's see if loadAll() is at the end. Usually there is a loadAll call or document ready at the end.
    if "loadAll();" in js_content:
        # replace the last loadAll(); with the JS block and then loadAll(); again.
        js_content = js_content.rsplit("loadAll();", 1)
        js_content = js_content[0] + js_implementation + "\nloadAll();" + js_content[1]
    else:
        js_content += js_implementation

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(js_content)
    
print("All files patched successfully.")
