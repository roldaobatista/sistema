---
name: interface-design
description: "Design de interfaces — dashboards, painéis de administração, aplicativos, ferramentas e produtos interativos. NÃO é para design de marketing (landing pages, sites de marketing, campanhas)."
---

# Design de Interface

**Habilidade · Memória · Consistência**

> Construa interfaces com intenção. Lembre-se das decisões tomadas ao longo das sessões. Mantenha uma consistência sistemática.

*Para design de interface — dashboards, aplicativos, ferramentas, painéis de administração. Não para sites de marketing.*

---

## Escopo

**Ideal para:** Painéis de controle, painéis de administração, aplicativos SaaS, ferramentas, páginas de configurações e interfaces de dados.

**Não recomendado para:** Páginas de destino, sites de marketing e campanhas. Redirecione-os para `/frontend-design`.

---

## O Problema

Você irá gerar resultados genéricos. Seu treinamento já analisou milhares de dashboards. Os padrões são fortes.

Você pode seguir todo o processo abaixo — explorar o domínio, criar uma assinatura, declarar sua intenção — e ainda assim gerar um modelo. Cores quentes em estruturas frias. Fontes amigáveis em layouts genéricos. Uma "sensação de cozinha" que se parece com qualquer outro aplicativo.

Isso acontece porque a intenção reside na prosa, mas a geração de código se baseia em padrões. A lacuna entre eles é onde os valores padrão prevalecem.

O processo abaixo ajuda. Mas o processo por si só não garante a qualidade. Você precisa se policiar.

### Onde os valores padrão se ocultam

As configurações padrão não se anunciam. Elas se disfarçam de infraestrutura — as partes que parecem simplesmente precisar funcionar, e não serem projetadas.

**Tipografia** parece um recipiente. Escolha algo legível e siga em frente. Mas a tipografia não está apenas contendo seu design — ela **É** o seu design. O peso de um título, a personalidade de um rótulo, a textura de um parágrafo. Tudo isso molda a sensação que o produto transmite antes mesmo de alguém ler uma palavra. Uma ferramenta de gestão para uma padaria e um terminal de negociação podem precisar de uma "tipografia limpa e legível" — mas a tipografia que transmite aconchego e um toque artesanal não é a mesma que a tipografia fria e precisa. Se você está usando sua fonte de sempre, você não está criando um design.

**Navegação** parece um andaime. Construa a barra lateral, adicione os links e mãos à obra. Mas a navegação não gira em torno do seu produto — ela **É** o seu produto. Onde você está, para onde pode ir, o que mais importa. Uma página flutuando no espaço é uma demonstração de um componente, não um software. A navegação ensina as pessoas a pensar sobre o espaço em que estão inseridas.

**Dados** parecem apresentação. Você tem números, mostre números. Mas um número na tela não é design. A questão é: o que esse número significa para quem o vê? O que essa pessoa fará com ele? Um anel de progresso e uma etiqueta empilhada mostram "3 de 10" — um conta uma história, o outro preenche espaço. Se você está optando por um número na etiqueta, você não está projetando.

**Nomes dos tokens** parecem detalhes de implementação. Mas suas variáveis CSS são decisões de design. `--ink` evoca um mundo, `--parchment` outro, `--gray-700` e `--surface-2` um modelo. Alguém que lesse apenas seus tokens deveria ser capaz de adivinhar de que produto se trata.

A armadilha é pensar que algumas decisões são criativas e outras estruturais. **Não existem decisões estruturais. Tudo é design.** No momento em que você para de perguntar "por que isso?", é o momento em que as decisões padrão assumem o controle.

---

## Intenção em Primeiro Lugar

Antes de mexer no código, responda a estas perguntas. Não mentalmente — responda em voz alta, para si mesmo ou para o usuário.

1. **Quem é esse ser humano?** Não os "usuários". A pessoa real. Onde ela está quando abre isso? O que está pensando? O que ela fez há 5 minutos, o que fará daqui a 5 minutos? Um professor às 7 da manhã tomando café não é um desenvolvedor depurando à meia-noite, que por sua vez não é um fundador entre reuniões com investidores. O mundo deles molda a interface.

2. **O que eles precisam realizar?** Não "usar o painel de controle". O verbo. Avaliar esses envios. Encontrar a falha na implementação. Aprovar o pagamento. A resposta determina o que vem a seguir, o que se esconde.

3. **Qual deve ser a sensação?** Descreva com palavras que façam sentido. "Limpo e moderno" não significa nada — toda IA diz isso. Aconchegante como um caderno? Frio como um terminal? Denso como uma sala de negociação? Tranquilo como um aplicativo de leitura? A resposta define a cor, a tipografia, o espaçamento, a densidade — tudo.

> **Se você não souber responder a essas perguntas com detalhes específicos, pare. Pergunte ao usuário. Não chute. Não dê uma resposta padrão.**

### Toda escolha deve ser uma escolha

Para cada decisão, você deve ser capaz de explicar o **PORQUÊ**.

- Por que este layout e não outro?
- Por que essa temperatura de cor?
- Por que essa fonte?
- Por que essa escala de espaçamento?
- Por que essa hierarquia de informações?

Se sua resposta for "é comum", "é limpo" ou "funciona", você não escolheu. Você optou pela resposta padrão. Respostas padrão são invisíveis. Escolhas invisíveis se acumulam, resultando em uma saída genérica.

**O teste:** se você trocasse suas escolhas pelas alternativas mais comuns e o design não parecesse significativamente diferente, você nunca fez escolhas reais.

### A mesmice é o fracasso

Se outra IA, ao receber um estímulo semelhante, produzisse um resultado substancialmente igual, **você falhou**.

Não se trata de ser diferente por si só. Trata-se da interface emergir do problema específico, do usuário específico, do contexto específico. Quando você projeta a partir da intenção, a homogeneidade se torna impossível porque não existem duas intenções idênticas.

Ao criar designs a partir de configurações padrão, tudo fica igual porque essas configurações são compartilhadas.

### A intenção deve ser sistêmica

Dizer "quente" e usar cores frias não é cumprir o prometido. A intenção não é um rótulo — é uma restrição que molda todas as decisões.

- Se a intenção for criar uma atmosfera **acolhedora**: superfícies, texto, bordas, detalhes, cores semânticas, tipografia — tudo acolhedor.
- Se a intenção for criar uma atmosfera **densa**: espaçamento, tamanho da fonte, arquitetura da informação — tudo denso.
- Se a intenção for criar uma atmosfera **calma**: movimento, contraste, saturação de cor — tudo calmo.

Verifique se a sua saída corresponde à intenção declarada. Cada token reforça essa intenção? Ou você declarou uma intenção e, em seguida, acatou o padrão?

---

## Exploração do Domínio do Produto

É aqui que os valores padrão são detectados — ou não.

- **Saída genérica:** Tipo de tarefa → Modelo visual → Tema
- **Saída personalizada:** Tipo de tarefa → Domínio do produto → Assinatura → Estrutura + Expressão

A diferença: tempo dedicado ao universo do produto antes de qualquer reflexão visual ou estrutural.

### Resultados Esperados

> **Não proponha nenhuma direção até que tenha apresentado todas as quatro:**

1. **Domínio:** Conceitos, metáforas e vocabulário do universo deste produto. Não se trata de funcionalidades, mas sim de território. Mínimo de 5.
2. **Mundo das cores:** Quais cores existem naturalmente no domínio deste produto? Não pense em cores "quentes" ou "frias" — pense no mundo real. Se este produto fosse um espaço físico, o que você veria? Quais cores pertencem a esse espaço, mas não a nenhum outro? Liste pelo menos 5.
3. **Assinatura:** Um elemento — visual, estrutural ou de interação — que só poderia existir neste produto. Se não conseguir pensar em nenhum, continue procurando.
4. **Opções padrão:** 3 escolhas óbvias para este tipo de interface — visual E estrutural. Você não pode evitar padrões que não nomeou.

### Requisitos da proposta

Suas instruções devem fazer referência explícita a:

- Conceitos de domínio que você explorou
- Cores da sua exploração do mundo das cores
- Seu elemento de assinatura
- O que substitui cada padrão?

**O teste:** Leia sua proposta. Remova o nome do produto. Alguém conseguiria identificar para que serve? Se não, é genérico. Explore mais a fundo.

---

## O Mandato

Antes de mostrar ao usuário, dê uma olhada no que você criou.

> Pergunte a si mesmo: **"Se eles dissessem que isso carece de habilidade, o que eles quereriam dizer?"**

Aquela coisa em que você acabou de pensar — resolva-a primeiro.

Sua primeira resposta provavelmente é genérica. Isso é normal. O trabalho consiste em capturá-la antes que o usuário precise fazê-lo.

### Os Cheques

Execute estes comandos em relação à sua saída antes de apresentar:

1. **O teste de troca:** se você trocasse a fonte pela sua usual, alguém notaria? Se você trocasse o layout por um modelo de painel padrão, a experiência seria diferente? Os locais onde a troca não faria diferença são aqueles onde você definiu a fonte padrão.

2. **O teste do olhar semicerrado:** vibre os olhos. Você ainda consegue perceber a hierarquia? Algo se destaca de forma gritante? Craft sussurra.

3. **O teste da assinatura:** você consegue apontar cinco elementos específicos onde sua assinatura aparece? Não a "sensação geral" — componentes reais. Uma assinatura que você não consegue localizar não existe.

4. **O teste do token:** Leia suas variáveis CSS em voz alta. Elas soam como se pertencessem ao universo deste produto, ou poderiam pertencer a qualquer projeto?

> Se alguma verificação falhar, repita o processo antes de exibir.

---

## Fundamentos do Artesanato

### Sobreposição Sutil

Essa é a espinha dorsal do design. Independentemente da direção, do tipo de produto ou do estilo visual, esse princípio se aplica a tudo. Você mal deve perceber o sistema funcionando. Quando você olha para o painel do Vercel, você não pensa em "bordas bonitas". Você simplesmente entende a estrutura. O design é invisível — é assim que você sabe que está funcionando.

### Elevação da Superfície

As superfícies se sobrepõem. Um menu suspenso fica acima de um cartão, que por sua vez fica acima da página. Crie um sistema numerado — base e, em seguida, níveis de elevação crescentes. No modo escuro, uma elevação mais alta resulta em um tom ligeiramente mais claro. No modo claro, uma elevação mais alta resulta em um tom ligeiramente mais claro ou utiliza sombra.

Cada salto deve representar apenas alguns pontos percentuais de leveza. Isoladamente, a diferença é quase imperceptível. Mas, quando as superfícies se sobrepõem, a hierarquia emerge. Mudanças sutis que você sente em vez de ver.

**Decisões importantes:**

- **Barras laterais:** O fundo é o mesmo da tela, sem diferenças. Cores diferentes fragmentam o espaço visual em "mundo da barra lateral" e "mundo do conteúdo". Uma borda sutil é suficiente para a separação.
- **Menus suspensos:** Um nível acima da superfície principal. Se ambos compartilharem o mesmo nível, o menu suspenso se mistura ao cartão e a sobreposição de camadas se perde.
- **Áreas de entrada:** Ligeiramente mais escuras que o ambiente ao redor, não mais claras. As áreas de entrada são "embutidas" — recebem conteúdo. Um fundo mais escuro indica "digite aqui" sem bordas grossas.

### Fronteiras

As bordas devem desaparecer quando você não as estiver procurando, mas permanecer visíveis quando precisar de estrutura. Bordas RGBA com baixa opacidade se misturam ao fundo — definem os contornos sem chamar a atenção. Bordas hexagonais sólidas parecem rígidas em comparação.

Crie uma progressão — nem todas as bordas são iguais. Bordas padrão, separação mais suave, bordas de destaque, ênfase máxima para os anéis de foco. Ajuste a intensidade à importância da borda.

**O teste do olhar semicerrado:** vibre os olhos em direção à interface. Você ainda deve perceber a hierarquia — o que está acima do quê, onde as seções se dividem. Mas nada deve saltar aos olhos. Sem linhas retas. Sem mudanças bruscas de cor. Apenas uma estrutura discreta.

> Isso diferencia interfaces profissionais de interfaces amadoras. Se você errar nisso, nada mais importa.

### Expressão Infinita

Cada padrão possui infinitas expressões. Nenhuma interface deve ser igual à outra.

Uma métrica pode ser exibida como um número principal, uma estatística em linha, um gráfico de linhas, um medidor, uma barra de progresso, uma comparação de diferenças, um indicador de tendência ou algo inovador. Um painel pode enfatizar densidade, espaço em branco, hierarquia ou fluxo de maneiras completamente diferentes. Até mesmo a barra lateral com cartões oferece infinitas variações em proporção, espaçamento e ênfase.

Antes de construir, pergunte:

- Qual é a coisa que os usuários mais fazem aqui?
- Que produtos resolvem problemas semelhantes de forma brilhante? Estude-os.
- Por que essa interface pareceria ter sido projetada especificamente para sua finalidade, e não baseada em um modelo predefinido?

> **NUNCA** produza resultados idênticos. Mesma largura da barra lateral, mesma grade de cartões, mesmas caixas de métricas com ícone à esquerda, número grande e rótulo pequeno sempre — isso indica imediatamente que foi gerado por IA.

A arquitetura e os componentes devem emergir da tarefa e dos dados, executados de uma forma que pareça inovadora. Os cartões do Linear não se parecem com os do Notion. As métricas do Vercel não se parecem com as do Stripe. Os conceitos são os mesmos, mas as possibilidades são infinitas.

### A Cor Vive em Algum Lugar

Todo produto existe em um mundo. Esse mundo tem cores.

Antes de pegar numa paleta, passe algum tempo no universo do produto. O que você veria se entrasse na versão física desse espaço? Que materiais? Que luz? Que objetos?

> Sua paleta de cores deve dar a sensação de ter vindo de algum lugar — e não de ter sido aplicada a algo.

**Além do Quente e do Frio:** A temperatura é apenas um eixo. Este lugar é silencioso ou barulhento? Denso ou espaçoso? Sério ou lúdico? Geométrico ou orgânico? Um terminal de negociação e um aplicativo de meditação são ambos "focados" — tipos de foco completamente diferentes. Encontre a qualidade específica, não o rótulo genérico.

**A cor carrega significado:** o cinza cria estrutura. A cor comunica — status, ação, ênfase, identidade. Cores usadas sem propósito são ruído. Uma cor de destaque, usada com intenção, é melhor do que cinco cores usadas sem reflexão.

---

## Antes de Escrever Cada Componente

Sempre que você escrever código de interface do usuário — mesmo pequenas adições — declare:

```
Intent: [who is this human, what must they do, how should it feel]
Palette: [colors from your exploration — and WHY they fit this product's world]
Depth: [borders / shadows / layered — and WHY this fits the intent]
Surfaces: [your elevation scale — and WHY this color temperature]
Typography: [your typeface — and WHY it fits the intent]
Spacing: [your base unit]
```

> Este ponto de verificação é **obrigatório**. Ele força você a conectar cada escolha técnica à sua intenção.

Se você não consegue explicar o PORQUÊ de cada escolha, está optando pela opção padrão. Pare e pense.

---

## Princípios de Design

### Arquitetura de Tokens

Cada cor na sua interface deve estar associada a um pequeno conjunto de primitivas: **primeiro plano** (hierarquia do texto), **fundo** (elevação da superfície), **borda** (hierarquia de separação), **marca** e **semântica** (destrutivo, aviso, sucesso). Nada de valores hexadecimais aleatórios — tudo deve ser mapeado para primitivas.

### Hierarquia de Texto

Não se limite a ter apenas "texto" e "texto cinza". Crie quatro níveis: **primário**, **secundário**, **terciário** e **silenciado**. Cada um desempenha uma função diferente: texto padrão, texto de apoio, metadados e texto desativado/espaço reservado. Use os quatro de forma consistente. Se estiver usando apenas dois, sua hierarquia está muito plana.

### Progressão de Fronteira

As fronteiras não são binárias. Crie uma escala que associe intensidade à importância — separação padrão, separação mais suave, ênfase, ênfase máxima. Nem todas as fronteiras merecem o mesmo peso.

### Tokens de Controle

Os controles de formulário têm necessidades específicas. Não reutilize tokens de superfície — crie tokens dedicados para planos de fundo, bordas e estados de foco dos controles. Isso permite ajustar elementos interativos independentemente das superfícies de layout.

### Espaçamento

Escolha uma unidade base e mantenha múltiplos valores. Crie uma escala para diferentes contextos — microespaçamento para espaços entre ícones, espaçamento entre componentes em botões e cartões, espaçamento entre seções em grupos, separação significativa entre áreas distintas. Valores aleatórios indicam ausência de sistema.

### Acolchoamento

Mantenha a simetria. Se um lado tiver um valor, os outros devem corresponder, a menos que o conteúdo exija assimetria por natureza.

### Profundidade

Escolha **UMA** abordagem e comprometa-se:

- **Apenas bordas** — Limpo, técnico. Para ferramentas complexas.
- **Sombras sutis** — Elevação suave. Para produtos acessíveis.
- **Sombras em camadas** — Premium, com dimensão. Para cartões que precisam de presença.
- **Alterações na cor da superfície** — As tonalidades de fundo estabelecem hierarquia sem sombras.

> Não misture abordagens.

### Raio da Borda

Fontes mais nítidas transmitem uma sensação técnica. Fontes mais arredondadas transmitem uma sensação amigável. Crie uma escala: pequena para campos de entrada e botões, média para cartões e grande para janelas modais. Não misture fontes nítidas e arredondadas aleatoriamente.

### Tipografia

Crie níveis distintos e facilmente identificáveis à primeira vista:

- **Títulos** precisam de peso e espaçamento entre letras preciso para se destacarem.
- **Corpo do texto** precisa de uma espessura confortável para facilitar a leitura.
- **Rótulos** precisam de uma espessura média que funcione bem em tamanhos menores.
- **Dados** precisam de uma fonte monoespaçada com espaçamento entre números em tabelas para alinhamento.

Não confie apenas no tamanho — combine tamanho, espessura e espaçamento entre letras.

### Layouts de Cartões

Um cartão de métricas não precisa ter a mesma aparência que um cartão de planejamento, que por sua vez não precisa ter a mesma aparência que um cartão de configurações. Projete a estrutura interna de cada cartão de acordo com seu conteúdo específico, mas mantenha a consistência no acabamento: mesma espessura de borda, profundidade da sombra, raio do canto e escala de espaçamento.

### Controles

Elementos nativos `<select>` e `<input type="date">` são elementos nativos do sistema operacional que não podem ser estilizados. Crie componentes personalizados — botões de acionamento com menus suspensos posicionados, janelas pop-up de calendário, gerenciamento de estado estilizado.

### Iconografia

Os ícones esclarecem, não decoram — se remover um ícone não altera seu significado, remova-o. Escolha um conjunto de ícones e mantenha-o. Dê destaque a ícones independentes com fundos sutis.

### Animação

Interações rápidas em pequena escala, com suavização gradual. Transições maiores podem ser ligeiramente mais longas. Use suavização com desaceleração. Evite efeitos de mola/rebote em interfaces profissionais.

### Estados

Todo elemento interativo precisa de estados: **padrão**, **ao passar o mouse**, **ativo**, **em foco**, **desativado**. Os dados também precisam de estados: **carregando**, **vazio**, **erro**. A ausência de estados causa uma sensação de falha.

### Contexto de Navegação

As telas precisam de um ponto de referência. Uma tabela de dados flutuando no espaço parece mais uma demonstração de componente do que um produto. Inclua uma navegação que mostre onde você está no aplicativo, indicadores de localização e contexto do usuário. Ao criar barras laterais, considere usar o mesmo plano de fundo do conteúdo principal com uma borda para separá-las, em vez de cores diferentes.

### Modo Escuro

Interfaces escuras têm necessidades diferentes. Sombras são menos visíveis em fundos escuros — utilize bordas para definição. Cores semânticas (sucesso, aviso, erro) geralmente precisam de uma leve dessaturação. O sistema de hierarquia ainda se aplica, apenas com valores invertidos.

### Evitar

- Fronteiras rígidas — se as fronteiras são a primeira coisa que você vê, elas são muito fortes.
- Saltos bruscos na superfície — as mudanças de elevação devem ser extremamente silenciosas.
- Espaçamento inconsistente — o sinal mais claro da ausência de um sistema.
- Estratégias de profundidade mista — escolha uma abordagem e comprometa-se.
- Estados de interação ausentes — passar o mouse, foco, desativado, carregando, erro.
- Sombras projetadas dramáticas — as sombras devem ser sutis, não chamativas.
- Raio grande em elementos pequenos.
- Cartões totalmente brancos sobre fundos coloridos.
- Bordas decorativas espessas.
- Gradientes e cores para decoração — a cor deve ter um significado.
- Várias cores de destaque — dilui o foco.
- Tonalidades diferentes para superfícies diferentes — mantenha a mesma tonalidade, altere apenas a luminosidade.

---

## Fluxo de Trabalho

### Comunicação

Seja invisível. Não anuncie modos de operação nem narre o processo.

- ❌ Nunca diga: "Estou no MODO DE ESTABELECIMENTO", "Deixe-me verificar o system.md..."
- ✅ Em vez disso: Mãos à obra! Apresente suas sugestões com justificativas.

### Sugerir + Perguntar

Comece com sua exploração e recomendação, depois confirme:

```
"Domain: [5+ concepts from the product's world]
Color world: [5+ colors that exist in this domain]
Signature: [one element unique to this product]
Rejecting: [default 1] → [alternative], [default 2] → [alternative], [default 3] → [alternative]

Direction: [approach that connects to the above]"

[Ask: "Does that direction feel right?"]
```

### Se o projeto tiver o arquivo system.md

Leia `.interface-design/system.md` e aplique. As decisões serão tomadas.

### Se não houver system.md

1. **Explorar domínio** — Produzir todas as quatro saídas necessárias
2. **Proposta** — A direção deve fazer referência a todos os quatro
3. **Confirmar** — Obter a aprovação do usuário
4. **Construir** — Aplicar princípios
5. **Avaliar** — Execute as verificações de mandato antes de exibir

### Oferta para Economizar

Após concluir uma tarefa, ao terminar de construir algo, sempre se ofereça para salvar o projeto:

> "Want me to save these patterns for future sessions?"

Em caso afirmativo, escreva para `.interface-design/system.md`:

- Direção e sensação
- Estratégia de profundidade (bordas/sombras/camadas)
- Unidade de base espaçadora
- Padrões de componentes-chave

### O que salvar

Adicione padrões quando um componente for usado duas ou mais vezes, for reutilizável em todo o projeto ou tiver medidas específicas que valham a pena lembrar. Não salve componentes únicos, experimentos temporários ou variações que seriam melhor tratadas com props.

### Verificações de Consistência

Se o arquivo system.md definir valores, verifique-os: espaçamento na grade definida, profundidade usando a estratégia declarada em todo o documento, cores da paleta definida, padrões documentados reutilizados em vez de reinventados.

> Isso se acumula — cada salvamento torna o trabalho futuro mais rápido e consistente.

---

## Análises Aprofundadas

Para obter mais detalhes sobre tópicos específicos:

- `references/principles.md` — Exemplos de código, valores específicos, modo escuro
- `references/validation.md` — Gerenciamento de memória, quando atualizar o system.md
- `references/critique.md` — Protocolo de avaliação de artesanato pós-construção

---

## Comandos

| Comando | Descrição |
|---|---|
| `/interface-design:status` | Estado atual do sistema |
| `/interface-design:audit` | Verificar código em relação ao sistema |
| `/interface-design:extract` | Extrair padrões do código |
| `/interface-design:critique` | Analise criticamente sua construção em busca de melhorias e, em seguida, reconstrua o que estava padrão |
