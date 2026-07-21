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
        console.log('🔌 Inicializando Supabase...');
        console.log('URL:', this.URL);
        
        try {
            // Verificar se o SDK foi carregado
            if (typeof window.supabase === 'undefined') {
                console.error('❌ SDK do Supabase não encontrado');
                return false;
            }
            
            // Criar cliente
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
            
            console.log('✅ Cliente Supabase criado com sucesso');
            return true;
            
        } catch (e) {
            console.error('❌ Erro ao criar cliente Supabase:', e.message);
            return false;
        }
    },
    
    async testConnection() {
        if (!this.supabase) {
            console.error('❌ testConnection: supabase é null');
            return false;
        }
        
        try {
            console.log('🔍 Testando conexão com Supabase...');
            
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
    
    // Buscar TODOS os produtos com paginação
    async fetchProdutos() {
        if (!this.supabase) {
            console.error('❌ fetchProdutos: supabase é null');
            return [];
        }
        
        console.log('🔄 Buscando TODOS os produtos do Supabase...');
        
        try {
            let todosProdutos = [];
            let pagina = 0;
            const limitePorPagina = 1000;
            let temMais = true;
            
            while (temMais) {
                const inicio = pagina * limitePorPagina;
                const fim = inicio + limitePorPagina - 1;
                
                console.log(`   📄 Página ${pagina + 1} (${inicio}-${fim})...`);
                
                const { data, error } = await this.supabase
                    .from('produtos')
                    .select('*')
                    .range(inicio, fim);
                
                if (error) {
                    console.error('❌ Erro ao buscar:', error.message);
                    throw error;
                }
                
                if (data && data.length > 0) {
                    todosProdutos = todosProdutos.concat(data);
                    console.log(`   ✅ ${data.length} registros (total acumulado: ${todosProdutos.length})`);
                    
                    if (data.length < limitePorPagina) {
                        temMais = false;
                    } else {
                        pagina++;
                    }
                } else {
                    temMais = false;
                }
                
                // Pequena pausa
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`✅ Total carregado: ${todosProdutos.length} produtos`);
            return todosProdutos;
            
        } catch (e) {
            console.error('❌ Exceção fetchProdutos:', e.message);
            throw e;
        }
    },
    
    // Substituir todos os produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        console.log('🧹 Limpando tabela...');
        
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
            const { error } = await this.supabase.from('produtos').insert(batch);
            if (error) throw error;
            
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
        
        if (error) {
            console.error('❌ Erro fetchContagens:', error.message);
            throw error;
        }
        
        return data || [];
    },
    
    async saveContagem(contagem) {
        if (!this.supabase) return null;
        
        const { data, error } = await this.supabase
            .from('contagens')
            .insert([contagem])
            .select('id')
            .single();
        
        if (error) {
            console.error('❌ Erro saveContagem:', error.message);
            throw error;
        }
        
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

// Inicializar automaticamente ao carregar o script
console.log('📦 Database.js carregado');