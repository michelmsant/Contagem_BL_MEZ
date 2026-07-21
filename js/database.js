// ============================================================
// DATABASE.JS - Conexão com Supabase
// ============================================================

const Database = {
    supabase: null,
    
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDy8LTj8HIGAPd8',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    init() {
        try {
            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase SDK não carregado');
                return false;
            }
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY);
            console.log('✅ Supabase inicializado');
            return true;
        } catch (e) {
            console.error('❌ Erro Supabase:', e.message);
            return false;
        }
    },
    
    async testConnection() {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase.from('produtos').select('id', { count: 'exact', head: true });
            if (error) { console.error('❌ Erro conexão:', error.message); return false; }
            console.log('✅ Conexão OK');
            return true;
        } catch (e) { return false; }
    },
    
    // Buscar TODOS os produtos com paginação
    async fetchProdutos() {
        if (!this.supabase) return [];
        
        console.log('🔄 Buscando TODOS os produtos...');
        
        try {
            let todosProdutos = [];
            let pagina = 0;
            const limitePorPagina = 1000;
            let temMais = true;
            
            while (temMais) {
                const inicio = pagina * limitePorPagina;
                const fim = inicio + limitePorPagina - 1;
                
                const { data, error } = await this.supabase
                    .from('produtos')
                    .select('*')
                    .range(inicio, fim);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    todosProdutos = todosProdutos.concat(data);
                    if (data.length < limitePorPagina) {
                        temMais = false;
                    } else {
                        pagina++;
                    }
                } else {
                    temMais = false;
                }
            }
            
            console.log('✅ Total carregado: ' + todosProdutos.length + ' produtos');
            return todosProdutos;
        } catch (e) {
            console.error('❌ Erro fetchProdutos:', e.message);
            throw e;
        }
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
        const { data } = await this.supabase.from('contagens').select('*').order('created_at', { ascending: false }).limit(5000);
        return data || [];
    },
    
    async saveContagem(contagem) {
        const { data, error } = await this.supabase.from('contagens').insert([contagem]).select('id').single();
        if (error) throw error;
        return data;
    },
    
    async deleteContagem(id) {
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    saveBaseMeta(meta) {
        try { localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(meta)); } catch (e) {}
    },
    
    loadBaseMeta() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.BASE_META)); } catch (e) { return null; }
    }
};