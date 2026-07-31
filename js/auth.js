// ============================================================
// AUTH.JS - Autenticação (Offline First + Supabase)
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
        let users = this._getLocalUsers();
        
        if (Database.supabase) {
            try {
                const { data, error } = await Database.supabase
                    .from('usuarios')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (!error && data && data.length > 0) {
                    const merged = [...data];
                    if (!merged.find(u => u.usuario === this.MASTER_USER.usuario)) {
                        merged.push({ ...this.MASTER_USER });
                    }
                    this._saveLocalUsers(merged);
                    return merged;
                }
            } catch (e) {
                console.warn('Supabase indisponível, usando dados locais');
            }
        }
        
        return users;
    },
    
    async saveUser(userData) {
        let users = this._getLocalUsers();
        const newUser = {
            ...userData,
            id: Date.now(),
            created_at: new Date().toISOString()
        };
        users.push(newUser);
        this._saveLocalUsers(users);
        
        if (Database.supabase) {
            try {
                await Database.supabase.from('usuarios').insert([userData]);
            } catch (e) {
                console.warn('Salvo localmente, Supabase indisponível');
            }
        }
        
        return { sucesso: true, id: newUser.id };
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
            } catch (e) {}
        }
        
        return { sucesso: true };
    },
    
    cadastrar(nome, usuario, senha) {
        if (!nome || nome.trim().length < 3) {
            return { sucesso: false, mensagem: 'Nome deve ter pelo menos 3 caracteres.' };
        }
        if (!usuario || usuario.trim().length < 4) {
            return { sucesso: false, mensagem: 'Usuário deve ter pelo menos 4 caracteres.' };
        }
        if (!senha || senha.trim().length < 4) {
            return { sucesso: false, mensagem: 'Senha deve ter pelo menos 4 caracteres.' };
        }
        
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
        
        users.push(newUser);
        this._saveLocalUsers(users);
        
        if (Database.supabase) {
            Database.supabase.from('usuarios').insert([{
                nome: nome.trim(),
                usuario: usuario.trim(),
                senha: senha.trim(),
                role: 'user',
                ativo: true
            }]).then(() => {}).catch(() => {});
        }
        
        return { sucesso: true, mensagem: 'Cadastro realizado com sucesso!' };
    },
    
    login(usuario, senha) {
        if (!usuario || !senha) {
            return { sucesso: false, mensagem: 'Preencha todos os campos.' };
        }
        
        const users = this._getLocalUsers();
        const user = users.find(u => u.usuario === usuario.trim() && u.senha === senha.trim());
        
        if (!user) {
            return { sucesso: false, mensagem: 'Usuário ou senha incorretos.' };
        }
        
        if (user.ativo === false) {
            return { sucesso: false, mensagem: 'Usuário desativado. Contate o administrador.' };
        }
        
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
        } catch (e) {
            return null;
        }
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
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        return user;
    }
};

Auth.init();