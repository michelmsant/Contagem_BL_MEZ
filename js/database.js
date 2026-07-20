// ============================================================
// DATABASE.JS - Conexão com Supabase
// ============================================================

const Database = {
    supabase: null,
    
    // CREDENCIAIS FIXAS - NÃO ALTERAR
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDyLT8jHIGAPd8',
    
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
            const { error } = await this.supabase
                .from('produtos')
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Erro conexão:', error.message);
                return false;
            }
            console.log('✅ Conexão OK');
            return true;
        } catch (e) {
            console.error('❌ Exceção:', e.message);
            return false;
        }
    },
    
    async fetchProdutos() {
        if (!this.supabase) return [];
        
        const { data, error } = await this.supabase
            .from('produtos')
            .select('*');
        
        if (error) {
            console.error('❌ Erro fetchProdutos:', error.message);
            throw error;
        }
        
        console.log(`✅ ${data?.length || 0} produtos carregados`);
        return data || [];
    },
    
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        // Limpar
        const { error: delError } = await this.supabase
            .from('produtos')
            .delete()
            .neq('id', 0);
        
        if (delError) throw delError;
        
        // Inserir em lotes
        const BATCH = 500;
        const total = produtosArray.length;
        
        for (let i = 0; i < total; i += BATCH) {
            const batch = produtosArray.slice(i, i + BATCH);
            const { error } = await this.supabase.from('produtos').insert(batch);
            if (error) throw error;
            
            if (onProgress) {
                onProgress(Math.round(((i + batch.length) / total) * 100));
            }
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