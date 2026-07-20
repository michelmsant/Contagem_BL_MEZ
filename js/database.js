// ============================================================
// DATABASE.JS - Conexão com Supabase (CORRIGIDO)
// ============================================================

const Database = {
    supabase: null,
    
    // Credenciais fixas
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDyLT8jHIGAPd8',

    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    // Inicializar - CHAMADO APÓS O CARREGAMENTO DO SUPABASE SDK
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
        if (!this.supabase) {
            console.error('❌ testConnection: supabase é null');
            return false;
        }
        
        try {
            const { data, error } = await this.supabase
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
    
    // Buscar produtos
    async fetchProdutos() {
        if (!this.supabase) {
            console.error('❌ fetchProdutos: supabase é null');
            return [];
        }
        
        console.log('🔄 Buscando produtos...');
        
        try {
            const { data, error } = await this.supabase
                .from('produtos')
                .select('*');
            
            if (error) {
                console.error('❌ Erro ao buscar:', error.message);
                throw error;
            }
            
            console.log(`✅ ${data?.length || 0} produtos encontrados`);
            return data || [];
        } catch (e) {
            console.error('❌ Exceção ao buscar:', e.message);
            throw e;
        }
    },
    
    // Limpar e inserir produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        console.log('🧹 Limpando tabela...');
        
        // Limpar
        const { error: delError } = await this.supabase
            .from('produtos')
            .delete()
            .neq('id', 0);
        
        if (delError) {
            console.error('❌ Erro ao limpar:', delError.message);
            throw delError;
        }
        
        console.log(`📤 Enviando ${produtosArray.length} produtos...`);
        
        // Inserir em lotes
        const BATCH = 500;
        const total = produtosArray.length;
        
        for (let i = 0; i < total; i += BATCH) {
            const batch = produtosArray.slice(i, i + BATCH);
            
            const { error } = await this.supabase
                .from('produtos')
                .insert(batch);
            
            if (error) {
                console.error(`❌ Erro no lote ${i}:`, error.message);
                throw error;
            }
            
            if (onProgress) {
                onProgress(Math.round(((i + batch.length) / total) * 100));
            }
            
            await new Promise(r => setTimeout(r, 80));
        }
        
        console.log('✅ Todos produtos enviados!');
        return true;
    },
    
    // Contagens
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
            .insert([contagem])
            .select('id')
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async deleteContagem(id) {
        if (!this.supabase) return;
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    // Metadados
    saveBaseMeta(meta) {
        try {
            localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(meta));
        } catch (e) {}
    },
    
    loadBaseMeta() {
        try {
            const data = localStorage.getItem(this.KEYS.BASE_META);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }
};