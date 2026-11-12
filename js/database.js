// ============================================================
// DATABASE.JS - Conexão com Supabase (Corrigido e Paginado)
// ============================================================

const Database = {
    supabase: null,
    
    // Credenciais fixas (Chave anon public)
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDyLT8jHIGAPd8',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    // Inicializar
    init() {
        try {
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase SDK não carregado!');
                return false;
            }
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY);
            console.log('✅ Supabase conectado! URL:', this.URL);
            return true;
        } catch (e) {
            console.error('❌ Erro ao conectar Supabase:', e.message);
            return false;
        }
    },
    
    // Testar conexão real
    async testConnection() {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('produtos')
                .select('id', { count: 'exact', head: true });
            if (error) {
                console.error('❌ Erro no teste:', error.message);
                return false;
            }
            console.log('✅ Conexão OK - Tabela produtos acessível');
            return true;
        } catch (e) {
            console.error('❌ Exceção no teste:', e.message);
            return false;
        }
    },
    
    // ============ BUSCAR PRODUTOS (PAGINADO) ============
    async fetchProdutos() {
        if (!this.supabase) return [];
        console.log('🔄 Buscando TODOS os produtos do Supabase...');
        
        let todos = [];
        let pagina = 0;
        const limite = 1000;
        let temMais = true;
        
        try {
            while (temMais) {
                const inicio = pagina * limite;
                const fim = inicio + limite - 1;
                
                const { data, error } = await this.supabase
                    .from('produtos')
                    .select('*')
                    .range(inicio, fim);
                    
                if (error) throw error;
                
                if (data && data.length > 0) {
                    todos = todos.concat(data);
                    console.log(`   Página ${pagina + 1} carregada (${data.length} registros)`);
                    
                    // Se retornou menos que o limite, chegou ao fim
                    if (data.length < limite) {
                        temMais = false;
                    } else {
                        pagina++;
                    }
                } else {
                    temMais = false;
                }
            }
            
            console.log(`✅ Total de ${todos.length} produtos carregados`);
            return todos;
        } catch (e) {
            console.error('❌ Erro ao buscar produtos:', e.message);
            throw e;
        }
    },
    
    // Limpar e inserir produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        console.log('🧹 Limpando tabela...');
        const { error: delError } = await this.supabase.from('produtos').delete().neq('id', 0);
        if (delError) throw delError;
        
        console.log(`📤 Enviando ${produtosArray.length} produtos...`);
        const BATCH = 500;
        const total = produtosArray.length;
        
        for (let i = 0; i < total; i += BATCH) {
            const batch = produtosArray.slice(i, i + BATCH);
            const { error } = await this.supabase.from('produtos').insert(batch);
            if (error) throw error;
            if (onProgress) onProgress(Math.round(((i + batch.length) / total) * 100));
            await new Promise(r => setTimeout(r, 80));
        }
        return true;
    },
    
    // ============ CONTAGENS ============
    async fetchContagens() {
        if (!this.supabase) return [];
        const { data, error } = await this.supabase
            .from('contagens')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5000);
        if (error) throw error;
        return data || [];
    },
    
    async saveContagem(contagem) {
        if (!this.supabase) return null;
        const { data, error } = await this.supabase
            .from('contagens')
            .insert([{
                data: contagem.data || '',
                rua: contagem.rua,
                codigo: contagem.codigo,
                descricao: contagem.descricao,
                embalagem: contagem.embalagem,
                quantidade: contagem.quantidade,
                contagem: contagem.contagem || 1,
                observacoes: contagem.observacoes || '',
                matricula: contagem.matricula || contagem.usuario || '',
                usuario: contagem.usuario_nome || contagem.usuarioNome || ''
            }])
            .select('id')
            .single();
        if (error) throw error;
        return data;
    },
    
    async updateContagem(id, dados) {
        if (!this.supabase) return;
        const { error } = await this.supabase
            .from('contagens')
            .update({
                quantidade: dados.quantidade,
                observacoes: dados.observacoes || '',
                data: dados.data,
                contagem: dados.contagem || 1
            })
            .eq('id', id);
        if (error) throw error;
    },
    
    async deleteContagem(id) {
        if (!this.supabase) return;
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    // Metadados
    saveBaseMeta(meta) {
        try { localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(meta)); } catch (e) {}
    },
    
    loadBaseMeta() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.BASE_META)); } catch (e) { return null; }
    }
};