(function() {
    'use strict';
    
    const currentUser = Auth.checkAccess();
    if (!currentUser) return;
    const isMaster = Auth.isMaster();
    
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    
    const hamburgerBtn = $('#hamburgerBtn');
    const sidebar = $('#sidebar');
    const sidebarOverlay = $('#sidebarOverlay');
    const sidebarClose = $('#sidebarClose');
    const menuBase = $('#menuBase');
    const menuHistorico = $('#menuHistorico');
    const userNameDisplay = $('#userNameDisplay');
    const masterBadge = $('#masterBadge');
    const connectionDot = $('#connectionDot');
    const importInfo = $('#importInfo');
    const inputRua = $('#rua');
    const inputFaixa = $('#faixa');
    const inputCodigo = $('#codigo');
    const inputDescricao = $('#descricao');
    const inputEmbalagem = $('#embalagem');
    const inputQuantidade = $('#quantidade');
    const inputObservacoes = $('#observacoes');
    const btnSalvar = $('#btnSalvar');
    const btnNovaContagem = $('#btnNovaContagem');
    const btnCamera = $('#btnCamera');
    const statItens = $('#statItens');
    const statPaletes = $('#statPaletes');
    const statProdutos = $('#statProdutos');
    const statUltima = $('#statUltima');
    const tabelaHistorico = $('#tabelaHistorico');
    const nenhumRegistro = $('#nenhumRegistro');
    const tabelaDashboard = $('#tabelaDashboard');
    const nenhumDashboard = $('#nenhumDashboard');
    const filtroRua = $('#filtroRua');
    const filtroFaixa = $('#filtroFaixa');
    const filtroCodigo = $('#filtroCodigo');
    const filtroDescricao = $('#filtroDescricao');
    const modalDuplicidade = $('#modalDuplicidade');
    const msgDuplicidade = $('#msgDuplicidade');
    const modalCamera = $('#modalCamera');
    const cameraVideo = $('#cameraVideo');
    const btnFecharCamera = $('#btnFecharCamera');
    const btnCameraContinuo = $('#btnCameraContinuo');
    const modoCameraLabel = $('#modoCameraLabel');
    const importZoneMaster = $('#importZoneMaster');
    const fileInputMaster = $('#fileInputMaster');
    const progressBarMaster = $('#progressBarMaster');
    const progressFillMaster = $('#progressFillMaster');
    const importStatusMaster = $('#importStatusMaster');
    const baseInfo = $('#baseInfo');
    const btnRecarregarBase = $('#btnRecarregarBase');
    const restoreFileInput = $('#restoreFileInput');
    const btnExportCSV = $('#btnExportCSV');
    const btnExportExcel = $('#btnExportExcel');
    
    const state = {
        produtosMapCodAcesso: new Map(),
        produtosMapSeqProduto: new Map(),
        baseMeta: null,
        contagensLocal: [],
        pendingContagens: [],
        sortColumn: null,
        sortDirection: 'asc',
        resolvendoDuplicidade: null,
        dbConnected: false
    };
    
    // ============ INIT ============
    async function init() {
        console.log('🚀 Iniciando Contagem BL_MEZ...');
        
        // Exibir nome do usuário
        if (userNameDisplay) {
            userNameDisplay.textContent = '👤 ' + (currentUser.nome || currentUser.usuario);
        }
        
        // Badge de master
        if (isMaster) {
            if (masterBadge) masterBadge.style.display = 'inline';
            if (menuBase) menuBase.style.display = 'block';
            if (menuHistorico) menuHistorico.style.display = 'block';
        }
        
        // Inicializar Supabase
        const dbOk = Database.init();
        state.dbConnected = dbOk;
        updateConnectionDot();
        
        // Carregar contagens do localStorage PRIMEIRO (rápido)
        loadContagens();
        
        // Tentar carregar metadados
        const meta = Database.loadBaseMeta();
        if (meta && !state.baseMeta) state.baseMeta = meta;
        
        // Renderizar interface imediatamente
        atualizarInfoImportacao();
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        atualizarBaseInfo();
        
        // Conectar ao Supabase em segundo plano
        if (dbOk) {
            const testOk = await Database.testConnection();
            state.dbConnected = testOk;
            updateConnectionDot();
            
            if (testOk) {
                // Carregar base em segundo plano
                carregarBaseDoSupabase().then(() => {
                    atualizarInfoImportacao();
                    atualizarBaseInfo();
                });
                
                // Sincronizar pendentes
                syncPendingContagens();
            } else {
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Supabase offline</span>';
            }
        } else {
            if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Modo offline</span>';
        }
        
        // Dark mode
        if (localStorage.getItem('blmez_darkmode') === '1') {
            document.body.classList.add('dark-mode');
            const darkBtn = $('#menuDarkMode');
            if (darkBtn) darkBtn.textContent = '☀️ Modo Claro';
        }
        
        // Configurar eventos
        setupEventListeners();
        
        // Abrir seção padrão
        abrirSecao('contagem');
        
        console.log('✅ Pronto!');
        console.log('   Produtos:', state.produtosMapCodAcesso.size);
        console.log('   Contagens:', state.contagensLocal.length);
    }
    
    function updateConnectionDot() {
        if (connectionDot) {
            connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
        }
    }
    
    // ============ SIDEBAR ============
    function abrirSidebar() {
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('open');
    }
    
    function fecharSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    }
    
    function abrirSecao(nome) {
        ['secaoContagem', 'secaoBase', 'secaoHistorico', 'secaoDashboard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        
        const mapa = {
            contagem: 'secaoContagem',
            base: 'secaoBase',
            historico: 'secaoHistorico',
            dashboard: 'secaoDashboard'
        };
        
        const secao = document.getElementById(mapa[nome]);
        if (secao) secao.classList.add('active');
        
        $$('.sidebar-item[data-section]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === nome) item.classList.add('active');
        });
        
        if (nome === 'historico') renderizarHistorico();
        if (nome === 'dashboard') { renderizarDashboard(); atualizarEstatisticas(); }
        if (nome === 'base') atualizarBaseInfo();
        
        fecharSidebar();
    }
    
    // ============ BASE DE PRODUTOS ============
    async function carregarBaseDoSupabase() {
        if (!Database.supabase) return;
        
        try {
            console.log('🔄 Carregando base do Supabase...');
            const produtos = await Database.fetchProdutos();
            
            if (produtos && produtos.length > 0) {
                construirIndices(produtos);
                
                state.baseMeta = {
                    nomeArquivo: 'Supabase',
                    totalRegistros: produtos.length,
                    dataHoraImportacao: new Date().toISOString()
                };
                
                Database.saveBaseMeta(state.baseMeta);
                atualizarInfoImportacao();
                atualizarBaseInfo();
                
                console.log('✅ ' + produtos.length + ' produtos carregados');
                Utils.showToast('✅ ' + produtos.length.toLocaleString('pt-BR') + ' produtos carregados', 'success');
            } else {
                console.log('⚠️ Nenhum produto encontrado');
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Base vazia</span>';
            }
        } catch (err) {
            console.error('❌ Erro:', err.message);
            if (importInfo) importInfo.innerHTML = '<span style="color:var(--red);">❌ Erro: ' + Utils.escapeHTML(err.message) + '</span>';
        }
    }
    
    function construirIndices(produtos) {
        state.produtosMapCodAcesso.clear();
        state.produtosMapSeqProduto.clear();
        
        for (const p of produtos) {
            const embFormatada = p.embalagem && p.qtdembalagem
                ? p.embalagem + ' x ' + p.qtdembalagem
                : (p.embalagem || p.qtdembalagem || '');
            
            const produto = {
                seqProduto: p.seqproduto || '',
                descCompleta: p.desccompleta || '',
                codAcesso: p.codacesso || '',
                embalagem: p.embalagem || '',
                qtdEmbalagem: p.qtdembalagem || '',
                embalagemFormatada: embFormatada
            };
            
            if (produto.codAcesso) state.produtosMapCodAcesso.set(produto.codAcesso, produto);
            if (produto.seqProduto) state.produtosMapSeqProduto.set(produto.seqProduto, produto);
        }
        
        console.log('📊 Índices construídos: ' + state.produtosMapCodAcesso.size + ' produtos');
    }
    
    async function importarBaseMaster(conteudo, nomeArquivo) {
        if (!Database.supabase) {
            Utils.showToast('❌ Supabase não conectado!', 'error');
            return;
        }
        
        if (progressBarMaster) progressBarMaster.classList.add('active');
        if (progressFillMaster) progressFillMaster.style.width = '0%';
        if (importStatusMaster) importStatusMaster.textContent = 'Processando arquivo...';
        
        try {
            const linhas = conteudo.split(/\r?\n/).filter(l => l.trim() !== '');
            if (linhas.length === 0) throw new Error('Arquivo vazio.');
            
            const delimitadores = ['\t', ';', ','];
            let delimitador = '\t';
            let maxCols = 0;
            for (const d of delimitadores) {
                const cols = linhas[0].split(d).length;
                if (cols > maxCols) { maxCols = cols; delimitador = d; }
            }
            
            const primeiraCols = linhas[0].split(delimitador);
            const pareceCabecalho = primeiraCols.some(c => /seqproduto|codacesso/i.test(c.trim()));
            const inicioDados = pareceCabecalho ? 1 : 0;
            
            if (primeiraCols.length < 9) throw new Error('Arquivo precisa ter pelo menos 9 colunas.');
            
            const produtosParaSupabase = [];
            
            for (let i = inicioDados; i < linhas.length; i++) {
                const cols = linhas[i].split(delimitador);
                if (cols.length < 9) continue;
                
                produtosParaSupabase.push({
                    seqproduto: (cols[1] || '').trim(),
                    desccompleta: (cols[2] || '').trim(),
                    codacesso: (cols[3] || '').trim(),
                    embalagem: (cols[7] || '').trim(),
                    qtdembalagem: (cols[8] || '').trim()
                });
            }
            
            if (importStatusMaster) importStatusMaster.textContent = 'Enviando ' + produtosParaSupabase.length + ' produtos...';
            
            await Database.replaceProdutos(produtosParaSupabase, (progresso) => {
                if (progressFillMaster) progressFillMaster.style.width = progresso + '%';
                if (importStatusMaster) importStatusMaster.textContent = 'Enviando... ' + progresso + '%';
            });
            
            construirIndices(produtosParaSupabase.map(p => ({
                seqproduto: p.seqproduto,
                desccompleta: p.desccompleta,
                codacesso: p.codacesso,
                embalagem: p.embalagem,
                qtdembalagem: p.qtdembalagem
            })));
            
            state.baseMeta = {
                nomeArquivo,
                totalRegistros: state.produtosMapCodAcesso.size,
                dataHoraImportacao: new Date().toISOString()
            };
            
            Database.saveBaseMeta(state.baseMeta);
            atualizarInfoImportacao();
            atualizarBaseInfo();
            
            if (importStatusMaster) importStatusMaster.innerHTML = '<span style="color:var(--green);">✅ ' + state.produtosMapCodAcesso.size + ' produtos importados!</span>';
            Utils.showToast('✅ ' + state.produtosMapCodAcesso.size + ' produtos importados!', 'success');
            
        } catch (err) {
            console.error('❌ Erro:', err);
            if (importStatusMaster) importStatusMaster.innerHTML = '<span style="color:var(--red);">❌ ' + Utils.escapeHTML(err.message) + '</span>';
            Utils.showToast('❌ ' + err.message, 'error');
        } finally {
            if (progressBarMaster) progressBarMaster.classList.remove('active');
            if (progressFillMaster) progressFillMaster.style.width = '0%';
        }
    }
    
    function atualizarInfoImportacao() {
        if (!importInfo) return;
        
        if (!state.baseMeta || state.produtosMapCodAcesso.size === 0) {
            importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Nenhuma base carregada.</span>';
            return;
        }
        
        const dh = state.baseMeta.dataHoraImportacao
            ? Utils.formatDataHora(state.baseMeta.dataHoraImportacao)
            : { data: '--', hora: '--' };
        
        importInfo.innerHTML =
            '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> ' +
            '<span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> ' +
            '<span>📅 ' + dh.data + ' ' + dh.hora + '</span> ' +
            '<span class="badge">☁️ Supabase</span>';
    }
    
    function atualizarBaseInfo() {
        if (baseInfo) {
            baseInfo.textContent = state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' produtos na base';
        }
    }
    
    // ============ PESQUISA ============
    function pesquisarProduto(codigo) {
        if (!codigo || !codigo.trim()) return null;
        const cod = codigo.trim();
        
        if (state.produtosMapCodAcesso.has(cod)) return state.produtosMapCodAcesso.get(cod);
        if (state.produtosMapSeqProduto.has(cod)) return state.produtosMapSeqProduto.get(cod);
        
        for (const [key, val] of state.produtosMapCodAcesso) {
            if (key.startsWith(cod)) return val;
        }
        for (const [key, val] of state.produtosMapSeqProduto) {
            if (key.startsWith(cod)) return val;
        }
        
        return null;
    }
    
    // ============ CONTAGENS ============
    function loadContagens() {
        try {
            state.contagensLocal = JSON.parse(localStorage.getItem(Database.KEYS.CONTAGENS) || '[]');
            state.pendingContagens = JSON.parse(localStorage.getItem(Database.KEYS.PENDING) || '[]');
        } catch (e) {
            state.contagensLocal = [];
            state.pendingContagens = [];
        }
    }
    
    function saveContagens() {
        try {
            localStorage.setItem(Database.KEYS.CONTAGENS, JSON.stringify(state.contagensLocal));
            localStorage.setItem(Database.KEYS.PENDING, JSON.stringify(state.pendingContagens));
        } catch (e) {}
    }
    
    async function salvarContagem(contagem) {
        const idx = state.contagensLocal.findIndex(c =>
            c.rua === contagem.rua && c.faixa === contagem.faixa && c.codigo === contagem.codigo
        );
        
        if (idx >= 0) {
            return new Promise(resolve => {
                state.resolvendoDuplicidade = (op) => {
                    state.resolvendoDuplicidade = null;
                    
                    if (op === 'editar') {
                        state.contagensLocal[idx] = {
                            ...contagem,
                            synced: false,
                            localId: state.contagensLocal[idx].localId
                        };
                    } else if (op === 'somar') {
                        state.contagensLocal[idx].quantidade += contagem.quantidade;
                        state.contagensLocal[idx].observacoes = contagem.observacoes || state.contagensLocal[idx].observacoes || '';
                        state.contagensLocal[idx].synced = false;
                    }
                    
                    saveContagens();
                    renderizarHistorico();
                    renderizarDashboard();
                    atualizarEstatisticas();
                    resolve(op);
                };
                
                const exist = state.contagensLocal[idx];
                if (msgDuplicidade) {
                    msgDuplicidade.innerHTML =
                        '<strong>' + Utils.escapeHTML(exist.rua) + '</strong> / Faixa ' + exist.faixa + '<br>' +
                        'Qtd atual: ' + exist.quantidade + ' | Nova: ' + contagem.quantidade;
                }
                if (modalDuplicidade) modalDuplicidade.style.display = 'flex';
            });
        }
        
        state.contagensLocal.push(contagem);
        state.pendingContagens.push(contagem);
        saveContagens();
        
        if (Database.supabase && navigator.onLine) {
            await syncPendingContagens();
        }
        
        return 'novo';
    }
    
    async function syncPendingContagens() {
        if (!Database.supabase || state.pendingContagens.length === 0) return;
        
        let count = 0;
        for (const cont of [...state.pendingContagens]) {
            try {
                const result = await Database.saveContagem({
                    rua: cont.rua,
                    faixa: cont.faixa,
                    codigo: cont.codigo,
                    descricao: cont.descricao,
                    embalagem: cont.embalagem,
                    quantidade: cont.quantidade,
                    observacoes: cont.observacoes || '',
                    data: cont.data,
                    hora: cont.hora
                });
                
                cont.synced = true;
                cont.supabase_id = result.id;
                state.pendingContagens = state.pendingContagens.filter(c => c.localId !== cont.localId);
                count++;
            } catch (err) {
                console.error('Erro ao sincronizar:', err);
            }
        }
        
        if (count > 0) {
            saveContagens();
            renderizarHistorico();
            renderizarDashboard();
            atualizarEstatisticas();
        }
    }
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        let lista = [...state.contagensLocal];
        
        if (filtroRua && filtroRua.value.trim()) {
            const f = filtroRua.value.toLowerCase().trim();
            lista = lista.filter(c => c.rua.toLowerCase().includes(f));
        }
        if (filtroFaixa && filtroFaixa.value.trim()) {
            const f = filtroFaixa.value.toLowerCase().trim();
            lista = lista.filter(c => String(c.faixa).includes(f));
        }
        if (filtroCodigo && filtroCodigo.value.trim()) {
            const f = filtroCodigo.value.toLowerCase().trim();
            lista = lista.filter(c => c.codigo.toLowerCase().includes(f));
        }
        if (filtroDescricao && filtroDescricao.value.trim()) {
            const f = filtroDescricao.value.toLowerCase().trim();
            lista = lista.filter(c => c.descricao.toLowerCase().includes(f));
        }
        
        if (state.sortColumn) {
            lista.sort((a, b) => {
                let va = a[state.sortColumn];
                let vb = b[state.sortColumn];
                if (typeof va === 'string') va = va.toLowerCase();
                if (typeof vb === 'string') vb = vb.toLowerCase();
                return state.sortDirection === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
            });
        } else {
            lista.sort((a, b) => new Date(b.dataISO || 0) - new Date(a.dataISO || 0));
        }
        
        return lista;
    }
    
    function renderizarHistorico() {
        if (!tabelaHistorico) return;
        
        const lista = getHistoricoFiltrado();
        tabelaHistorico.innerHTML = '';
        
        if (lista.length === 0) {
            if (nenhumRegistro) nenhumRegistro.style.display = 'block';
        } else {
            if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            
            lista.forEach(c => {
                const syncedIcon = c.synced ? '☁️' : '📱';
                const tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + Utils.escapeHTML(c.rua) + '</td>' +
                    '<td>' + c.faixa + '</td>' +
                    '<td>' + Utils.escapeHTML(c.codigo) + ' ' + syncedIcon + '</td>' +
                    '<td>' + Utils.escapeHTML(c.descricao) + '</td>' +
                    '<td>' + Utils.escapeHTML(c.embalagem) + '</td>' +
                    '<td><strong>' + c.quantidade + '</strong></td>' +
                    '<td>' + (c.data || '--') + '</td>' +
                    '<td>' + (c.hora || '--') + '</td>' +
                    '<td>' +
                        '<button class="btn btn-outline btn-sm btn-editar" data-id="' + c.localId + '">✏️</button> ' +
                        '<button class="btn btn-danger-text btn-sm btn-excluir" data-id="' + c.localId + '">🗑️</button>' +
                    '</td>';
                tabelaHistorico.appendChild(tr);
            });
            
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                    if (i >= 0) editarContagem(i);
                });
            });
            
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(btn => {
                btn.addEventListener('click', function() {
                    const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                    if (i >= 0) excluirContagem(i);
                });
            });
        }
    }
    
    function renderizarDashboard() {
        if (!tabelaDashboard) return;
        
        const ruas = {};
        state.contagensLocal.forEach(c => {
            if (!ruas[c.rua]) ruas[c.rua] = { itens: 0, paletes: 0, ultima: '' };
            ruas[c.rua].itens++;
            ruas[c.rua].paletes += c.quantidade;
            if (!ruas[c.rua].ultima || new Date(c.dataISO) > new Date(ruas[c.rua].ultima)) {
                ruas[c.rua].ultima = c.dataISO;
            }
        });
        
        tabelaDashboard.innerHTML = '';
        const entradas = Object.entries(ruas);
        
        if (entradas.length === 0) {
            if (nenhumDashboard) nenhumDashboard.style.display = 'block';
        } else {
            if (nenhumDashboard) nenhumDashboard.style.display = 'none';
            entradas.forEach(([rua, dados]) => {
                const dh = dados.ultima ? Utils.formatDataHora(dados.ultima) : { data: '--', hora: '--' };
                const tr = document.createElement('tr');
                tr.innerHTML =
                    '<td><strong>' + Utils.escapeHTML(rua) + '</strong></td>' +
                    '<td>' + dados.itens + '</td>' +
                    '<td>' + dados.paletes + '</td>' +
                    '<td>' + dh.data + ' ' + dh.hora + '</td>';
                tabelaDashboard.appendChild(tr);
            });
        }
    }
    
    function editarContagem(index) {
        const c = state.contagensLocal[index];
        if (inputRua) inputRua.value = c.rua;
        if (inputFaixa) inputFaixa.value = c.faixa;
        if (inputCodigo) inputCodigo.value = c.codigo;
        if (inputDescricao) inputDescricao.value = c.descricao;
        if (inputEmbalagem) inputEmbalagem.value = c.embalagem;
        if (inputQuantidade) inputQuantidade.value = c.quantidade;
        if (inputObservacoes) inputObservacoes.value = c.observacoes || '';
        
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens();
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        abrirSecao('contagem');
        Utils.showToast('Contagem carregada para edição.', 'success');
    }
    
    async function excluirContagem(index) {
        if (!confirm('Deseja realmente excluir esta contagem?')) return;
        
        const c = state.contagensLocal[index];
        if (c.supabase_id && Database.supabase) {
            try { await Database.deleteContagem(c.supabase_id); } catch (err) {}
        }
        
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens();
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        Utils.showToast('Contagem excluída.', 'success');
    }
    
    function atualizarEstatisticas() {
        if (statItens) statItens.textContent = state.contagensLocal.length.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensLocal.reduce((s, c) => s + (c.quantidade || 0), 0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensLocal.map(c => c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensLocal.length > 0) {
            const u = state.contagensLocal[state.contagensLocal.length - 1];
            statUltima.textContent = (u.data || '--') + ' ' + (u.hora || '--');
        }
    }
    
    // ============ EVENTOS ============
    function setupEventListeners() {
        // Sidebar
        if (hamburgerBtn) hamburgerBtn.addEventListener('click', abrirSidebar);
        if (sidebarClose) sidebarClose.addEventListener('click', fecharSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', fecharSidebar);
        
        $$('.sidebar-item[data-section]').forEach(item => {
            item.addEventListener('click', () => abrirSecao(item.dataset.section));
        });
        
        // Dark mode
        const darkBtn = $('#menuDarkMode');
        if (darkBtn) {
            darkBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('blmez_darkmode', isDark ? '1' : '0');
                darkBtn.textContent = isDark ? '☀️ Modo Claro' : '🌓 Modo Escuro';
            });
        }
        
        // Sync
        const syncBtn = $('#menuSync');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                await syncPendingContagens();
                if (state.pendingContagens.length === 0) {
                    Utils.showToast('✅ Tudo sincronizado!', 'success');
                }
            });
        }
        
        // Backup
        const backupBtn = $('#menuBackup');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                if (state.contagensLocal.length === 0) {
                    Utils.showToast('Nenhum dado para backup.', 'error');
                    return;
                }
                const json = JSON.stringify(state.contagensLocal, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                Utils.downloadBlob(blob, 'backup_blmez_' + new Date().toISOString().slice(0, 10) + '.json');
                Utils.showToast('Backup realizado!', 'success');
            });
        }
        
        // Restore
        const restoreBtn = $('#menuRestore');
        if (restoreBtn && restoreFileInput) {
            restoreBtn.addEventListener('click', () => restoreFileInput.click());
            restoreFileInput.addEventListener('change', (e) => {
                if (!e.target.files[0]) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const dados = JSON.parse(ev.target.result);
                        if (!Array.isArray(dados)) throw new Error('Formato inválido');
                        if (confirm('Restaurar ' + dados.length + ' registros? Isso substituirá o histórico atual.')) {
                            state.contagensLocal = dados;
                            state.pendingContagens = dados.filter(c => !c.synced);
                            saveContagens();
                            renderizarHistorico();
                            renderizarDashboard();
                            atualizarEstatisticas();
                            Utils.showToast('✅ ' + dados.length + ' registros restaurados!', 'success');
                        }
                    } catch (err) {
                        Utils.showToast('Arquivo inválido.', 'error');
                    }
                };
                reader.readAsText(e.target.files[0]);
                e.target.value = '';
            });
        }
        
        // Logout
        const logoutBtn = $('#menuLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Deseja realmente sair?')) Auth.logout();
            });
        }
        
        // Importação master
        if (importZoneMaster && fileInputMaster) {
            importZoneMaster.addEventListener('click', () => fileInputMaster.click());
            
            fileInputMaster.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name);
                reader.readAsText(file);
                fileInputMaster.value = '';
            });
            
            importZoneMaster.addEventListener('dragover', (e) => {
                e.preventDefault();
                importZoneMaster.classList.add('drag-over');
            });
            
            importZoneMaster.addEventListener('dragleave', () => {
                importZoneMaster.classList.remove('drag-over');
            });
            
            importZoneMaster.addEventListener('drop', async (e) => {
                e.preventDefault();
                importZoneMaster.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name);
                reader.readAsText(file);
            });
        }
        
        if (btnRecarregarBase) {
            btnRecarregarBase.addEventListener('click', () => carregarBaseDoSupabase());
        }
        
        // Pesquisa de código
        if (inputCodigo) {
            inputCodigo.addEventListener('change', () => pesquisarEAtualizar(inputCodigo.value));
            inputCodigo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    pesquisarEAtualizar(inputCodigo.value);
                    if (inputDescricao && inputDescricao.value) {
                        if (inputQuantidade) inputQuantidade.focus();
                        if (inputQuantidade) inputQuantidade.select();
                    }
                }
            });
        }
        
        function pesquisarEAtualizar(codigo) {
            if (!codigo || !codigo.trim()) {
                if (inputDescricao) inputDescricao.value = '';
                if (inputEmbalagem) inputEmbalagem.value = '';
                return;
            }
            
            if (state.produtosMapCodAcesso.size === 0) {
                Utils.showToast('⚠️ Nenhuma base carregada.', 'error');
                return;
            }
            
            const produto = pesquisarProduto(codigo);
            
            if (produto) {
                if (inputDescricao) inputDescricao.value = produto.descCompleta;
                if (inputEmbalagem) inputEmbalagem.value = produto.embalagemFormatada;
                if (inputCodigo) inputCodigo.classList.add('input-success');
                setTimeout(() => {
                    if (inputCodigo) inputCodigo.classList.remove('input-success');
                }, 1500);
                Utils.playBeep();
                Utils.vibrate(40);
            } else {
                if (inputDescricao) inputDescricao.value = '';
                if (inputEmbalagem) inputEmbalagem.value = '';
                if (inputCodigo) inputCodigo.classList.add('input-error');
                setTimeout(() => {
                    if (inputCodigo) inputCodigo.classList.remove('input-error');
                }, 1500);
                Utils.showToast('❌ Produto não encontrado.', 'error');
            }
        }
        
        // Salvar
        if (btnSalvar) {
            btnSalvar.addEventListener('click', async () => {
                const rua = inputRua ? inputRua.value.trim() : '';
                const faixaStr = inputFaixa ? inputFaixa.value.trim() : '';
                const codigo = inputCodigo ? inputCodigo.value.trim() : '';
                const descricao = inputDescricao ? inputDescricao.value.trim() : '';
                const embalagem = inputEmbalagem ? inputEmbalagem.value.trim() : '';
                const quantidade = inputQuantidade ? (parseInt(inputQuantidade.value) || 0) : 0;
                const observacoes = inputObservacoes ? inputObservacoes.value.trim() : '';
                
                if (!rua) { Utils.showToast('⚠️ Informe a Rua.', 'error'); if (inputRua) inputRua.focus(); return; }
                if (!faixaStr) { Utils.showToast('⚠️ Informe a Faixa.', 'error'); if (inputFaixa) inputFaixa.focus(); return; }
                if (!codigo) { Utils.showToast('⚠️ Informe o Código.', 'error'); if (inputCodigo) inputCodigo.focus(); return; }
                if (!descricao) { Utils.showToast('⚠️ Produto não encontrado.', 'error'); return; }
                if (quantidade <= 0) { Utils.showToast('⚠️ Quantidade inválida.', 'error'); if (inputQuantidade) inputQuantidade.focus(); return; }
                
                const faixa = parseInt(faixaStr);
                const dh = Utils.formatDataHora(new Date());
                
                const contagem = {
                    localId: Utils.generateId(),
                    rua, faixa, codigo, descricao, embalagem, quantidade, observacoes,
                    data: dh.data, hora: dh.hora, dataISO: dh.iso,
                    synced: false,
                    usuario: currentUser.usuario,
                    usuarioNome: currentUser.nome
                };
                
                const resultado = await salvarContagem(contagem);
                
                if (resultado === 'novo') {
                    Utils.showToast('✅ Contagem salva!', 'success');
                    limparFormulario();
                } else if (resultado === 'editar') {
                    Utils.showToast('✅ Contagem atualizada!', 'success');
                    limparFormulario();
                } else if (resultado === 'somar') {
                    Utils.showToast('✅ Quantidade somada!', 'success');
                    limparFormulario();
                }
            });
        }
        
        function limparFormulario() {
            if (inputRua) inputRua.value = '';
            if (inputFaixa) inputFaixa.value = '';
            if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success', 'input-error'); }
            if (inputDescricao) inputDescricao.value = '';
            if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputQuantidade) inputQuantidade.value = '1';
            if (inputObservacoes) inputObservacoes.value = '';
            if (inputRua) inputRua.focus();
        }
        
        if (btnNovaContagem) btnNovaContagem.addEventListener('click', limparFormulario);
        
        // Câmera
        if (btnCamera) {
            btnCamera.addEventListener('click', () => {
                if (Camera.isOpen) {
                    Camera.close();
                    if (modalCamera) modalCamera.style.display = 'none';
                } else {
                    if (modalCamera) modalCamera.style.display = 'flex';
                    Camera.open(cameraVideo, (codigo) => {
                        if (inputCodigo) inputCodigo.value = codigo;
                        pesquisarEAtualizar(codigo);
                        if (!Camera.continuousMode) {
                            if (modalCamera) modalCamera.style.display = 'none';
                        }
                    });
                }
            });
        }
        
        if (btnFecharCamera) btnFecharCamera.addEventListener('click', () => {
            Camera.close();
            if (modalCamera) modalCamera.style.display = 'none';
        });
        
        if (btnCameraContinuo) {
            btnCameraContinuo.addEventListener('click', () => {
                const cont = Camera.toggleContinuous();
                if (modoCameraLabel) modoCameraLabel.textContent = cont ? 'LIGADO' : 'DESLIGADO';
            });
        }
        
        // Modal duplicidade
        const btnEditar = $('#btnEditarExistente');
        const btnSomar = $('#btnSomarQuantidade');
        const btnCancelar = $('#btnCancelarDuplicidade');
        
        if (btnEditar) btnEditar.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar');
        });
        
        if (btnSomar) btnSomar.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar');
        });
        
        if (btnCancelar) btnCancelar.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            state.resolvendoDuplicidade = null;
        });
        
        // Exportação
        if (btnExportCSV) {
            btnExportCSV.addEventListener('click', () => {
                if (!isMaster) { Utils.showToast('Acesso restrito.', 'error'); return; }
                const dados = getHistoricoFiltrado().map(c => ({
                    Rua: c.rua, Faixa: c.faixa, Código: c.codigo,
                    Descrição: c.descricao, Embalagem: c.embalagem,
                    Quantidade: c.quantidade, Data: c.data || '',
                    Hora: c.hora || '', Observações: c.observacoes || ''
                }));
                if (!dados.length) { Utils.showToast('Nenhum dado.', 'error'); return; }
                const cab = Object.keys(dados[0]).join(';');
                const csv = '\uFEFF' + [cab, ...dados.map(d => Object.values(d).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'))].join('\n');
                Utils.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'contagem_' + new Date().toISOString().slice(0, 10) + '.csv');
                Utils.showToast('CSV exportado!', 'success');
            });
        }
        
        if (btnExportExcel) {
            btnExportExcel.addEventListener('click', () => {
                if (!isMaster) { Utils.showToast('Acesso restrito.', 'error'); return; }
                const dados = getHistoricoFiltrado().map(c => ({
                    Rua: c.rua, Faixa: c.faixa, Código: c.codigo,
                    Descrição: c.descricao, Embalagem: c.embalagem,
                    Quantidade: c.quantidade, Data: c.data || '',
                    Hora: c.hora || '', Observações: c.observacoes || ''
                }));
                if (!dados.length) { Utils.showToast('Nenhum dado.', 'error'); return; }
                const ws = XLSX.utils.json_to_sheet(dados);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Contagens');
                XLSX.writeFile(wb, 'contagem_' + new Date().toISOString().slice(0, 10) + '.xlsx');
                Utils.showToast('Excel exportado!', 'success');
            });
        }
        
        // Filtros
        [filtroRua, filtroFaixa, filtroCodigo, filtroDescricao].forEach(input => {
            if (input) input.addEventListener('input', renderizarHistorico);
        });
        
        // Ordenação
        $$('thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                state.sortDirection = state.sortColumn === col ? (state.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
                state.sortColumn = col;
                renderizarHistorico();
            });
        });
        
        // Atalhos
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; }
            }
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); if (btnSalvar) btnSalvar.click(); }
            if (e.key === 'Enter' && document.activeElement === inputQuantidade) { e.preventDefault(); if (btnSalvar) btnSalvar.click(); }
        });
        
        // Online/Offline
        window.addEventListener('online', async () => {
            Utils.showToast('🌐 Online!', 'success');
            if (Database.supabase) {
                await syncPendingContagens();
                if (state.produtosMapCodAcesso.size === 0) await carregarBaseDoSupabase();
            }
        });
        
        window.addEventListener('offline', () => {
            Utils.showToast('📱 Modo offline.', 'warning');
        });
    }
    
    // Iniciar
    init();
})();