# UPGRIND — Crônicas do Abismo

RPG de grind/idle para navegador. Você escolhe uma classe e o herói explora sozinho masmorras geradas proceduralmente: luta contra monstros, abre baús, equipa armas melhores, sobe de nível, derrota chefes e avança por zonas cada vez mais difíceis.

## Como jogar

Abra o `index.html` com dois cliques no navegador. Não precisa instalar nada.

Se preferir rodar com um servidor local:

```bash
python -m http.server 5173
```

Depois acesse `http://localhost:5173`.

**Atalhos:** `P` pausa · `1`–`4` mudam a velocidade (1x, 2x, 3x, 5x) · roda do mouse sobre o mapa aproxima/afasta · `Esc` fecha janelas.

O progresso é salvo automaticamente no navegador (localStorage). Use **Configurações → Exportar** para fazer backup.

## Sistemas

- **16 classes de D&D em 5 raridades.** Guerreiro, Mago, Ladino e Patrulheiro vêm liberados. Cavaleiro, Clérigo, Bárbaro e Bardo são Incomuns. Monge, Druida, Paladino e Feiticeiro são Raros. Bruxo, Artífice e Necromante são Épicos, e o Caçador de Sangue é Lendário. Cada classe tem 4 habilidades ativas, 4 passivas e um **talento inato** que cresce a cada nível, no estilo Vampire Survivors. Quanto mais rara a classe, maiores os atributos base e mais forte o inato.
- **31 espécies** (Humano, Anão, Elfo, Halfling, Orc, Tiferino, Aasimar, Genasi, Forjado Bélico, Shadar-kai, Fada, Thri-kreen…) com bônus e um poder racial próprio. As raras ganham um multiplicador extra.
- **Desbloqueios progressivos.** Conteúdo novo libera por metas (zona recorde, abates, santuários, Senhores derrotados), por feitos com uma classe específica (ex.: zona 25 com o Ladino libera o Monge) ou resgatando o personagem preso numa jaula na masmorra (Paladino, Druida, Bardo…). Raros pedem 1 ascensão, Épicos 2–3 e Lendários 5–7.
- **Multiclasse:** depois de 2 ascensões, uma classe dominada (zona 25 com ela) pode ser combinada com outra também dominada. O herói ganha 4+2 habilidades ativas, as passivas das duas classes, +15% de Dano e Vida e 60% do inato da segunda classe. Em troca, cada nível pede 40% mais XP.
- **Modo Desafio (opcional):** a jornada tem 3 corações. Cada derrota custa um, e perder o último encerra a jornada (Fim de Jogo). Rende +30% de ouro e XP, +20% de sorte e 50% mais Almas. Almas, Altar, conquistas e desbloqueios nunca são perdidos, e um Fim de Jogo a partir da zona 15 conta como ascensão.
- **Exploração automática:** mapas procedurais com salas, corredores, névoa de guerra e linha de visão. A IA prioriza inimigos, depois baús, santuários e prisioneiros, explora o mapa, caça o chefe e entra no portal.
- **8 biomas** que se alternam a cada 5 zonas: Floresta, Cavernas, Deserto, Pântano, Gelo, Vulcão, Cripta e Abismo. Cada um tem inimigos, decoração, iluminação, trilha sonora e um Senhor próprio.
- **Saque:** 6 raridades (Comum → Mítico), afixos aleatórios, nomes com concordância de gênero, poderes lendários, armaduras por tipo de classe (placas, couro, pele, tecido, monge), baús de 4 tiers e Mímicos.
- **Venda em massa:** vender por raridade, modo de seleção, clique direito para venda rápida e venda automática configurável.
- **Progressão:** níveis e talentos, Treino com ouro, Forja (+1, +2… com chance de falha a partir de +5), conquistas com bônus permanentes.
- **Ascensão (prestígio):** a partir da zona 15. Reinicia a jornada em troca de Almas para o Altar e permite trocar de classe e espécie. O Atalho Astral faz a jornada começar adiantada, já com nível e equipamento da zona.
- **Música:** 10 faixas geradas na hora (título, uma por bioma e uma de chefe), com volume próprio e opção de desligar.
- **Roda em segundo plano:** a simulação continua com ALT+TAB ou com a aba minimizada. Ao fechar o jogo e voltar, o herói recebe ouro, XP e itens pelo tempo fora (50% de eficiência, aumentável no Altar).

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `js/data.js` | Dados de balanceamento: inimigos, biomas, itens, treinos, almas e conquistas |
| `js/heroes.js` | Classes, espécies, habilidades, talentos inatos, regras de desbloqueio e multiclasse |
| `js/sprites.js` | Pixel art em texto (cada letra é uma cor da paleta), com contorno automático |
| `js/mapgen.js` | Geração procedural das zonas |
| `js/world.js` | Simulação: movimento, pathfinding, IA, combate, habilidades, chefes e saque |
| `js/render.js` | Renderização em canvas: mapa, névoa, luz, entidades e efeitos |
| `js/game.js` | Estado, progressão, economia, salvamento e loop principal |
| `js/ui.js` | Interface: tela de título, HUD, painéis, tooltips e janelas |
| `js/items.js`, `js/stats.js` | Geração de itens e cálculo de atributos/poder |
| `js/audio.js` | Efeitos sonoros sintetizados com WebAudio |
| `js/music.js` | Músicas procedurais (sequenciador WebAudio) |

Ferramentas de desenvolvimento em `dev/`:

- `dev/gallery.html` mostra todos os sprites ampliados, útil para editar a pixel art.
- `dev/sim.js` roda o jogo sem navegador, em alta velocidade, e imprime a progressão zona a zona. Use para testar balanceamento: `node dev/sim.js mage 90 1 elf` (classe, minutos de jogo, comprar melhorias, espécie).
- `dev/career.js` simula uma carreira inteira com várias ascensões e mostra quando cada classe e espécie é desbloqueada: `node dev/career.js 24 fighter` (horas, classe inicial; acrescente `1` para o Modo Desafio).

A maior parte do balanceamento fica em `js/data.js` e nas funções `zoneScale`/`enemyScale` em `js/util.js` (inimigos escalam um pouco mais rápido que os itens; é isso que cria a "parede" do grind).
