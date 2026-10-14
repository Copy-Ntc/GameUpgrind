# UPGRIND — Crônicas do Abismo

RPG de grind/idle para navegador. Você escolhe uma classe e o herói explora sozinho masmorras geradas proceduralmente: luta contra monstros, abre baús, equipa armas melhores, sobe de nível, derrota chefes e avança por zonas cada vez mais difíceis.

## Como jogar

Abra o `index.html` com dois cliques no navegador. Não precisa instalar nada.

Se preferir rodar com um servidor local:

```bash
python -m http.server 5173
```

Depois acesse `http://localhost:5173`. O Live Server do VS Code também funciona.

**Atalhos:** `P` pausa · `1`–`4` mudam a velocidade (1x, 2x, 3x, 5x) · roda do mouse sobre o mapa aproxima/afasta · `Esc` fecha janelas.

O progresso é salvo automaticamente no navegador (localStorage), em até **3 slots** independentes. O botão de sair (canto superior direito) salva e volta para a tela de slots sem apagar nada. Use **Configurações → Exportar** para fazer backup.

## Duração e escala

Não há limite de zona nem de nível. A escala foi calibrada com `dev/career.js` para a **zona 200** ser a meta de longo prazo:

- a primeira jornada costuma acabar perto da zona 30, em cerca de 1 hora;
- Classes e espécies Lendárias aparecem depois de umas 35 horas de jogo otimizado;
- a zona 200 exige 70 horas ou mais.

Com tudo isso, a duração fica igual ou maior que a de completar o Vampire Survivors.

Itens e ouro crescem 17,5% por zona; a Vida dos inimigos cresce 25% e o Dano, 24%. Essa diferença é a "parede" do grind. Raridade, Arma Ancestral, Altar, Maestria, multiclasse e mestiçagem são multiplicadores que empurram a parede, e cada um vale várias zonas.

## Sistemas

- **3 corações por jornada (padrão).** Cada derrota custa um coração e faz o herói recuar uma zona para se fortalecer. Sem corações é Fim de Jogo: você recebe as Almas e escolhe a próxima jornada. A partir da zona 15, um Fim de Jogo conta como ascensão. O **Modo Relaxado** tira os corações, mas rende só 60% das Almas.
- **16 classes de D&D em 5 raridades.** Guerreiro, Mago, Ladino e Patrulheiro vêm liberados. Cavaleiro, Clérigo, Bárbaro e Bardo são Incomuns. Monge, Druida, Paladino e Feiticeiro são Raros. Bruxo, Artífice e Necromante são Épicos, e o Caçador de Sangue é Lendário. Cada classe tem 4 habilidades ativas, 4 passivas e um **talento inato** que cresce a cada nível, no estilo Vampire Survivors. A raridade multiplica Vida, Dano e Armadura finais (até ×1,7 numa classe Lendária).
- **31 espécies** (Humano, Anão, Elfo, Halfling, Orc, Tiferino, Aasimar, Genasi, Forjado Bélico, Shadar-kai, Fada, Thri-kreen…) com bônus e um poder racial próprio. A raridade da espécie também multiplica os atributos finais.
- **Desbloqueios lentos.** Conteúdo novo libera por metas (zona recorde, abates, santuários, Senhores derrotados), por feitos com uma classe específica (ex.: zona 45 com o Ladino libera o Monge) ou resgatando o personagem preso numa jaula na masmorra. Incomuns pedem 1–3 ascensões, Raros 4–6, Épicos 8–11 e Lendários 14–20.
- **Domínio:** uma classe ou espécie fica "dominada" ao chegar à zona 50 numa jornada que **começou** com ela. Trocar no meio da jornada não conta para recordes.
- **Multiclasse (10 ascensões):** combina duas classes dominadas: 4+2 habilidades ativas, as passivas das duas, +15% de Dano e Vida e 60% do inato da segunda. Cada nível pede 40% mais XP.
- **Mestiçagem (14 ascensões):** combina duas espécies dominadas: 50% dos traços da segunda, os poderes das duas e +10% de Dano e Vida. Cada nível pede 25% mais XP (acumula com a multiclasse).
- **Armas Ancestrais:** cada classe tem uma arma exclusiva (ex.: a Adaga dos Deuses do Ladino), obtida uma única vez no **Cofre Ancestral**, que aparece jogando com a classe a partir da zona 30. Ela acompanha a classe em todas as jornadas e é despertada de Comum até Mítica com **Fragmentos Ancestrais** (caem dos Senhores de bioma, às vezes de chefes e Mímicos) e recordes cada vez maiores com a classe. Na Épica e na Mítica ganha poderes lendários.
- **Maestria:** a partir do nível 60, os pontos de talento que sobram vão para talentos sem limite de nível (Dano, Vida, Armadura, Dano Crítico, Velocidade de Ataque e Fortuna).
- **Altar das Almas:** Poder, Vigor e Égide acumulam multiplicando (cada nível ×1,08). O Atalho Astral faz a jornada começar adiantada, já com nível e equipamento, na zona mais alta que o herói aguenta.
- **Exploração automática:** mapas procedurais com salas, corredores, névoa de guerra e linha de visão. A IA prioriza inimigos, depois baús, santuários, prisioneiros e cofres, explora o mapa, caça o chefe e entra no portal.
- **8 biomas** que se alternam a cada 5 zonas: Floresta, Cavernas, Deserto, Pântano, Gelo, Vulcão, Cripta e Abismo. Cada um tem inimigos, decoração, iluminação, trilha sonora e um Senhor próprio.
- **Saque:** 6 raridades (Comum → Mítico), afixos aleatórios, nomes com concordância de gênero, poderes lendários, armaduras por tipo de classe (placas, couro, pele, tecido, monge), baús de 4 tiers e Mímicos.
- **Venda em massa:** vender por raridade, modo de seleção, clique direito para venda rápida e venda automática configurável.
- **Progressão por jornada:** níveis e talentos, Treino com ouro, Forja (+1, +2… com chance de falha a partir de +5), conquistas com bônus permanentes.
- **Música:** 10 faixas geradas na hora (título, uma por bioma e uma de chefe), com volume próprio e opção de desligar.
- **Roda em segundo plano:** a simulação continua com ALT+TAB ou com a aba minimizada. Ao fechar o jogo e voltar, o herói recebe ouro, XP e itens pelo tempo fora (50% de eficiência, aumentável no Altar). Um slot fechado pelo botão de sair não ganha progresso offline.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `js/util.js` | Utilitários e a escala por zona (`SCALE`, `zoneScale`, `enemyScale`, `enemyAtkScale`) |
| `js/data.js` | Dados de balanceamento: inimigos, biomas, itens, treinos, Altar e conquistas |
| `js/heroes.js` | Classes, espécies, habilidades, inatos, desbloqueios, Maestria e Armas Ancestrais |
| `js/sprites.js` | Pixel art em texto (cada letra é uma cor da paleta), com contorno automático |
| `js/mapgen.js` | Geração procedural das zonas |
| `js/world.js` | Simulação: movimento, pathfinding, IA, combate, habilidades, chefes e saque |
| `js/render.js` | Renderização em canvas: mapa, névoa, luz, entidades e efeitos |
| `js/game.js` | Estado, slots de salvamento, progressão, economia e loop principal |
| `js/ui.js` | Interface: tela de título e slots, HUD, painéis, tooltips e janelas |
| `js/items.js`, `js/stats.js` | Geração de itens e cálculo de atributos/poder |
| `js/audio.js` | Efeitos sonoros sintetizados com WebAudio |
| `js/music.js` | Músicas procedurais (sequenciador WebAudio) |

Ferramentas de desenvolvimento em `dev/`:

- `dev/gallery.html` mostra todos os sprites ampliados (heróis, espécies, inimigos, itens e ícones), útil para editar a pixel art.
- `dev/sim.js` roda uma jornada sem navegador, em alta velocidade, e imprime a progressão zona a zona: `node dev/sim.js mage 90 1 elf` (classe, minutos de jogo, comprar melhorias, espécie).
- `dev/career.js` simula uma carreira inteira com várias jornadas e mostra quando cada classe, espécie e Arma Ancestral é liberada: `node dev/career.js 60 fighter 1 10` (horas, classe inicial, corações 1/0, relatório a cada N horas).
- Os dois aceitam `SCALE="item,vidaInimigo,danoInimigo,almas"` para testar outra escala sem editar o jogo.
