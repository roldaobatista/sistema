# Especificação do Sistema de Câmeras — War Room

> Documento de referência para compra e instalação do sistema de câmeras
> integrado ao módulo TV (War Room) do sistema.
>
> **Localização:** Rondonópolis, MT
> **Quantidade de câmeras:** 6
> **Orçamento estimado total:** R$ 3.200 a R$ 4.200

---

## 1. Visão Geral

O sistema de câmeras será integrado ao **TV Dashboard (War Room)** do sistema, exibindo
as 6 câmeras em tempo real em um grid à esquerda da tela, junto com o mapa de técnicos
e KPIs operacionais à direita.

**Layout do dashboard na TV:**

```
┌──────────────────────────────────────────────────────────────────┐
│  LOGO    WAR ROOM - Central de Monitoramento         14:35      │
├────────────────────────┬─────────────────────────────────────────┤
│  [CAM 01] [CAM 02]    │  OS HOJE  EXECUÇÃO  FINALIZADAS  ...   │
│  [CAM 03] [CAM 04]    │  ┌─────────────────────────────────┐   │
│  [CAM 05] [CAM 06]    │  │     MAPA COM TÉCNICOS           │   │
│                        │  │     EM TEMPO REAL                │   │
│  Grid 3x2 clicável    │  └─────────────────────────────────┘   │
│  (ampliar câmera)      │  Equipe (5)    │  OS em Execução (3)  │
│                        │  • João - trab │  #1234 - Cliente X    │
│                        │  • Maria - dis │  #1235 - Cliente Y    │
├────────────────────────┴─────────────────────────────────────────┤
│  ATIVIDADES  #1234 Cliente X (14:30) • #1235 Cliente Y (14:25)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Equipamentos — O que Comprar

### 2.1. NVR (Gravador de Vídeo em Rede)

| Item | Detalhes |
|---|---|
| **Modelo** | **Intelbras NVD 1408 P** |
| **Quantidade** | 1 unidade |
| **Preço estimado** | R$ 690 a R$ 1.360 (varia por loja) |

**Por que este modelo:**

- **8 portas PoE integradas** — alimenta as câmeras pelo próprio cabo de rede,
  eliminando a necessidade de fontes de energia separadas para cada câmera. Isso
  simplifica MUITO a instalação.
- **8 canais** — comporta as 6 câmeras e sobram 2 portas para expansão futura.
- **Suporte 4K** — mesmo usando câmeras 2MP agora, permite upgrade no futuro.
- **RTSP nativo** — protocolo necessário para integrar com o sistema web.
  O NVR expõe cada câmera em uma URL RTSP (ex: `rtsp://192.168.1.100:554/cam/1`),
  que é o que o software usa para exibir no dashboard.
- **Compressão H.265+** — economiza espaço no HD (grava mais dias com menos disco).
- **Intelbras** — marca brasileira, assistência técnica em Rondonópolis e todo MT,
  peças fáceis de encontrar, melhor suporte local do mercado.

> **ATENÇÃO:** Compre a versão **NVD 1408 P** (com "P" no final).
> O "P" indica que tem as portas PoE integradas. A versão sem "P" é mais barata
> mas NÃO alimenta as câmeras, exigindo fontes separadas e um switch PoE adicional.

**Onde comprar:**

- KaBuM: https://www.kabum.com.br/produto/923306/
- Mercado Livre: https://lista.mercadolivre.com.br/nvd-1408-p
- NetAlarmes: https://www.netalarmes.com.br/nvr-intelbras-nvd-1408-4k-8-canais
- Loja Intelbras: https://www.intelbras.com/pt-br/gravador-digital-de-video-nvr-nvd-1408-p

---

### 2.2. Câmeras IP PoE

Recomendo **2 modelos diferentes** para se adequar ao local de instalação:

#### Câmeras Externas (Bullet) — Frente e Fundo

| Item | Detalhes |
|---|---|
| **Modelo** | **Intelbras VIP 1230 B G4** (Bullet) |
| **Quantidade** | 2 unidades |
| **Preço unitário** | R$ 378 a R$ 450 |
| **Subtotal** | R$ 756 a R$ 900 |

**Por que Bullet para externas:**

- **Formato tubular** — design intimidador que dissuade invasores (visualmente
  "parece uma câmera de segurança profissional").
- **IP67** — totalmente vedada contra poeira e água. Pode ficar exposta a chuva,
  sol e intempéries sem problema.
- **IR 30 metros** — visão noturna a 30m, suficiente para cobrir a fachada e o fundo.
- **Full HD 2MP** — resolução 1920x1080, suficiente para identificar rostos e placas.
- **PoE** — funciona com o cabo de rede do NVR, sem fonte separada.
- **Lente 2.8mm** — ângulo aberto (~107°), ideal para cobrir áreas amplas.

**Onde comprar:**

- Amazon: https://www.amazon.com.br/dp/B0CL5BFW63
- Tudo Forte: https://www.tudoforte.com.br/camera-intelbras-vip-1230-b-g4-bullet-full-hd
- Mercado Livre: buscar "VIP 1230 B G4"

---

#### Câmeras Internas (Dome) — Escritório, Oficina e Recepção

| Item | Detalhes |
|---|---|
| **Modelo** | **Intelbras VIP 1230 D G4** (Dome) |
| **Quantidade** | 4 unidades |
| **Preço unitário** | R$ 396 a R$ 470 |
| **Subtotal** | R$ 1.584 a R$ 1.880 |

**Por que Dome para internas:**

- **Design discreto** — formato de "domo" que se integra ao ambiente sem chamar
  atenção excessiva. Ideal para escritório e áreas de atendimento ao cliente.
- **Anti-vandalismo** — cúpula protege a lente. Mais difícil de apontar para
  outro lado ou danificar.
- **Mesmas specs** — 2MP Full HD, PoE, IR 30m, lente 2.8mm. Mesma qualidade
  da versão Bullet, só muda o formato.
- **Fixação no teto** — ocupa menos espaço visual, não interfere na circulação.

**Onde comprar:**

- Buscapé (comparador): https://www.buscape.com.br/busca/vip+1230+d+g4+intelbras
- Mercado Livre: https://lista.mercadolivre.com.br/intelbras-vip-1230-d-g4
- Loja Infocam: https://www.lojainfocam.com.br (buscar VIP 1230 D G4)

---

### 2.3. HD para Gravação

| Item | Detalhes |
|---|---|
| **Modelo** | **Seagate SkyHawk 1TB** (ST1000VX013) |
| **Quantidade** | 1 unidade |
| **Preço estimado** | R$ 460 a R$ 510 |

**Por que este HD:**

- **Linha SkyHawk** — fabricado especificamente para vigilância. HDs comuns (desktop)
  não são projetados para gravação contínua 24/7 e falham em poucos meses.
- **Firmware ImagePerfect** — garante zero perda de quadros na gravação.
- **Suporte a 64 câmeras** — muito além das 6, dá margem de folga.
- **Taxa de trabalho 180TB/ano** — 3x mais que HDs desktop, aguenta o ritmo.
- **Garantia 3 anos** — Seagate tem boa garantia no Brasil.
- **1TB de capacidade** — com 6 câmeras em 2MP, H.265+, grava aproximadamente
  **15 a 20 dias** de vídeo contínuo. Se precisar de mais tempo, pode trocar por
  2TB (~35-40 dias) por ~R$ 200 a mais.

> **Alternativa 2TB:** Seagate SkyHawk 2TB (ST2000VX017) por ~R$ 600-700.
> Recomendado se quiser manter gravações por mais tempo.

**Onde comprar:**

- Total Eletrônicos: https://www.totaleletronicos.com.br/hd-seagate-skyhawk-1tb-sata6-5400rpm-256mb
- HiCorp: https://www.hicorp.com.br/hdd-seagate-skyhawk-1tb-psegurancavigilanciadvr-st1000vx013
- KaBuM: buscar "SkyHawk 1TB ST1000VX013"

---

### 2.4. Infraestrutura de Rede (Cabeamento)

| Item | Qtd | Preço Est. |
|---|---|---|
| **Cabo de rede Cat5e** (caixa 305m) | 1 cx | R$ 190 a R$ 350 |
| **Conectores RJ45 Cat5e** (pacote 50 un) | 1 pct | R$ 25 a R$ 40 |
| **Alicate de crimpagem RJ45** | 1 un | R$ 30 a R$ 60 |
| **Testador de cabo de rede** | 1 un | R$ 25 a R$ 40 |
| **Canaletas** (3m, pacote) | 5-10 un | R$ 50 a R$ 100 |
| **Parafusos + buchas** para fixação | 1 kit | R$ 15 a R$ 25 |
| **Subtotal infraestrutura** | | **R$ 335 a R$ 615** |

**Por que Cat5e e não Cat6:**

- Cat5e suporta até 1Gbps a 100m — mais que suficiente para câmeras 2MP.
- Cat6 é ~50% mais caro e não traz benefício real para câmeras IP.
- A distância máxima do PoE (100m) não muda entre Cat5e e Cat6.

> **Dica:** Se a empresa fica em um prédio comercial, verifique se já existe
> infraestrutura de rede (tubulações, canaletas). Isso pode economizar tempo
> e dinheiro na instalação.

**Onde comprar (kits ou separado):**

- KaBuM: https://www.kabum.com.br (buscar "cabo cat5e 305m")
- Amazon: buscar "caixa cabo rede cat5e 305m"
- Mercado Livre: buscar "kit instalação câmera IP cabo rede"

---

## 3. Resumo de Custos

| Categoria | Qtd | Preço Mín. | Preço Máx. |
|---|---|---|---|
| NVR Intelbras NVD 1408 P | 1 | R$ 690 | R$ 1.360 |
| Câmera Bullet VIP 1230 B G4 (externa) | 2 | R$ 756 | R$ 900 |
| Câmera Dome VIP 1230 D G4 (interna) | 4 | R$ 1.584 | R$ 1.880 |
| HD Seagate SkyHawk 1TB | 1 | R$ 460 | R$ 510 |
| Infraestrutura (cabos, conectores, etc.) | — | R$ 335 | R$ 615 |
| **TOTAL ESTIMADO** | | **R$ 3.825** | **R$ 5.265** |

> **Dica de economia:** Comprando tudo no Mercado Livre ou KaBuM em uma única
> compra, é possível conseguir frete grátis e descontos por volume. Kits prontos
> (NVR + câmeras) costumam ser mais baratos que comprar separado.

---

## 4. Disposição das 6 Câmeras

```
                    ┌─────────────────────────────────┐
                    │         EMPRESA                  │
                    │                                  │
    [CAM 01]        │    [CAM 02]         [CAM 03]    │
    Frente/Fachada  │    Recepção         Escritório   │
    (BULLET ext.)   │    (DOME int.)      (DOME int.)  │
                    │                                  │
                    │    [CAM 04]         [CAM 05]     │
                    │    Oficina 1        Oficina 2/   │
                    │    (DOME int.)      Depósito     │
                    │                     (DOME int.)  │
                    │                                  │
                    │                     [CAM 06]     │
                    │                     Fundo/Saída  │
                    │                     (BULLET ext.)│
                    └─────────────────────────────────┘
```

| Câmera | Local | Tipo | Motivo |
|---|---|---|---|
| **CAM 01** | Frente / Fachada | Bullet (externa) | Cobre entrada principal, identifica visitantes e veículos |
| **CAM 02** | Recepção / Entrada | Dome (interna) | Registra quem entra e sai, formato discreto para clientes |
| **CAM 03** | Escritório | Dome (interna) | Visão geral do ambiente administrativo |
| **CAM 04** | Oficina 1 | Dome (interna) | Monitora área de trabalho dos técnicos |
| **CAM 05** | Oficina 2 / Depósito | Dome (interna) | Controle de estoque e ferramentas |
| **CAM 06** | Fundo / Saída traseira | Bullet (externa) | Cobre saída alternativa, área de carga/descarga |

---

## 5. Instalação — Passo a Passo

### 5.1. Preparação (antes de comprar)

1. **Medir distâncias** — meça o caminho do cabo de cada câmera até o local do NVR.
   Some todas as distâncias para saber se 305m de cabo são suficientes.
   (Regra: distância real x 1.3 para folga de curvas e subidas.)
2. **Definir local do NVR** — deve ficar em local seguro, ventilado, próximo a
   uma tomada e ao roteador/switch de internet.
3. **Verificar tomadas** — o NVR precisa de 1 tomada. As câmeras NÃO precisam
   (são alimentadas via PoE pelo NVR).

### 5.2. Instalação física

1. Instale o HD SkyHawk dentro do NVR (abertura por parafusos na parte inferior).
2. Passe os cabos de rede de cada câmera até o NVR usando canaletas.
3. Crimpe os conectores RJ45 nas pontas dos cabos.
4. Teste cada cabo com o testador antes de instalar a câmera.
5. Fixe as câmeras nos locais definidos.
6. Conecte cada cabo na porta PoE correspondente do NVR.
7. Ligue o NVR na tomada — as câmeras devem ligar automaticamente via PoE.

### 5.3. Configuração do NVR

1. Conecte o NVR ao roteador/switch de internet via cabo de rede.
2. Acesse a interface web do NVR pelo navegador (geralmente `http://192.168.1.108`).
3. Configure cada câmera (resolução, FPS, qualidade).
4. Configure a gravação contínua 24/7.
5. Anote as URLs RTSP de cada câmera (formato: `rtsp://IP_NVR:554/cam/realmonitor?channel=1&subtype=0`).

### 5.4. Integração com o sistema

1. Acesse o sistema como administrador.
2. Cadastre cada câmera com o nome e URL RTSP obtidos no passo anterior.
3. O TV Dashboard exibirá as 6 câmeras automaticamente no grid à esquerda.
4. Clique em qualquer câmera para ampliar em tela cheia.

---

## 6. TV para o Dashboard

### Recomendação de TV (43-55")

Para exibir o dashboard War Room, qualquer Smart TV serve, mas recomendo:

- **Samsung Crystal UHD 50"** ou **LG UHD 50"** — R$ 1.800 a R$ 2.500
- Resolução 4K (o dashboard fica nítido)
- Conexão HDMI (conectar um mini PC ou Chromecast)
- Wi-Fi integrado

**Como conectar a TV ao dashboard:**

| Opção | Custo | Complexidade |
|---|---|---|
| **Chromecast** — transmitir a aba do Chrome | R$ 250-350 | Simples |
| **Mini PC** — Beelink/MeLE conectado via HDMI | R$ 600-1.000 | Média |
| **Raspberry Pi 4** — rodar Chromium em kiosk mode | R$ 400-600 | Avançada |
| **Fire TV Stick** — usar navegador Silk | R$ 300-400 | Simples |

> **Recomendação:** Para uso profissional 24/7, um **Mini PC** é a melhor opção.
> Ele conecta via HDMI na TV e abre o navegador em tela cheia automaticamente
> ao ligar. Mais estável que Chromecast para uso contínuo.

---

## 7. Checklist de Compras

Use esta lista para conferir na hora da compra:

- [ ] 1x NVR Intelbras NVD 1408 **P** (com PoE)
- [ ] 2x Câmera Intelbras VIP 1230 **B** G4 (Bullet, externa)
- [ ] 4x Câmera Intelbras VIP 1230 **D** G4 (Dome, interna)
- [ ] 1x HD Seagate SkyHawk 1TB (ou 2TB)
- [ ] 1x Caixa cabo de rede Cat5e 305m
- [ ] 1x Pacote conectores RJ45 (50 un)
- [ ] 1x Alicate de crimpagem RJ45
- [ ] 1x Testador de cabo de rede
- [ ] Canaletas para passagem de cabo
- [ ] Parafusos e buchas para fixação das câmeras
- [ ] TV 43-55" (se ainda não tiver)
- [ ] Mini PC ou Chromecast (para conectar TV ao sistema)

---

## 8. Perguntas Frequentes

**P: Posso usar câmeras Wi-Fi em vez de cabo?**
R: Tecnicamente sim, mas NÃO recomendo. Câmeras Wi-Fi sofrem com interferência,
perda de sinal e travamentos. Para monitoramento profissional 24/7, cabo é
essencial. A instalação com PoE é simples: um único cabo resolve tudo.

**P: Preciso de internet para as câmeras funcionarem?**
R: Não. O NVR grava localmente no HD. A internet só é necessária para exibir
as câmeras no dashboard do sistema (acesso remoto). Se a internet cair, as
câmeras continuam gravando normalmente.

**P: 1TB é suficiente? Quantos dias grava?**
R: Com 6 câmeras em 2MP, compressão H.265+, ~15-20 dias. Se precisar de mais,
opte pelo HD de 2TB (~35-40 dias). O NVR sobrescreve as gravações mais antigas
automaticamente quando o disco enche.

**P: Posso instalar eu mesmo?**
R: A parte de configuração do NVR e integração com o sistema é simples (interface
web). A parte física (passar cabos, fixar câmeras, crimpar conectores) exige alguma
habilidade. Se preferir, contrate um técnico de CFTV local — o custo de instalação
em Rondonópolis costuma ser R$ 100-200 por câmera.

**P: E se eu quiser adicionar mais câmeras depois?**
R: O NVR tem 8 portas, então cabe mais 2 câmeras sem trocar nada. Para mais de 8,
seria necessário trocar o NVR por um de 16 canais.

---

*Documento gerado em 15/02/2026. Preços são estimativas baseadas em pesquisa de mercado
e podem variar. Consulte as lojas para valores atualizados.*
