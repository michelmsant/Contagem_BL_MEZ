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
        
        // Restaurar última rua selecionada
        const ultimaRua = localStorage.getItem(ULTIMA_RUA_KEY);
        if (ultimaRua && inputRua) {
            inputRua.value = ultimaRua;
        }
        
        renderizarHistorico();
        renderizarDashboard();
        atualizarEstatisticas();
        atualizarBaseInfo();
        
        const dbOk = Database.init();
        state.dbConnected = dbOk;
        updateConnectionDot();
        
        if (dbOk) {
            const testOk = await Database.testConnection();
            state.dbConnected = testOk;
            updateConnectionDot();
            if (testOk) {
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
        console.log('✅ Pronto! Produtos:', state.produtosMapCodAcesso.size);
    }
    
    function updateConnectionDot() {
        if (connectionDot) connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
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
            contagem: 'secaoContagem', base: 'secaoBase', historico: 'secaoHistorico',
            dashboard: 'secaoDashboard', usuarios: 'secaoUsuarios'
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
                Utils.showToast('✅ ' + produtos.length.toLocaleString('pt-BR') + ' produtos carregados', 'success');
            }
        } catch (err) {}
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
            Utils.showToast('✅ ' + state.produtosMapCodAcesso.size + ' produtos importados!', 'success');
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
        importInfo.innerHTML = '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> <span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> <span>📅 ' + dh.data + ' ' + dh.hora + '</span>';
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
        for (const [k, v] of state.produtosMapSeqProduto) if (k.startsWith(c)) return v;
        return null;
    }
    
    function processarCodigo(codigoDigitado) {
        if (!codigoDigitado?.trim()) {
            if (inputDescricao) inputDescricao.value = '';
            if (inputEmbalagem) inputEmbalagem.value = '';
            return;
        }
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
    
    // ============ CONTAGENS ============
    function loadContagens() {
        try {
            state.contagensLocal = JSON.parse(localStorage.getItem(Database.KEYS.CONTAGENS) || '[]');
            state.pendingContagens = JSON.parse(localStorage.getItem(Database.KEYS.PENDING) || '[]');
        } catch (e) { state.contagensLocal = []; state.pendingContagens = []; }
    }
    
    function saveContagens() {
        try { localStorage.setItem(Database.KEYS.CONTAGENS, JSON.stringify(state.contagensLocal)); localStorage.setItem(Database.KEYS.PENDING, JSON.stringify(state.pendingContagens)); } catch (e) {}
    }
    
    async function salvarContagem(contagem) {
        const idx = state.contagensLocal.findIndex(c => c.rua === contagem.rua && c.codigo === contagem.codigo);
        if (idx >= 0) {
            return new Promise(resolve => {
                state.resolvendoDuplicidade = async (op) => {
                    state.resolvendoDuplicidade = null;
                    const c = state.contagensLocal[idx];
                    if (op === 'editar') state.contagensLocal[idx] = { ...contagem, synced: false, localId: c.localId, supabase_id: c.supabase_id || null };
                    else if (op === 'somar') {
                        state.contagensLocal[idx].quantidade += contagem.quantidade;
                        state.contagensLocal[idx].observacoes = contagem.observacoes || c.observacoes || '';
                        state.contagensLocal[idx].data = contagem.data; state.contagensLocal[idx].hora = contagem.hora; state.contagensLocal[idx].dataISO = contagem.dataISO;
                        state.contagensLocal[idx].synced = false; state.contagensLocal[idx].usuario = contagem.usuario; state.contagensLocal[idx].usuarioNome = contagem.usuarioNome;
                    }
                    saveContagens();
                    const atualizado = state.contagensLocal[idx];
                    if (Database.supabase && navigator.onLine) {
                        if (atualizado.supabase_id) {
                            try { await Database.updateContagem(atualizado.supabase_id, { quantidade: atualizado.quantidade, observacoes: atualizado.observacoes||'', data: atualizado.data, hora: atualizado.hora, usuario: atualizado.usuario||'', usuario_nome: atualizado.usuarioNome||'' }); atualizado.synced = true; saveContagens(); } catch (err) {}
                        } else {
                            try { const res = await Database.saveContagem({ rua: atualizado.rua, codigo: atualizado.codigo, descricao: atualizado.descricao, embalagem: atualizado.embalagem, quantidade: atualizado.quantidade, observacoes: atualizado.observacoes||'', data: atualizado.data, hora: atualizado.hora, usuario: atualizado.usuario||'', usuario_nome: atualizado.usuarioNome||'' }); atualizado.supabase_id = res.id; atualizado.synced = true; saveContagens(); } catch (err) {}
                        }
                    }
                    renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
                    resolve(op);
                };
                msgDuplicidade.innerHTML = '<strong>' + state.contagensLocal[idx].rua + '</strong><br>Qtd atual: ' + state.contagensLocal[idx].quantidade + ' | Nova: ' + contagem.quantidade;
                modalDuplicidade.style.display = 'flex';
            });
        }
        state.contagensLocal.push(contagem); state.pendingContagens.push(contagem); saveContagens();
        if (Database.supabase && navigator.onLine) await syncPendingContagens();
        return 'novo';
    }
    
    async function syncPendingContagens() {
        if (!Database.supabase || !state.pendingContagens.length) return;
        for (const c of [...state.pendingContagens]) {
            try { const res = await Database.saveContagem({ rua: c.rua, codigo: c.codigo, descricao: c.descricao, embalagem: c.embalagem, quantidade: c.quantidade, observacoes: c.observacoes||'', data: c.data, hora: c.hora, usuario: c.usuario||'', usuario_nome: c.usuarioNome||'' }); c.synced = true; c.supabase_id = res.id; state.pendingContagens = state.pendingContagens.filter(x => x.localId !== c.localId); } catch (e) {}
        }
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
    }
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        let lista = [...state.contagensLocal];
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
            lista.forEach(c => { const tr = document.createElement('tr'); tr.innerHTML = '<td>'+Utils.escapeHTML(c.rua)+'</td><td>'+Utils.escapeHTML(c.codigo)+' '+(c.synced?'☁️':'📱')+'</td><td>'+Utils.escapeHTML(c.descricao)+'</td><td>'+Utils.escapeHTML(c.embalagem)+'</td><td><strong>'+c.quantidade+'</strong></td><td>'+(c.data||'--')+'</td><td>'+(c.hora||'--')+'</td><td>'+Utils.escapeHTML(c.usuarioNome||c.usuario||'--')+'</td><td><button class="btn btn-outline btn-sm btn-editar" data-id="'+c.localId+'">✏️</button> <button class="btn btn-danger-text btn-sm btn-excluir" data-id="'+c.localId+'">🗑️</button></td>'; tabelaHistorico.appendChild(tr); });
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(b=>b.addEventListener('click',function(){const i=state.contagensLocal.findIndex(c=>c.localId===this.dataset.id);if(i>=0)editarContagem(i);}));
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(b=>b.addEventListener('click',function(){const i=state.contagensLocal.findIndex(c=>c.localId===this.dataset.id);if(i>=0)excluirContagem(i);}));
        }
    }
    
    function renderizarDashboard() {
        if (!tabelaDashboard) return;
        const ruas = {}; state.contagensLocal.forEach(c=>{if(!ruas[c.rua])ruas[c.rua]={itens:0,paletes:0,ultima:''};ruas[c.rua].itens++;ruas[c.rua].paletes+=c.quantidade;if(!ruas[c.rua].ultima||new Date(c.dataISO)>new Date(ruas[c.rua].ultima))ruas[c.rua].ultima=c.dataISO;});
        tabelaDashboard.innerHTML = ''; const entradas = Object.entries(ruas);
        if (!entradas.length) { if (nenhumDashboard) nenhumDashboard.style.display = 'block'; }
        else { if (nenhumDashboard) nenhumDashboard.style.display = 'none'; entradas.forEach(([rua,dados])=>{const dh=dados.ultima?Utils.formatDataHora(dados.ultima):{data:'--',hora:'--'};const tr=document.createElement('tr');tr.innerHTML='<td><strong>'+Utils.escapeHTML(rua)+'</strong></td><td>'+dados.itens+'</td><td>'+dados.paletes+'</td><td>'+dh.data+' '+dh.hora+'</td>';tabelaDashboard.appendChild(tr);}); }
    }
    
    function editarContagem(index) {
        const c = state.contagensLocal[index];
        if (inputRua) inputRua.value = c.rua;
        if (inputCodigo) inputCodigo.value = c.codigo;
        if (inputDescricao) inputDescricao.value = c.descricao;
        if (inputEmbalagem) inputEmbalagem.value = c.embalagem;
        if (inputQuantidade) inputQuantidade.value = c.quantidade;
        if (inputObservacoes) inputObservacoes.value = c.observacoes||'';
        state.contagensLocal.splice(index,1); state.pendingContagens = state.pendingContagens.filter(p=>p.localId!==c.localId);
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
        abrirSecao('contagem'); Utils.showToast('Editando...','success');
    }
    
    async function excluirContagem(index) {
        if (!confirm('Excluir?')) return;
        const c = state.contagensLocal[index];
        if (c.supabase_id && Database.supabase) await Database.deleteContagem(c.supabase_id);
        state.contagensLocal.splice(index,1); state.pendingContagens = state.pendingContagens.filter(p=>p.localId!==c.localId);
        saveContagens(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
    }
    
    function atualizarEstatisticas() {
        if (statItens) statItens.textContent = state.contagensLocal.length.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensLocal.reduce((s,c)=>s+(c.quantidade||0),0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensLocal.map(c=>c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensLocal.length) { const u=state.contagensLocal[state.contagensLocal.length-1]; statUltima.textContent=(u.data||'--')+' '+(u.hora||'--'); }
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
        
        $('#menuSync')?.addEventListener('click', async () => { await syncPendingContagens(); Utils.showToast('✅ Sincronizado!','success'); });
        $('#menuBackup')?.addEventListener('click', () => { if (!state.contagensLocal.length) return; Utils.downloadBlob(new Blob([JSON.stringify(state.contagensLocal)],{type:'application/json'}),'backup_'+new Date().toISOString().slice(0,10)+'.json'); });
        $('#menuRestore')?.addEventListener('click', () => restoreFileInput?.click());
        if (restoreFileInput) restoreFileInput.addEventListener('change', (e) => { if(!e.target.files[0])return; const r=new FileReader(); r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);state.contagensLocal=d;state.pendingContagens=d.filter(c=>!c.synced);saveContagens();renderizarHistorico();renderizarDashboard();atualizarEstatisticas();}catch(ex){}}; r.readAsText(e.target.files[0]); e.target.value=''; });
        $('#menuLogout')?.addEventListener('click', () => { if (confirm('Sair?')) Auth.logout(); });
        
        if (btnAddUser) btnAddUser.addEventListener('click', () => { const n=novoNome?.value.trim(),u=novoUsuario?.value.trim(),s=novaSenha?.value,r=novoRole?.value; if(!n||!u||!s)return; const res=Auth.cadastrar(n,u,s); if(res.sucesso){if(r==='master')Auth.updateUser(u,{role:'master'});if(novoNome)novoNome.value='';if(novoUsuario)novoUsuario.value='';if(novaSenha)novaSenha.value='';renderizarUsuarios();} });
        
        if (importZoneMaster && fileInputMaster) {
            importZoneMaster.addEventListener('click', () => fileInputMaster.click());
            fileInputMaster.addEventListener('change', async (e) => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev)=>await importarBaseMaster(ev.target.result,f.name); r.readAsText(f); fileInputMaster.value=''; });
            importZoneMaster.addEventListener('dragover', (e) => { e.preventDefault(); importZoneMaster.classList.add('drag-over'); });
            importZoneMaster.addEventListener('dragleave', () => importZoneMaster.classList.remove('drag-over'));
            importZoneMaster.addEventListener('drop', async (e) => { e.preventDefault(); importZoneMaster.classList.remove('drag-over'); const f=e.dataTransfer.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev)=>await importarBaseMaster(ev.target.result,f.name); r.readAsText(f); });
        }
        btnRecarregarBase?.addEventListener('click', carregarBaseDoSupabase);
        
        // Pesquisa de código
        if (inputCodigo) {
            inputCodigo.addEventListener('input', function() { this.classList.remove('input-success','input-error'); });
            inputCodigo.addEventListener('change', function() { processarCodigo(this.value); });
            inputCodigo.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();processarCodigo(this.value);if(inputDescricao?.value&&inputQuantidade){setTimeout(()=>{inputQuantidade.focus();inputQuantidade.select();},200);}} });
        }
        
        // Salvar
        btnSalvar?.addEventListener('click', () => {
            if (state.salvandoContagem) return;
            
            const rua = inputRua?.value || '';
            const codigo = inputCodigo?.value.trim() || '';
            const desc = inputDescricao?.value.trim() || '';
            const emb = inputEmbalagem?.value.trim() || '';
            const qtd = parseInt(inputQuantidade?.value) || 0;
            const obs = inputObservacoes?.value.trim() || '';
            
            if (!rua || !codigo || !desc || qtd <= 0) {
                Utils.showToast('⚠️ Preencha todos os campos', 'error');
                return;
            }
            
            state.salvandoContagem = true;
            const dh = Utils.formatDataHora(new Date());
            const contagem = { localId: Utils.generateId(), rua, codigo, descricao: desc, embalagem: emb, quantidade: qtd, observacoes: obs, data: dh.data, hora: dh.hora, dataISO: dh.iso, synced: false, usuario: currentUser.usuario, usuarioNome: currentUser.nome };
            
            salvarContagem(contagem).then(res => {
                if (res !== 'cancelar') {
                    Utils.showToast('✅ Salvo!','success');
                    if (inputRua && inputRua.value) localStorage.setItem(ULTIMA_RUA_KEY, inputRua.value);
                    const ruaSalva = inputRua?.value || '';
                    if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success','input-error'); }
                    if (inputDescricao) inputDescricao.value = '';
                    if (inputEmbalagem) inputEmbalagem.value = '';
                    if (inputQuantidade) inputQuantidade.value = '1';
                    if (inputObservacoes) inputObservacoes.value = '';
                    if (inputRua) inputRua.value = ruaSalva;
                    if (inputCodigo) inputCodigo.focus();
                }
                renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
                state.salvandoContagem = false;
            });
        });
        
        btnNovaContagem?.addEventListener('click', () => {
            const ruaAtual = inputRua?.value || '';
            if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success','input-error'); }
            if (inputDescricao) inputDescricao.value = '';
            if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputQuantidade) inputQuantidade.value = '1';
            if (inputObservacoes) inputObservacoes.value = '';
            if (inputRua) inputRua.value = ruaAtual;
            if (inputCodigo) inputCodigo.focus();
        });
        
        // Câmera
        btnCamera?.addEventListener('click', () => {
            if (Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; }
            else { if (modalCamera) modalCamera.style.display = 'flex'; Camera.open(cameraVideo, (codigoLido) => { if (inputCodigo) inputCodigo.value = codigoLido; processarCodigo(codigoLido); if (!Camera.continuousMode && modalCamera) modalCamera.style.display = 'none'; }); }
        });
        btnFecharCamera?.addEventListener('click', () => { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; });
        btnCameraContinuo?.addEventListener('click', () => { const cont = Camera.toggleContinuous(); if (modoCameraLabel) modoCameraLabel.textContent = cont ? 'LIGADO' : 'DESLIGADO'; });
        
        $('#btnEditarExistente')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar'); });
        $('#btnSomarQuantidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar'); });
        $('#btnCancelarDuplicidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; state.resolvendoDuplicidade = null; });
        
        btnExportCSV?.addEventListener('click', () => { if(!isMaster)return; const dados=getHistoricoFiltrado().map(c=>({Rua:c.rua,Código:c.codigo,Descrição:c.descricao,Embalagem:c.embalagem,Quantidade:c.quantidade,Data:c.data||'',Hora:c.hora||'',Observações:c.observacoes||'',Usuário:c.usuarioNome||''})); if(!dados.length)return; const cab=Object.keys(dados[0]).join(';'); Utils.downloadBlob(new Blob(['\uFEFF'+[cab,...dados.map(d=>Object.values(d).map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';'))].join('\n')],{type:'text/csv;charset=utf-8;'}),'contagem_'+new Date().toISOString().slice(0,10)+'.csv'); });
        btnExportExcel?.addEventListener('click', () => { if(!isMaster)return; const dados=getHistoricoFiltrado().map(c=>({Rua:c.rua,Código:c.codigo,Descrição:c.descricao,Embalagem:c.embalagem,Quantidade:c.quantidade,Data:c.data||'',Hora:c.hora||'',Observações:c.observacoes||'',Usuário:c.usuarioNome||''})); if(!dados.length)return; const ws=XLSX.utils.json_to_sheet(dados);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Contagens');XLSX.writeFile(wb,'contagem_'+new Date().toISOString().slice(0,10)+'.xlsx'); });
        
        [filtroRua,filtroCodigo,filtroDescricao].forEach(i=>i?.addEventListener('input',renderizarHistorico));
        $$('thead th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const col=th.dataset.sort;state.sortDirection=state.sortColumn===col?(state.sortDirection==='asc'?'desc':'asc'):'asc';state.sortColumn=col;renderizarHistorico();}));
        
        document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&Camera.isOpen){Camera.close();if(modalCamera)modalCamera.style.display='none';}if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();btnSalvar?.click();}});
        window.addEventListener('online',async()=>{state.dbConnected=true;updateConnectionDot();if(Database.supabase){await syncPendingContagens();if(!state.produtosMapCodAcesso.size)await carregarBaseDoSupabase();}});
        window.addEventListener('offline',()=>{state.dbConnected=false;updateConnectionDot();});
    }
    
    init();
})();