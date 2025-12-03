# 🚀 Guia Completo: Deploy na Vercel com Domínio da Registro BR

## 📋 Pré-requisitos

- ✅ Conta na Vercel (gratuita): [vercel.com](https://vercel.com)
- ✅ Conta na Registro BR com domínio comprado
- ✅ Projeto no GitHub (já está configurado)
- ✅ Variáveis de ambiente do Supabase configuradas

---

## 📝 Passo 1: Preparar o Projeto

### 1.1. Criar arquivo `.env.example` (opcional, para referência)
Crie um arquivo `.env.example` com as variáveis necessárias:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 1.2. Verificar se o `vercel.json` está criado
✅ Já foi criado! O arquivo `vercel.json` está configurado para funcionar com React Router.

---

## 🔧 Passo 2: Fazer Deploy na Vercel

### 2.1. Conectar o Repositório GitHub

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"** ou **"Import Project"**
3. Selecione o repositório `allure-business-hub` do GitHub
4. Clique em **"Import"**

### 2.2. Configurar o Projeto

**Configurações do Build:**
- **Framework Preset:** Vite
- **Build Command:** `npm run build` (já vem preenchido)
- **Output Directory:** `dist` (já vem preenchido)
- **Install Command:** `npm install` (já vem preenchido)

**Variáveis de Ambiente:**
Adicione as variáveis do Supabase:
- `VITE_SUPABASE_URL` = URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY` = Chave anônima do Supabase

**Como encontrar essas variáveis:**
1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Settings** → **API**
3. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

### 2.3. Fazer o Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar (2-5 minutos)
3. Você receberá uma URL temporária: `seu-projeto.vercel.app`

---

## 🌐 Passo 3: Configurar Domínio na Vercel

### 3.1. Adicionar Domínio na Vercel

1. No dashboard do projeto na Vercel, vá em **Settings** → **Domains**
2. Clique em **"Add Domain"**
3. Digite seu domínio (ex: `agendaris.com.br` ou `www.agendaris.com.br`)
4. Clique em **"Add"**

### 3.2. Obter os Registros DNS da Vercel

A Vercel mostrará os registros DNS que você precisa configurar:
- **Tipo A** ou **CNAME** (dependendo do que você escolher)
- **Valores específicos** fornecidos pela Vercel

**Exemplo do que você verá:**
```
Tipo: A
Nome: @
Valor: 76.76.21.21

Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

---

## 🔐 Passo 4: Configurar DNS na Registro BR

### 4.1. Acessar o Painel da Registro BR

1. Acesse [registro.br](https://registro.br)
2. Faça login na sua conta
3. Vá em **"Meus Domínios"**
4. Clique no domínio que você quer configurar

### 4.2. Configurar os Registros DNS

**Opção A: Usando Registros A (Recomendado para domínio raiz)**

1. Vá em **"DNS"** ou **"Zona DNS"**
2. Adicione/Edite os seguintes registros:

**Para o domínio raiz (sem www):**
```
Tipo: A
Nome: @ (ou deixe em branco)
Valor: 76.76.21.21
TTL: 3600
```

**Para www:**
```
Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
TTL: 3600
```

**Opção B: Usando apenas CNAME (se a Registro BR permitir)**

Alguns registradores permitem usar CNAME no domínio raiz:
```
Tipo: CNAME
Nome: @
Valor: cname.vercel-dns.com
```

### 4.3. Salvar as Alterações

1. Clique em **"Salvar"** ou **"Aplicar"**
2. Aguarde a propagação DNS (pode levar de 5 minutos a 48 horas, geralmente 1-2 horas)

---

## ✅ Passo 5: Verificar e Ativar SSL

### 5.1. Verificar Status na Vercel

1. Volte para o dashboard da Vercel
2. Vá em **Settings** → **Domains**
3. O status do domínio deve mostrar:
   - ⏳ **"Pending"** (aguardando DNS)
   - ✅ **"Valid Configuration"** (quando estiver pronto)

### 5.2. SSL Automático

A Vercel configura SSL automaticamente via Let's Encrypt. Quando o DNS estiver propagado:
- ✅ O certificado SSL será emitido automaticamente
- ✅ Seu site estará acessível via HTTPS

---

## 🔍 Passo 6: Verificar se Está Funcionando

### 6.1. Testar o Domínio

1. Aguarde 1-2 horas após configurar o DNS
2. Acesse seu domínio no navegador: `https://seudominio.com.br`
3. Verifique se:
   - ✅ O site carrega corretamente
   - ✅ O SSL está ativo (cadeado verde no navegador)
   - ✅ Todas as rotas funcionam (teste navegar entre páginas)

### 6.2. Verificar DNS (Ferramentas Online)

Use estas ferramentas para verificar se o DNS está propagado:
- [whatsmydns.net](https://www.whatsmydns.net)
- [dnschecker.org](https://dnschecker.org)

Digite seu domínio e verifique se os registros A/CNAME estão corretos.

---

## 🛠️ Passo 7: Configurar Variáveis de Ambiente (Importante!)

### 7.1. Adicionar Variáveis na Vercel

1. No dashboard da Vercel, vá em **Settings** → **Environment Variables**
2. Adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Selecione os ambientes: **Production**, **Preview**, **Development**
4. Clique em **"Save"**

### 7.2. Fazer Novo Deploy

Após adicionar as variáveis:
1. Vá em **Deployments**
2. Clique nos **3 pontos** do último deploy
3. Selecione **"Redeploy"**
4. Isso garantirá que as variáveis sejam aplicadas

---

## 📱 Passo 8: Configurar Supabase (URLs Permitidas)

### 8.1. Adicionar Domínio no Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Authentication** → **URL Configuration**
3. Adicione seu domínio em **"Site URL"**:
   - `https://seudominio.com.br`
4. Adicione em **"Redirect URLs"**:
   - `https://seudominio.com.br/**`
   - `https://www.seudominio.com.br/**` (se usar www)

---

## 🎯 Resumo dos Passos

1. ✅ **Deploy na Vercel** → Conectar GitHub e fazer deploy
2. ✅ **Adicionar Domínio** → Configurar domínio na Vercel
3. ✅ **Configurar DNS** → Adicionar registros A/CNAME na Registro BR
4. ✅ **Aguardar Propagação** → 1-2 horas para DNS propagar
5. ✅ **Verificar SSL** → Vercel configura automaticamente
6. ✅ **Configurar Supabase** → Adicionar domínio nas URLs permitidas

---

## 🆘 Troubleshooting

### Problema: Domínio não está funcionando

**Soluções:**
1. Verifique se os registros DNS estão corretos na Registro BR
2. Aguarde mais tempo (DNS pode levar até 48h)
3. Use ferramentas de verificação DNS para confirmar propagação
4. Verifique se não há erros no dashboard da Vercel

### Problema: SSL não está ativo

**Soluções:**
1. Aguarde até 24h após o DNS propagar
2. Verifique se o domínio está configurado corretamente na Vercel
3. Tente remover e adicionar o domínio novamente na Vercel

### Problema: Site carrega mas rotas não funcionam

**Solução:**
- Verifique se o arquivo `vercel.json` está no repositório (✅ já está criado!)

### Problema: Erro de autenticação do Supabase

**Soluções:**
1. Verifique se as variáveis de ambiente estão configuradas na Vercel
2. Adicione o domínio nas URLs permitidas do Supabase
3. Faça um novo deploy após alterar as variáveis

---

## 📞 Suporte

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Registro BR Suporte:** [atendimento.registro.br](https://atendimento.registro.br)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

---

## ✨ Dicas Finais

1. **Sempre faça deploy via GitHub** - A Vercel faz deploy automático a cada push
2. **Use variáveis de ambiente** - Nunca commite chaves no código
3. **Monitore os logs** - Use o dashboard da Vercel para ver erros
4. **Teste em produção** - Sempre teste após cada deploy

Boa sorte com o deploy! 🚀

