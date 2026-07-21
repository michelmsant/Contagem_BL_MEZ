const Database = {
    supabase: null,
    
    // Usando service_role (acesso total)
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM4MjgxNiwiZXhwIjoyMDk5OTU4ODE2fQ.ix1w_IQndEQRqnhQ34FRW9_1_sSHVNFZEQ2sQhMyovY',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    init() {
        console.log('🔌 Inicializando Supabase...');
        this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY);
        console.log('✅ Cliente criado');
        return true;
    },
    
    async testConnection() {
        console.log('🔍 Testando conexão...');
        const { data, error } = await this.supabase.from('produtos').select('id').limit(1);
        if (error) {
            console.error('❌ Erro:', error.message);
            return false;
        }
        console.log('✅ Conexão OK');
        return true;
    },
    
    async fetchProdutos() {
        console.log('🔄 Buscando produtos...');
        let todos = [];
        let page = 0;
        const size = 1000;
        let more = true;
        
        while (more) {
            const from = page * size;
            const to = from + size - 1;
            console.log('   Página', page + 1, '(', from, '-', to, ')');
            
            const { data, error } = await this.supabase.from('produtos').select('*').range(from, to);
            
            if (error) {
                console.error('❌ Erro:', error.message);
                throw error;
            }
            
            if (data && data.length > 0) {
                todos = todos.concat(data);
                console.log('   ✅', data.length, 'registros (total:', todos.length, ')');
                if (data.length < size) more = false;
                else page++;
            } else {
                more = false;
            }
        }
        
        console.log('✅ Total:', todos.length, 'produtos');
        return todos;
    },
    
    async replaceProdutos(arr, cb) {
        await this.supabase.from('produtos').delete().neq('id', 0);
        for (let i = 0; i < arr.length; i += 500) {
            const b = arr.slice(i, i + 500);
            const { error } = await this.supabase.from('produtos').insert(b);
            if (error) throw error;
            if (cb) cb(Math.round((i + b.length) / arr.length * 100));
        }
    },
    
    async fetchContagens() {
        const { data } = await this.supabase.from('contagens').select('*').order('created_at', { ascending: false }).limit(5000);
        return data || [];
    },
    
    async saveContagem(c) {
        const { data, error } = await this.supabase.from('contagens').insert([c]).select('id').single();
        if (error) throw error;
        return data;
    },
    
    async deleteContagem(id) {
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    saveBaseMeta(m) { try { localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(m)); } catch(e) {} },
    loadBaseMeta() { try { return JSON.parse(localStorage.getItem(this.KEYS.BASE_META)); } catch(e) { return null; } }
};