// ============================================================
// AUTH.JS - Autenticação (Supabase + LocalStorage)
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
    },
    
    _garantirMasterLocal() {
        let users = this._getLocalUsers();
        if (!users.find(u => u.usuario === this.MASTER_USER.usuario)) {
            users.push({ ...this.MASTER_USER });
            localStorage.setItem(this.LOCAL_USERS_KEY, JSON.stringify(users));
        }
    },
    
    _getLocalUsers() {
        try {
            const data = localStorage.getItem(this.LOCAL_USERS_KEY);
            let users = data ? JSON.parse(data) : [];
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
    
    async getAllUsers() {
        // Sincronizar do Supabase
        if (Database.supabase) {
            try {
                const { data, error } = await Database.supabase
                    .from('usuarios')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (!error && data && data.length > 0) {
                    let merged = [...data];
                    if (!merged.find(u => u.usuario === this.MASTER_USER.usuario)) {
                        merged.push({ ...this.MASTER_USER });
                    }
                    this._saveLocalUsers(merged);
                    return merged;
                }
            } catch (e) {
                console.warn('⚠️ Supabase indisponível');
            }
        }
        return this._getLocalUsers();
    },
    
    // ============ CADASTRAR (SALVA LOCAL + SUPABASE) ============
    cadastrar(nome, usuario, senha) {
        // Validações
        if (!nome || nome.trim().length < 3) return { sucesso: false, mensagem: 'Nome deve ter pelo menos 3 caracteres.' };
        if (!usuario || usuario.trim().length < 4) return { sucesso: false, mensagem: 'Matrícula deve ter pelo menos 4 dígitos.' };
        if (!/^\d+$/.test(usuario.trim())) return { sucesso: false, mensagem: 'Matrícula deve conter apenas números.' };
        if (!senha || senha.trim().length < 4) return { sucesso: false, mensagem: 'Senha deve ter pelo menos 4 caracteres.' };
        
        const users = this._getLocalUsers();
        if (users.find(u => u.usuario === usuario.trim())) {
            return { sucesso: false, mensagem: 'Esta matrícula já está em uso.' };
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
        
        // Salvar local imediatamente
        users.push(newUser);
        this._saveLocalUsers(users);
        
        // Enviar para o Supabase (assíncrono)
        this._enviarParaSupabase(newUser);
        
        return { sucesso: true, mensagem: 'Cadastro realizado com sucesso!' };
    },
    
    async _enviarParaSupabase(userData) {
        if (!Database.supabase) {
            console.warn('⚠️ Supabase não conectado - usuário salvo apenas localmente');
            return;
        }
        
        try {
            console.log('📤 Enviando usuário para o Supabase:', userData.usuario);
            
            const { data, error } = await Database.supabase
                .from('usuarios')
                .insert([{
                    nome: userData.nome,
                    usuario: userData.usuario,
                    senha: userData.senha,
                    role: userData.role || 'user',
                    ativo: true
                }])
                .select('id')
                .single();
            
            if (error) {
                console.error('❌ Erro ao salvar no Supabase:', error.message);
                console.error('   Detalhes:', error.details);
                console.error('   Hint:', error.hint);
                console.error('   Código:', error.code);
            } else {
                console.log('✅ Usuário salvo no Supabase! ID:', data.id);
            }
        } catch (err) {
            console.error('❌ Exceção ao enviar para Supabase:', err.message);
        }
    },
    
    // ============ ATUALIZAR USUÁRIO ============
    async updateUser(usuario, updates) {
        // Atualizar local
        let users = this._getLocalUsers();
        const idx = users.findIndex(u => u.usuario === usuario);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            this._saveLocalUsers(users);
        }
        
        // Atualizar Supabase
        if (Database.supabase) {
            try {
                console.log('📤 Atualizando usuário no Supabase:', usuario);
                const { error } = await Database.supabase
                    .from('usuarios')
                    .update(updates)
                    .eq('usuario', usuario);
                
                if (error) {
                    console.error('❌ Erro ao atualizar:', error.message);
                } else {
                    console.log('✅ Usuário atualizado no Supabase!');
                }
            } catch (err) {
                console.error('❌ Exceção:', err.message);
            }
        }
        
        return { sucesso: true };
    },
    
    // ============ EXCLUIR USUÁRIO ============
    async deleteUser(usuario) {
        if (usuario === this.MASTER_USER.usuario) {
            return { sucesso: false, mensagem: 'Não é possível excluir o usuário Master principal.' };
        }
        
        // Remover local
        let users = this._getLocalUsers();
        users = users.filter(u => u.usuario !== usuario);
        this._saveLocalUsers(users);
        
        // Remover Supabase
        if (Database.supabase) {
            try {
                console.log('📤 Excluindo usuário do Supabase:', usuario);
                const { error } = await Database.supabase
                    .from('usuarios')
                    .delete()
                    .eq('usuario', usuario);
                
                if (error) {
                    console.error('❌ Erro ao excluir:', error.message);
                } else {
                    console.log('✅ Usuário excluído do Supabase!');
                }
            } catch (err) {
                console.error('❌ Exceção:', err.message);
            }
        }
        
        return { sucesso: true };
    },
    
    // ============ LOGIN ============
    async login(usuario, senha) {
        if (!usuario || !senha) return { sucesso: false, mensagem: 'Preencha todos os campos.' };
        if (!/^\d+$/.test(usuario.trim())) return { sucesso: false, mensagem: 'Matrícula deve conter apenas números.' };
        
        const u = usuario.trim();
        const s = senha.trim();
        
        // Master sempre funciona
        if (u === this.MASTER_USER.usuario && s === this.MASTER_USER.senha) {
            return this._createSession(this.MASTER_USER);
        }
        
        // Tentar Supabase primeiro
        if (Database.supabase) {
            try {
                const { data, error } = await Database.supabase
                    .from('usuarios')
                    .select('*')
                    .eq('usuario', u)
                    .eq('senha', s)
                    .single();
                
                if (!error && data) {
                    if (data.ativo === false) {
                        return { sucesso: false, mensagem: 'Usuário desativado.' };
                    }
                    // Atualizar local
                    let localUsers = this._getLocalUsers();
                    if (!localUsers.find(lu => lu.usuario === u)) {
                        localUsers.push(data);
                        this._saveLocalUsers(localUsers);
                    }
                    return this._createSession(data);
                }
            } catch (e) {
                console.warn('Supabase indisponível, usando local');
            }
        }
        
        // Fallback local
        const users = this._getLocalUsers();
        const user = users.find(lu => lu.usuario === u && lu.senha === s);
        
        if (!user) return { sucesso: false, mensagem: 'Matrícula ou senha incorretos.' };
        if (user.ativo === false) return { sucesso: false, mensagem: 'Usuário desativado.' };
        
        return this._createSession(user);
    },
    
    _createSession(user) {
        const sessionData = {
            nome: user.nome,
            usuario: user.usuario,
            role: user.role || 'user',
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
        return { sucesso: true, mensagem: `Bem-vindo, ${user.nome}!`, user: sessionData };
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