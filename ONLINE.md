# Modo online: contas, save na nuvem e placar

O jogo funciona sem nada disso, salvando no navegador. Ao ligar o modo online, cada jogador pode:

- criar uma conta (apelido, e-mail e senha);
- guardar o **perfil** (Almas, Altar, liberações, Armas Ancestrais…) e os 3 slots de jornada na nuvem, e continuar em outro navegador ou computador. Ao entrar na conta tudo volta; ao sair, o navegador fica limpo para a próxima pessoa;
- aparecer no **placar** (zona recorde, maior golpe, tempo de jogo e nível).

O servidor é o [Supabase](https://supabase.com), que tem plano gratuito e funciona direto com o site do GitHub Pages.

## Passo a passo (uns 10 minutos)

1. **Crie o projeto.** Entre em https://supabase.com, clique em *Start your project* e entre com sua conta do GitHub. Depois clique em *New project*:
   - **Name:** `upgrind`
   - **Database Password:** qualquer senha forte (guarde, mas o jogo não usa)
   - **Region:** *South America (São Paulo)*
   - **Plano:** Free

   Espere uns 2 minutos até o projeto ficar pronto.

2. **Crie as tabelas.** No menu da esquerda, abra **SQL Editor** e clique em *New query*. Cole **todo** o conteúdo do arquivo [`online/supabase.sql`](online/supabase.sql) e clique em **Run**. Deve aparecer *Success. No rows returned*.

3. **Ajuste o login.** Em **Authentication → Sign In / Providers**, deixe **Email** ligado (já vem assim).
   - **Recomendado para jogar com amigos:** desligue *Confirm email*, assim a conta já entra na hora.
   - Se deixar ligado, cada pessoa precisa clicar no link do e-mail de confirmação, e o e-mail gratuito do Supabase só envia poucas mensagens por hora.
   - Na mesma página, em **Email**, ponha a senha mínima em **8** caracteres (o jogo já pede 8 para contas novas).

4. **Diga onde o jogo está.** Em **Authentication → URL Configuration**:
   - **Site URL:** `https://copy-ntc.github.io/GameUpgrind/`
   - **Redirect URLs:** adicione o mesmo endereço. Ele é usado pelos links de confirmação e de "Esqueci minha senha". Não use curingas como `*` ou `**`: um endereço aberto deixa um site falso receber o link de login de alguém.

5. **Copie as duas informações públicas.** Em **Project Settings → API Keys** (ou no botão **Connect** no topo):
   - **Project URL**, por exemplo `https://abcdefgh.supabase.co`;
   - a chave **anon** ou **publishable** (começa com `eyJ…` ou `sb_publishable_…`).

   ⚠ **Nunca** use a chave `service_role` ou `secret`.

6. **Cole no jogo.** Abra [`js/online-config.js`](js/online-config.js) e preencha:
   ```js
   const ONLINE_CONFIG = {
     url: 'https://abcdefgh.supabase.co',
     key: 'sua-chave-anon-ou-publishable',
   };
   ```

7. **Publique.** Faça commit e push. Em 1 ou 2 minutos o GitHub Pages atualiza, e a tela inicial passa a mostrar **Entrar / Criar conta** e **🏆 Placar**.

## Atualização: perfil na nuvem

Se o seu projeto foi criado antes desta versão, rode uma vez o arquivo [`online/atualizacao-perfil.sql`](online/atualizacao-perfil.sql) no **SQL Editor** do Supabase (*New query* → colar → **Run**). Ele libera o "slot 0" da tabela `saves`, onde fica o perfil. Antes disso, o jogo avisa na tela inicial e o perfil continua salvo só no navegador. Os slots de jornada já sincronizam normalmente.

## Atualização: segurança

Rode uma vez o arquivo [`online/atualizacao-seguranca.sql`](online/atualizacao-seguranca.sql) no **SQL Editor** (*New query* → colar → **Run**). No fim ele mostra 3 linhas (`profiles_name_chars`, `saves_data_size` e `saves_slot_check`). Ele:

- tira permissões que o jogo não usa (por exemplo, ninguém consegue gravar direto no placar ou mudar a data de criação do perfil);
- recusa apelidos com HTML ou caracteres invisíveis (usados para imitar outro jogador);
- limita cada save a 1 MB (um save cheio tem uns 100 KB), para ninguém lotar o banco;
- aceita no máximo um envio ao placar a cada 20 segundos por conta, e o tempo de jogo não cresce mais rápido que o relógio;
- cria a coluna `hidden` no placar para moderação (veja abaixo).

Quem instalar do zero com o `supabase.sql` já recebe tudo isso.

### Esconder um trapaceiro do placar

**Table Editor → leaderboard**, ache a linha e mude `hidden` para `true`. Ela some para todo mundo, menos para o próprio jogador, que nem percebe. Para trocar um apelido ofensivo, edite `name` em **profiles**.

### Anti-robô com Cloudflare Turnstile (grátis, não precisa de domínio)

Impede robôs de criar contas em massa e de testar senhas no login.

1. Em https://dash.cloudflare.com (crie uma conta grátis), abra **Turnstile → Add widget**:
   - **Widget name:** `upgrind`
   - **Hostnames:** `copy-ntc.github.io` (e `localhost` se for testar no seu PC)
   - **Widget Mode:** *Managed*

   Copie a **Site Key** e a **Secret Key**.
2. **Primeiro o jogo:** cole a **Site Key** em [`js/online-config.js`](js/online-config.js), no campo `turnstile`, faça commit e push e espere o site atualizar (a caixa da Cloudflare aparece no "Entrar / Criar conta").
3. **Depois o Supabase:** em **Authentication → Attack Protection** (em versões antigas, *Bot and Abuse Protection*), ligue **Enable CAPTCHA protection**, escolha **Cloudflare Turnstile** e cole a **Secret Key**.

Nessa ordem. Se ligar no Supabase antes de o site ter a Site Key, ninguém consegue entrar até o passo 2 ficar pronto. A Secret Key é a única informação que **nunca** vai para o código.

### E-mail de recuperação de senha (Gmail, grátis, sem domínio)

O e-mail gratuito do Supabase só entrega para a equipe do projeto, então o "Esqueci minha senha" não chega para os jogadores. Com um Gmail do jogo ele passa a funcionar para todos (limite de uns 500 e-mails por dia).

1. Crie um Gmail só para o jogo (ex.: `overlevelgame@gmail.com`) e ligue a **verificação em duas etapas** nele.
2. Na conta Google desse Gmail, abra **Segurança → Senhas de app** (ou procure "Senhas de app" na busca da conta), crie uma com o nome `Supabase` e copie a senha de 16 letras. Ela só aparece uma vez.
3. No Supabase, abra **Authentication → Emails → SMTP Settings** e ligue **Enable Custom SMTP**:
   - **Sender email:** o Gmail do jogo
   - **Sender name:** `OverLevelGame`
   - **Host:** `smtp.gmail.com`
   - **Port:** `465`
   - **Username:** o Gmail do jogo
   - **Password:** a senha de app de 16 letras
4. Ainda em **Authentication → Emails**, na aba **Templates**, abra **Reset Password** e troque por:
   - **Subject:** `Recupere sua senha do OverLevelGame`
   - **Body:**
     ```html
     <h2>Recuperar senha</h2>
     <p>Alguém pediu para trocar a senha da sua conta no OverLevelGame.</p>
     <p><a href="{{ .ConfirmationURL }}">Clique aqui para criar uma senha nova</a></p>
     <p>Abra o link no mesmo navegador em que você joga. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
     ```
5. Teste com a sua própria conta: **Entrar → Esqueci minha senha**. O link abre o jogo já pedindo a senha nova.

A senha de app fica só no painel do Supabase. Não coloque no código nem mande para ninguém. Se vazar, apague-a em **Senhas de app** e crie outra.

### Trocar a senha estando logado

Na tela inicial (botão **🔑 Trocar senha**) ou em **Configurações**, o jogador digita a senha atual e a nova. A senha atual é conferida antes da troca. Se o jogador esqueceu a senha e o e-mail não chega, o dono do jogo pode definir uma provisória pelo SQL Editor:

```sql
update auth.users
set encrypted_password = extensions.crypt('SenhaProvisoria123!', extensions.gen_salt('bf'))
where email = 'email.do.jogador@exemplo.com';
```

Confirme antes, por outro canal, que é mesmo o dono da conta pedindo. Depois ele entra com a provisória e troca pelo botão **Trocar senha**.

### Contas do dono do jogo

Quem controla o GitHub ou o Supabase controla o jogo. Ligue a verificação em duas etapas (2FA) no **GitHub** (*Settings → Password and authentication*), no **Supabase** (*Account → Security*) e no e-mail usado nos dois.

### Trocar a versão da biblioteca do Supabase

O jogo carrega `supabase-js` com uma impressão digital (SRI) em `SUPABASE_SRI`, em [`js/online.js`](js/online.js). Se mudar a versão em `SUPABASE_CDN`, gere a impressão nova com:

```bash
curl -s URL_DO_ARQUIVO | openssl dgst -sha384 -binary | openssl base64 -A
```

e cole como `sha384-<resultado>`. Sem isso, o navegador recusa o arquivo e o modo online não liga.

## Perguntas comuns

- **A chave fica pública no GitHub, tem problema?** Não. A URL e a chave *anon/publishable* foram feitas para ficar no site. Quem protege os dados são as regras do `supabase.sql`: cada conta só lê e grava os próprios saves, e o placar só aceita recordes enviados pela própria conta.
- **Dá para trapacear no placar?** O jogo roda no navegador de cada um, então quem souber mexer no código ainda consegue mandar uma zona falsa. O servidor barra os exageros mais fáceis (envios em rajada, tempo de jogo impossível, textos com HTML), e o resto se resolve escondendo a pessoa com a coluna `hidden`. Impedir de vez exigiria rodar o combate no servidor.
- **O projeto gratuito para sozinho?** Sim: depois de 1 semana sem ninguém jogar, o Supabase pausa o projeto. Basta entrar no painel e clicar em *Restore*. Enquanto isso o jogo continua funcionando e salvando no navegador.
- **Meus amigos perdem o progresso.** Isso acontece quando abrem o link pelo navegador interno do WhatsApp, Discord ou Instagram, ou numa aba anônima: esses navegadores apagam os dados ao fechar. O jogo mostra um aviso quando percebe isso. A saída é abrir no Chrome, Edge ou Firefox normal, ou entrar com uma conta.
- **Como testar sem servidor?** Abra o jogo pelo servidor local, rode no console `const s = document.createElement('script'); s.src = 'dev/mock-online.js'; document.head.appendChild(s);` e depois `MockOnline.start()`. Isso liga um Supabase falso em memória.
