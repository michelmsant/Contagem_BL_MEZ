// ============================================================
// APP.JS - Versão Final Corrigida
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
    
    // Elementos
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
    
    // ============ ESTADO ============
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
        
        // Exibir usuário
        userNameDisplay.textContent = `👤 ${currentUser.nome}`;
        
        // Configurações master
        if (isMaster) {
            masterBadge.style.display = 'inline';
            tabBaseBtn.style.display = 'inline-block';
            tabHistoricoBtn.style.display = 'inline-block';
        }
        
        // Inicializar Supabase
        const dbOk = Database.init();
        state.dbConnected = dbOk;
        updateConnectionIndicator();
        
        // Carregar contagens locais
        loadContagens();
        
        // Tentar carregar base do Supabase
        if (dbOk) {
            await carregarBaseDoSupabase();
        } else {
            importInfo.innerHTML = '<span style="color:var(--red);">❌ Supabase não conectado. Verifique o console.</span>';
        }
        
        // Metadados
        const meta = Database.loadBaseMeta();
        if (meta && !state.baseMeta) {
            state.baseMeta = meta;
        }
        
        // Renderizar
        atualizarInfoImportacao();
        renderizarHistorico();
        atualizarEstatisticas();
        
        // Sincronizar pendentes
        if (dbOk && navigator.onLine) {
            await syncPendingContagens();
        }
        
        // Dark mode
        if (localStorage.getItem('blmez_darkmode') === '1') {
            document.body.classList.add('dark-mode');
            $('#menuDarkMode').textContent = '☀️ Modo Claro';
        }
        
        // Foco
        inputRua.focus();
        
        console.log('✅ Pronto!');
        console.log(`   Supabase: ${dbOk ? 'Conectado' : 'Offline'}`);
        console.log(`   Produtos: ${state.produtosMapCodAcesso.size}`);
        console.log(`   Contagens: ${state.contagensLocal.length}`);
    }
    
    function updateConnectionIndicator() {
        if (connectionDot) {
            connectionDot.textContent = state.dbConnected ? '🟢' : '🔴';
            connectionDot.title = state.dbConnected ? 'Supabase conectado' : 'Supabase offline';
        }
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
                
                console.log(`✅ ${produtos.length} produtos carregados`);
                Utils.showToast(`✅ ${produtos.length} produtos carregados do Supabase`, 'success');
            } else {
                console.log('⚠️ Nenhum produto encontrado no Supabase');
                importInfo.innerHTML = '<span style="color:var(--orange);">⚠️ Base vazia. Importe um arquivo TXT.</span>';
            }
        } catch (err) {
            console.error('❌ Erro ao carregar base:', err);
            importInfo.innerHTML = `<span style="color:var(--red);">❌ Erro: ${Utils.escapeHTML(err.message)}</span>`;
            Utils.showToast('❌ Erro ao carregar base: ' + err.message, 'error');
        }
    }
    
    function construirIndices(produtos) {
        state.produtosMapCodAcesso.clear();
        state.produtosMapSeqProduto.clear();
        
        for (const p of produtos) {
            const embFormatada = p.embalagem && p.qtdembalagem 
                ? `${p.embalagem} x ${p.qtdembalagem}` 
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
    }
    
    async function importarBaseMaster(conteudo, nomeArquivo) {
        if (!Database.supabase) {
            Utils.showToast('❌ Supabase não conectado!', 'error');
            return;
        }
        
        progressBarMaster.classList.add('active');
        progressFillMaster.style.width = '0%';
        importStatusMaster.textContent = 'Processando arquivo...';
        
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
                
                const seqProduto = (cols[1] || '').trim();
                const descCompleta = (cols[2] || '').trim();
                const codAcesso = (cols[3] || '').trim();
                const embalagem = (cols[7] || '').trim();
                const qtdEmbalagem = (cols[8] || '').trim();
                
                if (!codAcesso && !seqProduto) continue;
                
                produtosParaSupabase.push({
                    seqproduto: seqProduto,
                    desccompleta: descCompleta,
                    codacesso: codAcesso,
                    embalagem,
                    qtdembalagem: qtdEmbalagem
                });
            }
            
            importStatusMaster.textContent = `Enviando ${produtosParaSupabase.length} produtos...`;
            
            // Enviar para Supabase (substitui)
            await Database.replaceProdutos(produtosParaSupabase, (progresso) => {
                progressFillMaster.style.width = progresso + '%';
                importStatusMaster.textContent = `Enviando... ${progresso}%`;
            });
            
            // Reconstruir índices locais
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
            
            importStatusMaster.innerHTML = `<span style="color:var(--green);">✅ ${state.produtosMapCodAcesso.size} produtos importados com sucesso!</span>`;
            Utils.showToast(`✅ ${state.produtosMapCodAcesso.size} produtos importados!`, 'success');
            
        } catch (err) {
            console.error('❌ Erro:', err);
            importStatusMaster.innerHTML = `<span style="color:var(--red);">❌ ${Utils.escapeHTML(err.message)}</span>`;
            Utils.showToast('❌ ' + err.message, 'error');
        } finally {
            progressBarMaster.classList.remove('active');
            progressFillMaster.style.width = '0%';
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
        
        importInfo.innerHTML = `
            <span class="badge">📄 ${Utils.escapeHTML(state.baseMeta.nomeArquivo || 'Base')}</span>
            <span class="badge">📊 ${state.produtosMapCodAcesso.size.toLocaleString('pt-BR')} registros</span>
            <span>📅 ${dh.data} ${dh.hora}</span>
            <span class="badge">☁️ Supabase</span>
        `;
    }
    
    function atualizarBaseInfo() {
        if (baseInfo) {
            baseInfo.textContent = `${state.produtosMapCodAcesso.size.toLocaleString('pt-BR')} produtos na base`;
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
                    if (opcao === 'editar') {
                        state.contagensLocal[existente] = { ...contagem, synced: false, localId: state.contagensLocal[existente].localId };
                    } else if (opcao === 'somar') {
                        state.contagensLocal[existente].quantidade += contagem.quantidade;
                        state.contagensLocal[existente].synced = false;
                    }
                    saveContagens();
                    state.resolvendoDuplicidade = null;
                    resolve(opcao);
                };
                
                msgDuplicidade.innerHTML = `
                    <strong>${state.contagensLocal[existente].rua}</strong> /
                    Faixa ${state.contagensLocal[existente].faixa}<br>
                    Qtd atual: ${state.contagensLocal[existente].quantidade} |
                    Nova: ${contagem.quantidade}
                `;
                modalDuplicidade.style.display = 'flex';
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
                    rua: cont.rua, faixa: cont.faixa, codigo: cont.codigo,
                    descricao: cont.descricao, embalagem: cont.embalagem,
                    quantidade: cont.quantidade, observacoes: cont.observacoes || '',
                    data: cont.data, hora: cont.hora
                });
                cont.synced = true;
                cont.supabase_id = result.id;
                state.pendingContagens = state.pendingContagens.filter(c => c.localId !== cont.localId);
                count++;
            } catch (err) {}
        }
        
        if (count > 0) {
            saveContagens();
            renderizarHistorico();
            atualizarEstatisticas();
        }
    }
    
    // ============ RENDERIZAÇÃO ============
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
        
        if (lista.length === 0) {
            if (nenhumRegistro) nenhumRegistro.style.display = 'block';
        } else {
            if (nenhumRegistro) nenhumRegistro.style.display = 'none';
            
            lista.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${Utils.escapeHTML(c.rua)}</td>
                    <td>${c.faixa}</td>
                    <td>${Utils.escapeHTML(c.codigo)} ${c.synced ? '☁️' : '📱'}</td>
                    <td>${Utils.escapeHTML(c.descricao)}</td>
                    <td>${Utils.escapeHTML(c.embalagem)}</td>
                    <td><strong>${c.quantidade}</strong></td>
                    <td>${c.data || '--'}</td>
                    <td>${c.hora || '--'}</td>
                    <td>
                        <button class="btn btn-outline btn-sm btn-editar" data-id="${c.localId}">✏️</button>
                        <button class="btn btn-danger-text btn-sm btn-excluir" data-id="${c.localId}">🗑️</button>
                    </td>
                `;
                tabelaHistorico.appendChild(tr);
            });
            
            tabelaHistorico.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = state.contagensLocal.findIndex(c => c.localId === btn.dataset.id);
                    if (idx >= 0) editarContagem(idx);
                });
            });
            
            tabelaHistorico.querySelectorAll('.btn-excluir').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = state.contagensLocal.findIndex(c => c.localId === btn.dataset.id);
                    if (idx >= 0) excluirContagem(idx);
                });
            });
        }
    }
    
    function editarContagem(index) {
        const c = state.contagensLocal[index];
        inputRua.value = c.rua; inputFaixa.value = c.faixa;
        inputCodigo.value = c.codigo; inputDescricao.value = c.descricao;
        inputEmbalagem.value = c.embalagem; inputQuantidade.value = c.quantidade;
        inputObservacoes.value = c.observacoes || '';
        
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens(); renderizarHistorico(); atualizarEstatisticas();
        
        document.querySelector('[data-tab="contagem"]').click();
        Utils.showToast('Contagem carregada para edição.', 'success');
    }
    
    async function excluirContagem(index) {
        if (!confirm('Excluir?')) return;
        const c = state.contagensLocal[index];
        if (c.supabase_id && Database.supabase) {
            try { await Database.deleteContagem(c.supabase_id); } catch (err) {}
        }
        state.contagensLocal.splice(index, 1);
        state.pendingContagens = state.pendingContagens.filter(p => p.localId !== c.localId);
        saveContagens(); renderizarHistorico(); atualizarEstatisticas();
        Utils.showToast('Excluída.', 'success');
    }
    
    function atualizarEstatisticas() {
        if (statItens) statItens.textContent = state.contagensLocal.length.toLocaleString('pt-BR');
        if (statPaletes) statPaletes.textContent = state.contagensLocal.reduce((s, c) => s + (c.quantidade || 0), 0).toLocaleString('pt-BR');
        if (statProdutos) statProdutos.textContent = new Set(state.contagensLocal.map(c => c.codigo)).size.toLocaleString('pt-BR');
        if (statUltima && state.contagensLocal.length > 0) {
            const u = state.contagensLocal[state.contagensLocal.length - 1];
            statUltima.textContent = `${u.data || '--'} ${u.hora || '--'}`;
        }
    }
    
    // ============ EVENTOS ============
    
    // Menu
    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => menuDropdown.classList.remove('show'));
    menuDropdown.addEventListener('click', (e) => e.stopPropagation());
    
    $('#menuDarkMode').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('blmez_darkmode', isDark ? '1' : '0');
        $('#menuDarkMode').textContent = isDark ? '☀️ Modo Claro' : '🌓 Modo Escuro';
        menuDropdown.classList.remove('show');
    });
    
    $('#menuSync').addEventListener('click', async () => {
        menuDropdown.classList.remove('show');
        await syncPendingContagens();
        Utils.showToast('Sincronizado!', 'success');
    });
    
    $('#menuBackup').addEventListener('click', () => {
        menuDropdown.classList.remove('show');
        if (!state.contagensLocal.length) { Utils.showToast('Nenhum dado.', 'error'); return; }
        const blob = new Blob([JSON.stringify(state.contagensLocal, null, 2)], { type: 'application/json' });
        Utils.downloadBlob(blob, `backup_${new Date().toISOString().slice(0,10)}.json`);
        Utils.showToast('Backup OK!', 'success');
    });
    
    $('#menuRestore').addEventListener('click', () => {
        menuDropdown.classList.remove('show');
        $('#restoreFileInput').click();
    });
    
    $('#restoreFileInput').addEventListener('change', (e) => {
        if (!e.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const dados = JSON.parse(ev.target.result);
                if (!Array.isArray(dados)) throw new Error('Inválido');
                if (confirm(`Restaurar ${dados.length} registros?`)) {
                    state.contagensLocal = dados;
                    state.pendingContagens = dados.filter(c => !c.synced);
                    saveContagens(); renderizarHistorico(); atualizarEstatisticas();
                    Utils.showToast('✅ Restaurado!', 'success');
                }
            } catch (err) { Utils.showToast('Arquivo inválido.', 'error'); }
        };
        reader.readAsText(e.target.files[0]);
        e.target.value = '';
    });
    
    $('#menuLogout').addEventListener('click', () => {
        if (confirm('Sair?')) Auth.logout();
    });
    
    // Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const tab = document.getElementById('tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1));
            if (tab) tab.classList.add('active');
            if (btn.dataset.tab === 'historico') renderizarHistorico();
            if (btn.dataset.tab === 'base') atualizarBaseInfo();
        });
    });
    
    // Importação Master
    if (importZoneMaster) {
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
            e.preventDefault();
            importZoneMaster.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => await importarBaseMaster(ev.target.result, file.name);
            reader.readAsText(file);
        });
    }
    
    $('#btnRecarregarBase')?.addEventListener('click', async () => {
        await carregarBaseDoSupabase();
    });
    
    // Pesquisa
    function pesquisarEAtualizar(codigo) {
        if (!codigo?.trim()) {
            inputDescricao.value = '';
            inputEmbalagem.value = '';
            return;
        }
        
        if (state.produtosMapCodAcesso.size === 0) {
            Utils.showToast('⚠️ Base vazia!', 'error');
            return;
        }
        
        const produto = pesquisarProduto(codigo);
        
        if (produto) {
            inputDescricao.value = produto.descCompleta;
            inputEmbalagem.value = produto.embalagemFormatada;
            inputCodigo.classList.add('input-success');
            setTimeout(() => inputCodigo.classList.remove('input-success'), 1500);
            Utils.playBeep(); Utils.vibrate(40);
        } else {
            inputDescricao.value = '';
            inputEmbalagem.value = '';
            inputCodigo.classList.add('input-error');
            setTimeout(() => inputCodigo.classList.remove('input-error'), 1500);
            Utils.showToast('❌ Não encontrado.', 'error');
        }
    }
    
    inputCodigo.addEventListener('change', () => pesquisarEAtualizar(inputCodigo.value));
    inputCodigo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            pesquisarEAtualizar(inputCodigo.value);
            if (inputDescricao.value) { inputQuantidade.focus(); inputQuantidade.select(); }
        }
    });
    
    // Salvar
    btnSalvar.addEventListener('click', async () => {
        const rua = inputRua.value.trim();
        const faixa = parseInt(inputFaixa.value) || 0;
        const codigo = inputCodigo.value.trim();
        const descricao = inputDescricao.value.trim();
        const embalagem = inputEmbalagem.value.trim();
        const quantidade = parseInt(inputQuantidade.value) || 0;
        const observacoes = inputObservacoes.value.trim();
        
        if (!rua) { Utils.showToast('⚠️ Rua', 'error'); return; }
        if (!faixa) { Utils.showToast('⚠️ Faixa', 'error'); return; }
        if (!codigo) { Utils.showToast('⚠️ Código', 'error'); return; }
        if (!descricao) { Utils.showToast('⚠️ Produto não encontrado', 'error'); return; }
        if (quantidade <= 0) { Utils.showToast('⚠️ Quantidade', 'error'); return; }
        
        const dh = Utils.formatDataHora(new Date());
        const contagem = {
            localId: Utils.generateId(), rua, faixa, codigo, descricao, embalagem,
            quantidade, observacoes, data: dh.data, hora: dh.hora, dataISO: dh.iso,
            synced: false, usuario: currentUser.usuario, usuarioNome: currentUser.nome
        };
        
        const resultado = await salvarContagem(contagem);
        
        if (resultado !== 'cancelar') {
            Utils.showToast('✅ Salvo!', 'success');
            inputRua.value = ''; inputFaixa.value = ''; inputCodigo.value = '';
            inputDescricao.value = ''; inputEmbalagem.value = '';
            inputQuantidade.value = '1'; inputObservacoes.value = '';
            inputCodigo.classList.remove('input-success', 'input-error');
            inputRua.focus();
        }
        
        renderizarHistorico(); atualizarEstatisticas();
    });
    
    btnNovaContagem.addEventListener('click', () => {
        inputRua.value = ''; inputFaixa.value = ''; inputCodigo.value = '';
        inputDescricao.value = ''; inputEmbalagem.value = '';
        inputQuantidade.value = '1'; inputObservacoes.value = '';
        inputRua.focus();
    });
    
    // Câmera
    btnCamera.addEventListener('click', () => {
        if (Camera.isOpen) { Camera.close(); modalCamera.style.display = 'none'; }
        else {
            modalCamera.style.display = 'flex';
            Camera.open(cameraVideo, (codigo) => {
                inputCodigo.value = codigo;
                pesquisarEAtualizar(codigo);
                if (!Camera.continuousMode) modalCamera.style.display = 'none';
            });
        }
    });
    
    btnFecharCamera.addEventListener('click', () => { Camera.close(); modalCamera.style.display = 'none'; });
    
    btnCameraContinuo.addEventListener('click', () => {
        const isCont = Camera.toggleContinuous();
        modoCameraLabel.textContent = isCont ? 'LIGADO' : 'DESLIGADO';
    });
    
    // Duplicidade
    $('#btnEditarExistente').addEventListener('click', () => {
        modalDuplicidade.style.display = 'none';
        if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('editar');
        renderizarHistorico(); atualizarEstatisticas();
    });
    
    $('#btnSomarQuantidade').addEventListener('click', () => {
        modalDuplicidade.style.display = 'none';
        if (state.resolvendoDuplicidade) state.resolvendoDuplicidade('somar');
        renderizarHistorico(); atualizarEstatisticas();
    });
    
    $('#btnCancelarDuplicidade').addEventListener('click', () => {
        modalDuplicidade.style.display = 'none';
        state.resolvendoDuplicidade = null;
    });
    
    // Exportação
    function getDadosExportacao() {
        return getHistoricoFiltrado().map(c => ({
            Rua: c.rua, Faixa: c.faixa, Código: c.codigo, Descrição: c.descricao,
            Embalagem: c.embalagem, Quantidade: c.quantidade,
            Data: c.data || '', Hora: c.hora || '', Observações: c.observacoes || ''
        }));
    }
    
    $('#btnExportCSV').addEventListener('click', () => {
        if (!isMaster) { Utils.showToast('Acesso restrito.', 'error'); return; }
        const dados = getDadosExportacao();
        if (!dados.length) { Utils.showToast('Nenhum dado.', 'error'); return; }
        const cab = ['Rua','Faixa','Código','Descrição','Embalagem','Quantidade','Data','Hora','Observações'];
        const linhas = [cab.join(';')];
        dados.forEach(d => linhas.push(Object.values(d).map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')));
        Utils.downloadBlob(new Blob(['\uFEFF' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' }), `contagem_${new Date().toISOString().slice(0,10)}.csv`);
        Utils.showToast('CSV exportado!', 'success');
    });
    
    $('#btnExportExcel').addEventListener('click', () => {
        if (!isMaster) { Utils.showToast('Acesso restrito.', 'error'); return; }
        const dados = getDadosExportacao();
        if (!dados.length) { Utils.showToast('Nenhum dado.', 'error'); return; }
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Contagens');
        XLSX.writeFile(wb, `contagem_${new Date().toISOString().slice(0,10)}.xlsx`);
        Utils.showToast('Excel exportado!', 'success');
    });
    
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
            if (Camera.isOpen) { Camera.close(); modalCamera.style.display = 'none'; }
        }
        if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); btnSalvar.click(); }
        if (e.key === 'Enter' && document.activeElement === inputQuantidade) { e.preventDefault(); btnSalvar.click(); }
    });
    
    // Online/Offline
    window.addEventListener('online', async () => {
        Utils.showToast('🌐 Online!', 'success');
        if (Database.supabase) {
            await syncPendingContagens();
            if (state.produtosMapCodAcesso.size === 0) await carregarBaseDoSupabase();
        }
    });
    
    window.addEventListener('offline', () => Utils.showToast('📱 Offline', 'warning'));
    
    // ============ INICIAR ============
    init();
    
})();