// ============================================================
// APP.JS - Contagem BL_MEZ - Versão Final Corrigida
// ============================================================

(function() {
    'use strict';
    
    // ============ VERIFICAÇÃO DE ACESSO ============
    const currentUser = Auth.checkAccess();
    if (!currentUser) return;
    
    const isMaster = Auth.isMaster();
    
    // ============ ATALHOS DOM ============
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    
    // Elementos da UI
    const userNameDisplay = $('#userNameDisplay');
    const masterBadge = $('#masterBadge');
    const connectionDot = $('#connectionDot');
    const hamburgerBtn = $('#hamburgerBtn');
    const menuDropdown = $('#menuDropdown');
    const tabBaseBtn = $('#tabBaseBtn');
    const tabHistoricoBtn = $('#tabHistoricoBtn');
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
    
    // ============ ESTADO DA APLICAÇÃO ============
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
    
    // ============ INICIALIZAÇÃO ============
    async function init() {
        console.log('🚀 Iniciando Contagem BL_MEZ...');
        console.log('👤 Usuário:', currentUser.nome, '| Master:', isMaster);
        
        // Exibir informações do usuário
        if (userNameDisplay) userNameDisplay.textContent = '👤 ' + currentUser.nome;
        
        // Badge de master
        if (isMaster) {
            if (masterBadge) masterBadge.style.display = 'inline';
            if (tabBaseBtn) tabBaseBtn.style.display = 'inline-block';
            if (tabHistoricoBtn) tabHistoricoBtn.style.display = 'inline-block';
        }
        
        // Inicializar Supabase
        console.log('🔌 Inicializando Supabase...');
        const dbOk = Database.init();
        state.dbConnected = dbOk;
        updateConnectionIndicator();
        
        // Testar conexão e carregar produtos
        if (dbOk) {
            const testOk = await Database.testConnection();
            state.dbConnected = testOk;
            updateConnectionIndicator();
            
            if (testOk) {
                console.log('✅ Conexão OK! Carregando produtos...');
                await carregarBaseDoSupabase();
            } else {
                console.error('❌ Falha no teste de conexão');
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--red);">❌ Erro na conexão com Supabase</span>';
            }
        } else {
            console.error('❌ Supabase não inicializado');
            if (importInfo) importInfo.innerHTML = '<span style="color:var(--red);">❌ Supabase não conectado</span>';
        }
        
        // Carregar contagens do localStorage
        loadContagens();
        
        // Metadados
        const meta = Database.loadBaseMeta();
        if (meta && !state.baseMeta) {
            state.baseMeta = meta;
        }
        
        // Renderizar
        atualizarInfoImportacao();
        renderizarHistorico();
        atualizarEstatisticas();
        atualizarBaseInfo();
        
        // Sincronizar pendentes
        if (state.dbConnected && navigator.onLine) {
            await syncPendingContagens();
        }
        
        // Dark mode
        if (localStorage.getItem('blmez_darkmode') === '1') {
            document.body.classList.add('dark-mode');
            const darkBtn = $('#menuDarkMode');
            if (darkBtn) darkBtn.textContent = '☀️ Modo Claro';
        }
        
        // Foco inicial
        if (inputRua) inputRua.focus();
        
        console.log('✅ Aplicação pronta!');
        console.log('   Supabase:', state.dbConnected ? 'Conectado' : 'Offline');
        console.log('   Produtos:', state.produtosMapCodAcesso.size);
        console.log('   Contagens:', state.contagensLocal.length);
    }
    
    function updateConnectionIndicator() {
        if (connectionDot) {
            connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
            connectionDot.title = state.dbConnected ? 'Supabase Online' : 'Supabase Offline';
        }
    }
    
    // ============ BASE DE PRODUTOS ============
    async function carregarBaseDoSupabase() {
        if (!Database.supabase) {
            console.error('❌ carregarBase: supabase é null');
            return;
        }
        
        try {
            console.log('🔄 Buscando produtos do Supabase...');
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
                
                console.log('✅ ' + produtos.length + ' produtos carregados na memória');
                Utils.showToast('✅ ' + produtos.length + ' produtos carregados', 'success');
            } else {
                console.log('⚠️ Nenhum produto encontrado no Supabase');
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Base vazia. Importe um arquivo TXT na aba Gerenciar Base.</span>';
                Utils.showToast('⚠️ Base vazia - Importe um TXT', 'warning');
            }
        } catch (err) {
            console.error('❌ Erro ao carregar base:', err.message);
            if (importInfo) importInfo.innerHTML = '<span style="color:var(--red);">❌ Erro: ' + Utils.escapeHTML(err.message) + '</span>';
            Utils.showToast('❌ Erro: ' + err.message, 'error');
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
            
            // Detectar delimitador
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
            
            // Reconstruir índices em memória
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
            console.error('❌ Erro ao importar:', err);
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
            '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span>' +
            '<span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span>' +
            '<span>📅 ' + dh.data + ' ' + dh.hora + '</span>' +
            '<span class="badge">☁️ Supabase</span>';
    }
    
    function atualizarBaseInfo() {
        if (baseInfo) {
            baseInfo.textContent = state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' produtos na base';
        }
    }
    
    // ============ PESQUISA DE PRODUTOS ============
    function pesquisarProduto(codigo) {
        if (!codigo || !codigo.trim()) return null;
        const cod = codigo.trim();
        
        // Busca exata
        if (state.produtosMapCodAcesso.has(cod)) return state.produtosMapCodAcesso.get(cod);
        if (state.produtosMapSeqProduto.has(cod)) return state.produtosMapSeqProduto.get(cod);
        
        // Busca parcial (começa com)
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
        const existente = state.contagensLocal.findIndex(c =>
            c.rua === contagem.rua && c.faixa === contagem.faixa && c.codigo === contagem.codigo
        );
        
        if (existente >= 0) {
            return new Promise((resolve) => {
                state.resolvendoDuplicidade = (opcao) => {
                    state.resolvendoDuplicidade = null;
                    
                    if (opcao === 'editar') {
                        state.contagensLocal[existente] = { 
                            ...contagem, 
                            synced: false, 
                            localId: state.contagensLocal[existente].localId 
                        };
                    } else if (opcao === 'somar') {
                        state.contagensLocal[existente].quantidade += contagem.quantidade;
                        state.contagensLocal[existente].observacoes = contagem.observacoes || state.contagensLocal[existente].observacoes || '';
                        state.contagensLocal[existente].synced = false;
                    }
                    
                    saveContagens();
                    renderizarHistorico();
                    atualizarEstatisticas();
                    resolve(opcao);
                };
                
                const exist = state.contagensLocal[existente];
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
                console.error('Erro ao sincronizar contagem:', err);
            }
        }
        
        if (count > 0) {
            saveContagens();
            renderizarHistorico();
            atualizarEstatisticas();
            Utils.showToast('✅ ' + count + ' contagens sincronizadas!', 'success');
        }
    }
    
    // ============ RENDERIZAÇÃO ============
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
            
            // Eventos dos botões
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                    if (idx >= 0) editarContagem(idx);
                });
            });
            
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                    if (idx >= 0) excluirContagem(idx);
                });
            });
        }
        
        // Ícones de ordenação
        $$('thead th[data-sort]').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = th.dataset.sort === state.sortColumn 
                    ? (state.sortDirection === 'asc' ? '▲' : '▼') 
                    : '';
            }
        });
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
        atualizarEstatisticas();
        
        // Mudar para aba de contagem
        const tabContagemBtn = document.querySelector('[data-tab="contagem"]');
        if (tabContagemBtn) tabContagemBtn.click();
        
        Utils.showToast('Contagem carregada para edição.', 'success');
    }
    
    async function excluirContagem(index) {
        if (!confirm('Deseja realmente excluir esta contagem?')) return;
        
        const c = state.contagensLocal[index];
        
        if (c.supabase_id && Database.supabase) {
            try {
                await Database.deleteContagem(c.supabase_id);
            } catch (err) {
                console.error('Erro ao excluir do Supabase:', err);
            }
        }
        
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens();
        renderizarHistorico();
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
    
    // Menu hamburguer
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (menuDropdown) menuDropdown.classList.toggle('show');
        });
    }
    
    document.addEventListener('click', () => {
        if (menuDropdown) menuDropdown.classList.remove('show');
    });
    
    if (menuDropdown) {
        menuDropdown.addEventListener('click', (e) => e.stopPropagation());
    }
    
    // Menu: Modo Escuro
    const menuDarkMode = $('#menuDarkMode');
    if (menuDarkMode) {
        menuDarkMode.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('blmez_darkmode', isDark ? '1' : '0');
            menuDarkMode.textContent = isDark ? '☀️ Modo Claro' : '🌓 Modo Escuro';
            if (menuDropdown) menuDropdown.classList.remove('show');
        });
    }
    
    // Menu: Sincronizar
    const menuSync = $('#menuSync');
    if (menuSync) {
        menuSync.addEventListener('click', async () => {
            if (menuDropdown) menuDropdown.classList.remove('show');
            await syncPendingContagens();
            if (state.pendingContagens.length === 0) {
                Utils.showToast('✅ Tudo sincronizado!', 'success');
            }
        });
    }
    
    // Menu: Backup
    const menuBackup = $('#menuBackup');
    if (menuBackup) {
        menuBackup.addEventListener('click', () => {
            if (menuDropdown) menuDropdown.classList.remove('show');
            if (state.contagensLocal.length === 0) {
                Utils.showToast('Nenhum dado para backup.', 'error');
                return;
            }
            const json = JSON.stringify(state.contagensLocal, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            Utils.downloadBlob(blob, 'backup_blmez_' + new Date().toISOString().slice(0,10) + '.json');
            Utils.showToast('Backup realizado!', 'success');
        });
    }
    
    // Menu: Restaurar
    const menuRestore = $('#menuRestore');
    if (menuRestore) {
        menuRestore.addEventListener('click', () => {
            if (menuDropdown) menuDropdown.classList.remove('show');
            if (restoreFileInput) restoreFileInput.click();
        });
    }
    
    if (restoreFileInput) {
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
    
    // Menu: Logout
    const menuLogout = $('#menuLogout');
    if (menuLogout) {
        menuLogout.addEventListener('click', () => {
            if (confirm('Deseja realmente sair?')) {
                Auth.logout();
            }
        });
    }
    
    // Abas de navegação
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tabContent = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
            if (tabContent) tabContent.classList.add('active');
            
            if (tab === 'historico') renderizarHistorico();
            if (tab === 'base') atualizarBaseInfo();
        });
    });
    
    // Importação Master (aba Gerenciar Base)
    if (importZoneMaster) {
        importZoneMaster.addEventListener('click', () => {
            if (fileInputMaster) fileInputMaster.click();
        });
    }
    
    if (fileInputMaster) {
        fileInputMaster.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                await importarBaseMaster(ev.target.result, file.name);
            };
            reader.readAsText(file);
            fileInputMaster.value = '';
        });
    }
    
    if (importZoneMaster) {
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
            reader.onload = async (ev) => {
                await importarBaseMaster(ev.target.result, file.name);
            };
            reader.readAsText(file);
        });
    }
    
    // Botão Recarregar Base
    if (btnRecarregarBase) {
        btnRecarregarBase.addEventListener('click', async () => {
            await carregarBaseDoSupabase();
        });
    }
    
    // Pesquisa de código
    function pesquisarEAtualizarCampos(codigo) {
        if (!codigo || !codigo.trim()) {
            if (inputDescricao) inputDescricao.value = '';
            if (inputEmbalagem) inputEmbalagem.value = '';
            return;
        }
        
        if (state.produtosMapCodAcesso.size === 0) {
            Utils.showToast('⚠️ Nenhuma base carregada. Importe um arquivo TXT primeiro.', 'error');
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
            Utils.showToast('❌ Produto não encontrado na base.', 'error');
        }
    }
    
    if (inputCodigo) {
        inputCodigo.addEventListener('change', () => {
            pesquisarEAtualizarCampos(inputCodigo.value);
        });
        
        inputCodigo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                pesquisarEAtualizarCampos(inputCodigo.value);
                if (inputDescricao && inputDescricao.value) {
                    if (inputQuantidade) inputQuantidade.focus();
                    if (inputQuantidade) inputQuantidade.select();
                }
            }
        });
        
        inputCodigo.addEventListener('blur', () => {
            if (inputCodigo.value.trim()) {
                pesquisarEAtualizarCampos(inputCodigo.value);
            }
        });
    }
    
    // Salvar contagem
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
            if (!descricao) { Utils.showToast('⚠️ Produto não encontrado na base.', 'error'); return; }
            if (quantidade <= 0) { Utils.showToast('⚠️ Quantidade deve ser maior que zero.', 'error'); if (inputQuantidade) inputQuantidade.focus(); return; }
            
            const faixa = parseInt(faixaStr);
            const dh = Utils.formatDataHora(new Date());
            
            const contagem = {
                localId: Utils.generateId(),
                rua: rua,
                faixa: faixa,
                codigo: codigo,
                descricao: descricao,
                embalagem: embalagem,
                quantidade: quantidade,
                observacoes: observacoes,
                data: dh.data,
                hora: dh.hora,
                dataISO: dh.iso,
                synced: false,
                usuario: currentUser.usuario,
                usuarioNome: currentUser.nome
            };
            
            const resultado = await salvarContagem(contagem);
            
            if (resultado === 'novo') {
                Utils.showToast('✅ Contagem salva com sucesso!', 'success');
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
        if (inputCodigo) inputCodigo.value = '';
        if (inputDescricao) inputDescricao.value = '';
        if (inputEmbalagem) inputEmbalagem.value = '';
        if (inputQuantidade) inputQuantidade.value = '1';
        if (inputObservacoes) inputObservacoes.value = '';
        if (inputCodigo) inputCodigo.classList.remove('input-success', 'input-error');
        if (inputRua) inputRua.focus();
    }
    
    if (btnNovaContagem) {
        btnNovaContagem.addEventListener('click', limparFormulario);
    }
    
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
                    pesquisarEAtualizarCampos(codigo);
                    if (!Camera.continuousMode) {
                        if (modalCamera) modalCamera.style.display = 'none';
                    }
                });
            }
        });
    }
    
    if (btnFecharCamera) {
        btnFecharCamera.addEventListener('click', () => {
            Camera.close();
            if (modalCamera) modalCamera.style.display = 'none';
        });
    }
    
    if (btnCameraContinuo) {
        btnCameraContinuo.addEventListener('click', () => {
            const isCont = Camera.toggleContinuous();
            if (modoCameraLabel) modoCameraLabel.textContent = isCont ? 'LIGADO' : 'DESLIGADO';
            if (btnCameraContinuo) {
                btnCameraContinuo.style.background = isCont ? 'var(--green)' : '';
                btnCameraContinuo.style.color = isCont ? 'white' : '';
            }
        });
    }
    
    if (modalCamera) {
        modalCamera.addEventListener('click', (e) => {
            if (e.target === modalCamera) {
                Camera.close();
                modalCamera.style.display = 'none';
            }
        });
    }
    
    // Modal duplicidade
    const btnEditarExistente = $('#btnEditarExistente');
    const btnSomarQuantidade = $('#btnSomarQuantidade');
    const btnCancelarDuplicidade = $('#btnCancelarDuplicidade');
    
    if (btnEditarExistente) {
        btnEditarExistente.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar');
        });
    }
    
    if (btnSomarQuantidade) {
        btnSomarQuantidade.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar');
        });
    }
    
    if (btnCancelarDuplicidade) {
        btnCancelarDuplicidade.addEventListener('click', () => {
            if (modalDuplicidade) modalDuplicidade.style.display = 'none';
            if (state.resolvendoDuplicidade) {
                state.resolvendoDuplicidade('cancelar');
                state.resolvendoDuplicidade = null;
            }
        });
    }
    
    if (modalDuplicidade) {
        modalDuplicidade.addEventListener('click', (e) => {
            if (e.target === modalDuplicidade) {
                modalDuplicidade.style.display = 'none';
                if (state.resolvendoDuplicidade) {
                    state.resolvendoDuplicidade('cancelar');
                    state.resolvendoDuplicidade = null;
                }
            }
        });
    }
    
    // Exportação (apenas master)
    function getDadosExportacao() {
        return getHistoricoFiltrado().map(c => ({
            Rua: c.rua,
            Faixa: c.faixa,
            'Código': c.codigo,
            'Descrição': c.descricao,
            Embalagem: c.embalagem,
            Quantidade: c.quantidade,
            Data: c.data || '',
            Hora: c.hora || '',
            'Observações': c.observacoes || '',
            'Usuário': c.usuarioNome || ''
        }));
    }
    
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            if (!isMaster) {
                Utils.showToast('Acesso restrito ao administrador.', 'error');
                return;
            }
            const dados = getDadosExportacao();
            if (dados.length === 0) {
                Utils.showToast('Nenhum dado para exportar.', 'error');
                return;
            }
            const cabecalho = ['Rua', 'Faixa', 'Código', 'Descrição', 'Embalagem', 'Quantidade', 'Data', 'Hora', 'Observações', 'Usuário'];
            const linhas = [cabecalho.join(';')];
            dados.forEach(d => {
                linhas.push(Object.values(d).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'));
            });
            const csv = '\uFEFF' + linhas.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            Utils.downloadBlob(blob, 'contagem_blmez_' + new Date().toISOString().slice(0,10) + '.csv');
            Utils.showToast('CSV exportado!', 'success');
        });
    }
    
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            if (!isMaster) {
                Utils.showToast('Acesso restrito ao administrador.', 'error');
                return;
            }
            const dados = getDadosExportacao();
            if (dados.length === 0) {
                Utils.showToast('Nenhum dado para exportar.', 'error');
                return;
            }
            if (typeof XLSX === 'undefined') {
                Utils.showToast('Biblioteca SheetJS não carregada.', 'error');
                return;
            }
            const ws = XLSX.utils.json_to_sheet(dados);
            ws['!cols'] = [
                { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 40 },
                { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 20 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Contagens');
            XLSX.writeFile(wb, 'contagem_blmez_' + new Date().toISOString().slice(0,10) + '.xlsx');
            Utils.showToast('Excel exportado!', 'success');
        });
    }
    
    // Filtros do histórico
    [filtroRua, filtroFaixa, filtroCodigo, filtroDescricao].forEach(input => {
        if (input) input.addEventListener('input', renderizarHistorico);
    });
    
    // Ordenação
    $$('thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (state.sortColumn === col) {
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortColumn = col;
                state.sortDirection = 'asc';
            }
            renderizarHistorico();
        });
    });
    
    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (Camera.isOpen) {
                Camera.close();
                if (modalCamera) modalCamera.style.display = 'none';
            }
            if (modalDuplicidade && modalDuplicidade.style.display === 'flex') {
                modalDuplicidade.style.display = 'none';
            }
            limparFormulario();
        }
        
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (btnSalvar) btnSalvar.click();
        }
        
        if (e.key === 'Enter' && document.activeElement === inputQuantidade) {
            e.preventDefault();
            if (btnSalvar) btnSalvar.click();
        }
    });
    
    // Online/Offline
    window.addEventListener('online', async () => {
        Utils.showToast('🌐 Conexão restaurada!', 'success');
        if (Database.supabase) {
            await syncPendingContagens();
            if (state.produtosMapCodAcesso.size === 0) {
                await carregarBaseDoSupabase();
            }
        }
    });
    
    window.addEventListener('offline', () => {
        Utils.showToast('📱 Modo offline. Dados salvos localmente.', 'warning');
    });
    
    // ============ INICIAR APLICAÇÃO ============
    init();
    
})();