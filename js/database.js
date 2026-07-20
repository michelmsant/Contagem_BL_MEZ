// ============================================================
// DATABASE.JS - Conexão com Supabase (CORRIGIDO)
// ============================================================

const Database = {
    supabase: null,
    
    // Credenciais fixas do Supabase
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDy8LTj8HIGAPd8',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    // Inicializar conexão
    init() {
        try {
            // Verificar se o SDK do Supabase foi carregado
            if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
                console.error('❌ Supabase SDK não carregado!');
                return false;
            }
            
            // Usar a variável global supabase (sem window.)
            const sbClient = typeof supabase !== 'undefined' ? supabase : window.supabase;
            this.supabase = sbClient.createClient(this.URL, this.ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
            
            console.log('✅ Supabase conectado!');
            console.log('   URL:', this.URL);
            console.log('   Cliente criado:', !!this.supabase);
            return true;
        } catch (e) {
            console.error('❌ Erro ao conectar Supabase:', e.message);
            return false;
        }
    },
    
    // Testar conexão
    async testConnection() {
        if (!this.supabase) {
            console.error('❌ Supabase não inicializado');
            return false;
        }
        
        try {
            const { data, error } = await this.supabase
                .from('produtos')
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Erro no teste de conexão:', error.message);
                console.error('   Detalhes:', error);
                return false;
            }
            
            console.log('✅ Conexão OK - Tabela produtos acessível');
            return true;
        } catch (e) {
            console.error('❌ Exceção no teste:', e.message);
            return false;
        }
    },
    
    // Buscar todos os produtos
    async fetchProdutos() {
        if (!this.supabase) {
            console.error('❌ fetchProdutos: supabase é null');
            return [];
        }
        
        console.log('🔄 Buscando produtos do Supabase...');
        
        try {
            const { data, error } = await this.supabase
                .from('produtos')
                .select('*');
            
            if (error) {
                console.error('❌ Erro ao buscar produtos:', error.message);
                console.error('   Código:', error.code);
                console.error('   Detalhes:', error.details);
                throw error;
            }
            
            console.log(`✅ ${data?.length || 0} produtos carregados`);
            return data || [];
        } catch (e) {
            console.error('❌ Exceção ao buscar produtos:', e.message);
            throw e;
        }
    },
    
    // Substituir todos os produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) {
            throw new Error('Supabase não conectado');
        }
        
        console.log('🧹 Limpando tabela de produtos...');
        
        // Limpar tabela
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
            
            // Pequena pausa
            await new Promise(r => setTimeout(r, 80));
        }
        
        console.log('✅ Todos produtos enviados!');
        return true;
    },
    
    // Buscar contagens
    async fetchContagens() {
        if (!this.supabase) return [];
        
        const { data, error } = await this.supabase
            .from('contagens')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5000);
        
        if (error) {
            console.error('❌ Erro ao buscar contagens:', error.message);
            throw error;
        }
        
        return data || [];
    },
    
    // Salvar contagem
    async saveContagem(contagem) {
        if (!this.supabase) return null;
        
        const { data, error } = await this.supabase
            .from('contagens')
            .insert([contagem])
            .select('id')
            .single();
        
        if (error) {
            console.error('❌ Erro ao salvar contagem:', error.message);
            throw error;
        }
        
        return data;
    },
    
    // Excluir contagem
    async deleteContagem(id) {
        if (!this.supabase) return;
        await this.supabase.from('contagens').delete().eq('id', id);
    },
    
    // Metadados (leves)
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