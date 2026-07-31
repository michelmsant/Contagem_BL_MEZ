// ============================================================
// AUTH.JS - Autenticação (Supabase First + LocalStorage Fallback)
// ============================================================

const Auth = {
    STORAGE_KEY: 'blmez_current_user',
    LOCAL_USERS_KEY: 'blmez_users',
    
    MASTER_USER: {
        nome: 'Michel Marcelo',
        usuario: '5461448',
        senha: '5461448',
        role: 'master',
        ativo: true,
        id: 1,
        created_at: new Date().toISOString()
    },
    
    init() {
        this._garantirMasterLocal();
        // Sincronizar do Supabase ao iniciar
        if (Database.supabase) {
            this._syncFromSupabase();
        }
    },
    
    _garantirMasterLocal() {
        let users = this._getLocalUsers();
        if (!users.find(u => u.usuario === this.MASTER_USER.usuario)) {
            users.push({ ...this.MASTER_USER });
            localStorage.setItem(this.LOCAL_USERS_KEY, JSON.stringify(users));
        }
    },
    
    async _syncFromSupabase() {
        if (!Database.supabase) return;
        try {
            const { data, error } = await Database.supabase
                .from('usuarios')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data && data.length > 0) {
                let merged = [...data];
                // Garantir que o Master sempre existe
                if (!merged.find(u => u.usuario === this.MASTER_USER.usuario)) {
                    merged.push({ ...this.MASTER_USER });
                }
                // Salvar no localStorage para uso offline
                localStorage.setItem(this.LOCAL_USERS_KEY, JSON.stringify(merged));
                console.log('✅ Usuários sincronizados do Supabase:', merged.length);
            }
        } catch (e) {
            console.warn('⚠️ Não foi possível sincronizar do Supabase');
        }
    },
    
    _getLocalUsers() {
        try {
            const data = localStorage.getItem(this.LOCAL_USERS_KEY);
            let users = data ? JSON.parse(data) : [];
            // Sempre garantir Master
            if (!users.find(u => u.usuario === this.MASTER_USER.usuario)) {
                users.push({ ...this.MASTER_USER });
            }
            return users;
        } catch (e) {
            return [{ ...this.MASTER_USER }];
        }
    },
    
    _saveLocalUsers(users) {
        try {
            localStorage.setItem(this.LOCAL_USERS_KEY, JSON.stringify(users));
        } catch (e) {}
    },
    
    // Buscar usuário do Supabase diretamente
    async _findUserInSupabase(usuario) {
        if (!Database.supabase) return null;
        try {
            const { data, error } = await Database.supabase
                .from('usuarios')
                .select('*')
                .eq('usuario', usuario)
                .single();
            
            if (!error && data) {
                return data;
            }
        } catch (e) {}
        return null;
    },
    
    async getAllUsers() {
        // Sempre sincronizar primeiro
        await this._syncFromSupabase();
        return this._getLocalUsers();
    },
    
    async saveUserToSupabase(userData) {
        if (!Database.supabase) {
            console.warn('⚠️ Supabase não conectado. Usuário salvo apenas localmente.');
            return;
        }
        try {
            const { error } = await Database.supabase.from('usuarios').insert([{
                nome: userData.nome,
                usuario: userData.usuario,
                senha: userData.senha,
                role: userData.role || 'user',
                ativo: true
            }]);
            
            if (error) {
                console.error('❌ Erro Supabase:', error.message);
            } else {
                console.log('✅ Usuário salvo no Supabase:', userData.usuario);
            }
        } catch (e) {
            console.warn('⚠️ Erro ao salvar no Supabase:', e.message);
        }
    },
    
    cadastrar(nome, usuario, senha) {
        if (!nome || nome.trim().length < 3) return { sucesso: false, mensagem: 'Nome deve ter pelo menos 3 caracteres.' };
        if (!usuario || usuario.trim().length < 4) return { sucesso: false, mensagem: 'Usuário deve ter pelo menos 4 caracteres.' };
        if (!senha || senha.trim().length < 4) return { sucesso: false, mensagem: 'Senha deve ter pelo menos 4 caracteres.' };
        
        const users = this._getLocalUsers();
        if (users.find(u => u.usuario === usuario.trim())) {
            return { sucesso: false, mensagem: 'Este nome de usuário já está em uso.' };
        }
        
        const newUser = {
            nome: nome.trim(),
            usuario: usuario.trim(),
            senha: senha.trim(),
            role: 'user',
            ativo: true,
            id: Date.now(),
            created_at: new Date().toISOString()
        };
        
        // Salvar localmente
        users.push(newUser);
        this._saveLocalUsers(users);
        
        // Enviar para o Supabase
        this.saveUserToSupabase(newUser);
        
        return { sucesso: true, mensagem: 'Cadastro realizado com sucesso!' };
    },
    
    // ============ LOGIN CORRIGIDO ============
    async login(usuario, senha) {
        if (!usuario || !senha) return { sucesso: false, mensagem: 'Preencha todos os campos.' };
        
        const usuarioLimpo = usuario.trim();
        const senhaLimpa = senha.trim();
        
        // 1. Verificar no Master primeiro (sempre funciona)
        if (usuarioLimpo === this.MASTER_USER.usuario && senhaLimpa === this.MASTER_USER.senha) {
            const sessionData = {
                nome: this.MASTER_USER.nome,
                usuario: this.MASTER_USER.usuario,
                role: 'master',
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
            return { sucesso: true, mensagem: `Bem-vindo, ${this.MASTER_USER.nome}!`, user: sessionData };
        }
        
        // 2. Tentar buscar do Supabase PRIMEIRO
        if (Database.supabase) {
            try {
                const supabaseUser = await this._findUserInSupabase(usuarioLimpo);
                
                if (supabaseUser && supabaseUser.senha === senhaLimpa) {
                    if (supabaseUser.ativo === false) {
                        return { sucesso: false, mensagem: 'Usuário desativado.' };
                    }
                    
                    // Salvar no localStorage local para próximos logins
                    let localUsers = this._getLocalUsers();
                    if (!localUsers.find(u => u.usuario === usuarioLimpo)) {
                        localUsers.push(supabaseUser);
                        this._saveLocalUsers(localUsers);
                    }
                    
                    const sessionData = {
                        nome: supabaseUser.nome,
                        usuario: supabaseUser.usuario,
                        role: supabaseUser.role || 'user',
                        loginTime: new Date().toISOString()
                    };
                    
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
                    console.log('✅ Login via Supabase:', supabaseUser.nome);
                    return { sucesso: true, mensagem: `Bem-vindo, ${supabaseUser.nome}!`, user: sessionData };
                }
            } catch (e) {
                console.warn('⚠️ Supabase indisponível, tentando localStorage...');
            }
        }
        
        // 3. Fallback: localStorage
        const users = this._getLocalUsers();
        const user = users.find(u => u.usuario === usuarioLimpo && u.senha === senhaLimpa);
        
        if (!user) {
            return { sucesso: false, mensagem: 'Usuário ou senha incorretos.' };
        }
        
        if (user.ativo === false) {
            return { sucesso: false, mensagem: 'Usuário desativado.' };
        }
        
        const sessionData = {
            nome: user.nome,
            usuario: user.usuario,
            role: user.role || 'user',
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
        console.log('✅ Login via localStorage:', user.nome);
        return { sucesso: true, mensagem: `Bem-vindo, ${user.nome}!`, user: sessionData };
    },
    
    async updateUser(usuario, updates) {
        let users = this._getLocalUsers();
        const idx = users.findIndex(u => u.usuario === usuario);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            this._saveLocalUsers(users);
        }
        
        if (Database.supabase) {
            try {
                await Database.supabase.from('usuarios').update(updates).eq('usuario', usuario);
                console.log('✅ Usuário atualizado no Supabase:', usuario);
            } catch (e) {}
        }
        
        return { sucesso: true };
    },
    
    async deleteUser(usuario) {
        if (usuario === this.MASTER_USER.usuario) {
            return { sucesso: false, mensagem: 'Não é possível excluir o usuário Master principal.' };
        }
        
        let users = this._getLocalUsers();
        users = users.filter(u => u.usuario !== usuario);
        this._saveLocalUsers(users);
        
        if (Database.supabase) {
            try {
                await Database.supabase.from('usuarios').delete().eq('usuario', usuario);
                console.log('✅ Usuário excluído do Supabase:', usuario);
            } catch (e) {}
        }
        
        return { sucesso: true };
    },
    
    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        window.location.href = 'index.html';
    },
    
    isLoggedIn() {
        try {
            const session = localStorage.getItem(this.STORAGE_KEY);
            return session ? JSON.parse(session) : null;
        } catch (e) { return null; }
    },
    
    isMaster() {
        const user = this.isLoggedIn();
        return user && user.role === 'master';
    },
    
    getCurrentUser() {
        return this.isLoggedIn();
    },
    
    checkAccess() {
        const user = this.isLoggedIn();
        if (!user) { window.location.href = 'index.html'; return null; }
        return user;
    }
};

Auth.init();