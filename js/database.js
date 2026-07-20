const Database = {
    supabase: null,
    
    // Chaves copiadas diretamente do seu painel
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4MjgxNiwiZXhwIjoyMDk5OTU4ODE2fQ.ix1w_IQndEQRqnhQ34FRW9_1_sSHVNFZEQ2sQhMyovY',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    init() {
        console.log('🔌 Inicializando Supabase...');
        console.log('URL:', this.URL);
        console.log('Chave (primeiros 20):', this.ANON_KEY.substring(0, 20) + '...');
        
        if (typeof window.supabase === 'undefined') {
            console.error('❌ SDK do Supabase não carregado!');
            return false;
        }
        
        this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY, {
            auth: { persistSession: false }
        });
        
        console.log('✅ Cliente criado:', !!this.supabase);
        return true;
    },
    
    async testConnection() {
        if (!this.supabase) return false;
        try {
            const { data, error } = await this.supabase
                .from('produtos')
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Erro no teste:', error.message);
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
        console.log('🔄 Buscando produtos...');
        const { data, error } = await this.supabase.from('produtos').select('*');
        if (error) {
            console.error('❌ Erro fetch:', error.message);
            throw error;
        }
        console.log('✅ Produtos:', data.length);
        return data;
    },
    
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        await this.supabase.from('produtos').delete().neq('id', 0);
        
        const BATCH = 500;
        for (let i = 0; i < produtosArray.length; i += BATCH) {
            const batch = produtosArray.slice(i, i + BATCH);
            const { error } = await this.supabase.from('produtos').insert(batch);
            if (error) throw error;
            if (onProgress) onProgress(Math.round((i + batch.length) / produtosArray.length * 100));
            await new Promise(r => setTimeout(r, 80));
        }
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