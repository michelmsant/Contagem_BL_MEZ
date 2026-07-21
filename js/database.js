// ============================================================
// DATABASE.JS - Conexão com Supabase (Versão Final Corrigida)
// ============================================================

const Database = {
    supabase: null,
    
    // Credenciais
    URL: 'https://qsfljxfhjpomrtznbzur.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZmxqeGZoanBvbXJ0em5ienVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzODI4MTYsImV4cCI6MjA5OTk1ODgxNn0.zR_N6WJCsc1HzAFjlfqEz6lVUutQLNDy8LTj8HIGAPd8',
    
    KEYS: {
        CONTAGENS: 'blmez_contagens',
        PENDING: 'blmez_pending_contagens',
        BASE_META: 'blmez_base_meta'
    },
    
    init() {
        console.log('🔌 Inicializando Supabase...');
        console.log('URL:', this.URL);
        console.log('Key (primeiros 30):', this.ANON_KEY.substring(0, 30) + '...');
        
        try {
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY);
            console.log('✅ Cliente Supabase criado');
            return true;
        } catch (e) {
            console.error('❌ Erro ao criar cliente:', e.message);
            return false;
        }
    },
    
    async testConnection() {
        if (!this.supabase) {
            console.error('❌ supabase é null');
            return false;
        }
        
        console.log('🔍 Testando conexão...');
        
        try {
            const { data, error } = await this.supabase
                .from('produtos')
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.error('❌ Erro no teste:', error.message);
                console.error('   Código:', error.code);
                console.error('   Detalhes:', error.details);
                console.error('   Dica:', error.hint);
                return false;
            }
            
            console.log('✅ Conexão OK!');
            return true;
        } catch (e) {
            console.error('❌ Exceção:', e.message);
            return false;
        }
    },
    
    // Buscar todos os produtos
    async fetchProdutos() {
        if (!this.supabase) {
            console.error('❌ supabase é null');
            return [];
        }
        
        console.log('🔄 Buscando TODOS os produtos...');
        
        try {
            let todosProdutos = [];
            let pagina = 0;
            const limitePorPagina = 1000;
            let temMais = true;
            
            while (temMais) {
                const inicio = pagina * limitePorPagina;
                const fim = inicio + limitePorPagina - 1;
                
                console.log(`   📄 Página ${pagina + 1} (${inicio}-${fim})`);
                
                const { data, error } = await this.supabase
                    .from('produtos')
                    .select('*')
                    .range(inicio, fim);
                
                if (error) {
                    console.error('❌ Erro:', error.message);
                    throw error;
                }
                
                if (data && data.length > 0) {
                    todosProdutos = todosProdutos.concat(data);
                    console.log(`   ✅ ${data.length} registros (total: ${todosProdutos.length})`);
                    
                    if (data.length < limitePorPagina) {
                        temMais = false;
                    } else {
                        pagina++;
                    }
                } else {
                    temMais = false;
                }
                
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`✅ Total carregado: ${todosProdutos.length} produtos`);
            return todosProdutos;
        } catch (e) {
            console.error('❌ Exceção:', e.message);
            throw e;
        }
    },
    
    // Substituir todos os produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        console.log(`🧹 Limpando tabela...`);
        const { error: delError } = await this.supabase
            .from('produtos')
            .delete()
            .neq('id', 0);
        
        if (delError) {
            console.error('❌ Erro ao limpar:', delError.message);
            throw delError;
        }
        
        console.log(`📤 Enviando ${produtosArray.length} produtos...`);
        
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
            
            console.log(`   ✅ Lote ${Math.floor(i/BATCH) + 1} enviado (${i + batch.length}/${total})`);
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
    
    saveBaseMeta(meta) {
        try { localStorage.setItem(this.KEYS.BASE_META, JSON.stringify(meta)); } catch (e) {}
    },
    
    loadBaseMeta() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.BASE_META)); } catch (e) { return null; }
    }
};

console.log('📦 Database.js carregado com sucesso');