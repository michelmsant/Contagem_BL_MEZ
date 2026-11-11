(function() {
    'use strict';
    
    const currentUser = Auth.checkAccess();
    if (!currentUser) return;
    const isMaster = Auth.isMaster();
    
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    
    const ULTIMA_RUA_KEY = 'blmez_ultima_rua';
    
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
    const tabelaHistoricoRua = $('#tabelaHistoricoRua');
    const nenhumHistoricoRua = $('#nenhumHistoricoRua');
    const cardHistoricoRua = $('#cardHistoricoRua');
    const ruaAtualHistorico = $('#ruaAtualHistorico');
    const indicadorContagem = $('#indicadorContagem');
    const btnFinalizarRua = $('#btnFinalizarRua');
    
    const state = {
        produtosMapCodAcesso: new Map(),
        produtosMapSeqProduto: new Map(),
        baseMeta: null,
        contagensLocal: [],      // APENAS contagens pendentes (não finalizadas)
        contagensFinalizadas: [], // Contagens do Supabase
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
        
        try {
            if (userNameDisplay) userNameDisplay.textContent = '👤 ' + (currentUser.nome || currentUser.usuario);
            
            if (isMaster) {
                if (masterBadge) masterBadge.style.display = 'inline';
                if (menuBase) menuBase.style.display = 'block';
                if (menuHistorico) menuHistorico.style.display = 'block';
                if (menuUsuarios) menuUsuarios.style.display = 'block';
            }
            
            loadContagens();
            
            const meta = Database.loadBaseMeta();
            if (meta && !state.baseMeta) state.baseMeta = meta;
            
            const ultimaRua = localStorage.getItem(ULTIMA_RUA_KEY);
            if (ultimaRua && inputRua) inputRua.value = ultimaRua;
            
            if (localStorage.getItem('blmez_darkmode') === '1') {
                document.body.classList.add('dark-mode');
                const darkBtn = $('#menuDarkMode');
                if (darkBtn) darkBtn.textContent = '☀️ Modo Claro';
            }
            
            setupEventListeners();
            abrirSecao('contagem');
            
            console.log('✅ Interface pronta!');
            
            // Conectar ao Supabase e buscar finalizadas
            const dbOk = Database.init();
            state.dbConnected = dbOk;
            updateConnectionDot();
            
            if (dbOk) {
                const testOk = await Database.testConnection();
                state.dbConnected = testOk;
                updateConnectionDot();
                if (testOk) {
                    await carregarBaseDoSupabase();
                    await syncFromSupabase();
                }
            }
            
            atualizarHistoricoRua();
            renderizarHistorico();
            renderizarDashboard();
            atualizarEstatisticas();
            
        } catch (err) {
            console.error('❌ Erro:', err);
        }
    }
    
    function updateConnectionDot() {
        if (connectionDot) connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
    }
    
    // ============ SYNCRONIZAR DO SUPABASE (APENAS FINALIZADAS) ============
    async function syncFromSupabase() {
        if (!Database.supabase) return;
        try {
            const remotas = await Database.fetchContagens();
            if (remotas && remotas.length > 0) {
                state.contagensFinalizadas = remotas.map(c => ({
                    localId: 'remote_' + c.id,
                    supabase_id: c.id,
                    data: c.data,
                    rua: c.rua,
                    codigo: c.codigo,
                    descricao: c.descricao,
                    embalagem: c.embalagem,
                    quantidade: c.quantidade,
                    contagem: c.contagem || 1,
                    observacoes: c.observacoes || '',
                    usuario: c.matricula || '',
                    usuarioNome: c.usuario || '',
                    dataISO: c.created_at,
                    finalizada: true,
                    synced: true
                }));
                console.log('✅ ' + state.contagensFinalizadas.length + ' contagens finalizadas do Supabase');
                renderizarHistorico();
                renderizarDashboard();
                atualizarEstatisticas();
            }
        } catch (err) {}
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
        try {
            ['secaoContagem', 'secaoBase', 'secaoHistorico', 'secaoDashboard', 'secaoUsuarios'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('active');
            });
            
            const mapa = { contagem: 'secaoContagem', base: 'secaoBase', historico: 'secaoHistorico', dashboard: 'secaoDashboard', usuarios: 'secaoUsuarios' };
            const secao = document.getElementById(mapa[nome]);
            if (secao) secao.classList.add('active');
            
            $$('.sidebar-item[data-section]').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.section === nome) item.classList.add('active');
            });
            
            setTimeout(() => {
                if (nome === 'historico') renderizarHistorico();
                if (nome === 'dashboard') { renderizarDashboard(); atualizarEstatisticas(); }
                if (nome === 'base') { atualizarInfoImportacao(); atualizarBaseInfo(); }
                if (nome === 'usuarios') renderizarUsuarios();
                if (nome === 'contagem') atualizarHistoricoRua();
            }, 100);
            
            fecharSidebar();
        } catch (err) {}
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
                atualizarInfoImportacao(); atualizarBaseInfo();
            }
        } catch (err) {}
    }
    
    function construirIndices(produtos) {
        state.produtosMapCodAcesso.clear(); state.produtosMapSeqProduto.clear();
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
            atualizarInfoImportacao(); atualizarBaseInfo();
            importStatusMaster.innerHTML = '<span style="color:green">✅ ' + state.produtosMapCodAcesso.size + ' produtos</span>';
        } catch (err) {
            importStatusMaster.innerHTML = '<span style="color:red">❌ ' + Utils.escapeHTML(err.message) + '</span>';
        } finally {
            progressBarMaster.classList.remove('active');
        }
    }
    
    function atualizarInfoImportacao() {
        if (!importInfo) return;
        if (!state.baseMeta || state.produtosMapCodAcesso.size === 0) { importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Nenhuma base carregada.</span>'; return; }
        const dh = Utils.formatDataHora(state.baseMeta.dataHoraImportacao);
        importInfo.innerHTML = '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> <span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> <span>📅 ' + dh.data + ' ' + dh.hora + '</span>';
    }
    
    function atualizarBaseInfo() { if (baseInfo) baseInfo.textContent = state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' produtos na base'; }
    
    // ============ PESQUISA ============
    function pesquisarProduto(codigo) {
        if (!codigo?.trim()) return null;
        const c = codigo.trim();
        if (state.produtosMapCodAcesso.has(c)) return state.produtosMapCodAcesso.get(c);
        if (state.produtosMapSeqProduto.has(c)) return state.produtosMapSeqProduto.get(c);
        for (const [k, v] of state.produtosMapCodAcesso) if (k.startsWith(c)) return v;
        for (const [k, v] of state.produtosMapSeqProduto) if (k.startsWith(c)) return v;
        return null;
    }
    
    function processarCodigo(codigoDigitado) {
        if (!codigoDigitado?.trim()) { if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = ''; return; }
        if (!state.produtosMapCodAcesso.size) { Utils.showToast('⚠️ Base vazia', 'error'); return; }
        const produto = pesquisarProduto(codigoDigitado);
        if (produto) {
            if (inputDescricao) inputDescricao.value = produto.descCompleta;
            if (inputEmbalagem) inputEmbalagem.value = produto.embalagemFormatada;
            if (inputCodigo) { inputCodigo.value = produto.seqProduto || codigoDigitado; inputCodigo.classList.add('input-success'); setTimeout(() => inputCodigo?.classList.remove('input-success'), 1500); }
            Utils.playBeep(); Utils.vibrate(40);
        } else {
            if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputCodigo) { inputCodigo.classList.add('input-error'); setTimeout(() => inputCodigo?.classList.remove('input-error'), 1500); }
            Utils.showToast('❌ Não encontrado', 'error');
        }
    }
    
    // ============ CONTAGENS LOCAIS (PENDENTES) ============
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
        delete contagem.faixa;
        
        // Verificar se a rua já foi finalizada (buscar nas finalizadas do Supabase)
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === contagem.rua && c.contagem === 1);
        const numeroContagemAtual = ruaFinalizada ? 2 : 1;
        contagem.contagem = numeroContagemAtual;
        contagem.finalizada = false;
        contagem.synced = false;
        contagem.supabase_id = null;
        
        // Verificar duplicidade nas PENDENTES (localStorage)
        const idx = state.contagensLocal.findIndex(c => 
            c.rua === contagem.rua && 
            c.codigo === contagem.codigo && 
            c.contagem === numeroContagemAtual &&
            c.finalizada === false
        );
        
        if (idx >= 0) {
            return new Promise(resolve => {
                state.resolvendoDuplicidade = (op) => {
                    state.resolvendoDuplicidade = null;
                    
                    if (op === 'editar') {
                        state.contagensLocal[idx] = { ...contagem, synced: false, localId: state.contagensLocal[idx].localId, contagem: numeroContagemAtual, finalizada: false };
                    } else if (op === 'somar') {
                        state.contagensLocal[idx].quantidade += contagem.quantidade;
                        state.contagensLocal[idx].observacoes = contagem.observacoes || state.contagensLocal[idx].observacoes || '';
                        state.contagensLocal[idx].data = contagem.data;
                        state.contagensLocal[idx].hora = contagem.hora;
                        state.contagensLocal[idx].dataISO = contagem.dataISO;
                        state.contagensLocal[idx].usuario = contagem.usuario;
                        state.contagensLocal[idx].usuarioNome = contagem.usuarioNome;
                        state.contagensLocal[idx].contagem = numeroContagemAtual;
                    } else {
                        resolve(op);
                        return;
                    }
                    
                    saveContagens();
                    atualizarHistoricoRua();
                    resolve(op);
                };
                
                msgDuplicidade.innerHTML = '<strong>' + Utils.escapeHTML(state.contagensLocal[idx].rua) + '</strong><br>Código: ' + Utils.escapeHTML(state.contagensLocal[idx].codigo) + '<br>Contagem: ' + numeroContagemAtual + 'ª<br>Qtd atual: ' + state.contagensLocal[idx].quantidade + ' | Somar: ' + contagem.quantidade;
                modalDuplicidade.style.display = 'flex';
            });
        }
        
        state.contagensLocal.push(contagem);
        saveContagens();
        atualizarHistoricoRua();
        return 'novo';
    }
    
    // ============ HISTÓRICO DA RUA (APENAS PENDENTES) ============
    function atualizarHistoricoRua() {
        const ruaSelecionada = inputRua?.value || '';
        if (!ruaSelecionada) { if (cardHistoricoRua) cardHistoricoRua.style.display = 'none'; return; }
        if (cardHistoricoRua) cardHistoricoRua.style.display = 'block';
        if (ruaAtualHistorico) ruaAtualHistorico.textContent = ruaSelecionada;
        
        const contagensPendentes = state.contagensLocal.filter(c => c.rua === ruaSelecionada && c.finalizada === false);
        
        // Verificar se existe contagem finalizada no Supabase
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === ruaSelecionada && c.contagem === 1);
        
        if (indicadorContagem) {
            if (ruaFinalizada) {
                indicadorContagem.textContent = '🔄 SEGUNDA contagem da rua ' + ruaSelecionada;
                indicadorContagem.style.background = 'var(--orange-light)';
                indicadorContagem.style.color = 'var(--orange-dark)';
            } else if (contagensPendentes.length > 0) {
                indicadorContagem.textContent = '📝 PRIMEIRA contagem em andamento na rua ' + ruaSelecionada;
                indicadorContagem.style.background = 'var(--green-light)';
                indicadorContagem.style.color = 'var(--green-dark)';
            } else {
                indicadorContagem.textContent = '📝 Aguardando itens para contagem da rua ' + ruaSelecionada;
                indicadorContagem.style.background = 'var(--accent-light)';
                indicadorContagem.style.color = 'var(--accent)';
            }
        }
        
        if (tabelaHistoricoRua) {
            tabelaHistoricoRua.innerHTML = '';
            if (contagensPendentes.length === 0) {
                if (nenhumHistoricoRua) { nenhumHistoricoRua.textContent = 'Nenhuma contagem pendente para esta rua.'; nenhumHistoricoRua.style.display = 'block'; }
            } else {
                if (nenhumHistoricoRua) nenhumHistoricoRua.style.display = 'none';
                contagensPendentes.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<td>' + Utils.escapeHTML(c.rua) + '</td><td>' + Utils.escapeHTML(c.codigo) + '</td><td>' + Utils.escapeHTML(c.descricao) + '</td><td><strong>' + c.quantidade + '</strong></td>';
                    tabelaHistoricoRua.appendChild(tr);
                });
            }
        }
        
        if (btnFinalizarRua) {
            btnFinalizarRua.style.display = contagensPendentes.length === 0 ? 'none' : 'block';
        }
    }
    
    // ============ FINALIZAR (ENVIA PARA SUPABASE E LIMPA LOCAL) ============
    async function finalizarContagemRua() {
        const ruaSelecionada = inputRua?.value || '';
        if (!ruaSelecionada) { Utils.showToast('⚠️ Selecione uma rua', 'error'); return; }
        
        // Determinar número da contagem
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === ruaSelecionada && c.contagem === 1);
        const numeroContagem = ruaFinalizada ? 2 : 1;
        
        const contagensParaFinalizar = state.contagensLocal.filter(c => 
            c.rua === ruaSelecionada && 
            c.contagem === numeroContagem && 
            c.finalizada === false
        );
        
        if (contagensParaFinalizar.length === 0) { Utils.showToast('⚠️ Nada para finalizar', 'error'); return; }
        
        if (!confirm('Finalizar ' + numeroContagem + 'ª contagem da rua ' + ruaSelecionada + '?\nTotal: ' + contagensParaFinalizar.length + ' itens')) return;
        
        try {
            // Enviar para o Supabase
            if (Database.supabase && navigator.onLine) {
                console.log('🚀 Enviando ' + contagensParaFinalizar.length + ' contagens para o Supabase...');
                
                for (const c of contagensParaFinalizar) {
                    try {
                        const res = await Database.saveContagem({
                            data: c.data,
                            rua: c.rua,
                            codigo: c.codigo,
                            descricao: c.descricao,
                            embalagem: c.embalagem,
                            quantidade: c.quantidade,
                            contagem: numeroContagem,
                            observacoes: c.observacoes || '',
                            matricula: c.usuario || '',
                            usuario: c.usuarioNome || ''
                        });
                        
                        c.supabase_id = res.id;
                        c.synced = true;
                        c.finalizada = true;
                        console.log('✅ Enviado:', c.codigo, '| Qtd:', c.quantidade);
                    } catch (err) {
                        console.error('❌ Erro:', err.message);
                        throw err;
                    }
                }
                
                // Adicionar às finalizadas locais
                state.contagensFinalizadas = [...state.contagensFinalizadas, ...contagensParaFinalizar];
                
                // REMOVER do localStorage (contagens pendentes)
                state.contagensLocal = state.contagensLocal.filter(c => 
                    !(c.rua === ruaSelecionada && c.contagem === numeroContagem && c.finalizada === false)
                );
                saveContagens();
                
                Utils.showToast('✅ ' + numeroContagem + 'ª contagem da rua ' + ruaSelecionada + ' finalizada!', 'success');
            } else {
                // Offline - manter no localStorage
                contagensParaFinalizar.forEach(c => { c.finalizada = true; });
                saveContagens();
                Utils.showToast('⚠️ Offline - contagem finalizada localmente, sincronizar depois', 'warning');
            }
            
            atualizarHistoricoRua();
            renderizarHistorico();
            renderizarDashboard();
            atualizarEstatisticas();
            
        } catch (err) {
            Utils.showToast('❌ Erro: ' + err.message, 'error');
        }
    }
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        // Histórico mostra apenas contagens FINALIZADAS (do Supabase)
        let lista = [...state.contagensFinalizadas];
        if (filtroRua?.value.trim()) lista = lista.filter(c => c.rua.toLowerCase().includes(filtroRua.value.toLowerCase().trim()));
        if (filtroCodigo?.value.trim()) lista = lista.filter(c => c.codigo.toLowerCase().includes(filtroCodigo.value.toLowerCase().trim()));
        if (filtroDescricao?.value.trim()) lista = lista.filter(c => c.descricao.toLowerCase().includes(filtroDescricao.value.toLowerCase().trim()));
        if (state.sortColumn) { lista.sort((a,b)=>{let va=a[state.sortColumn],vb=b[state.sortColumn];if(typeof va==='string')va=va.toLowerCase();if(typeof vb==='string')vb=vb.toLowerCase();return state.sortDirection==='asc'?(va<vb?-1:1):(va>vb?-1:1);}); } else { lista.sort((a,b)=>new Date(b.dataISO||0)-new Date(a.dataISO||0)); }
        return lista;
    }
    
    function renderizarHistorico() {
        if (!tabelaHistorico) return;
        const lista = getHistoricoFiltrado(); tabelaHistorico.innerHTML = '';
        if (!lista.length) { if (nenhumRegistro) nenhumRegistro.style.display = 'block'; }
        else { if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            lista.forEach(c => { const tr = document.createElement('tr'); tr.innerHTML = '<td>'+Utils.escapeHTML(c.rua)+'</td><td>'+Utils.escapeHTML(c.codigo)+' ☁️</td><td>'+Utils.escapeHTML(c.descricao)+'</td><td>'+Utils.escapeHTML(c.embalagem)+'</td><td><strong>'+c.quantidade+'</strong></td><td>'+(c.data||'--')+'</td><td>'+(c.hora||'--')+'</td><td>'+Utils.escapeHTML(c.usuarioNome||c.usuario||'--')+'</td><td>'+(c.contagem||1)+'ª</td><td>✅ Finalizada</td><td><button class="btn btn-danger-text btn-sm btn-excluir" data-id="'+c.localId+'">🗑️</button></td>'; tabelaHistorico.appendChild(tr); });
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(b=>b.addEventListener('click',async function(){const i=state.contagensFinalizadas.findIndex(c=>c.localId===this.dataset.id);if(i>=0){if(confirm('Excluir?')){const c=state.contagensFinalizadas[i];if(c.supabase_id&&Database.supabase)await Database.deleteContagem(c.supabase_id);state.contagensFinalizadas.splice(i,1);renderizarHistorico();renderizarDashboard();atualizarEstatisticas();}}}));
        }
    }
    
    function renderizarDashboard() {
        if (!tabelaDashboard) return;
        const ruas = {}; state.contagensFinalizadas.forEach(c=>{if(!ruas[c.rua])ruas[c.rua]={itens:0,paletes:0,ultima:'',contagem:1};ruas[c.rua].itens++;ruas[c.rua].paletes+=c.quantidade;if(!ruas[c.rua].ultima||new Date(c.dataISO)>new Date(ruas[c.rua].ultima))ruas[c.rua].ultima=c.dataISO;if(c.contagem>ruas[c.rua].contagem)ruas[c.rua].contagem=c.contagem;});
        tabelaDashboard.innerHTML = ''; const entradas = Object.entries(ruas);
        if (!entradas.length) { if (nenhumDashboard) nenhumDashboard.style.display = 'block'; }
        else { if (nenhumDashboard) nenhumDashboard.style.display = 'none'; entradas.forEach(([rua,dados])=>{const dh=dados.ultima?Utils.formatDataHora(dados.ultima):{data:'--',hora:'--'};const tr=document.createElement('tr');tr.innerHTML='<td><strong>'+Utils.escapeHTML(rua)+'</strong></td><td>'+dados.itens+'</td><td>'+dados.paletes+'</td><td>'+dh.data+' '+dh.hora+'</td><td>'+dados.contagem+'ª</td><td>✅</td>';tabelaDashboard.appendChild(tr);}); }
    }
    
    function editarContagem(index) {
        const c = state.contagensLocal[index];
        if (inputRua) inputRua.value = c.rua; if (inputCodigo) inputCodigo.value = c.codigo;
        if (inputDescricao) inputDescricao.value = c.descricao; if (inputEmbalagem) inputEmbalagem.value = c.embalagem;
        if (inputQuantidade) inputQuantidade.value = c.quantidade; if (inputObservacoes) inputObservacoes.value = c.observacoes||'';
        state.contagensLocal.splice(index,1);
        saveContagens(); atualizarHistoricoRua();
        abrirSecao('contagem'); Utils.showToast('Editando...','success');
    }
    
    function atualizarEstatisticas() {
        const totalGeral = state.contagensFinalizadas.length;
        if (statItens) statItens.textContent = totalGeral.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensFinalizadas.reduce((s,c)=>s+(c.quantidade||0),0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensFinalizadas.map(c=>c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensFinalizadas.length) { const u=state.contagensFinalizadas[state.contagensFinalizadas.length-1]; statUltima.textContent=(u.data||'--')+' '+(u.hora||'--'); }
    }
    
    // ============ USUÁRIOS ============
    async function renderizarUsuarios() {
        if (!tabelaUsuarios) return;
        const users = await Auth.getAllUsers(); tabelaUsuarios.innerHTML = '';
        if (!users.length) { if (nenhumUsuario) nenhumUsuario.style.display = 'block'; }
        else { if (nenhumUsuario) nenhumUsuario.style.display = 'none';
            users.forEach(u=>{const tr=document.createElement('tr');const dc=u.created_at?Utils.formatDataHora(u.created_at):{data:'--',hora:'--'};tr.innerHTML='<td>'+Utils.escapeHTML(u.nome)+'</td><td>'+Utils.escapeHTML(u.usuario)+'</td><td>'+(u.role==='master'?'👑 Master':'👤 Usuário')+'</td><td>'+(u.ativo!==false?'🟢':'🔴')+'</td><td>'+dc.data+'</td><td>'+(u.usuario!=='5461448'?'<button class="btn btn-outline btn-sm btn-toggle-user" data-user="'+u.usuario+'" data-role="'+(u.role==='master'?'user':'master')+'">'+(u.role==='master'?'⬇':'⬆')+'</button> <button class="btn btn-danger-text btn-sm btn-delete-user" data-user="'+u.usuario+'">🗑️</button>':'Admin')+'</td>';tabelaUsuarios.appendChild(tr);});
            tabelaUsuarios.querySelectorAll('.btn-toggle-user').forEach(b=>b.addEventListener('click',async function(){await Auth.updateUser(this.dataset.user,{role:this.dataset.role});renderizarUsuarios();}));
            tabelaUsuarios.querySelectorAll('.btn-delete-user').forEach(b=>b.addEventListener('click',async function(){await Auth.deleteUser(this.dataset.user);renderizarUsuarios();}));
        }
    }
    
    // ============ EVENTOS ============
    function setupEventListeners() {
        if (hamburgerBtn) hamburgerBtn.addEventListener('click', abrirSidebar);
        if (sidebarClose) sidebarClose.addEventListener('click', fecharSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', fecharSidebar);
        $$('.sidebar-item[data-section]').forEach(item => item.addEventListener('click', () => abrirSecao(item.dataset.section)));
        
        const darkBtn = $('#menuDarkMode');
        if (darkBtn) darkBtn.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('blmez_darkmode', document.body.classList.contains('dark-mode')?'1':'0'); darkBtn.textContent = document.body.classList.contains('dark-mode')?'☀️ Modo Claro':'🌓 Modo Escuro'; });
        
        $('#menuSync')?.addEventListener('click', async () => { await syncFromSupabase(); Utils.showToast('✅ Sincronizado!','success'); });
        $('#menuBackup')?.addEventListener('click', () => { const dados = [...state.contagensLocal, ...state.contagensFinalizadas]; if (!dados.length) return; Utils.downloadBlob(new Blob([JSON.stringify(dados)],{type:'application/json'}),'backup_'+new Date().toISOString().slice(0,10)+'.json'); });
        $('#menuRestore')?.addEventListener('click', () => restoreFileInput?.click());
        if (restoreFileInput) restoreFileInput.addEventListener('change', (e) => { if(!e.target.files[0])return; const r=new FileReader(); r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);state.contagensLocal=d.filter(c=>!c.finalizada);state.contagensFinalizadas=d.filter(c=>c.finalizada);saveContagens();renderizarHistorico();renderizarDashboard();atualizarEstatisticas();atualizarHistoricoRua();}catch(ex){}}; r.readAsText(e.target.files[0]); e.target.value=''; });
        $('#menuLogout')?.addEventListener('click', () => { if (confirm('Sair?')) Auth.logout(); });
        
        if (btnAddUser) btnAddUser.addEventListener('click', () => { const n=novoNome?.value.trim(),u=novoUsuario?.value.trim(),s=novaSenha?.value,r=novoRole?.value; if(!n||!u||!s)return; if(!/^\d+$/.test(u)){Utils.showToast('⚠️ Matrícula apenas números','error');return;} const res=Auth.cadastrar(n,u,s); if(res.sucesso){if(r==='master')Auth.updateUser(u,{role:'master'});if(novoNome)novoNome.value='';if(novoUsuario)novoUsuario.value='';if(novaSenha)novaSenha.value='';renderizarUsuarios();}else{Utils.showToast('❌ '+res.mensagem,'error');} });
        
        if (importZoneMaster && fileInputMaster) {
            importZoneMaster.addEventListener('click', () => fileInputMaster.click());
            fileInputMaster.addEventListener('change', async (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev)=>await importarBaseMaster(ev.target.result,f.name); r.readAsText(f); fileInputMaster.value=''; });
            importZoneMaster.addEventListener('dragover', (e) => { e.preventDefault(); importZoneMaster.classList.add('drag-over'); });
            importZoneMaster.addEventListener('dragleave', () => importZoneMaster.classList.remove('drag-over'));
            importZoneMaster.addEventListener('drop', async (e) => { e.preventDefault(); importZoneMaster.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev)=>await importarBaseMaster(ev.target.result,f.name); r.readAsText(f); });
        }
        btnRecarregarBase?.addEventListener('click', carregarBaseDoSupabase);
        
        if (inputRua) inputRua.addEventListener('change', atualizarHistoricoRua);
        if (btnFinalizarRua) btnFinalizarRua.addEventListener('click', finalizarContagemRua);
        
        if (inputCodigo) {
            inputCodigo.addEventListener('input', function() { this.classList.remove('input-success','input-error'); });
            inputCodigo.addEventListener('change', function() { processarCodigo(this.value); });
            inputCodigo.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();processarCodigo(this.value);if(inputDescricao?.value&&inputQuantidade){setTimeout(()=>{inputQuantidade.focus();inputQuantidade.select();},200);}} });
        }
        
        btnSalvar?.addEventListener('click', () => {
            if (state.salvandoContagem) return;
            const rua = inputRua?.value || '';
            const codigo = inputCodigo?.value.trim() || '';
            const desc = inputDescricao?.value.trim() || '';
            const emb = inputEmbalagem?.value.trim() || '';
            const qtd = parseInt(inputQuantidade?.value) || 0;
            const obs = inputObservacoes?.value.trim() || '';
            if (!rua || !codigo || !desc || qtd <= 0) { Utils.showToast('⚠️ Preencha todos','error'); return; }
            if (!/^\d+$/.test(codigo)) { Utils.showToast('⚠️ Código apenas números','error'); return; }
            state.salvandoContagem = true;
            const dh = Utils.formatDataHora(new Date());
            const contagem = { localId: Utils.generateId(), rua, codigo, descricao: desc, embalagem: emb, quantidade: qtd, observacoes: obs, data: dh.data, hora: dh.hora, dataISO: dh.iso, synced: false, usuario: currentUser.usuario, usuarioNome: currentUser.nome, contagem: 1, finalizada: false };
            salvarContagem(contagem).then(res => {
                if (res !== 'cancelar') {
                    Utils.showToast('✅ Salvo!','success');
                    if (inputRua?.value) localStorage.setItem(ULTIMA_RUA_KEY, inputRua.value);
                    const ruaSalva = inputRua?.value || '';
                    if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success','input-error'); }
                    if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = '';
                    if (inputQuantidade) inputQuantidade.value = '1'; if (inputObservacoes) inputObservacoes.value = '';
                    if (inputRua) inputRua.value = ruaSalva; if (inputCodigo) inputCodigo.focus();
                    atualizarHistoricoRua();
                }
                state.salvandoContagem = false;
            });
        });
        
        btnNovaContagem?.addEventListener('click', () => {
            const ruaAtual = inputRua?.value || '';
            if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success','input-error'); }
            if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputQuantidade) inputQuantidade.value = '1'; if (inputObservacoes) inputObservacoes.value = '';
            if (inputRua) inputRua.value = ruaAtual; if (inputCodigo) inputCodigo.focus();
            atualizarHistoricoRua();
        });
        
        btnCamera?.addEventListener('click', () => { if (Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; } else { if (modalCamera) modalCamera.style.display = 'flex'; Camera.open(cameraVideo, (codigoLido) => { if (inputCodigo) inputCodigo.value = codigoLido; processarCodigo(codigoLido); if (!Camera.continuousMode && modalCamera) modalCamera.style.display = 'none'; }); } });
        btnFecharCamera?.addEventListener('click', () => { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; });
        btnCameraContinuo?.addEventListener('click', () => { const cont = Camera.toggleContinuous(); if (modoCameraLabel) modoCameraLabel.textContent = cont ? 'LIGADO' : 'DESLIGADO'; });
        
        $('#btnEditarExistente')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar'); });
        $('#btnSomarQuantidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar'); });
        $('#btnCancelarDuplicidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; state.resolvendoDuplicidade = null; });
        
        btnExportCSV?.addEventListener('click', () => { if(!isMaster)return; const dados=getHistoricoFiltrado().map(c=>({Rua:c.rua,Código:c.codigo,Descrição:c.descricao,Embalagem:c.embalagem,Quantidade:c.quantidade,Data:c.data||'',Hora:c.hora||'',Observações:c.observacoes||'',Matrícula:c.usuario||'',Usuário:c.usuarioNome||'',Contagem:(c.contagem||1)+'ª',Status:'Finalizada'})); if(!dados.length)return; const cab=Object.keys(dados[0]).join(';'); Utils.downloadBlob(new Blob(['\uFEFF'+[cab,...dados.map(d=>Object.values(d).map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';'))].join('\n')],{type:'text/csv;charset=utf-8;'}),'contagem_'+new Date().toISOString().slice(0,10)+'.csv'); });
        btnExportExcel?.addEventListener('click', () => { if(!isMaster)return; const dados=getHistoricoFiltrado().map(c=>({Rua:c.rua,Código:c.codigo,Descrição:c.descricao,Embalagem:c.embalagem,Quantidade:c.quantidade,Data:c.data||'',Hora:c.hora||'',Observações:c.observacoes||'',Matrícula:c.usuario||'',Usuário:c.usuarioNome||'',Contagem:(c.contagem||1)+'ª',Status:'Finalizada'})); if(!dados.length)return; const ws=XLSX.utils.json_to_sheet(dados);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Contagens');XLSX.writeFile(wb,'contagem_'+new Date().toISOString().slice(0,10)+'.xlsx'); });
        
        [filtroRua,filtroCodigo,filtroDescricao].forEach(i=>i?.addEventListener('input',renderizarHistorico));
        $$('thead th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const col=th.dataset.sort;state.sortDirection=state.sortColumn===col?(state.sortDirection==='asc'?'desc':'asc'):'asc';state.sortColumn=col;renderizarHistorico();}));
        
        document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&Camera.isOpen){Camera.close();if(modalCamera)modalCamera.style.display='none';}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();btnSalvar?.click();}});
        window.addEventListener('online',async()=>{state.dbConnected=true;updateConnectionDot();});
        window.addEventListener('offline',()=>{state.dbConnected=false;updateConnectionDot();});
    }
    
    init();
})();