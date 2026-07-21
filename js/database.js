// ============================================================
// DATABASE.JS - Conexão com Supabase (service_role)
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
        console.log('URL:', this.URL);
        
        try {
            if (typeof window.supabase === 'undefined') {
                console.error('❌ SDK do Supabase não carregado');
                return false;
            }
            
            this.supabase = window.supabase.createClient(this.URL, this.ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
            
            console.log('✅ Cliente Supabase criado com sucesso');
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
        
        console.log('🔍 Testando conexão com Supabase...');
        
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
                
                console.log(`   📄 Página ${pagina + 1} (${inicio}-${fim})`);
                
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
                
                // Pequena pausa para não sobrecarregar
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`✅ Total carregado: ${todosProdutos.length} produtos`);
            return todosProdutos;
        } catch (e) {
            console.error('❌ Exceção ao buscar produtos:', e.message);
            throw e;
        }
    },
    
    // Substituir todos os produtos
    async replaceProdutos(produtosArray, onProgress) {
        if (!this.supabase) throw new Error('Supabase não conectado');
        
        console.log('🧹 Limpando tabela de produtos...');
        
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
            
            if (error) {
                console.error(`❌ Erro no lote ${i}:`, error.message);
                throw error;
            }
            
            if (onProgress) {
                onProgress(Math.round(((i + batch.length) / total) * 100));
            }
            
            console.log(`   ✅ Lote enviado (${i + batch.length}/${total})`);
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

console.log('📦 Database.js carregado com sucesso');