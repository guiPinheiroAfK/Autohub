# Pesquisa: som de motor 2 — gravações que faltam, "escuta" por ferramentas e acústica das famílias sem boa gravação

> Documento de pesquisa (14/11/2026). **Não é spec nem ADR.** Continua `som-motor.md` e `gravacoes-motor.md` e não repete o que já está lá (ver a seção de fontes para os números antigos).
> Nada foi baixado e nenhum código foi alterado. As licenças foram lidas nas páginas (Freesound, Zenodo, GitHub, arXiv) ou em buscas. Onde só havia resumo de terceiro ou nada, está marcado **(não confirmado)**.
> Convenções: `[Sn]` = fonte da seção final. **(estimativa)** = número sem fonte direta, a calibrar de ouvido. **(não confirmado)** = dado não conferido na fonte primária.

---

## 0. Resumo

1. **Gravações novas com licença livre são escassas para W16, V12, V10 e rotativo.** Achei um V6 novo em CC BY (Suzuki Vitara, parado, com partida, marcha lenta e aceleradas) e um I4 em dinamômetro em CC0 (Mercedes 190E, do pacote "The Dyno Sessions"). Não achei nenhum W16, V12 ou rotativo com CC0/BY no Freesound.
2. **O melhor lote para pesquisar agora é o muted.io "Performance Cars"**: CC0 confirmado, 68 gravações de carros esportivos em WAV 96 kHz/24 bits, de graça por Ko-fi. A página não lista os carros, então é preciso baixar (decisão sua) para saber se há algo de W16, V12 ou rotativo.
3. **Dataset com RPM e torque anotados** (Doerfler & Wyse 2026, Zenodo): 19 h de áudio com canais de controle. Ótima referência para calibrar o rastreador de rpm, mas a licença do paper é CC BY-NC-SA 4.0 e a do dataset não foi conferida. **Não embutir no jogo** até conferir.
4. **Para "ouvir" com IA, o que mais rende é medir, não escutar:** perfil de ordens do motor, loudness/sharpness/roughness (MoSQITo) em rpm casado, e um espectrograma em PNG que eu consigo ler com a ferramenta de leitura de imagem. Embeddings de áudio (CLAP, OpenL3, PANNs) servem só para comparação grosseira. Modelos de linguagem de áudio (Qwen2-Audio) são pesados demais para um notebook Windows.
5. **Diagnóstico provável do W16 sintetizado:** pulso de largura fixa (2,2 ms) entre pulsos a cada 45° fica com ciclo de trabalho de ~23% a 800 rpm e ~88% a 3000 rpm. Além disso, 16 pulsos idênticos em um barramento só formam um tom muito regular, sem a assimetria de ignição e a separação dos quatro escapamentos. Ver seção C.1.
6. **Fatos acústicos confirmados do W16:** 16 cilindros em dois blocos de 8 a 90°, ignição a cada 45° em ordem assimétrica, quatro turbos (dois por banco), Chiron com turbo sequencial de dois estágios [S1]. Consequência: 8 pulsos por volta, ordem fundamental 8.
7. **Top W16 (resumo):** (a) quatro barramentos de escape com pequenos atrasos e ganhos diferentes; (b) pulso mais largo e boom mais grave, com lowpass baixo em marcha lenta; (c) growl de banda 250–900 Hz com ganho proporcional à carga, mais assobios de turbo desafinados.

---

# Parte A — Gravações

## A.1 O que foi conferido nesta rodada

- Páginas do Freesound foram lidas com a ferramenta de leitura de páginas. A ferramenta resume a página, então duração, formato, tamanho e licença foram conferidos **no resumo da página**, não no arquivo. Antes de usar, abrir a página no navegador e conferir a licença por arquivo.
- As buscas no Freesound pela ferramenta são **parciais**: a de "dyno" mostrou 2 de 7 resultados, a de V12 mostrou 15 de 22. Não dá para listar tudo por essa via.
- Nenhum áudio foi baixado. O muted.io e o Zenodo precisam de decisão sua antes do download (regra de download do projeto).

## A.2 Candidatos novos (confirmados nesta rodada)

| Família | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Por que serve / ressalva |
|---|---|---|---|---|---|---|---|---|
| **V6** | Suzuki Vitara V6 engine (Keith Selmes) | https://freesound.org/people/Keith%20Selmes/sounds/249720/ | **CC BY 4.0** ("Attribution 4.0") | 2:09 | WAV 44,1 kHz / 16 bits, estéreo | 21,7 MB | L/N/1 (parado: partida, marcha lenta, aceleradas, desligamento, três vezes) | Gravado de dentro do carro, no banco do motorista (Zoom H1). **Boa para marcha lenta e aceleradas em ponto morto** (camada de V6). Ressalva: captado na cabine, então admissão e escape chegam abafados; o motor é Suzuki V6 (confirmar a configuração do V; não conferi). |
| **V6** | 3.2L V6 V-TEC + escapamento (EvanBoyerman) | https://freesound.org/people/EvanBoyerman/sounds/755999/ | **CC BY 4.0** | 0:04,5 | WAV 48 kHz / 24 bits, mono | 633 KB | 1 (uma acelerada) | Motor e escapamento misturados numa só faixa. Serve para **timbre e calibração** de V6 aspirado. Curto demais para granular. |
| **I4 em dinamômetro** (lead) | Mercedes-Benz 190E-16V, dyno (Chippy569 / pacote "The Dyno Sessions: 190E") | https://freesound.org/people/Chippy569/sounds/162528/ | **CC0** | 0:08,25 | WAV 96 kHz / 24 bits, mono | 2,3 MB | 1 (partida e pequena acelerada) | Gravado em dinamômetro, com microfone Audix D6 a uns 30 cm atrás da saída do escape. Único motor **em dinamômetro com CC0** que achei. Ressalva: o uploader diz "pequena acelerada", não é uma varredura. O pacote tem outros arquivos (a página mostra 58 mono e 6 estéreo com essa tag); a licença de cada um precisa ser conferida. |
| V6 (já listado, licença agora conferida) | DeLorean DMC-12, V6 PRV (SkyernAklea) | https://freesound.org/people/SkyernAklea/sounds/623436/ | CC BY 4.0 | 1:20,8 | WAV 48 kHz / 32 bits, estéreo | 29,6 MB | não confirmado (tags: idle, start, rev) | Licença e duração conferidas. A estrutura (varredura ou passagens) **não está descrita**: ouvir. O PRV é V6 de ignição irregular (ver `som-motor.md` §2.8). |

## A.3 Lotes e packs com licença permissiva

- **muted.io "Performance Cars"** — **CC0** (confirmado na página). 68 gravações de carros esportivos e do asfalto por onde passaram, WAV 96 kHz / 24 bits, estéreo. Download grátis pelo Ko-fi (doação sugerida, não obrigatória). **A página não lista os carros.** É a melhor aposta para W16, V12 e rotativo, mas só se conhece o conteúdo baixando. Decisão sua.
- **Doerfler & Wyse (2026), dataset de sons de motor com controle embutido** — Zenodo DOI 10.5281/zenodo.16883336 e Hugging Face [S10]. 5.935 arquivos, 19 h, 24,5 GB, quatro veículos (5 a 10 min de timbre cada), canais de RPM e torque normalizados (10.000 rpm e 1.000 Nm), 48 kHz, quatro canais. **Licença:** o arXiv está em CC BY-NC-SA 4.0 [S10] e a licença do dataset não foi conferida. **Uso sugerido:** verdade de referência de RPM para calibrar o rastreador (`tools/som/rastrear.py`), e comparação de perfis de ordens. Não embutir no jogo sem conferir.
- **OpenGameArt "racing car engine sound loops"** — CC0 (pela listagem). Loops de um mesmo arranque de domínio público, que diferem só em pitch [S11]. Serve só como voz de tráfego.
- **Magic Sound Effects "Car Engines" (itch.io)** — **pago**, licença própria: uso pessoal e um projeto comercial. Tem 70 loops de rpm bem feitos [S12]. **Não entra no repo** com essa licença. Só usar se o dono comprar e a licença permitir.
- **Sonniss GameAudioGDC** — o pacote de 2026 proíbe o uso para treinar IA; o de 2023 é royalty-free, mundial, não exclusivo, com lei inglesa [S13]. Não achei pacote de motor livre dentro dele. Ler a licença do ano antes de qualquer uso.
- **BeamNG e Assetto Corsa** — **não usar.** O fórum do BeamNG diz que as amostras de motor são de terceiros e vêm criptografadas, e que o EULA proíbe o uso fora do jogo [S14] **(não confirmado no texto oficial)**. Não achei termos de som do Assetto Corsa.

## A.4 Famílias sem candidato livre novo

| Família | Situação | Próximo passo |
|---|---|---|
| **W16** | Nenhum CC0/BY no Freesound (buscas em inglês, com e sem filtros). Restam o Chiron no Commons (YouTube→Commons, CC BY 3.0, 1:42, Opus, risco de proveniência) e o Veyron Grand Sport (CC BY-SA, 9 s). Os packs de W16 que aparecem são pagos. | Ver o muted.io. Se não houver nada, o W16 fica em síntese com os ajustes da Parte C, com o Chiron do Commons só como referência de escuta (não embutir). |
| **V12** | Sem dinamômetro em CC0. Ficam o "lambo rev" (CC0, 5,3 s, #112076) e o Ferrari 340 America (CC BY 3.0, 12 s, já listado). O Gordon Murray T.50 em dinamômetro é de imprensa, sem licença livre [S15]. | Aceitar o que há e tratar o V12 mais como síntese (Parte C.3). |
| **V10** | Continua o Audi R8 (CC BY 4.0, 2:08, 35 MB, de `gravacoes-motor.md`). O Lexus LFA dinamômetro é de imprensa. | Ouvir o R8 e confirmar V10 (não V8 4.2). |
| **Rotativo** | Nenhum CC0/BY no Freesound. Os packs de rotativo do Unity Asset Store e do Fab são pagos e não têm licença livre [S16]. O melhor livre é o RX-7 do Commons (Taz Ringer, CC BY 3.0, 4:58, 4,4 MB, YouTube→Commons). | Ouvir o RX-7 e decidir se o risco de proveniência vale a pena. |
| **Boxer-4** | O WRX CC0 (#273334) continua descartado (laço editado). Nenhum boxer-4 novo com licença livre apareceu. | Ficar com a síntese (`boxer4`) e o `t33kno` CC0 (partida/lenta) para textura. |
| **I5** | Continua o RG Volvo (CC BY 4.0, 0:32, 5,4 MB, de `gravacoes-motor.md`). O Volvo S60 ramp test é CC BY-NC (só análise). | Nada novo. |
| **I3** | Continua o HR12DE CC0 (26 s, processado pelo autor). | Nada novo. |

---

# Parte B — Como "ouvir" com IA e ferramentas

## B.0 Princípio

Eu não ouço áudio, mas consigo: (1) calcular números sobre áudio com Python; (2) ler **imagens** (espectrograma, mapa de ordens) pela ferramenta de leitura de arquivos; (3) comparar vetores (embeddings). Por isso o loop deve medir e mostrar imagens. O juízo final é de ouvido, pelo dono. As métricas são **guarda-corpo**, não veredito: um motor pode ter métricas boas e soar errado.

## B.1 Ferramentas

| Ferramenta | O que dá | Licença | Instalação | CPU num notebook Windows | Uso no loop |
|---|---|---|---|---|---|
| **numpy + scipy** (já usados em `tools/som`) | espectro, centroide, fluxo, perfil de ordens por reamostragem angular | BSD (padrão) | já instalado | trivial | base de tudo |
| **librosa** | MFCC, chroma, centroide, onsets, pitch | ISC **(verificar no repo)** | `pip install librosa` | trivial | distância MFCC como métrica auxiliar |
| **MoSQITo** [S17] | loudness, sharpness (DIN 45692), roughness (Daniel & Weber e ECMA-418-2), tonalidade | **verificar no repo** (não confirmei) | `pip install mosqito` (versão 1.2.1 nos docs) | trivial a moderado (estimativa) | **métricas principais de textura** (rugosidade é a do "rumble") |
| **Essentia** [S18] | centenas de descritores espectrais, tonais e temporais | **AGPL-3.0** ou licença comercial | `pip install essentia` (wheels só para Linux/macOS; no Windows, usar WSL2) | rápido | opcional, só offline; a AGPL só pesa se o código for distribuído. Algoritmo de roughness **não confirmado** |
| **Análise de ordens própria** (`rastrear.py` + reamostragem angular) | perfil de ordens e mapa de ordens (tipo Campbell) | código do projeto | nenhuma | trivial | métrica principal de "caráter". O MATLAB tem `rpmtrack`, `rpmordermap` e `orderwaveform` como referência do método [S19] |
| **LAION-CLAP** [S20] | embeddings de áudio e texto, similaridade, zero-shot | código **CC0-1.0**; pesos **licença não declarada** na página lida | `pip install laion-clap`; Python 3.10 documentado; exemplos usam CUDA, então instalar PyTorch CPU | viável para clipes curtos (estimativa: segundos por clipe; não medi) | similaridade grosseira "parece motor de V8?" |
| **OpenL3** [S21] | embeddings de áudio (look-listen-learn) | código **MIT**; pesos **CC BY 4.0** | `pip install openl3` (TensorFlow: escolher a versão CPU); port `torchopenl3` em PyTorch | sem benchmark encontrado | alternativa ao CLAP |
| **PANNs (panns-inference)** | tagging AudioSet (527 classes), CNN14, janela de 10 s | pacote **não confirmado**; pesos originais **não confirmados** | `pip install panns-inference` (PyTorch) | viável (estimativa) | classe "motor" e "motor de combustão"; pouco fino |
| **Qwen2-Audio-7B(-Instruct)** [S22] | descreve o áudio em texto e responde perguntas | Apache-2.0 nos cards de terceiros; **conferir o LICENSE do repo oficial** | Hugging Face; ou GGUF quantizado (Nexa) | **inviável** em tempo razoável num notebook (estimativa: minutos por clipe, 7B de parâmetros) | descrição qualitativa pontual, não otimização |
| **Gemini (API, entrada de áudio)** [S23] | descrição e comparação em linguagem natural | pago, termos do Google | chave de API | nuvem | avaliação qualitativa de poucos renders. O áudio sobe para o Google |
| **MCP de análise de áudio (comunidade)** | librosa exposto como ferramenta: fingerprint, espectrograma, pitch, comparação [S24] | **não verificada** | `uv` com `.mcp.json`, conforme o README | trivial | útil para ver espectrogramas, mas é **código de terceiros**: ler antes de instalar. O outro (`mcp-music-analysis`) baixa de URLs e YouTube: não usar para isso |

**Skills e plugins do próprio ambiente:** não achei skill de análise de motor. O `local-whisper` só transcreve fala. Não serve.

**Custo de Gemini, para dimensionar (não confirmado):** a fonte diz 25 tokens por segundo de áudio [S23]. Um minuto dá ~1.500 tokens. Com o preço por milhão de tokens que as fontes dão, o custo por clipe fica em frações de centavo. Os preços por milhão variam entre as fontes (de US$ 0,50 a US$ 3), então conferir a página oficial de preços antes.

## B.2 O que a pesquisa acadêmica mede em som de motor

- **Doerfler & Wyse (2026)** [S10]: síntese por ordens (harmônicos de 0,5 a 64 ordens, 128 osciladores) com ruído e ressonância. **A comparação com gravações reais é só qualitativa** (perfis de magnitude por ordem em faixas de rpm e torque). Não há métrica numérica nem teste de escuta.
- **TU Delft (aviões medidos vs sintetizados)** [S25]: a diferença não aparece só em loudness. Tonalidade, rugosidade e flutuação explicam mais, e loudness sozinho não explica as diferenças.
- **AES (efeitos reais vs sintéticos)** [S26]: descritores temporais, espectrais e espectro-temporais, com classificador supervisionado. Não há padrão para avaliar síntese de som.
- **EAA 2025 (motor sintético vs real)** [S27]: fatores de avaliação por ouvintes (rugosidade, "peso", "esportividade") e análise fatorial. Não li o texto completo.

**Proposta de métricas para o loop** (estimativa, a validar):
1. **Perfil de ordens** (magnitude em dB por ordem 0,5 a 12) nos mesmos rpm: distância média por ordem. É a métrica de "caráter".
2. **Loudness, sharpness e roughness** (MoSQITo) em janelas de 0,5 s, no mesmo rpm.
3. **Tonalidade e flutuação** (MoSQITo), opcionais, para ver se o som está "tonal demais" ou "tremido" demais.
4. **Embedding** (CLAP ou OpenL3), cosseno, só para ranquear famílias. Muda com o microfone, então não usar para ajuste fino.

## B.3 Loop proposto: render → comparar → ajustar

1. **Referência.** Uma gravação de motor X com `rpm(t)` estimado pelo `rastrear.py` (ou, para validar o rastreador, uma com rpm anotado, como o dataset da seção A.3). Recortar janelas em rpm casado (ex.: 1000, 2000, … até o limitador).
2. **Render.** Um renderizador offline com o mesmo DSP do AudioWorklet, dirigido pelo mesmo `rpm(t)`. **Exige separar o núcleo DSP de `sound/` do worklet.** É mudança de código e fica para uma etapa própria.
3. **Métricas** nas mesmas janelas: perfil de ordens, MoSQITo, embedding.
4. **Otimizador** (Nelder–Mead ou busca em grade pequena; CMA-ES se houver muitos parâmetros) sobre: `pulsoMs`, ganhos e atrasos por evento, ângulos de banco (dentro de faixa), `crossfeed`, `boomHz/Db`, `coletorHz`, `lpBase`, `aspereza`, `jitter`. A ordem de ignição fica **travada** (é física, não ajuste).
5. **Saída:** JSON de parâmetros e PNGs lado a lado (espectrograma e mapa de ordens, referência e render). **Eu leio as imagens** e proponho o próximo ajuste. O dono ouve os três melhores em A/B e escolhe.
6. **Guardas:** normalizar o volume pela mesma medida do `nivel.py` (senão a loudness mede o microfone); não otimizar só pelo CLAP (ele aprende o timbre do microfone); recortar regiões de Doppler e de vento; não ajustar uma família com uma só gravação.

## B.4 Recomendação (top 3)

1. **Perfil de ordens + MoSQITo.** Determinístico, barato, interpretável, e roda em CPU sem problema. É onde as diferenças entre motores aparecem de verdade.
2. **Espectrograma e mapa de ordens como imagem.** Custo zero, usa o `rastrear.py` que já existe, e é o que eu consigo "inspecionar" com mais precisão.
3. **LAION-CLAP** (código CC0, CPU viável). Só para dizer "parece da família certa" e nada mais. Se faltar licença clara dos pesos, usar OpenL3 (código MIT, pesos CC BY 4.0).

**Evitar:** Qwen2-Audio local no notebook (pesado demais). Gemini só para uma avaliação qualitativa pontual de poucos renders.

---

# Parte C — Acústica e receitas de síntese

Os números de ordem e de intervalo são aritmética a partir de fatos (marcados). Os valores de parâmetro são **(estimativa)** e devem ser calibrados de ouvido ou pelo loop da B.3.

## C.0 Fórmulas de apoio

- Intervalo entre ignições (graus): `Δθ / (6 · rpm)` segundos.
- Ordem fundamental: `N_ign_por_volta × rpm / 60`, onde `N_ign_por_volta = N_cil / 2` em quatro tempos.
- **Ciclo de trabalho aproximado** do pulso: `pulsoMs / (Δθ / (6·rpm)) · 1000`. Com pulso de largura fixa, ele **sobe com o rpm**. É o primeiro diagnóstico a checar em qualquer perfil.

| Motor | Intervalo | Ordem fundamental | Ciclo de trabalho (pulso 2 ms) a 800 rpm | a 3000 rpm |
|---|---|---|---|---|
| W16 (45°) | 9,4 ms a 800 rpm; 2,5 ms a 3000 | 8 (107 Hz a 800 rpm; 400 Hz a 3000) | ~21% | ~80% |
| V12 (60°) | 12,5 ms a 800 rpm; 3,3 ms a 3000 | 6 (80 Hz a 800; 300 Hz a 3000) | ~16% | ~60% |
| V10 (72°) | 15 ms a 800 rpm; 4 ms a 3000 | 5 (67 Hz a 800; 250 Hz a 3000) | ~13% | ~50% |
| I4 (180°) | 37,5 ms a 800 rpm; 10 ms a 3000 | 2 (27 Hz a 800; 100 Hz a 3000) | ~5% | ~20% |

(Cálculo a partir da fórmula acima; o pulso real da síntese tem decaimento, então é um indicador, não medida.)

## C.1 W16 — por que soa mal (hipóteses para checar antes de mudar)

**Fatos do perfil atual** (`sound/profiles.ts`, perfil `w16`): `uniforme(16)` com ganho 1 em todos os eventos; `pulsoMs` 2,2; `aspereza` 0,04; `jitter` 0,03; `boomHz` 75 (+7 dB); `coletorHz` 300; `lpBase` 750 + 0,1·rpm (teto 2000); `inducao` "biturbo"; `admissao` 0,2; `pops` 0,2. Um barramento só.

**Hipóteses**, da mais provável para a menos:

- **H1. Ciclo de trabalho do pulso sobe com o rpm.** Com `pulsoMs` 2,2 ms, o pulso ocupa ~23% do intervalo a 800 rpm (clique e zumbido, como motor elétrico) e ~88% a 3000 rpm (tom contínuo sem articulação). Um W16 real é grave e "balanceado" em baixa carga [S1], o que pede pulso mais largo e grave em marcha lenta.
- **H2. Regularidade total.** Dezesseis pulsos idênticos concentram a energia na ordem 8 e nos harmônicos (16, 24). O resultado é um tom de sintetizador ou de sirene. A ignição real é assimétrica [S1], e isso espalha a energia.
- **H3. Um barramento só.** Os quatro escapamentos somados sem atraso nem ganho diferente não produzem batimento, nem a "coral" espacial que a imprensa descreve [S28].
- **H4. Pouco crescimento com a carga.** A Bugatti descreve o som como um rosnado que cresce com a carga [S1]. O `aspereza` de 0,04 deixa o som limpo demais no on-load.
- **H5. Turbo genérico.** O W16 usa quatro turbos, dois por banco, e o Chiron usa turbo sequencial de dois estágios [S1]. O perfil trata como "biturbo" e não tem como representar quatro fontes de assobio nem a transição entre estágios.
- **H6. Grave e lowpass.** Com `lpBase` 750 em marcha lenta, o som pode ficar fino; o W16 tem peso grave (**(não confirmado)**: comparar o espectro com o Chiron do Commons antes de mexer).

**Antes de mudar qualquer número:** gerar o espectrograma e o mapa de ordens do render atual (3000 rpm e 1000 rpm) e ver se a energia está concentrada na ordem 8 (H2) e se o ciclo de trabalho muda com o rpm (H1).

## C.2 W16 — receita (em ordem de prioridade)

1. **Quatro barramentos, um por turbo (ou por meia-bancada).** Atraso fixo de 0 a 0,6 ms e ganhos diferentes por barramento, por exemplo [1,0; 0,8; 0,95; 0,85] **(estimativa)**. Isso cria batimento sem mudar o rpm. Extensão necessária em `EventoIgnicao` (campo de barramento) e em `EngineSoundProfile` (lista de barramentos).
2. **Pulso que acompanha o intervalo (H1).** Usar `t1 = min(t1Max, 0,42 · intervalo)` como em `som-motor.md` §1.3. Com `t1Max` 3,0 a 3,6 ms, o pulso não ocupa mais de 42% do intervalo.
3. **Grave e lowpass.** `boomHz` 55 a 65 Hz, +8 dB; `coletorHz` 180 a 250 Hz; `lpBase` 500 + 0,08·rpm, teto 1800 **(estimativa)**. Em marcha lenta, lowpass fechado e boom forte, sem aspereza.
4. **Reforço de ordens.** Manter a ordem 8 como fundamental. Reforçar a ordem 4 (metade de cada banco) e a 16 em −6 dB relativos **(estimativa)**. Ordem 24 e acima, baixa.
5. **Growl de carga (H4).** Ruído de banda 250 a 900 Hz com ganho proporcional à carga; `aspereza` 0,12 no on-load; `jitter` 0,05 por evento; `cv` ±0,05 **(estimativa)**.
6. **Turbo (H5).** Quatro osciladores de assobio em 1,6 a 3,8 kHz, desafinados ±1,5% entre si, com entrada gradual no spool. Para o Chiron: primeiro estágio por volta de 2000 rpm e o segundo por volta de 3500 rpm **(estimativa)**. Whoosh em 4 a 9 kHz com ganho baixo, ver `som-motor.md` §3.1.
7. **Ignição assimétrica (H2).** Usar uma ordem de referência com cuidado: a WhichCar dá 1-14-9-4-7-12-15-6-13-8-3-16-11-2-5-10 para o Veyron [S29], mas o carscounsel dá outra [S30] e não é fonte forte. **Não usar sem confirmação**. Enquanto isso, a assimetria pode vir do ganho e do atraso por barramento (passo 1).

## C.3 V12

- **Fatos:** 12 cilindros, intervalo uniforme de 60° em ignição uniforme (even-fire), ordem fundamental 6, com 3 e 6 fortes e 12 como harmônico alto. Fóruns e imprensa descrevem o V12 da Ferrari como mais "denso" e o da Lamborghini como mais "cortante" [S31] **(não confirmado por medição)**.
- **Receita:** manter `uniforme(12)`, `pulsoMs` 1,9 ou menos, `jitter` 0,02. Saturação leve (`drive` +20%) para gerar as ordens 3, 6 e 12. Coletor em 620 Hz, `lpTeto` 5000. Para a versão "cortante" (Lamborghini), reduzir o conteúdo de ordem 3 e subir o agudo **(estimativa)**. Intake de alto rpm em 4 a 8 kHz (admissão do motor), mais forte que no V10.

## C.4 V10

- **Fatos:** ignição uniforme de 72° (exemplos citados em `som-motor.md` §2.11) gera ordem 5. Ignição de 90/54 (Viper, LP560-4 citados nessa mesma seção) gera som mais rouco, com ordem 2,5 forte em cada banco. O LFA a 9000 rpm tem a ordem 5 em 750 Hz [S32].
- **Receita:** separar **dois perfis**. `v10` (uniforme, sem atraso entre bancos, lowpass alto, ordem 5 forte, agudo) e `v10-odd` (90/54, atrasos de banco, mais rouco). O perfil atual mistura os dois: `i % 2 ? 0,35 : 0` de atraso é do odd-fire, não do even-fire.

## C.5 Rotativo (Wankel)

- **Fatos:** uma combustão por rotor por volta do eixo excêntrico [S33]. Dois rotores dão dois pulsos por volta, ordem 2, como um I4 (6000 rpm = 200 Hz). A janela de escape fica aberta por ~270° do eixo (~75% do ciclo), com abertura abrupta da porta [S33]. Em marcha lenta, com `bridgeport` e sobreposição grande, há reversão e falhas de combustão, o "brap" irregular [S34].
- **Confiança baixa:** as fontes sobre o som do rotativo são de entusiastas, com erros técnicos em alguns casos [S35]. O SAE 2022-01-0591 (análise de condições de queima de um Wankel moderno) existe, mas não li o texto [S36].
- **Receita:** manter os 2 pulsos por volta com `t1Frac` alto (corpo longo) e `t2Frac` baixo (ataque seco), como em `som-motor.md` §2.14. Falhas aleatórias em marcha lenta (`missChance` 0,05 a 0,15, zero acima de 3000 rpm). Agudo de coletor alto (700 Hz, highshelf +5 dB).

## C.6 Boxer-4

- **Fatos:** ignição a cada 180°, ordem 2. O rumble vem sobretudo de headers de comprimentos desiguais, que jogam os pulsos fora de compasso no coletor [S37]. Há discordância: um comentário no Carthrottle questiona se o header desigual é a causa principal [S38]. Header de comprimentos iguais soa liso e mais agudo.
- **Receita:** seguir `som-motor.md` §2.5 (atrasos de 0,3, 1,0 e 1,3 ms; `tauScale` 1,05 a 1,25; boom 85 a 90 Hz; lowpass `850 + 0,17·rpm`). Para o "galope" de marcha lenta, modulação de amplitude na meia-ordem (rpm/120) com profundidade de 0,10 a 0,15 **(estimativa)**.
- **Uso do WRX CC0 (#273334):** descartado para o loop, mas útil como referência de escuta.

---

## Próximos passos (sugestão, decisão sua)

1. Aprovar o download do **muted.io** (CC0, 68 arquivos, cerca de dezenas de MB em 96 kHz) para ver se há W16, V12 ou rotativo. Confirmar o tamanho antes.
2. Ouvir os candidatos novos: Vitara V6 (249720), 190E dyno (162528) e DeLorean (623436, ver a estrutura).
3. Antes de baixar qualquer um, abrir a página no navegador e conferir a licença do arquivo.
4. Escrever um script de métricas (perfil de ordens + MoSQITo) em `tools/som/` ou em `scratch`. Isso não exige mudança no jogo.
5. Só depois, separar o núcleo DSP do AudioWorklet para permitir o renderizador offline.

---

## Fontes

- [S1] Bugatti Newsroom, "Bugatti W16 engine – the last of its kind" (ignição de 45°, ordem assimétrica, dois blocos de oito a 90°, quatro turbos, dois estágios no Chiron, "balanced ... growling"): https://newsroom.bugatti.com/press-releases/bugatti-w16-engine-the-last-of-its-kind
- [S10] Doerfler & Wyse (2026), "Analysis-Driven Procedural Generation of an Engine Sound Dataset with Embedded Control Annotations", arXiv:2603.07584 (licença do arXiv CC BY-NC-SA 4.0; dataset no Zenodo DOI 10.5281/zenodo.16883336): https://arxiv.org/html/2603.07584v1
- [S11] OpenGameArt, "racing car engine sound loops": https://opengameart.org/content/racing-car-engine-sound-loops
- [S12] Magic Sound Effects, "Car Engines" (itch.io, pago): https://magicsoundeffects.itch.io/car-engines
- [S13] Sonniss, GameAudioGDC (licença de 2023 e nota sobre o pacote de 2026 proibir treino de IA): https://sonniss.com/gameaudiogdc · https://blog.imseankim.com/gdc-2026-game-audio-ai-divide-52-percent-developers-sound-designers/
- [S14] BeamNG, fórum e documentação de modding (termos de terceiros, sons criptografados, não confirmado no EULA): https://documentation.beamng.com/modding/programming/legal/ · https://beamng.com/resources/complete-sound-mod-for-all-vehicles.1905/
- [S15] The Drive, "Gordon Murray's new V12 is real and here's what it sounds like": https://www.thedrive.com/news/34968/gordon-murrays-new-v12-is-real-and-heres-what-it-sounds-like.md
- [S16] Unity Asset Store e Fab, listagens de rotativo (pagas): https://assetstore.unity.com/packages/slug/113444 · https://www.fab.com/listings/21a15596-3e86-4760-964b-c54c8c25f4fd
- [S17] MoSQITo, documentação e PyPI (métricas: loudness, sharpness DIN 45692, roughness Daniel & Weber e ECMA-418-2, tonalidade; v1.2.1): https://mosqito.readthedocs.io/en/stable/source/reference/mosqito.sq_metrics.html · https://pypi.org/project/mosqito/0.2.1/
- [S18] Essentia (MTG/UPF), README e documentação (AGPL-3.0; wheels Linux/macOS): https://github.com/MTG/essentia · https://essentia.upf.edu/documentation.html
- [S19] MathWorks, `rpmtrack`, `rpmfreqmap`, `rpmordermap`, `orderwaveform` (método de ordens sem tacômetro): https://ch.mathworks.com/help/signal/ref/rpmtrack.html · https://au.mathworks.com/help/signal/ref/rpmfreqmap.html
- [S20] LAION-CLAP, repositório (CC0-1.0; exemplos com CUDA; Python 3.10): https://github.com/LAION-AI/CLAP · PyPI: https://pypi.org/project/laion-clap/1.1.3
- [S21] OpenL3, PyPI (código MIT; pesos CC BY 4.0): https://pypi.org/project/openl3/
- [S22] Qwen2-Audio-7B, cards de terceiros (Apache-2.0; conferir o repositório oficial): https://huggingface.co/NexaAIDev/Qwen2-Audio-7B-GGUF
- [S23] Google, preços da API Gemini (25 tokens por segundo de áudio; preços variam entre fontes; conferir a página oficial): https://ai.google.dev/gemini-api/docs/pricing
- [S24] MCP de análise de áudio (comunidade, não verificado): https://glama.ai/mcp/servers/@zachswift615/audio-analysis-mcp · https://glama.ai/mcp/servers/@hugohow/mcp-music-analysis/blob/main/src/mcp_music_analysis/server.py
- [S25] TU Delft, "Objective quantification of perceived differences between measured and synthesized aircraft sounds": https://repository.tudelft.nl/record/uuid:f9970790-52b5-4164-8a82-5f260d5d663f
- [S26] AES, comparação de sons reais e sintéticos com descritores objetivos: https://www.aes.org/e-lib/download.cfm/22409.pdf?ID=22409
- [S27] EAA/DAEL 2025, comparação de motores sintéticos e reais (fatores de ouvintes): https://dael.euracoustics.org/confs/fa2025/data/articles/000759.pdf
- [S28] The Drive, "Listen to the W16 Bugatti Bolide in Lake Como" e Hagerty, "Here's how a Bugatti Veyron should sound" (opinião de crítico e de dono): https://www.thedrive.com/news/listen-to-the-w16-bugatti-bolide-in-lake-como.md · https://www.hagerty.com/media/?p=45047
- [S29] WhichCar, ordem de ignição do Veyron (não verificada em segunda fonte): https://www.whichcar.com.au/?p=541933
- [S30] Carscounsel, "W16 firing order" (fonte fraca, não usada como base): https://carscounsel.com/w16-firing-order/
- [S31] Carthrottle, "Why Do Different Engine Configurations Make Different Sounds?" e "A Musician's Analysis of Engine Notes": https://www.carthrottle.com/news/why-do-different-engine-configurations-make-different-sounds · https://www.carthrottle.com/news/musicians-analysis-engine-notes
- [S32] Goodwood, "The raw sound of a V10 F1 engine at 20000rpm" e "The seven best sounding V10s of all time" (contexto de V10, sem medição): https://www.goodwood.com/grr/f1/the-seven-best-sounding-v10s-of-all-time/
- [S33] Wikipedia, "Wankel engine" e patente US 9194232 (janela de escape ~75% do ciclo): https://en.wikipedia.org/wiki/Wankel_engine · https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9194232
- [S34] Rotary Car Club, discussão de overlap e falhas em bridgeport: https://www.rotarycarclub.com/rotary_forum/showthread.php?p=124303
- [S35] SlashGear, "Why Do Rotary Engines Make That Unique 'Brap Brap' Sound?" (fonte de entusiasta, com erros técnicos): https://www.slashgear.com/1879127/rotary-engine-brap-sound-reason/
- [S36] SAE, "Testing of a Modern Wankel Rotary Engine – Part III: Firing Condition Analysis" (título e resumo; texto não lido): https://saemobilus.sae.org/content/2022-01-0591
- [S37] Crawford Performance, SlashGear e Motor Authority, sobre headers desiguais e o rumble do boxer: https://crawfordperformance.com/blogs/news/unequal-length-headers-wrx-guide · https://www.slashgear.com/1970710/subaru-unequal-length-headers-rumble-sound/
- [S38] Carthrottle, "Subaru boxer rumble – exhaust explained" (com comentário discordando da causa): https://www.carthrottle.com/posts/subaru-boxer-rumble-exhaust-explained
- Freesound (páginas lidas nesta rodada): https://freesound.org/people/Keith%20Selmes/sounds/249720/ · https://freesound.org/people/EvanBoyerman/sounds/755999/ · https://freesound.org/people/Chippy569/sounds/162528/ · https://freesound.org/people/Chippy569/packs/ · https://freesound.org/people/SkyernAklea/sounds/623436/
- muted.io, "Performance Cars" (CC0, 68 arquivos, 96 kHz/24 bits): https://muted.io/performance-cars
- Commons, trilhas de vídeos YouTube (CC BY 3.0, risco de proveniência, ver `gravacoes-motor.md` A.3): https://commons.wikimedia.org/wiki/File:Bugatti_Chiron_-_engine_and_exhaust_sound_(YouTube_BtBU0O3j_ZE).opus · https://commons.wikimedia.org/wiki/File:Mazda_RX-7_-_engine_and_exhaust_sound_(YouTube_4z0y1H2REvE).opus
- Documentos locais de referência: `docs/pesquisa/som-motor.md` (§1.3, §2.5, §2.8 a §2.14, §3.1 e §10 Fontes [F1]–[F31]) e `docs/pesquisa/gravacoes-motor.md` (A.2, A.3, B.6 a B.9 e Fontes [G1]–[G21]).

---

# Parte V8 — por que os V8 soavam mal e o que mudou (14/11/2026)

> Medido offline com `web-garagem/src/game/autodash/__tests__/render-motor.test.ts` (reproduz a cadeia de `audio.ts` sem WebAudio: guias de onda + banco + ganhos de `misturarGravacao`, EQ e saturação; sem compressor, eco e efeitos) e com os bancos como estão em `public/autodash/som/`. **Ninguém ouviu nada ainda**: o que está aqui é espectro e volume. Os números "antes" vêm do commit anterior a esta parte; o áudio de antes e depois está em `docs/pesquisa/audio-v8/`.

## V.1 O que estava errado (medido)

Perfil `v8-cruzado`, banco Studebaker 1953 (1957–5664 rpm), `mix` 0,7. Centroide espectral e volume (dBFS da saída renderizada), pé no fundo:

| rpm | gravação sozinha | síntese sozinha | mistura (como no jogo) |
|---|---|---|---|
| 1500 | −62,6 dB (quase desligada) · 1229 Hz | −29,5 dB · 98 Hz | −29,5 dB · 98 Hz |
| 3000 | −44,9 dB · 1392 Hz | −33,9 dB · 155 Hz | −33,7 dB · 248 Hz |
| 5000 | −28,3 dB · 1222 Hz | −33,2 dB · 224 Hz | −27,4 dB · 1056 Hz |
| 6500 | −32,9 dB · 2754 Hz | −28,5 dB · 260 Hz | −26,7 dB · 853 Hz |

1. **A síntese domina a mistura abaixo de ~4500 rpm e é quase um seno.** Em 1500–3000 rpm o centroide da síntese é 100–260 Hz e ela tem 38 dB menos energia entre 1 e 4 kHz; a linha da explosão (4ª ordem) concentra de −0,8 a −3 dB de toda a energia. É o "zumbido". Com o pé no fundo ela ainda sobe 15 dB (de −44 para −29), enquanto a gravação sobe só 6: a síntese manda mais. A mistura a 3000 rpm tem centroide de 248 Hz, quatro vezes mais escura que a gravação (1064 Hz, medida nos grãos originais).
2. **A lenta e o arranque não têm gravação.** O banco só cobre de 1957 rpm; o misturador desliga a gravação abaixo de ~1760 rpm (`lo × 0,9`) e a zera em ~1370. Lenta (700) e 1500 rpm são 100% síntese (a linha acima de 1500: gravação em −62 dB, síntese em −29).
3. **Esticado demais no alto.** A 6500 rpm o grão sai a 1,15× do giro gravado mais alto; o centroide da gravação dobra (1222 → 2754 Hz): "esganiçado". A mistura só tira a gravação aos poucos (75% ainda a 6500).
4. **Som de cofre em vez de escape.** O Studebaker foi gravado debaixo do capô: centroide de 940 a 1390 Hz, muito 250 Hz–4 kHz (clique de válvulas, chiado). Um V8 ouvido do escape tem o centroide entre 300 e 500 Hz (os bancos novos dão 400–500 Hz a 3000 rpm). A síntese escura mais a gravação clara não se juntam: o jogo toca dois sons diferentes ao mesmo tempo.
5. **Período do grão: correto.** `voltasPorGrao = 2` (ciclo de 720°) e a frequência do grão bate com o giro (14,2 Hz a 1704 rpm). **Oitava: sem erro** no Studebaker (faixa 1957–5664 confere com o `PRIOR` do README). O erro de oitava apareceu na primeira tentativa de rastrear o candidato novo (V.2) e foi corrigido lá.
6. **Cobertura curta.** 1957–5664 rpm num motor que vai de 700 a 6400. Fora disso, estica o grão (item 3) ou volta para a síntese (itens 1 e 2).

## V.2 Gravações avaliadas (baixadas, licenças conferidas na página)

| Gravação | Licença | Resultado |
|---|---|---|
| Chrysler 1964, microfone no escape (#240671, lonemonk) | CC BY 4.0 | **Usada (lenta).** 48 s de lenta estável a ~790 rpm (4ª ordem em 53 Hz; 1ª em 13,2 Hz), perspectiva do escape, grave forte em 80–130 Hz. Não tem varredura. |
| "nascar24chevyrev2" (#43485, enginemusic) | CC BY 3.0 | **Usada (meio).** Acelerada de pit de 12 s, mas só de 2250 a 3750 rpm no motor-alvo: o resto tem outros motores de fundo e a "lenta" que parecia 670 rpm era um zumbido de rede de 150 Hz que o rastreador seguia. 4ª ordem em 245 Hz no platô (3670 rpm; linhas em 61,2·k, de 4 a 10). |
| Studebaker 1953 (#238847, lonemonk) | CC BY 4.0 | **Usada (alto, 3500–6000 rpm), com passa-baixa de 3 kHz** para chegar perto do timbre das outras. |
| "Big Block V8 Rev" (#127980, Henaway) | CC0 | Descartada: 3,7 s sem linhas harmônicas limpas (ruído de fundo largo). |
| "DynoRunUp 1250HP Chev V8" (#177185, Ears68) | CC0 | Descartada: 103 s de dinamômetro de evento, mas com plateia e vários carros misturados. |
| "Hot-Rod V8 Supercharged Dynamometer Test 600HP" (#144455, Ears68) | CC BY 3.0 | **Não usada, é a melhor pista para o futuro:** 32 s limpos de dinamômetro, subida em carga de 3500 a 4750 rpm e descida até ~1500, linhas harmônicas nítidas. Tem apito de compressor Roots (ordem 6) gravado junto; só serve de verdade para o `v8-cruzado` (que é "roots"), não para o Ford aspirado. |

Não achei V8 de virabrequim plano melhor que a Ferrari 360 (CC0): `v8-plano` ficou com o banco antigo.

## V.3 O que foi feito

- **Banco `v8-escape`** (cruzado, 45 s, 703 grãos, 612 KB): Chrysler (700–900 rpm) + NASCAR (2000–3650) + Studebaker filtrado (3500–6000), com `tools/som/juntar.py`, curva de volume por giro e nível pelo `nivel.py` (receita completa em `tools/som/README.md`). Emendas: lenta → NASCAR, **buraco de 900 a ~2000 rpm** onde o motor estica o grão mais próximo (até ~1,4–1,5×, acima dos ~1,3× que eu queria): é o ponto fraco, junto da emenda das gravações em ~3500 rpm.
- **Mixagem** (`Gravacao` em `sound/profiles.ts`, usada em `audio.ts`):
  - `sint`: sobra do modelo físico dentro da faixa gravada, 0,06 (antes 0,51): a gravação manda e a síntese fica só como corpo; fora da faixa a síntese assume como antes.
  - `corpo` [140 Hz, +2 dB]: pico do corpo do escape sobre a gravação; `topoHz` 9000 (só corta o chiado acima disso; as gravações novas já são escuras).
  - `burble` 0,7 (Ford 0,5): ao tirar o pé a partir de 2300 rpm (antes 3300) os estouros ficam mais frequentes, mais longos e ~20% mais graves.
- `v8-plano`: banco antigo, mesma mixagem nova (`mix` 0,85, `sint` 0,1, corpo 160 Hz +1,5 dB): a gravação passou a mandar de 1500 a 4500 rpm (centroide 1333 Hz a 3000, antes 1195).

Resultado medido (mistura, pé no fundo, `v8-cruzado`): centroide a 3000 rpm 248 → 463 Hz (a gravação sozinha: ~430–500 Hz); a 5000 rpm 1056 → 407 Hz e a 6500 rpm 853 → 605 Hz (o Studebaker filtrado é bem mais escuro que antes; o timbre sobe com o giro, de 253 Hz a 1500 rpm até ~600 Hz a 6500, em vez de cair); a lenta a 800 rpm sai da gravação (Chrysler) em vez da síntese. Volume com o pé no fundo: 1500 rpm de −29,5 para −42,0 dB, 3000 rpm de −33,7 para −34,7, 5000 rpm de −27,4 para −29,1, 6500 rpm de −26,7 para −31,0. **A faixa baixa (1500–2500 rpm) ficou bem mais baixa que antes** (a síntese estourava lá, 12 dB acima da gravação); se soar fraco na largada, o ajuste é subir `sint` ou o ganho do trecho de 900 a 2200 rpm.

## V.4 Não verificado

- Som no navegador (ouvido). Só espectro e volume offline.
- O burble (os estouros usam buffers WebAudio, fora do render offline).
- O compressor e a saturação do jogo no mix final (o render só tem a tanh).
