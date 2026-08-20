// ============================================================
// DATABASE.JS - Conexão com Supabase
// ============================================================

const Database = {
    supabase: null,
    
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4MjgxNiwiZXhwIjoyMDk5OTU4ODE2fQ.ix1w_IQndEQRqnhQ34FRW9_1_sSHVNFZEQ2sQhMyovY',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    init() {
        console.log('🔌 Inicializando Supabase...');
        try {
            if (typeof window.supabase === 'undefined') {
                console.error('❌ SDK do Supabase não carregado');
                return false;
            }
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            console.log('✅ Cliente Supabase criado');
            return true;
        } catch (e) {
            console.error('❌ Erro:', e.message);
            return false;
        }
    },
    
    async testConnection() {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase.from('produtos').select('id', { count: 'exact', head: true });
            return !error;
        } catch (e) { return false; }
    },
    
    async fetchProdutos() {
        if (!this.supabase) return [];
        let todos = [];
        let pagina = 0;
        const limite = 1000;
        let temMais = true;
        while (temMais) {
            const inicio = pagina * limite;
            const fim = inicio + limite - 1;
            const { data, error } = await this.supabase.from('produtos').select('*').range(inicio, fim);
            if (error) throw error;
            if (data && data.length > 0) {
                todos = todos.concat(data);
                if (data.length < limite) temMais = false;
                else pagina++;
            } else {
                temMais = false;
            }
        }
        return todos;
    },
    
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        await this.supabase.from('produtos').delete().neq('id', 0);
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
        
        console.log('💾 Salvando contagem no Supabase:', contagem);
        
        const { data, error } = await this.supabase
            .from('contagens')
            .insert([{
                rua: contagem.rua,
                codigo: contagem.codigo,
                descricao: contagem.descricao,
                embalagem: contagem.embalagem,
                quantidade: contagem.quantidade,
                observacoes: contagem.observacoes || '',
                data: contagem.data,
                hora: contagem.hora,
                usuario: contagem.usuario || '',
                usuario_nome: contagem.usuarioNome || '',
                contagem: contagem.contagem || 1,
                finalizada: contagem.finalizada || false,
                data_finalizacao: contagem.data_finalizacao || null
            }])
            .select('id')
            .single();
        
        if (error) {
            console.error('❌ Erro ao salvar:', error.message);
            throw error;
        }
        
        console.log('✅ Contagem salva, ID:', data.id);
        return data;
    },
    
    async updateContagem(id, dados) {
        if (!this.supabase) return;
        const { error } = await this.supabase
            .from('contagens')
            .update(dados)
            .eq('id', id);
        if (error) throw error;
    },
    
    async deleteContagem(id) {
        if (!this.supabase) return;
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    saveBaseMeta(meta) {
        try { localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(meta)); } catch (e) {}
    },
    
    loadBaseMeta() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.BASE_META)); } catch (e) { return null; }
    }
};

console.log('📦 Database.js carregado');