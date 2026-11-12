(function() {
    'use strict';
    
    const currentUser = Auth.checkAccess();
    if (!currentUser) return;
    const isMaster = Auth.isMaster();
    
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    
    const ULTIMA_RUA_KEY = 'blmez_ultima_rua';
    
    // Elementos
    const userNameDisplay = $('#userNameDisplay');
    const masterBadge = $('#masterBadge');
    const connectionDot = $('#connectionDot');
    const inputRua = $('#rua');
    const inputCodigo = $('#codigo');
    const inputDescricao = $('#descricao');
    const inputEmbalagem = $('#embalagem');
    const inputQuantidade = $('#quantidade');
    const inputObservacoes = $('#observacoes');
    
    const state = {
        produtosMapCodAcesso: new Map(),
        produtosMapSeqProduto: new Map(),
        baseMeta: null,
        contagensLocal: [],      
        contagensFinalizadas: [], 
        resolvendoDuplicidade: null,
        salvandoContagem: false
    };
    
    // ============ INICIALIZAÇÃO ============
    async function init() {
        try {
            if (userNameDisplay) userNameDisplay.textContent = '👤 ' + (currentUser.nome || currentUser.usuario);
            
            if (isMaster) {
                if (masterBadge) masterBadge.style.display = 'inline';
                if ($('#menuBase')) $('#menuBase').style.display = 'block';
                if ($('#menuHistorico')) $('#menuHistorico').style.display = 'block';
                if ($('#menuUsuarios')) $('#menuUsuarios').style.display = 'block';
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
            
            // Renderiza a interface IMEDIATAMENTE (sem esperar banco)
            atualizarHistoricoRua();
            renderizarHistorico();
            renderizarDashboard();
            atualizarEstatisticas();
            atualizarInfoImportacao();
            
            setupEventListeners();
            if (typeof abrirSecao === 'function') abrirSecao('contagem');

        } catch (err) {
            console.error('❌ Erro na inicialização:', err);
        }
        
        // Banco de dados em segundo plano (não trava a tela)
        try {
            const dbOk = Database.init();
            state.dbConnected = dbOk;
            if (connectionDot) connectionDot.textContent = dbOk ? '🟢' : '🔴';
            
            if (dbOk) {
                const testOk = await Database.testConnection();
                state.dbConnected = testOk;
                if (connectionDot) connectionDot.textContent = testOk ? '🟢' : '🔴';
                
                if (testOk) {
                    await carregarBaseDoSupabase();
                    await syncFromSupabase();
                    atualizarHistoricoRua();
                    renderizarHistorico();
                    renderizarDashboard();
                    atualizarEstatisticas();
                }
            }
        } catch(e) {}
    }
    
    async function syncFromSupabase() {
        if (!Database.supabase) return;
        try {
            const remotas = await Database.fetchContagens();
            if (remotas && remotas.length > 0) {
                state.contagensFinalizadas = remotas.map(c => ({
                    localId: 'remote_' + c.id, supabase_id: c.id, data: c.data, rua: c.rua, codigo: c.codigo, descricao: c.descricao, embalagem: c.embalagem, quantidade: c.quantidade, contagem: c.contagem || 1, observacoes: c.observacoes || '', usuario: c.matricula || '', usuarioNome: c.usuario || '', dataISO: c.created_at, finalizada: true, synced: true
                }));
            }
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
    
    function atualizarInfoImportacao() {
        const importInfo = $('#importInfo');
        if (!importInfo) return;
        if (!state.baseMeta || state.produtosMapCodAcesso.size === 0) { importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Nenhuma base carregada.</span>'; return; }
        const dh = Utils.formatDataHora(state.baseMeta.dataHoraImportacao);
        importInfo.innerHTML = '<span class="badge">📄 ' + Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base') + '</span> <span class="badge">📊 ' + state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' registros</span> <span>📅 ' + dh.data + ' ' + dh.hora + '</span>';
    }
    
    function atualizarBaseInfo() { const baseInfo = $('#baseInfo'); if (baseInfo) baseInfo.textContent = state.produtosMapCodAcesso.size.toLocaleString('pt-BR') + ' produtos na base'; }
    
    // ============ PESQUISA ============
    function pesquisarProduto(codigo) {
        if (!codigo?.trim()) return null;
        const c = codigo.trim();
        if (state.produtosMapCodAcesso.has(c)) return state.produtosMapCodAcesso.get(c);
        if (state.produtosMapSeqProduto.has(c)) return state.produtosMapSeqProduto.get(c);
        for (const [k, v] of state.produtosMapCodAcesso) if (k.startsWith(c)) return v;
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
    
    // ============ CONTAGENS ============
    function loadContagens() {
        try { state.contagensLocal = JSON.parse(localStorage.getItem(Database.KEYS.CONTAGENS) || '[]'); } catch (e) { state.contagensLocal = []; }
    }
    
    function saveContagens() {
        try { localStorage.setItem(Database.KEYS.CONTAGENS, JSON.stringify(state.contagensLocal)); } catch (e) {}
    }
    
    async function salvarContagem(contagem) {
        delete contagem.faixa;
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === contagem.rua && c.contagem === 1);
        const numeroContagemAtual = ruaFinalizada ? 2 : 1;
        contagem.contagem = numeroContagemAtual;
        contagem.finalizada = false; contagem.synced = false; contagem.supabase_id = null;
        
        const idx = state.contagensLocal.findIndex(c => c.rua === contagem.rua && c.codigo === contagem.codigo && c.contagem === numeroContagemAtual && c.finalizada === false);
        
        if (idx >= 0) {
            return new Promise(resolve => {
                state.resolvendoDuplicidade = (op) => {
                    state.resolvendoDuplicidade = null;
                    if (op === 'editar') {
                        state.contagensLocal[idx] = { ...contagem, synced: false, localId: state.contagensLocal[idx].localId, contagem: numeroContagemAtual, finalizada: false };
                    } else if (op === 'somar') {
                        state.contagensLocal[idx].quantidade += contagem.quantidade;
                        state.contagensLocal[idx].observacoes = contagem.observacoes || state.contagensLocal[idx].observacoes || '';
                        state.contagensLocal[idx].data = contagem.data; state.contagensLocal[idx].hora = contagem.hora; state.contagensLocal[idx].dataISO = contagem.dataISO;
                        state.contagensLocal[idx].usuario = contagem.usuario; state.contagensLocal[idx].usuarioNome = contagem.usuarioNome;
                        state.contagensLocal[idx].contagem = numeroContagemAtual;
                    } else { resolve(op); return; }
                    saveContagens(); atualizarHistoricoRua(); resolve(op);
                };
                const msgDup = $('#msgDuplicidade');
                const modDup = $('#modalDuplicidade');
                if(msgDup) msgDup.innerHTML = '<strong>' + Utils.escapeHTML(state.contagensLocal[idx].rua) + '</strong><br>Código: ' + Utils.escapeHTML(state.contagensLocal[idx].codigo) + '<br>Contagem: ' + numeroContagemAtual + 'ª<br>Qtd atual: ' + state.contagensLocal[idx].quantidade + ' | Somar: ' + contagem.quantidade;
                if(modDup) modDup.style.display = 'flex';
            });
        }
        state.contagensLocal.push(contagem); saveContagens(); atualizarHistoricoRua(); return 'novo';
    }
    
    // ============ HISTÓRICO DA RUA ============
    function atualizarHistoricoRua() {
        const ruaSelecionada = inputRua?.value || '';
        const cardHistoricoRua = $('#cardHistoricoRua');
        const ruaAtualHistorico = $('#ruaAtualHistorico');
        const indicadorContagem = $('#indicadorContagem');
        const tabelaHistoricoRua = $('#tabelaHistoricoRua');
        const nenhumHistoricoRua = $('#nenhumHistoricoRua');
        const btnFinalizarRua = $('#btnFinalizarRua');
        
        if (!ruaSelecionada) { if (cardHistoricoRua) cardHistoricoRua.style.display = 'none'; return; }
        if (cardHistoricoRua) cardHistoricoRua.style.display = 'block';
        if (ruaAtualHistorico) ruaAtualHistorico.textContent = ruaSelecionada;
        
        const contagensPendentes = state.contagensLocal.filter(c => c.rua === ruaSelecionada && c.finalizada === false);
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === ruaSelecionada && c.contagem === 1);
        
        if (indicadorContagem) {
            if (ruaFinalizada) { indicadorContagem.textContent = '🔄 SEGUNDA contagem da rua ' + ruaSelecionada; indicadorContagem.style.background = 'var(--orange-light)'; indicadorContagem.style.color = 'var(--orange-dark)'; }
            else if (contagensPendentes.length > 0) { indicadorContagem.textContent = '📝 PRIMEIRA contagem em andamento na rua ' + ruaSelecionada; indicadorContagem.style.background = 'var(--green-light)'; indicadorContagem.style.color = 'var(--green-dark)'; }
            else { indicadorContagem.textContent = '📝 Aguardando itens para contagem da rua ' + ruaSelecionada; indicadorContagem.style.background = 'var(--accent-light)'; indicadorContagem.style.color = 'var(--accent)'; }
        }
        
        if (tabelaHistoricoRua) {
            tabelaHistoricoRua.innerHTML = '';
            if (contagensPendentes.length === 0) { if (nenhumHistoricoRua) { nenhumHistoricoRua.textContent = 'Nenhuma contagem pendente para esta rua.'; nenhumHistoricoRua.style.display = 'block'; } }
            else {
                if (nenhumHistoricoRua) nenhumHistoricoRua.style.display = 'none';
                contagensPendentes.forEach(c => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<td>' + Utils.escapeHTML(c.rua) + '</td><td>' + Utils.escapeHTML(c.codigo) + '</td><td>' + Utils.escapeHTML(c.descricao) + '</td><td><strong>' + c.quantidade + '</strong></td>';
                    tabelaHistoricoRua.appendChild(tr);
                });
            }
        }
        if (btnFinalizarRua) btnFinalizarRua.style.display = contagensPendentes.length === 0 ? 'none' : 'block';
    }
    
    // ============ FINALIZAR ============
    async function finalizarContagemRua() {
        const ruaSelecionada = inputRua?.value || '';
        if (!ruaSelecionada) { Utils.showToast('⚠️ Selecione uma rua', 'error'); return; }
        const ruaFinalizada = state.contagensFinalizadas.find(c => c.rua === ruaSelecionada && c.contagem === 1);
        const numeroContagem = ruaFinalizada ? 2 : 1;
        const contagensParaFinalizar = state.contagensLocal.filter(c => c.rua === ruaSelecionada && c.contagem === numeroContagem && c.finalizada === false);
        
        if (contagensParaFinalizar.length === 0) { Utils.showToast('⚠️ Nada para finalizar', 'error'); return; }
        if (!confirm('Finalizar ' + numeroContagem + 'ª contagem da rua ' + ruaSelecionada + '?\nTotal: ' + contagensParaFinalizar.length + ' itens')) return;
        
        try {
            if (Database.supabase && navigator.onLine) {
                for (const c of contagensParaFinalizar) {
                    try {
                        const res = await Database.saveContagem({ data: c.data, rua: c.rua, codigo: c.codigo, descricao: c.descricao, embalagem: c.embalagem, quantidade: c.quantidade, contagem: numeroContagem, observacoes: c.observacoes || '', matricula: c.usuario || '', usuario: c.usuarioNome || '' });
                        c.supabase_id = res.id; c.synced = true; c.finalizada = true;
                    } catch (err) { throw err; }
                }
                state.contagensFinalizadas = [...state.contagensFinalizadas, ...contagensParaFinalizar];
                state.contagensLocal = state.contagensLocal.filter(c => !(c.rua === ruaSelecionada && c.contagem === numeroContagem && c.finalizada === false));
                saveContagens();
                Utils.showToast('✅ ' + numeroContagem + 'ª contagem da rua ' + ruaSelecionada + ' finalizada!', 'success');
            } else {
                contagensParaFinalizar.forEach(c => { c.finalizada = true; }); saveContagens();
                Utils.showToast('⚠️ Offline - contagem finalizada localmente', 'warning');
            }
            atualizarHistoricoRua(); renderizarHistorico(); renderizarDashboard(); atualizarEstatisticas();
        } catch (err) { Utils.showToast('❌ Erro: ' + err.message, 'error'); }
    }
    
    // ============ RENDER ============
    function getHistoricoFiltrado() {
        const filtroRua = $('#filtroRua');
        const filtroCodigo = $('#filtroCodigo');
        const filtroDescricao = $('#filtroDescricao');
        
        let lista = [...state.contagensFinalizadas];
        if (filtroRua?.value.trim()) lista = lista.filter(c => c.rua.toLowerCase().includes(filtroRua.value.toLowerCase().trim()));
        if (filtroCodigo?.value.trim()) lista = lista.filter(c => c.codigo.toLowerCase().includes(filtroCodigo.value.toLowerCase().trim()));
        if (filtroDescricao?.value.trim()) lista = lista.filter(c => c.descricao.toLowerCase().includes(filtroDescricao.value.toLowerCase().trim()));
        lista.sort((a,b)=>new Date(b.dataISO||0)-new Date(a.dataISO||0));
        return lista;
    }
    
    function renderizarHistorico() {
        const tabelaHistorico = $('#tabelaHistorico');
        const nenhumRegistro = $('#nenhumRegistro');
        if (!tabelaHistorico) return;
        
        const lista = getHistoricoFiltrado(); tabelaHistorico.innerHTML = '';
        if (!lista.length) { if (nenhumRegistro) nenhumRegistro.style.display = 'block'; }
        else { if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            lista.forEach(c => { const tr = document.createElement('tr'); tr.innerHTML = '<td>'+Utils.escapeHTML(c.rua)+'</td><td>'+Utils.escapeHTML(c.codigo)+' ☁️</td><td>'+Utils.escapeHTML(c.descricao)+'</td><td>'+Utils.escapeHTML(c.embalagem)+'</td><td><strong>'+c.quantidade+'</strong></td><td>'+(c.data||'--')+'</td><td>'+(c.hora||'--')+'</td><td>'+Utils.escapeHTML(c.usuarioNome||c.usuario||'--')+'</td><td>'+(c.contagem||1)+'ª</td><td>✅ Finalizada</td><td><button class="btn btn-danger-text btn-sm btn-excluir" data-id="'+c.localId+'">🗑️</button></td>'; tabelaHistorico.appendChild(tr); });
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(b=>b.addEventListener('click',async function(){const i=state.contagensFinalizadas.findIndex(c=>c.localId===this.dataset.id);if(i>=0){if(confirm('Excluir?')){const c=state.contagensFinalizadas[i];if(c.supabase_id&&Database.supabase)await Database.deleteContagem(c.supabase_id);state.contagensFinalizadas.splice(i,1);renderizarHistorico();renderizarDashboard();atualizarEstatisticas();}}}));
        }
    }
    
    function renderizarDashboard() {
        const tabelaDashboard = $('#tabelaDashboard');
        const nenhumDashboard = $('#nenhumDashboard');
        if (!tabelaDashboard) return;
        
        const ruas = {}; state.contagensFinalizadas.forEach(c=>{if(!ruas[c.rua])ruas[c.rua]={itens:0,paletes:0,ultima:'',contagem:1};ruas[c.rua].itens++;ruas[c.rua].paletes+=c.quantidade;if(!ruas[c.rua].ultima||new Date(c.dataISO)>new Date(ruas[c.rua].ultima))ruas[c.rua].ultima=c.dataISO;if(c.contagem>ruas[c.rua].contagem)ruas[c.rua].contagem=c.contagem;});
        tabelaDashboard.innerHTML = ''; const entradas = Object.entries(ruas);
        if (!entradas.length) { if (nenhumDashboard) nenhumDashboard.style.display = 'block'; }
        else { if (nenhumDashboard) nenhumDashboard.style.display = 'none'; entradas.forEach(([rua,dados])=>{const dh=dados.ultima?Utils.formatDataHora(dados.ultima):{data:'--',hora:'--'};const tr=document.createElement('tr');tr.innerHTML='<td><strong>'+Utils.escapeHTML(rua)+'</strong></td><td>'+dados.itens+'</td><td>'+dados.paletes+'</td><td>'+dh.data+' '+dh.hora+'</td><td>'+dados.contagem+'ª</td><td>✅</td>';tabelaDashboard.appendChild(tr);}); }
    }
    
    function atualizarEstatisticas() {
        const statItens = $('#statItens');
        const statPaletes = $('#statPaletes');
        const statProdutos = $('#statProdutos');
        const statUltima = $('#statUltima');
        
        const totalGeral = state.contagensFinalizadas.length;
        if (statItens) statItens.textContent = totalGeral.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensFinalizadas.reduce((s,c)=>s+(c.quantidade||0),0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensFinalizadas.map(c=>c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensFinalizadas.length) { const u=state.contagensFinalizadas[state.contagensFinalizadas.length-1]; statUltima.textContent=(u.data||'--')+' '+(u.hora||'--'); }
    }
    
    // ============ USUÁRIOS ============
    async function renderizarUsuarios() {
        const tabelaUsuarios = $('#tabelaUsuarios');
        const nenhumUsuario = $('#nenhumUsuario');
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
        const hamburgerBtn = $('#hamburgerBtn');
        const sidebar = $('#sidebar');
        const sidebarOverlay = $('#sidebarOverlay');
        const sidebarClose = $('#sidebarClose');

        if (hamburgerBtn) hamburgerBtn.addEventListener('click', () => { if(sidebar) sidebar.classList.add('open'); if(sidebarOverlay) sidebarOverlay.classList.add('open'); });
        if (sidebarClose) sidebarClose.addEventListener('click', () => { if(sidebar) sidebar.classList.remove('open'); if(sidebarOverlay) sidebarOverlay.classList.remove('open'); });
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => { if(sidebar) sidebar.classList.remove('open'); if(sidebarOverlay) sidebarOverlay.classList.remove('open'); });
        
        $$('.sidebar-item[data-section]').forEach(item => item.addEventListener('click', () => {
            const nome = item.dataset.section;
            ['secaoContagem', 'secaoBase', 'secaoHistorico', 'secaoDashboard', 'secaoUsuarios'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('active');
            });
            const mapa = { contagem: 'secaoContagem', base: 'secaoBase', historico: 'secaoHistorico', dashboard: 'secaoDashboard', usuarios: 'secaoUsuarios' };
            const secao = document.getElementById(mapa[nome]);
            if (secao) secao.classList.add('active');
            
            $$('.sidebar-item[data-section]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            if(nome === 'historico') renderizarHistorico();
            if(nome === 'dashboard') { renderizarDashboard(); atualizarEstatisticas(); }
            if(nome === 'usuarios') renderizarUsuarios();
            if(nome === 'contagem') atualizarHistoricoRua();
            if(sidebar) sidebar.classList.remove('open'); if(sidebarOverlay) sidebarOverlay.classList.remove('open');
        }));
        
        const darkBtn = $('#menuDarkMode');
        if (darkBtn) darkBtn.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('blmez_darkmode', document.body.classList.contains('dark-mode')?'1':'0'); darkBtn.textContent = document.body.classList.contains('dark-mode')?'☀️ Modo Claro':'🌓 Modo Escuro'; });
        
        const btnSync = $('#menuSync');
        if(btnSync) btnSync.addEventListener('click', async () => { await syncFromSupabase(); Utils.showToast('✅ Sincronizado!','success'); });
        
        // ============ BACKUP ============
        const btnBackup = $('#menuBackup');
        if (btnBackup) {
            btnBackup.addEventListener('click', () => {
                const dados = [...state.contagensLocal, ...state.contagensFinalizadas];
                if (!dados.length) {
                    Utils.showToast('⚠️ Nenhum dado para backup.', 'error');
                    return;
                }
                const json = JSON.stringify(dados, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                Utils.downloadBlob(blob, `backup_blmez_${new Date().toISOString().slice(0, 10)}.json`);
                Utils.showToast('✅ Backup realizado com sucesso!', 'success');
            });
        }

        // ============ RESTAURAR ============
        const btnRestore = $('#menuRestore');
        const restoreFileInput = $('#restoreFileInput');
        
        if (btnRestore && restoreFileInput) {
            btnRestore.addEventListener('click', () => restoreFileInput.click());
            
            restoreFileInput.addEventListener('change', (e) => {
                if (!e.target.files[0]) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const dados = JSON.parse(ev.target.result);
                        if (!Array.isArray(dados)) throw new Error('Formato inválido');
                        
                        if (confirm(`Restaurar ${dados.length} registros? Isso substituirá o histórico atual.`)) {
                            state.contagensLocal = dados.filter(c => !c.finalizada);
                            state.contagensFinalizadas = dados.filter(c => c.finalizada);
                            
                            saveContagens();
                            renderizarHistorico();
                            renderizarDashboard();
                            atualizarEstatisticas();
                            atualizarHistoricoRua();
                            
                            Utils.showToast(`✅ ${dados.length} registros restaurados!`, 'success');
                        }
                    } catch (err) {
                        Utils.showToast('❌ Arquivo inválido.', 'error');
                    }
                };
                reader.readAsText(e.target.files[0]);
                e.target.value = '';
            });
        }

        // ============ SAIR ============
        const btnLogout = $('#menuLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                if (confirm('Deseja realmente sair?')) {
                    Auth.logout();
                }
            });
        }
        
        const btnExportCSV = $('#btnExportCSV');
        if(btnExportCSV) btnExportCSV.addEventListener('click', () => { if(!isMaster)return; const dados=getHistoricoFiltrado().map(c=>({Rua:c.rua,Código:c.codigo,Descrição:c.descricao,Embalagem:c.embalagem,Quantidade:c.quantidade,Data:c.data||'',Hora:c.hora||'',Observações:c.observacoes||'',Matrícula:c.usuario||'',Usuário:c.usuarioNome||'',Contagem:(c.contagem||1)+'ª'})); if(!dados.length)return; const cab=Object.keys(dados[0]).join(';'); Utils.downloadBlob(new Blob(['\uFEFF'+[cab,...dados.map(d=>Object.values(d).map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';'))].join('\n')],{type:'text/csv;charset=utf-8;'}),'contagem.csv'); });
        
        if (inputRua) inputRua.addEventListener('change', atualizarHistoricoRua);
        
        const btnFinalizarRua = $('#btnFinalizarRua');
        if (btnFinalizarRua) btnFinalizarRua.addEventListener('click', finalizarContagemRua);
        
        if (inputCodigo) {
            inputCodigo.addEventListener('input', function() { this.classList.remove('input-success','input-error'); });
            inputCodigo.addEventListener('change', function() { processarCodigo(this.value); });
            inputCodigo.addEventListener('keydown', function(e) { if(e.key==='Enter'){e.preventDefault();processarCodigo(this.value);if(inputDescricao?.value&&inputQuantidade){setTimeout(()=>{inputQuantidade.focus();inputQuantidade.select();},200);}} });
        }
        
        const btnSalvar = $('#btnSalvar');
        if(btnSalvar) btnSalvar.addEventListener('click', () => {
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
        
        const btnNovaContagem = $('#btnNovaContagem');
        if(btnNovaContagem) btnNovaContagem.addEventListener('click', () => {
            const ruaAtual = inputRua?.value || '';
            if (inputCodigo) { inputCodigo.value = ''; inputCodigo.classList.remove('input-success','input-error'); }
            if (inputDescricao) inputDescricao.value = ''; if (inputEmbalagem) inputEmbalagem.value = '';
            if (inputQuantidade) inputQuantidade.value = '1'; if (inputObservacoes) inputObservacoes.value = '';
            if (inputRua) inputRua.value = ruaAtual; if (inputCodigo) inputCodigo.focus();
            atualizarHistoricoRua();
        });
        
        const btnCamera = $('#btnCamera');
        const modalCamera = $('#modalCamera');
        if(btnCamera) btnCamera.addEventListener('click', () => { if (Camera.isOpen) { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; } else { if (modalCamera) modalCamera.style.display = 'flex'; Camera.open($('#cameraVideo'), (codigoLido) => { if (inputCodigo) inputCodigo.value = codigoLido; processarCodigo(codigoLido); if (!Camera.continuousMode && modalCamera) modalCamera.style.display = 'none'; }); } });
        
        const btnFecharCamera = $('#btnFecharCamera');
        if(btnFecharCamera) btnFecharCamera.addEventListener('click', () => { Camera.close(); if (modalCamera) modalCamera.style.display = 'none'; });
        
        $('#btnEditarExistente')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar'); });
        $('#btnSomarQuantidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar'); });
        $('#btnCancelarDuplicidade')?.addEventListener('click', () => { if (modalDuplicidade) modalDuplicidade.style.display = 'none'; state.resolvendoDuplicidade = null; });
        
        document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&Camera.isOpen){Camera.close();if(modalCamera)modalCamera.style.display='none';}});
    }
    
    init();
})();