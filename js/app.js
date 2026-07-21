(function() {
    'use strict';
    
    // Verificar acesso
    const currentUser = Auth.checkAccess();
    if (!currentUser) return;
    
    const isMaster = Auth.isMaster();
    
    // Atalhos DOM
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    
    // Elementos da UI
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
    
    // Estado
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
        
        // Exibir nome do usuário IMEDIATAMENTE
        if (userNameDisplay) {
            userNameDisplay.textContent = '👤 ' + (currentUser.nome || currentUser.usuario);
        }
        
        // Badge master
        if (isMaster) {
            if (masterBadge) masterBadge.style.display = 'inline';
            if (menuBase) menuBase.style.display = 'block';
            if (menuHistorico) menuHistorico.style.display = 'block';
        }
        
        // Carregar contagens primeiro (rápido, localStorage)
        loadContagens();
        
        // Metadados
        const meta = Database.loadBaseMeta();
        if (meta && !state.baseMeta) state.baseMeta = meta;
        
        // Renderizar interface imediatamente
        atualizarInfoImportacao();
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        atualizarBaseInfo();
        
        // Conectar ao Supabase
        console.log('🔌 Conectando ao Supabase...');
        const dbOk = Database.init();
        state.dbConnected = dbOk;
        updateConnectionDot();
        
        if (dbOk) {
            console.log('🔍 Testando conexão...');
            const testOk = await Database.testConnection();
            state.dbConnected = testOk;
            updateConnectionDot();
            
            if (testOk) {
                console.log('✅ Conectado! Carregando base...');
                await carregarBaseDoSupabase();
                await syncPendingContagens();
            } else {
                console.warn('⚠️ Falha no teste de conexão');
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Supabase offline - verificando...</span>';
            }
        } else {
            console.warn('⚠️ Database.init() falhou');
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
        console.log('   DB:', state.dbConnected ? 'Online' : 'Offline');
        console.log('   Produtos:', state.produtosMapCodAcesso.size);
        console.log('   Contagens:', state.contagensLocal.length);
    }
    
    function updateConnectionDot() {
        if (connectionDot) {
            connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
            connectionDot.title = state.dbConnected ? 'Supabase Online' : 'Supabase Offline';
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
            console.log('🔄 Carregando base...');
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
                if (importInfo) importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Base vazia</span>';
            }
        } catch (err) {
            console.error('❌ Erro:', err.message);
            if (importInfo) importInfo.innerHTML = '<span style="color:var(--red);">❌ ' + Utils.escapeHTML(err.message) + '</span>';
        }
    }
    
    function construirIndices(produtos) {
        state.produtosMapCodAcesso.clear();
        state.produtosMapSeqProduto.clear();
        
        for (const p of produtos) {
            const emb = p.embalagem && p.qtdembalagem ? p.embalagem + ' x ' + p.qtdembalagem : (p.embalagem || p.qtdembalagem || '');
            const prod = {
                seqProduto: p.seqproduto || '',
                descCompleta: p.desccompleta || '',
                codAcesso: p.codacesso || '',
                embalagem: p.embalagem || '',
                qtdEmbalagem: p.qtdembalagem || '',
                embalagemFormatada: emb
            };
            if (prod.codAcesso) state.produtosMapCodAcesso.set(prod.codAcesso, prod);
            if (prod.seqProduto) state.produtosMapSeqProduto.set(prod.seqProduto, prod);
        }
    }
    
    async function importarBaseMaster(conteudo, nomeArquivo) {
        if (!Database.supabase) { Utils.showToast('❌ Offline', 'error'); return; }
        
        progressBarMaster.classList.add('active');
        progressFillMaster.style.width = '0%';
        importStatusMaster.textContent = 'Processando...';
        
        try {
            const linhas = conteudo.split(/\r?\n/).filter(l => l.trim());
            if (!linhas.length) throw new Error('Vazio');
            
            const delimitadores = ['\t', ';', ','];
            let del = '\t', max = 0;
            delimitadores.forEach(d => { const c = linhas[0].split(d).length; if (c > max) { max = c; del = d; } });
            
            const cab = linhas[0].split(del);
            const inicio = cab.some(c => /seqproduto|codacesso/i.test(c)) ? 1 : 0;
            if (cab.length < 9) throw new Error('9 colunas necessárias');
            
            const arr = [];
            for (let i = inicio; i < linhas.length; i++) {
                const cols = linhas[i].split(del);
                if (cols.length < 9) continue;
                arr.push({
                    seqproduto: (cols[1]||'').trim(),
                    desccompleta: (cols[2]||'').trim(),
                    codacesso: (cols[3]||'').trim(),
                    embalagem: (cols[7]||'').trim(),
                    qtdembalagem: (cols[8]||'').trim()
                });
            }
            
            importStatusMaster.textContent = 'Enviando ' + arr.length + ' produtos...';
            
            await Database.replaceProdutos(arr, (p) => {
                progressFillMaster.style.width = p + '%';
                importStatusMaster.textContent = 'Enviando... ' + p + '%';
            });
            
            construirIndices(arr.map(p => ({
                seqproduto: p.seqproduto, desccompleta: p.desccompleta,
                codacesso: p.codacesso, embalagem: p.embalagem, qtdembalagem: p.qtdembalagem
            })));
            
            state.baseMeta = {
                nomeArquivo,
                totalRegistros: state.produtosMapCodAcesso.size,
                dataHoraImportacao: new Date().toISOString()
            };
            
            Database.saveBaseMeta(state.baseMeta);
            atualizarInfoImportacao();
            atualizarBaseInfo();
            
            importStatusMaster.innerHTML = '<span style="color:green">✅ ' + state.produtosMapCodAcesso.size + ' produtos</span>';
            Utils.showToast('✅ ' + state.produtosMapCodAcesso.size + ' produtos importados!', 'success');
            
        } catch (err) {
            importStatusMaster.innerHTML = '<span style="color:red">❌ ' + Utils.escapeHTML(err.message) + '</span>';
            Utils.showToast('❌ ' + err.message, 'error');
        } finally {
            progressBarMaster.classList.remove('active');
        }
    }
    
    function atualizarInfoImportacao() {
        if (!importInfo) return;
        if (!state.baseMeta || state.produtosMapCodAcesso.size === 0) {
            importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Nenhuma base carregada.</span>';
            return;
        }
        const dh = Utils.formatDataHora(state.baseMeta.dataHoraImportacao);
        importInfo.innerHTML =
            '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> ' +
            '<span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> ' +
            '<span>📅 ' + dh.data + ' ' + dh.hora + '</span> ' +
            '<span class="badge">☁️ Supabase</span>';
    }
    
    function atualizarBaseInfo() {
        if (baseInfo) baseInfo.textContent = state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' produtos na base';
    }
    
    // ============ PESQUISA ============
    function pesquisarProduto(codigo) {
        if (!codigo?.trim()) return null;
        const c = codigo.trim();
        if (state.produtosMapCodAcesso.has(c)) return state.produtosMapCodAcesso.get(c);
        if (state.produtosMapSeqProduto.has(c)) return state.produtosMapSeqProduto.get(c);
        for (const [k, v] of state.produtosMapCodAcesso) if (k.startsWith(c)) return v;
        return null;
    }
    
    // ============ CONTAGENS ============
    function loadContagens() {
        try {
            state.contagensLocal = JSON.parse(localStorage.getItem(Database.KEYS.CONTAGENS) || '[]');
            state.pendingContagens = JSON.parse(localStorage.getItem(Database.KEYS.PENDING) || '[]');
        } catch (e) { state.contagensLocal = []; state.pendingContagens = []; }
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
                    if (op === 'editar') state.contagensLocal[idx] = { ...contagem, synced: false, localId: state.contagensLocal[idx].localId };
                    else if (op === 'somar') { state.contagensLocal[idx].quantidade += contagem.quantidade; state.contagensLocal[idx].synced = false; }
                    saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
                    state.resolvendoDuplicidade = null;
                    resolve(op);
                };
                msgDuplicidade.innerHTML = '<strong>' + state.contagensLocal[idx].rua + '</strong> / Faixa ' + state.contagensLocal[idx].faixa + '<br>Qtd: ' + state.contagensLocal[idx].quantidade + ' | Nova: ' + contagem.quantidade;
                modalDuplicidade.style.display = 'flex';
            });
        }
        
        state.contagensLocal.push(contagem);
        state.pendingContagens.push(contagem);
        saveContagens();
        if (Database.supabase && navigator.onLine) await syncPendingContagens();
        return 'novo';
    }
    
    async function syncPendingContagens() {
        if (!Database.supabase || !state.pendingContagens.length) return;
        for (const c of [...state.pendingContagens]) {
            try {
                const res = await Database.saveContagem({
                    rua: c.rua, faixa: c.faixa, codigo: c.codigo,
                    descricao: c.descricao, embalagem: c.embalagem,
                    quantidade: c.quantidade, observacoes: c.observacoes || '',
                    data: c.data, hora: c.hora
                });
                c.synced = true; c.supabase_id = res.id;
                state.pendingContagens = state.pendingContagens.filter(x => x.localId !== c.localId);
            } catch (e) {}
        }
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
    }
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        let lista = [...state.contagensLocal];
        if (filtroRua?.value.trim()) lista = lista.filter(c => c.rua.toLowerCase().includes(filtroRua.value.toLowerCase().trim()));
        if (filtroFaixa?.value.trim()) lista = lista.filter(c => String(c.faixa).includes(filtroFaixa.value.trim()));
        if (filtroCodigo?.value.trim()) lista = lista.filter(c => c.codigo.toLowerCase().includes(filtroCodigo.value.toLowerCase().trim()));
        if (filtroDescricao?.value.trim()) lista = lista.filter(c => c.descricao.toLowerCase().includes(filtroDescricao.value.toLowerCase().trim()));
        
        if (state.sortColumn) {
            lista.sort((a, b) => {
                let va = a[state.sortColumn], vb = b[state.sortColumn];
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
        if (!lista.length) {
            if (nenhumRegistro) nenhumRegistro.style.display = 'block';
        } else {
            if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            lista.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML =
                    '<td>' + Utils.escapeHTML(c.rua) + '</td>' +
                    '<td>' + c.faixa + '</td>' +
                    '<td>' + Utils.escapeHTML(c.codigo) + ' ' + (c.synced ? '☁️' : '📱') + '</td>' +
                    '<td>' + Utils.escapeHTML(c.descricao) + '</td>' +
                    '<td>' + Utils.escapeHTML(c.embalagem) + '</td>' +
                    '<td><strong>' + c.quantidade + '</strong></td>' +
                    '<td>' + (c.data || '--') + '</td>' +
                    '<td>' + (c.hora || '--') + '</td>' +
                    '<td><button class="btn btn-outline btn-sm btn-editar" data-id="' + c.localId + '">✏️</button> <button class="btn btn-danger-text btn-sm btn-excluir" data-id="' + c.localId + '">🗑️</button></td>';
                tabelaHistorico.appendChild(tr);
            });
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(b => b.addEventListener('click', function() {
                const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                if (i >= 0) editarContagem(i);
            }));
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(b => b.addEventListener('click', function() {
                const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id);
                if (i >= 0) excluirContagem(i);
            }));
        }
    }
    
    function renderizarDashboard() {
        if (!tabelaDashboard) return;
        const ruas = {};
        state.contagensLocal.forEach(c => {
            if (!ruas[c.rua]) ruas[c.rua] = { itens: 0, paletes: 0, ultima: '' };
            ruas[c.rua].itens++;
            ruas[c.rua].paletes += c.quantidade;
            if (!ruas[c.rua].ultima || new Date(c.dataISO) > new Date(ruas[c.rua].ultima)) ruas[c.rua].ultima = c.dataISO;
        });
        tabelaDashboard.innerHTML = '';
        const entradas = Object.entries(ruas);
        if (!entradas.length) {
            if (nenhumDashboard) nenhumDashboard.style.display = 'block';
        } else {
            if (nenhumDashboard) nenhumDashboard.style.display = 'none';
            entradas.forEach(([rua, dados]) => {
                const dh = dados.ultima ? Utils.formatDataHora(dados.ultima) : { data: '--', hora: '--' };
                const tr = document.createElement('tr');
                tr.innerHTML = '<td><strong>' + Utils.escapeHTML(rua) + '</strong></td><td>' + dados.itens + '</td><td>' + dados.paletes + '</td><td>' + dh.data + ' ' + dh.hora + '</td>';
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
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
        abrirSecao('contagem');
        Utils.showToast('Editando...', 'success');
    }
    
    async function excluirContagem(index) {
        if (!confirm('Excluir?')) return;
        const c = state.contagensLocal[index];
        if (c.supabase_id && Database.supabase) await Database.deleteContagem(c.supabase_id);
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
    }
    
    function atualizarEstatisticas() {
        if (statItens) statItens.textContent = state.contagensLocal.length.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensLocal.reduce((s, c) => s + (c.quantidade || 0), 0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensLocal.map(c => c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensLocal.length) {
            const u = state.contagensLocal[state.contagensLocal.length - 1];
            statUltima.textContent = (u.data || '--') + ' ' + (u.hora || '--');
        }
    }
    
    // ============ EVENTOS ============
    function setupEventListeners() {
        if (hamburgerBtn) hamburgerBtn.addEventListener('click', abrirSidebar);
        if (sidebarClose) sidebarClose.addEventListener('click', fecharSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', fecharSidebar);
        
        $$('.sidebar-item[data-section]').forEach(item => item.addEventListener('click', () => abrirSecao(item.dataset.section)));
        
        const darkBtn = $('#menuDarkMode');
        if (darkBtn) darkBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('blmez_darkmode', isDark ? '1' : '0');
            darkBtn.textContent = isDark ? '☀️ Modo Claro' : '🌓 Modo Escuro';
        });
        
        $('#menuSync')?.addEventListener('click', async () => { await syncPendingContagens(); Utils.showToast('✅ Sincronizado!', 'success'); });
        $('#menuBackup')?.addEventListener('click', () => {
            if (!state.contagensLocal.length) { Utils.showToast('Nenhum dado', 'error'); return; }
            const blob = new Blob([JSON.stringify(state.contagensLocal, null, 2)], { type: 'application/json' });
            Utils.downloadBlob(blob, 'backup_' + new Date().toISOString().slice(0, 10) + '.json');
            Utils.showToast('Backup OK', 'success');
        });
        $('#menuRestore')?.addEventListener('click', () => restoreFileInput?.click());
        
        if (restoreFileInput) restoreFileInput.addEventListener('change', (e) => {
            if (!e.target.files[0]) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const dados = JSON.parse(ev.target.result);
                    if (!Array.isArray(dados)) throw new Error('Inválido');
                    if (confirm('Restaurar ' + dados.length + ' registros?')) {
                        state.contagensLocal = dados;
                        state.pendingContagens = dados.filter(c => !c.synced);
                        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
                        Utils.showToast('✅ Restaurado!', 'success');
                    }
                } catch (err) { Utils.showToast('Arquivo inválido', 'error'); }
            };
            reader.readAsText(e.target.files[0]);
            e.target.value = '';
        });
        
        $('#menuLogout')?.addEventListener('click', () => { if (confirm('Sair?')) Auth.logout(); });
        
        // Importação
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
            importZoneMaster.addEventListener('dragover', (e) => { e.preventDefault(); importZoneMaster.classList.add('drag-over'); });
            importZoneMaster.addEventListener('dragleave', () => importZoneMaster.classList.remove('drag-over'));
            importZoneMaster.addEventListener('drop', async (e) => {
                e.preventDefault(); importZoneMaster.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name);
                reader.readAsText(file);
            });
        }
        
        btnRecarregarBase?.addEventListener('click', carregarBaseDoSupabase);
        
        // Pesquisa
        if (inputCodigo) {
            inputCodigo.addEventListener('change', () => pesquisarEAtualizar(inputCodigo.value));
            inputCodigo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); pesquisarEAtualizar(inputCodigo.value); if (inputDescricao?.value) { inputQuantidade?.focus(); inputQuantidade?.select(); } }
            });
        }
        
        function pesquisarEAtualizar(codigo) {
            if (!codigo?.trim()) { if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = ''; return; }
            if (!state.produtosMapCodAcesso.size) { Utils.showToast('⚠️ Base vazia', 'error'); return; }
            const prod = pesquisarProduto(codigo);
            if (prod) {
                if (inputDescricao) inputDescricao.value = prod.descCompleta;
                if (inputEmbalagem) inputEmbalagem.value = prod.embalagemFormatada;
                if (inputCodigo) inputCodigo.classList.add('input-success');
                setTimeout(() => inputCodigo?.classList.remove('input-success'), 1500);
                Utils.playBeep(); Utils.vibrate(40);
            } else {
                if (inputDescricao) inputDescricao.value = '';
                if (inputEmbalagem) inputEmbalagem.value = '';
                if (inputCodigo) inputCodigo.classList.add('input-error');
                setTimeout(() => inputCodigo?.classList.remove('input-error'), 1500);
                Utils.showToast('❌ Não encontrado', 'error');
            }
        }
        
        // Salvar
        btnSalvar?.addEventListener('click', async () => {
            const rua = inputRua?.value.trim() || '';
            const faixa = parseInt(inputFaixa?.value) || 0;
            const codigo = inputCodigo?.value.trim() || '';
            const desc = inputDescricao?.value.trim() || '';
            const emb = inputEmbalagem?.value.trim() || '';
            const qtd = parseInt(inputQuantidade?.value) || 0;
            const obs = inputObservacoes?.value.trim() || '';
            
            if (!rua || !faixa || !codigo || !desc || qtd <= 0) { Utils.showToast('⚠️ Preencha todos', 'error'); return; }
            
            const dh = Utils.formatDataHora(new Date());
            const contagem = { localId: Utils.generateId(), rua, faixa, codigo, descricao: desc, embalagem: emb, quantidade: qtd, observacoes: obs, data: dh.data, hora: dh.hora, dataISO: dh.iso, synced: false, usuario: currentUser.usuario, usuarioNome: currentUser.nome };
            const res = await salvarContagem(contagem);
            if (res !== 'cancelar') {
                Utils.showToast('✅ Salvo!', 'success');
                if (inputRua) inputRua.value = '';
                if (inputFaixa) inputFaixa.value = '';
                if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success', 'input-error'); }
                if (inputDescricao) inputDescricao.value = '';
                if (inputEmbalagem) inputEmbalagem.value = '';
                if (inputQuantidade) inputQuantidade.value = '1';
                if (inputObservacoes) inputObservacoes.value = '';
                if (inputRua) inputRua.focus();
            }
            renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
        });
        
        btnNovaContagem?.addEventListener('click', () => {
            if (inputRua) inputRua.value = '';
            if (inputFaixa) inputFaixa.value = '';
            if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success', 'input-error'); }
            if (inputDescricao) inputDescricao.value = '';
            if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputQuantidade) inputQuantidade.value = '1';
            if (inputObservacoes) inputObservacoes.value = '';
            if (inputRua) inputRua.focus();
        });
        
        // Câmera
        btnCamera?.addEventListener('click', () => {
            if (Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; }
            else { if (modalCamera) modalCamera.style.display = 'flex'; Camera.open(cameraVideo, (codigo) => { if (inputCodigo) inputCodigo.value = codigo; pesquisarEAtualizar(codigo); if (!Camera.continuousMode && modalCamera) modalCamera.style.display = 'none'; }); }
        });
        btnFecharCamera?.addEventListener('click', () => { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; });
        btnCameraContinuo?.addEventListener('click', () => {
            const cont = Camera.toggleContinuous();
            if (modoCameraLabel) modoCameraLabel.textContent = cont ? 'LIGADO' : 'DESLIGADO';
        });
        
        // Duplicidade
        $('#btnEditarExistente')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar'); });
        $('#btnSomarQuantidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar'); });
        $('#btnCancelarDuplicidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; state.resolvendoDuplicidade = null; });
        
        // Exportação
        btnExportCSV?.addEventListener('click', () => {
            if (!isMaster) { Utils.showToast('Acesso restrito', 'error'); return; }
            const dados = getHistoricoFiltrado().map(c => ({ Rua: c.rua, Faixa: c.faixa, Código: c.codigo, Descrição: c.descricao, Embalagem: c.embalagem, Quantidade: c.quantidade, Data: c.data || '', Hora: c.hora || '', Observações: c.observacoes || '' }));
            if (!dados.length) { Utils.showToast('Nenhum dado', 'error'); return; }
            const cab = Object.keys(dados[0]).join(';');
            const csv = '\uFEFF' + [cab, ...dados.map(d => Object.values(d).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'))].join('\n');
            Utils.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'contagem_' + new Date().toISOString().slice(0, 10) + '.csv');
        });
        
        btnExportExcel?.addEventListener('click', () => {
            if (!isMaster) { Utils.showToast('Acesso restrito', 'error'); return; }
            const dados = getHistoricoFiltrado().map(c => ({ Rua: c.rua, Faixa: c.faixa, Código: c.codigo, Descrição: c.descricao, Embalagem: c.embalagem, Quantidade: c.quantidade, Data: c.data || '', Hora: c.hora || '', Observações: c.observacoes || '' }));
            if (!dados.length) { Utils.showToast('Nenhum dado', 'error'); return; }
            const ws = XLSX.utils.json_to_sheet(dados);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Contagens');
            XLSX.writeFile(wb, 'contagem_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        });
        
        // Filtros e ordenação
        [filtroRua, filtroFaixa, filtroCodigo, filtroDescricao].forEach(i => i?.addEventListener('input', renderizarHistorico));
        $$('thead th[data-sort]').forEach(th => th.addEventListener('click', () => {
            const col = th.dataset.sort;
            state.sortDirection = state.sortColumn === col ? (state.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
            state.sortColumn = col;
            renderizarHistorico();
        }));
        
        // Atalhos
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; }
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); btnSalvar?.click(); }
            if (e.key === 'Enter' && document.activeElement === inputQuantidade) { e.preventDefault(); btnSalvar?.click(); }
        });
        
        // Online/Offline
        window.addEventListener('online', async () => {
            Utils.showToast('🌐 Online!', 'success');
            state.dbConnected = true;
            updateConnectionDot();
            if (Database.supabase) {
                await syncPendingContagens();
                if (!state.produtosMapCodAcesso.size) await carregarBaseDoSupabase();
            }
        });
        
        window.addEventListener('offline', () => {
            Utils.showToast('📱 Offline', 'warning');
            state.dbConnected = false;
            updateConnectionDot();
        });
    }
    
    // Iniciar
    init();
})();