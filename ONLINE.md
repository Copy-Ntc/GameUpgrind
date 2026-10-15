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

4. **Diga onde o jogo está.** Em **Authentication → URL Configuration**:
   - **Site URL:** `https://copy-ntc.github.io/GameUpgrind/`
   - **Redirect URLs:** adicione o mesmo endereço. Ele é usado pelos links de confirmação e de "Esqueci minha senha".

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

## Perguntas comuns

- **A chave fica pública no GitHub, tem problema?** Não. A URL e a chave *anon/publishable* foram feitas para ficar no site. Quem protege os dados são as regras do `supabase.sql`: cada conta só lê e grava os próprios saves, e o placar só aceita recordes enviados pela própria conta.
- **Dá para trapacear no placar?** Quem souber mexer no console do navegador consegue enviar números falsos. Para um placar entre amigos, isso basta. Se virar algo público, aí vale mover a validação para o servidor.
- **O projeto gratuito para sozinho?** Sim: depois de 1 semana sem ninguém jogar, o Supabase pausa o projeto. Basta entrar no painel e clicar em *Restore*. Enquanto isso o jogo continua funcionando e salvando no navegador.
- **Meus amigos perdem o progresso.** Isso acontece quando abrem o link pelo navegador interno do WhatsApp, Discord ou Instagram, ou numa aba anônima: esses navegadores apagam os dados ao fechar. O jogo mostra um aviso quando percebe isso. A saída é abrir no Chrome, Edge ou Firefox normal, ou entrar com uma conta.
- **Como testar sem servidor?** Abra o jogo pelo servidor local, rode no console `const s = document.createElement('script'); s.src = 'dev/mock-online.js'; document.head.appendChild(s);` e depois `MockOnline.start()`. Isso liga um Supabase falso em memória.
