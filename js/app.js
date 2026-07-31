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
    const menuUsuarios = $('#menuUsuarios');
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
    const tabelaUsuarios = $('#tabelaUsuarios');
    const nenhumUsuario = $('#nenhumUsuario');
    const btnAddUser = $('#btnAddUser');
    const novoNome = $('#novoNome');
    const novoUsuario = $('#novoUsuario');
    const novaSenha = $('#novaSenha');
    const novoRole = $('#novoRole');
    
    const state = {
        produtosMapCodAcesso: new Map(),
        produtosMapSeqProduto: new Map(),
        baseMeta: null,
        contagensLocal: [],
        pendingContagens: [],
        sortColumn: null,
        sortDirection: 'asc',
        resolvendoDuplicidade: null,
        dbConnected: false,
        salvandoContagem: false
    };
    
    // ============ INICIALIZAÇÃO ============
    async function init() {
        console.log('🚀 Iniciando Contagem BL_MEZ...');
        console.log('👤 Usuário:', currentUser.nome, '| Master:', isMaster);
        
        if (userNameDisplay) {
            userNameDisplay.textContent = '👤 ' + (currentUser.nome || currentUser.usuario);
        }
        
        if (isMaster) {
            if (masterBadge) masterBadge.style.display = 'inline';
            if (menuBase) menuBase.style.display = 'block';
            if (menuHistorico) menuHistorico.style.display = 'block';
            if (menuUsuarios) menuUsuarios.style.display = 'block';
        }
        
        loadContagens();
        
        const meta = Database.loadBaseMeta();
        if (meta && !state.baseMeta) state.baseMeta = meta;
        
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        atualizarBaseInfo();
        
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
            }
        }
        
        atualizarInfoImportacao();
        atualizarBaseInfo();
        
        if (localStorage.getItem('blmez_darkmode') === '1') {
            document.body.classList.add('dark-mode');
            const darkBtn = $('#menuDarkMode');
            if (darkBtn) darkBtn.textContent = '☀️ Modo Claro';
        }
        
        setupEventListeners();
        abrirSecao('contagem');
        
        console.log('✅ Pronto!');
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
        ['secaoContagem', 'secaoBase', 'secaoHistorico', 'secaoDashboard', 'secaoUsuarios'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        
        const mapa = {
            contagem: 'secaoContagem',
            base: 'secaoBase',
            historico: 'secaoHistorico',
            dashboard: 'secaoDashboard',
            usuarios: 'secaoUsuarios'
        };
        
        const secao = document.getElementById(mapa[nome]);
        if (secao) secao.classList.add('active');
        
        $$('.sidebar-item[data-section]').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === nome) item.classList.add('active');
        });
        
        if (nome === 'historico') renderizarHistorico();
        if (nome === 'dashboard') { renderizarDashboard(); atualizarEstatisticas(); }
        if (nome === 'base') { atualizarInfoImportacao(); atualizarBaseInfo(); }
        if (nome === 'usuarios') renderizarUsuarios();
        
        fecharSidebar();
    }
    
    // ============ BASE DE PRODUTOS ============
    async function carregarBaseDoSupabase() {
        if (!Database.supabase) return;
        try {
            const produtos = await Database.fetchProdutos();
            if (produtos && produtos.length > 0) {
                construirIndices(produtos);
                state.baseMeta = { nomeArquivo: 'Supabase', totalRegistros: produtos.length, dataHoraImportacao: new Date().toISOString() };
                Database.saveBaseMeta(state.baseMeta);
                atualizarInfoImportacao();
                atualizarBaseInfo();
            }
        } catch (err) {}
    }
    
    function construirIndices(produtos) {
        state.produtosMapCodAcesso.clear();
        state.produtosMapSeqProduto.clear();
        for (const p of produtos) {
            const emb = p.embalagem && p.qtdembalagem ? p.embalagem + ' x ' + p.qtdembalagem : (p.embalagem || p.qtdembalagem || '');
            const prod = { seqProduto: p.seqproduto || '', descCompleta: p.desccompleta || '', codAcesso: p.codacesso || '', embalagem: p.embalagem || '', qtdEmbalagem: p.qtdembalagem || '', embalagemFormatada: emb };
            if (prod.codAcesso) state.produtosMapCodAcesso.set(prod.codAcesso, prod);
            if (prod.seqProduto) state.produtosMapSeqProduto.set(prod.seqProduto, prod);
        }
    }
    
    async function importarBaseMaster(conteudo, nomeArquivo) {
        if (!Database.supabase) { Utils.showToast('❌ Offline', 'error'); return; }
        progressBarMaster.classList.add('active');
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
                arr.push({ seqproduto: (cols[1]||'').trim(), desccompleta: (cols[2]||'').trim(), codacesso: (cols[3]||'').trim(), embalagem: (cols[7]||'').trim(), qtdembalagem: (cols[8]||'').trim() });
            }
            await Database.replaceProdutos(arr, (p) => { progressFillMaster.style.width = p + '%'; });
            construirIndices(arr.map(p => ({ seqproduto: p.seqproduto, desccompleta: p.desccompleta, codacesso: p.codacesso, embalagem: p.embalagem, qtdembalagem: p.qtdembalagem })));
            state.baseMeta = { nomeArquivo, totalRegistros: state.produtosMapCodAcesso.size, dataHoraImportacao: new Date().toISOString() };
            Database.saveBaseMeta(state.baseMeta);
            atualizarInfoImportacao();
            atualizarBaseInfo();
            importStatusMaster.innerHTML = '<span style="color:green">✅ ' + state.produtosMapCodAcesso.size + ' produtos</span>';
        } catch (err) {
            importStatusMaster.innerHTML = '<span style="color:red">❌ ' + Utils.escapeHTML(err.message) + '</span>';
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
        importInfo.innerHTML = '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> <span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> <span>📅 ' + dh.data + ' ' + dh.hora + '</span> <span class="badge">☁️ ' + (state.dbConnected ? 'Supabase' : 'Local') + '</span>';
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
            state.resolvendoDuplicidade = async (op) => {
                state.resolvendoDuplicidade = null;
                
                if (op === 'editar') {
                    // Atualizar contagem existente
                    state.contagensLocal[idx] = { 
                        ...contagem, 
                        synced: false, 
                        localId: state.contagensLocal[idx].localId,
                        supabase_id: state.contagensLocal[idx].supabase_id || null
                    };
                } else if (op === 'somar') {
                    // Somar quantidades
                    state.contagensLocal[idx].quantidade += contagem.quantidade;
                    state.contagensLocal[idx].observacoes = contagem.observacoes || state.contagensLocal[idx].observacoes || '';
                    state.contagensLocal[idx].data = contagem.data;
                    state.contagensLocal[idx].hora = contagem.hora;
                    state.contagensLocal[idx].dataISO = contagem.dataISO;
                    state.contagensLocal[idx].synced = false;
                    state.contagensLocal[idx].usuario = contagem.usuario;
                    state.contagensLocal[idx].usuarioNome = contagem.usuarioNome;
                }
                
                saveContagens();
                
                // ⚡ ENVIAR ATUALIZAÇÃO PARA O SUPABASE
                if (Database.supabase && navigator.onLine && state.contagensLocal[idx].supabase_id) {
                    try {
                        const c = state.contagensLocal[idx];
                        await Database.supabase
                            .from('contagens')
                            .update({
                                quantidade: c.quantidade,
                                observacoes: c.observacoes || '',
                                data: c.data,
                                hora: c.hora,
                                usuario: c.usuario || '',
                                usuario_nome: c.usuarioNome || ''
                            })
                            .eq('id', c.supabase_id);
                        
                        state.contagensLocal[idx].synced = true;
                        saveContagens();
                        console.log('✅ Contagem atualizada no Supabase');
                    } catch (err) {
                        console.error('❌ Erro ao atualizar no Supabase:', err);
                        // Adiciona na fila de pendentes para sincronizar depois
                        state.pendingContagens.push(state.contagensLocal[idx]);
                        saveContagens();
                    }
                } else if (Database.supabase && navigator.onLine && !state.contagensLocal[idx].supabase_id) {
                    // Se não tem supabase_id, tenta criar um novo registro
                    try {
                        const c = state.contagensLocal[idx];
                        const res = await Database.saveContagem({
                            rua: c.rua, faixa: c.faixa, codigo: c.codigo,
                            descricao: c.descricao, embalagem: c.embalagem,
                            quantidade: c.quantidade, observacoes: c.observacoes || '',
                            data: c.data, hora: c.hora,
                            usuario: c.usuario || '', usuario_nome: c.usuarioNome || ''
                        });
                        state.contagensLocal[idx].supabase_id = res.id;
                        state.contagensLocal[idx].synced = true;
                        saveContagens();
                        console.log('✅ Contagem criada no Supabase');
                    } catch (err) {
                        console.error('❌ Erro ao criar no Supabase:', err);
                    }
                }
                
                renderizarHistorico();
                renderizarDashboard();
                atualizarEstatisticas();
                resolve(op);
            };
            
            msgDuplicidade.innerHTML = '<strong>' + state.contagensLocal[idx].rua + '</strong> / Faixa ' + state.contagensLocal[idx].faixa + '<br>Qtd atual: ' + state.contagensLocal[idx].quantidade + ' | Nova: ' + contagem.quantidade;
            modalDuplicidade.style.display = 'flex';
        });
    }
    
    // Nova contagem
    state.contagensLocal.push(contagem);
    state.pendingContagens.push(contagem);
    saveContagens();
    if (Database.supabase && navigator.onLine) await syncPendingContagens();
    return 'novo';
}
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        let lista = [...state.contagensLocal];
        if (filtroRua?.value.trim()) lista = lista.filter(c => c.rua.toLowerCase().includes(filtroRua.value.toLowerCase().trim()));
        if (filtroFaixa?.value.trim()) lista = lista.filter(c => String(c.faixa).includes(filtroFaixa.value.trim()));
        if (filtroCodigo?.value.trim()) lista = lista.filter(c => c.codigo.toLowerCase().includes(filtroCodigo.value.toLowerCase().trim()));
        if (filtroDescricao?.value.trim()) lista = lista.filter(c => c.descricao.toLowerCase().includes(filtroDescricao.value.toLowerCase().trim()));
        if (state.sortColumn) {
            lista.sort((a, b) => { let va = a[state.sortColumn], vb = b[state.sortColumn]; if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase(); return state.sortDirection === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1); });
        } else {
            lista.sort((a, b) => new Date(b.dataISO || 0) - new Date(a.dataISO || 0));
        }
        return lista;
    }
    
    function renderizarHistorico() {
        if (!tabelaHistorico) return;
        const lista = getHistoricoFiltrado();
        tabelaHistorico.innerHTML = '';
        if (!lista.length) { if (nenhumRegistro) nenhumRegistro.style.display = 'block'; }
        else {
            if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            lista.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td>' + Utils.escapeHTML(c.rua) + '</td><td>' + c.faixa + '</td><td>' + Utils.escapeHTML(c.codigo) + ' ' + (c.synced ? '☁️' : '📱') + '</td><td>' + Utils.escapeHTML(c.descricao) + '</td><td>' + Utils.escapeHTML(c.embalagem) + '</td><td><strong>' + c.quantidade + '</strong></td><td>' + (c.data || '--') + '</td><td>' + (c.hora || '--') + '</td><td>' + Utils.escapeHTML(c.usuarioNome || c.usuario || '--') + '</td><td><button class="btn btn-outline btn-sm btn-editar" data-id="' + c.localId + '">✏️</button> <button class="btn btn-danger-text btn-sm btn-excluir" data-id="' + c.localId + '">🗑️</button></td>';
                tabelaHistorico.appendChild(tr);
            });
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(b => b.addEventListener('click', function() { const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id); if (i >= 0) editarContagem(i); }));
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(b => b.addEventListener('click', function() { const i = state.contagensLocal.findIndex(c => c.localId === this.dataset.id); if (i >= 0) excluirContagem(i); }));
        }
    }
    
    function renderizarDashboard() {
        if (!tabelaDashboard) return;
        const ruas = {};
        state.contagensLocal.forEach(c => {
            if (!ruas[c.rua]) ruas[c.rua] = { itens: 0, paletes: 0, ultima: '' };
            ruas[c.rua].itens++; ruas[c.rua].paletes += c.quantidade;
            if (!ruas[c.rua].ultima || new Date(c.dataISO) > new Date(ruas[c.rua].ultima)) ruas[c.rua].ultima = c.dataISO;
        });
        tabelaDashboard.innerHTML = '';
        const entradas = Object.entries(ruas);
        if (!entradas.length) { if (nenhumDashboard) nenhumDashboard.style.display = 'block'; }
        else {
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
        if (statUltima && state.contagensLocal.length) { const u = state.contagensLocal[state.contagensLocal.length - 1]; statUltima.textContent = (u.data || '--') + ' ' + (u.hora || '--'); }
    }
    
    // ============ USUÁRIOS ============
    async function renderizarUsuarios() {
        if (!tabelaUsuarios) return;
        const users = await Auth.getAllUsers();
        tabelaUsuarios.innerHTML = '';
        if (!users.length) { if (nenhumUsuario) nenhumUsuario.style.display = 'block'; }
        else {
            if (nenhumUsuario) nenhumUsuario.style.display = 'none';
            users.forEach(u => {
                const tr = document.createElement('tr');
                const dataCriacao = u.created_at ? Utils.formatDataHora(u.created_at) : { data: '--', hora: '--' };
                tr.innerHTML = '<td>' + Utils.escapeHTML(u.nome) + '</td><td>' + Utils.escapeHTML(u.usuario) + '</td><td><span class="badge" style="background:' + (u.role === 'master' ? '#FFD700' : 'var(--blue-light)') + ';color:' + (u.role === 'master' ? '#000' : 'var(--blue)') + ';">' + (u.role === 'master' ? '👑 Master' : '👤 Usuário') + '</span></td><td>' + (u.ativo !== false ? '🟢 Ativo' : '🔴 Inativo') + '</td><td>' + dataCriacao.data + '</td><td>' + (u.usuario !== '5461448' ? '<button class="btn btn-outline btn-sm btn-toggle-user" data-user="' + u.usuario + '" data-role="' + (u.role === 'master' ? 'user' : 'master') + '">' + (u.role === 'master' ? '⬇ Tornar Usuário' : '⬆ Tornar Master') + '</button> <button class="btn btn-danger-text btn-sm btn-delete-user" data-user="' + u.usuario + '">🗑️</button>' : '<span style="font-size:0.75rem;color:var(--text-muted);">Admin principal</span>') + '</td>';
                tabelaUsuarios.appendChild(tr);
            });
            tabelaUsuarios.querySelectorAll('.btn-toggle-user').forEach(btn => {
                btn.addEventListener('click', async function() {
                    if (confirm('Alterar tipo de "' + this.dataset.user + '"?')) {
                        await Auth.updateUser(this.dataset.user, { role: this.dataset.role });
                        Utils.showToast('✅ Atualizado!', 'success');
                        renderizarUsuarios();
                    }
                });
            });
            tabelaUsuarios.querySelectorAll('.btn-delete-user').forEach(btn => {
                btn.addEventListener('click', async function() {
                    if (confirm('Excluir "' + this.dataset.user + '"?')) {
                        const r = await Auth.deleteUser(this.dataset.user);
                        if (r.sucesso) { Utils.showToast('✅ Excluído!', 'success'); renderizarUsuarios(); }
                        else Utils.showToast('❌ ' + r.mensagem, 'error');
                    }
                });
            });
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
            localStorage.setItem('blmez_darkmode', document.body.classList.contains('dark-mode') ? '1' : '0');
            darkBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️ Modo Claro' : '🌓 Modo Escuro';
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
                    if (confirm('Restaurar ' + dados.length + ' registros?')) { state.contagensLocal = dados; state.pendingContagens = dados.filter(c => !c.synced); saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas(); Utils.showToast('✅ Restaurado!', 'success'); }
                } catch (err) { Utils.showToast('Arquivo inválido', 'error'); }
            };
            reader.readAsText(e.target.files[0]); e.target.value = '';
        });
        $('#menuLogout')?.addEventListener('click', () => { if (confirm('Sair?')) Auth.logout(); });
        
        // Adicionar usuário
        if (btnAddUser) {
            btnAddUser.addEventListener('click', () => {
                const nome = novoNome?.value.trim() || '';
                const usuario = novoUsuario?.value.trim() || '';
                const senha = novaSenha?.value || '';
                const role = novoRole?.value || 'user';
                if (!nome || !usuario || !senha) { Utils.showToast('⚠️ Preencha todos', 'error'); return; }
                const resultado = Auth.cadastrar(nome, usuario, senha);
                if (resultado.sucesso) {
                    if (role === 'master') Auth.updateUser(usuario, { role: 'master' });
                    Utils.showToast('✅ Usuário criado!', 'success');
                    if (novoNome) novoNome.value = '';
                    if (novoUsuario) novoUsuario.value = '';
                    if (novaSenha) novaSenha.value = '';
                    renderizarUsuarios();
                } else Utils.showToast('❌ ' + resultado.mensagem, 'error');
            });
        }
        
        // Importação
        if (importZoneMaster && fileInputMaster) {
            importZoneMaster.addEventListener('click', () => fileInputMaster.click());
            fileInputMaster.addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name); reader.readAsText(file); fileInputMaster.value = ''; });
            importZoneMaster.addEventListener('dragover', (e) => { e.preventDefault(); importZoneMaster.classList.add('drag-over'); });
            importZoneMaster.addEventListener('dragleave', () => importZoneMaster.classList.remove('drag-over'));
            importZoneMaster.addEventListener('drop', async (e) => { e.preventDefault(); importZoneMaster.classList.remove('drag-over'); const file = e.dataTransfer.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name); reader.readAsText(file); });
        }
        btnRecarregarBase?.addEventListener('click', carregarBaseDoSupabase);
        
        // Pesquisa de código - NÃO salva ao sair do campo
        if (inputCodigo) {
            inputCodigo.addEventListener('change', () => processarCodigo(inputCodigo.value));
            inputCodigo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    processarCodigo(inputCodigo.value);
                    // Focar no próximo campo (quantidade) só se encontrou produto
                    if (inputDescricao?.value && inputQuantidade) {
                        inputQuantidade.focus();
                        inputQuantidade.select();
                    }
                }
            });
        }
        
        function processarCodigo(codigoDigitado) {
            if (!codigoDigitado?.trim()) { if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = ''; return; }
            if (!state.produtosMapCodAcesso.size) { Utils.showToast('⚠️ Base vazia', 'error'); return; }
            const produto = pesquisarProduto(codigoDigitado);
            if (produto) {
                if (inputDescricao) inputDescricao.value = produto.descCompleta;
                if (inputEmbalagem) inputEmbalagem.value = produto.embalagemFormatada;
                if (inputCodigo) {
                    inputCodigo.value = produto.seqProduto || codigoDigitado;
                    inputCodigo.classList.add('input-success');
                    setTimeout(() => inputCodigo?.classList.remove('input-success'), 1500);
                }
                Utils.playBeep(); Utils.vibrate(40);
            } else {
                if (inputDescricao) inputDescricao.value = '';
                if (inputEmbalagem) inputEmbalagem.value = '';
                if (inputCodigo) { inputCodigo.classList.add('input-error'); setTimeout(() => inputCodigo?.classList.remove('input-error'), 1500); }
                Utils.showToast('❌ Não encontrado', 'error');
            }
        }
        
        // Salvar - SÓ salva ao clicar no botão ou Ctrl+Enter
        btnSalvar?.addEventListener('click', executarSalvamento);
        
        function executarSalvamento() {
            if (state.salvandoContagem) return;
            
            const rua = inputRua?.value.trim() || '';
            const faixa = parseInt(inputFaixa?.value) || 0;
            const codigo = inputCodigo?.value.trim() || '';
            const desc = inputDescricao?.value.trim() || '';
            const emb = inputEmbalagem?.value.trim() || '';
            const qtd = parseInt(inputQuantidade?.value) || 0;
            const obs = inputObservacoes?.value.trim() || '';
            
            if (!rua || !faixa || !codigo || !desc || qtd <= 0) { Utils.showToast('⚠️ Preencha todos', 'error'); return; }
            
            state.salvandoContagem = true;
            
            const dh = Utils.formatDataHora(new Date());
            const contagem = { localId: Utils.generateId(), rua, faixa, codigo, descricao: desc, embalagem: emb, quantidade: qtd, observacoes: obs, data: dh.data, hora: dh.hora, dataISO: dh.iso, synced: false, usuario: currentUser.usuario, usuarioNome: currentUser.nome };
            
            salvarContagem(contagem).then(res => {
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
                state.salvandoContagem = false;
            });
        }
        
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
            else { if (modalCamera) modalCamera.style.display = 'flex'; Camera.open(cameraVideo, (codigo) => { if (inputCodigo) inputCodigo.value = codigo; processarCodigo(codigo); if (!Camera.continuousMode && modalCamera) modalCamera.style.display = 'none'; }); }
        });
        btnFecharCamera?.addEventListener('click', () => { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; });
        btnCameraContinuo?.addEventListener('click', () => { const cont = Camera.toggleContinuous(); if (modoCameraLabel) modoCameraLabel.textContent = cont ? 'LIGADO' : 'DESLIGADO'; });
        
        // Duplicidade
        $('#btnEditarExistente')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar'); });
        $('#btnSomarQuantidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar'); });
        $('#btnCancelarDuplicidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; state.resolvendoDuplicidade = null; });
        
        // Exportação
        btnExportCSV?.addEventListener('click', () => {
            if (!isMaster) { Utils.showToast('Acesso restrito', 'error'); return; }
            const dados = getHistoricoFiltrado().map(c => ({ Rua: c.rua, Faixa: c.faixa, Código: c.codigo, Descrição: c.descricao, Embalagem: c.embalagem, Quantidade: c.quantidade, Data: c.data || '', Hora: c.hora || '', Observações: c.observacoes || '', Usuário: c.usuarioNome || c.usuario || '' }));
            if (!dados.length) { Utils.showToast('Nenhum dado', 'error'); return; }
            const cab = Object.keys(dados[0]).join(';');
            const csv = '\uFEFF' + [cab, ...dados.map(d => Object.values(d).map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'))].join('\n');
            Utils.downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'contagem_' + new Date().toISOString().slice(0, 10) + '.csv');
        });
        btnExportExcel?.addEventListener('click', () => {
            if (!isMaster) { Utils.showToast('Acesso restrito', 'error'); return; }
            const dados = getHistoricoFiltrado().map(c => ({ Rua: c.rua, Faixa: c.faixa, Código: c.codigo, Descrição: c.descricao, Embalagem: c.embalagem, Quantidade: c.quantidade, Data: c.data || '', Hora: c.hora || '', Observações: c.observacoes || '', Usuário: c.usuarioNome || c.usuario || '' }));
            if (!dados.length) { Utils.showToast('Nenhum dado', 'error'); return; }
            const ws = XLSX.utils.json_to_sheet(dados); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Contagens'); XLSX.writeFile(wb, 'contagem_' + new Date().toISOString().slice(0, 10) + '.xlsx');
        });
        
        [filtroRua, filtroFaixa, filtroCodigo, filtroDescricao].forEach(i => i?.addEventListener('input', renderizarHistorico));
        $$('thead th[data-sort]').forEach(th => th.addEventListener('click', () => { const col = th.dataset.sort; state.sortDirection = state.sortColumn === col ? (state.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'; state.sortColumn = col; renderizarHistorico(); }));
        
        // Atalhos - APENAS Ctrl+Enter salva
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; }
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); executarSalvamento(); }
        });
        
        window.addEventListener('online', async () => { state.dbConnected = true; updateConnectionDot(); if (Database.supabase) { await syncPendingContagens(); if (!state.produtosMapCodAcesso.size) await carregarBaseDoSupabase(); } });
        window.addEventListener('offline', () => { state.dbConnected = false; updateConnectionDot(); });
    }
    
    init();
})();