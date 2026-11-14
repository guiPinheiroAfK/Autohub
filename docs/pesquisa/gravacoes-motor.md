# Pesquisa: gravações de motor livres e como os jogos fazem som de motor a partir delas

> Documento de pesquisa (14/11/2026). **Não é spec nem ADR.** Complementa `docs/pesquisa/som-motor.md` (seção 4 e 5.1) e serve para o dono **aprovar ou recusar** gravações antes de qualquer download.
> Nada foi baixado. As licenças foram conferidas **na página de cada arquivo** em 14/11/2026. A qualidade foi avaliada **pela descrição do autor**, não de ouvido: ouvir o preview antes de aprovar.
> Convenções: `[Gn]` = fonte numerada na seção [Fontes](#fontes). **(estimativa)** = número sem fonte direta, a calibrar. ★ = melhor candidato da família.

---

## 0. Resumo

**Parte A (gravações).**
- Há candidatos com licença usável (CC0, CC BY, alguns CC BY-SA) para **todas as 15 famílias**. A qualidade, porém, é desigual. CC0 e CC BY "limpos", vindos de gravação própria do autor, existem com folga para V8 cruzado, I4 aspirado, boxer 4, flat-6, I6 turbo e V10/V12 (estes com qualidade de celular). Para **rotativo, W16, I3 e I4 turbo (SR20)** só aparecem trilhas de vídeos do YouTube marcados como CC BY e copiadas para o Wikimedia Commons, e essas têm risco de proveniência (seção A.3).
- O material mais valioso para granular, a **varredura lenta em carga** (dyno ou aceleração em marcha), é raro. Os quatro melhores achados são: o Supra no dinamômetro (CC0), o Renault 19 com acelerações a 6000 rpm e desacelerações (CC0), o Studebaker V8 de marcha lenta a 6000 rpm (CC BY 4.0) e o Cayman S arrancando (CC BY-SA). **Loops de rpm constante prontos praticamente não existem** em acervo livre e terão de ser extraídos das varreduras (Parte B).
- O Wikimedia Commons tem uma categoria com **617 arquivos de som de carros**, dos quais ~500 são trilhas de vídeos CC BY do YouTube. Cobre quase todo carro do jogo (350Z, Supra A80, Skyline R34, RX-7, MX-5, WRX STI, Chiron, Aventador…), mas cada arquivo precisa de triagem de proveniência e de escuta (fala, música).

**Parte B (técnica).**
1. Os jogos usam três famílias de técnica: **loops cruzados por rpm × carga** (Forza, Project CARS, BeamNG, Assetto Corsa), **granular síncrono ao ciclo do motor** a partir de uma varredura (Crankcase REV, AudioMotors, TONIC da Black Rock, HSOLA acadêmico) e, no topo, **síntese/modelagem física** (GT7, o próprio AutoDash hoje).
2. O granular bom corta **um ciclo completo do motor (720° = 2 voltas)** por grão. Assim cada grão carrega o padrão irregular dos cilindros (burble, rumble), e o pitch muda quase só por **escolher o grão gravado no rpm certo**, não por reamostrar. Isso elimina o "chipmunk".
3. A curva de rpm sai da gravação pela **ordem de ignição**, `f_ign = rpm/60 × N/2`: rastrear essa crista no espectrograma (soma harmônica + Viterbi), refinar pela fase e integrar a fase para obter o **ângulo do virabrequim θ(t)**. As fronteiras de grão ficam em `θ = θ0 + 720·k`.

---

# Parte A — Gravações candidatas

## A.1 Como ler as tabelas

- **Tipo de material:** `V` = varredura (sweep) de marcha lenta ao alto giro; `VC` = varredura em carga (dyno ou aceleração em marcha), o mais valioso; `N` = aceleradas em ponto morto (pouca carga); `L` = marcha lenta / regime constante; `P` = passagem (pass-by, com Doppler, pouco útil para granular); `1` = one-shot (partida, BOV, estouro).
- **Licença:** CC0 = sem crédito obrigatório. CC BY = crédito obrigatório. **CC BY-SA** = crédito, e o **áudio derivado** (cortado, filtrado) tem de ser distribuído como BY-SA. O código do jogo não fica BY-SA, mas o arquivo de áudio sim. É aceitável com ressalva; preferir CC0/BY quando houver empate. **CC BY-NC** e **RemArc (BBC)** = não comercial, ficam fora.
- **"YT→Commons"** = trilha de um vídeo do YouTube marcado pelo canal como CC BY 3.0, copiada para o Wikimedia Commons. Ver os riscos na seção A.3.
- Os tamanhos são os da página (arquivo original). Para o jogo, tudo seria cortado e convertido para mono Opus/AAC ~64–96 kbps, ou seja ~10 KB por segundo **(estimativa)**.
- **Freesound:** a página do som é pública e tem o player com o preview MP3. O download do original exige login.

## A.2 Candidatos por família

### V8 virabrequim cruzado (muscle, Mustang 1971, polícia) → perfis `v8-cruzado`, `v8-cruzado-ford`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade (pela descrição) | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | 1953 Studebaker Idle up to 6000rpm (lonemonk) | https://freesound.org/people/lonemonk/sounds/238847/ | CC BY 4.0 | 0:39 | MP3 256k, 44,1 kHz, estéreo | 1,2 MB | V/N | Chevy 350 aumentado, comando bravo, tunnel ram com dois quadrijets. Gravado **no cofre** (Zoom H2n XY), então o autor avisa que o escape quase não aparece | **varredura lenta de marcha lenta a 6000 rpm** de um small-block cross-plane: dá para fatiar em ciclos. Camada "motor/admissão" |
| | Chev350 Raw (lonemonk) | https://freesound.org/people/lonemonk/sounds/123717/ | CC BY 4.0 | 9:07 | WAV 16-bit/44,1 kHz, estéreo | 92,1 MB | N/L/1 | Hot rod Chevy 350 com problema de estouro (vela fraca), "ligado e acelerado muitas vezes" (H4n, mics internos). Feito para outro usuário que queria "rpm variados" | muitas aceleradas, marcha lenta com lope e **estouros reais** (pops). Usar só trechos |
| | Big Block V8 Rev (Henaway) | https://freesound.org/people/Henaway/sounds/127980/ | **CC0** | 0:03,7 | MP3 137k, mono | 62,5 KB | 1/N | uma acelerada de Ford 460 (big-block), tag "exhaust" | único **CC0** de V8 americano com acelerada limpa; bom one-shot de "blip" |
| | Chrysler Start and Idle (Exhaust perspective) (lonemonk) | https://freesound.org/people/lonemonk/sounds/240671/ | CC BY 4.0 | 0:48 | WAV 16-bit/44,1 kHz, estéreo | 8,1 MB | 1/L | Chrysler Windsor 1964 (V8), **microfone no escape** (H2n XY) | partida + **marcha lenta na perspectiva do escape**: loop de lenta do muscle |
| | Lexus IS-F dynamometer 2UR-GSE (2008) (Altair78) | https://commons.wikimedia.org/wiki/File:Lexus_IS-F_dynamometer_2UR-GSE_(2008).ogg | CC BY-SA 4.0 | 0:15 | OGG | 101 KB | **VC** | V8 5.0 cross-plane japonês num dinamômetro de evento ("Taste of Lexus"), público ao fundo provável | uma das poucas **puxadas em dinamômetro** livres; V8 cruzado mais "liso" (escape europeu) |
| | nascar24chevyrev2 (enginemusic) | https://freesound.org/people/enginemusic/sounds/43485/ | CC BY 3.0 | 0:12 | MP3 192k, 44,1 kHz | 286 KB | N | V8 Chevy de NASCAR acelerando no pit (2000), DAT + ECM959 | caráter de V8 de corrida com escape aberto |
| | mustang 6 (VacekH) e série "mustang 1–11" | https://freesound.org/people/VacekH/sounds/205505/ | CC0 | 0:05,7 | WAV 16/44,1, mono | 494 KB | P | Mustang GT500 (V8 com compressor), Sennheiser MKH60, passagens/partidas | CC0 de Mustang, mas **passagens**: servem só como referência e SFX de tráfego |

> **Evitar:** "Audi V8 Acceleration Sound" (FFKoenigsegg20012017, #339703, CC0). A descrição ("Audi V8 até 217 mph") e o nome do autor sugerem trilha tirada de vídeo de terceiros, e a proveniência é duvidosa.

### V8 virabrequim plano (Ferrari, Koenigsegg) → perfil `v8-plano` (carro `ghost`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Ferrari 360 Spider - engine sound (PritzProductions) | https://freesound.org/people/PritzProductions/sounds/241083/ | **CC0** | 0:37,9 | WAV 24-bit/48 kHz, estéreo | 10,4 MB | N/L (provável) | Zoom H6 "diretamente acima do motor do carro parado"; tags incluem "ignition" | **CC0, 24-bit, flat-plane V8 3.6 de perto**. Carro parado = partida, lenta e aceleradas em ponto morto (confirmar de ouvido) |
| | ferrari355underhood4 (enginemusic) | https://freesound.org/people/enginemusic/sounds/43484/ | CC BY 3.0 | 0:18 | MP3 192k, 48 kHz, estéreo | 428 KB | N | F355 Spider, mics binaurais **no cofre** (um na admissão, um na tampa de válvulas), DAT, ~1997. Também está no Commons | camada de **admissão** do flat-plane, o "grito" do F355 |
| | Koenigsegg Agera.ogg (Edvvc) | https://commons.wikimedia.org/wiki/File:Koenigsegg_Agera.ogg | CC BY-SA 3.0 | 0:10,4 | OGG | 254 KB | P/VC curto | largada da subida de Goodwood 2010; público e alto-falantes prováveis | é **o** Koenigsegg (V8 plano biturbo). Também há "Koenigsegg CCX-R.ogg" (10 s, 113 KB, mesma licença) |
| | Ferrari 458 Italia.ogg (Edvvc) | https://commons.wikimedia.org/wiki/File:Ferrari_458_Italia.ogg | CC BY-SA 3.0 | 0:11,6 | OGG | 278 KB | P/VC curto | largada em Goodwood 2010 | flat-plane aspirado de alto giro |

### V6 aspirado (Nissan Z) → perfil `v6` (carro `zcoupe`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | DeLorean DMC-12 (V6 PRV engine) (SkyernAklea) | https://freesound.org/people/SkyernAklea/sounds/623436/ | CC BY 4.0 | 1:20,8 | WAV 32-bit/48 kHz, estéreo | 29,6 MB | 1/L/N/P | Rode NTG4+ e Zoom F6 (equipamento bom); partida, lenta, aceleradas, saída | V6 com licença limpa e gravação boa. **Atenção:** o PRV do DeLorean é V6 a 90° de **ignição irregular**, caráter mais próximo da seção 2.8 de `som-motor.md` do que do VQ |
| | NISSAN VQ35HR engine.ogg (TTTNIS) | https://commons.wikimedia.org/wiki/File:NISSAN_VQ35HR_engine.ogg | **domínio público** | 0:04,5 | OGG | 68 KB | L/N | Nissan Fuga 350GT, gravação própria | **o motor exato do 350Z HR**, mas só 4,5 s: referência de timbre e calibração |
| | Nissan 350Z - engine and exhaust sound (KG's Garage) | https://commons.wikimedia.org/wiki/File:Nissan_350Z_-_engine_and_exhaust_sound_(YouTube_zNpHriHrNl0).opus | CC BY 3.0 (YT→Commons) | 10:00 | Opus ~127 kbps | 9,5 MB | ? | trilha de vídeo de oficina: **provável fala** | longo; pode ter trechos de acelerada utilizáveis |
| | Ryton Fissore Magnum… Alfa Romeo V6 engine close (klankbeeld) | https://freesound.org/people/klankbeeld/sounds/874882/ | CC BY 4.0 | 0:14 | WAV 32-bit/48 kHz, estéreo | 5,2 MB | 1 | V6 Busso 2.5 a 40 cm, só partida e desligamento, com compressor | partida/desligamento de V6 60°. O autor pede crédito e pede que não vire banco de sons "royalty free" (o uso num jogo é permitido) |

### V6 biturbo → perfil `v6-biturbo`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | mercedes benz c43 AMG exhaust rev slow rear (jerry.berumen) | https://freesound.org/people/jerry.berumen/sounds/772801/ | CC BY 4.0 | 0:46 | WAV 24-bit/96 kHz, mono | 12,7 MB | N ("rev slow") | gravado na concessionária, traseira/escape, Sony PCM-A10 | V6 biturbo (AMG C43) com **aceleradas lentas pelo escape**, quase uma varredura em ponto morto |
| | Maserati MC20 - engine and exhaust sound (Hungarian Supercar Spotters) | https://commons.wikimedia.org/wiki/File:Maserati_MC20_-_engine_and_exhaust_sound_(YouTube_IDmzyKfrAm4).opus | CC BY 3.0 (YT→Commons) | 0:28 | Opus | 420 KB | ? | canal de spotters (filmagem própria provável) | V6 biturbo "exótico" (Nettuno) |
| | Ferrari 296 - engine and exhaust sound (Supercars and beyond) | https://commons.wikimedia.org/wiki/File:Ferrari_296_-_engine_and_exhaust_sound_(YouTube_b9Qx9rpCsA0).opus | CC BY 3.0 (YT→Commons) | 1:16 | Opus | 1,05 MB | ? | canal de spotters | V6 120° biturbo |
| | land rover sport v6 engine revving (jerry.berumen) | https://freesound.org/people/jerry.berumen/sounds/772800/ | **não conferida** (o autor usa CC BY 4.0 nos vizinhos) | — | — | — | N | mesma sessão do C43 | V6 com compressor; conferir a página antes |

### V10 (Lamborghini, Audi R8, LFA) → perfil `v10` (carro `gt`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Audi R8 Idling Reving Backfire (Jonas_Jocys) | https://freesound.org/people/Jonas_Jocys/sounds/457733/ | CC BY 4.0 | 2:08 | WAV 24-bit/48 kHz, estéreo | 35,3 MB | L/N/1 | Sound Devices 633, MKH-416 acima do carro + condensador atrás. Lenta, aceleradas "em vários rpm", estouro. Comentários citam **algum clipping** | a melhor gravação profissional de supercarro achada, com licença limpa. **Verificar se é V10:** o R8 também teve V8 4.2. No espectro, V10 tem ordem 5 (250 Hz a 3000 rpm) e V8 tem ordem 4 (200 Hz) |
| | Lexus LFA revving 1LR-GUE (2009) (Altair78) | https://commons.wikimedia.org/wiki/File:Lexus_LFA_revving_1LR-GUE_(2009).ogg | CC BY-SA 4.0 | 0:17 | OGG | 295 KB | N | "LFA revving at auto show": público provável | **o LFA** (V10 de 9000 rpm), aceleradas em ponto morto |
| | Audi_R8_01 (ikbenraar) | https://freesound.org/people/ikbenraar/sounds/429099/ | CC BY 4.0 | 4:06 | WAV 16-bit/48 kHz, estéreo (M-S) | 45,2 MB | P/1 | R8 no circuito de Zolder, várias passagens e partida | passagens e partida; pouco útil para granular |
| | Lamborghini Huracan Performante (FiExhaust) | https://commons.wikimedia.org/wiki/File:Lamborghini_Huracan_Performante_-_engine_and_exhaust_sound_(YouTube_mgrAYKhz5gM).opus | CC BY 3.0 (YT→Commons) | 7:22 | Opus | 6,0 MB | ? | canal do fabricante de escapamento (conteúdo próprio); provavelmente com escape Fi e **trilha musical possível** | V10 5.2 com bastante material |

### V12 → perfil `v12` (alternativa do `ghost`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Lambo idle and rev (cheesepuff) | https://freesound.org/people/cheesepuff/sounds/112075/ | **CC0** | 1:04 | MP3, 44,1 kHz, estéreo | 2,0 MB | L/N | Murciélago LP670-4 SV na concessionária, áudio **de um vídeo do próprio autor** (câmera/celular): qualidade limitada, ambiente e vozes possíveis | **único V12 CC0** com lenta e aceleradas. Par: "lambo rev" (#112076, CC0, 5,3 s, 169 KB) |
| | ferrari340america2 (enginemusic) | https://freesound.org/people/enginemusic/sounds/43483/ | CC BY 3.0 | 0:12 | MP3 192k, 44,1 kHz | 285 KB | N | Ferrari 340 America (V12 4.0 Lampredi), DAT + ATM10, oficina, ~1997 | V12 italiano clássico acelerando de perto |
| | Lamborghini Aventador LP700-4 (2011).ogg (Edvvc) | https://commons.wikimedia.org/wiki/File:Lamborghini_Aventador_LP700-4_(2011).ogg | CC BY-SA 3.0 | 0:08 | OGG | 262 KB | P/VC curto | subida de Goodwood 2011 | V12 moderno em carga, curto |
| | Lamborghini Murciélago with Fi Exhaust (FiExhaust) | https://commons.wikimedia.org/wiki/File:Lamborghini_Murci%C3%A9lago_with_Fi_Exhaust_-_engine_and_exhaust_sound_(YouTube_iyWtAgi6R-s).opus | CC BY 3.0 (YT→Commons) | 10:06 | Opus | 8,5 MB | ? | canal do fabricante | muito material de V12, com escape modificado |

> **Evitar:** "V12 Engine - Short Rev" (Janosch-JR, #484191, CC0). O autor diz que é um **motor elétrico quebrado** processado para parecer V12.

### W16 (Bugatti) → perfil `w16`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Bugatti Chiron - engine and exhaust sound (aTOz) | https://commons.wikimedia.org/wiki/File:Bugatti_Chiron_-_engine_and_exhaust_sound_(YouTube_BtBU0O3j_ZE).opus | CC BY 3.0 (YT→Commons) | 1:42 | Opus | 1,5 MB | ? | canal de spotters | o único W16 longo com licença aberta |
| | Bugatti Veyron Grand Sport.ogg (Edvvc) | https://commons.wikimedia.org/wiki/File:Bugatti_Veyron_Grand_Sport.ogg | CC BY-SA 3.0 | 0:09 | OGG | 107 KB | VC curto | largada em Goodwood 2009 (gravação própria) | W16 em carga. Par: "Bugatti Veyron Pur Sang.ogg" (7,6 s, 188 KB, mesma licença) |

Nada de W16 no Freesound com CC0/BY. Como previsto, é a família mais rara.

### I6 (BMW, Supra 2JZ, Skyline RB26) → perfis `i6`, `i6-corrida` (carros `apex`, `kaiju`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Import car revs on Chassis Dyno with Turbo (editboy23) | https://freesound.org/people/editboy23/sounds/496171/ | **CC0** | 0:35 | WAV 16-bit/48 kHz, estéreo | 6,5 MB | **VC** | Toyota Supra em **dinamômetro de rolo**, levado "ao máximo", com assobio de turbo. O autor avisa que fica **muito alto e distorcido** no topo. Tags: manual, shift | o material ideal para granular (varredura em carga, sem pneu nem vento), **CC0**. Descartar o trecho distorcido. Confirmar de ouvido que é o 2JZ (A80) |
| | 6-cyl-VintageRaceCar…StartClimb (Ears68) | https://freesound.org/people/Ears68/sounds/185151/ | **CC0** | 1:01 | WAV 16-bit/44,1 kHz, estéreo | 10,3 MB | VC/N/P | I6 Holden preparado, três carburadores duplos laterais, **headers abertos**, câmbio Hewland; burnout, largada e subida (Tascam DR-05) | caráter de I6 "de corrida" com admissão forte, bom para `i6-corrida` |
| | Nissan Skyline GT-R R34 (Matteo Torrisi Officina Del Pilota) | https://commons.wikimedia.org/wiki/File:Nissan_Skyline_GT-R_R34_-_engine_and_exhaust_sound_(YouTube_GWgYGT9IM4E).opus | CC BY 3.0 (YT→Commons) | 4:07 | Opus | 4,0 MB | ? | canal de oficina (filmagem própria provável) | RB26 biturbo. Também "Nissan Skyline GT-R" (LowFps, 8:13, 7,0 MB) |
| | Toyota Supra (A80) (Fabio Rojas Pichardo) | https://commons.wikimedia.org/wiki/File:Toyota_Supra_(A80)_-_engine_and_exhaust_sound_(YouTube_YlRjnMnHRO4).opus | CC BY 3.0 (YT→Commons) | 0:34 | Opus | 543 KB | ? | — | 2JZ do A80 |
| | BMW M1 (Heup Motorsport) | https://commons.wikimedia.org/wiki/File:BMW_M1_-_engine_and_exhaust_sound_(YouTube_7gVkkRConA4).opus | CC BY 3.0 (YT→Commons) | 2:53 | Opus | 2,4 MB | ? | descrição do vídeo: "Pure Straight-Six Sound" (ProCar) | I6 BMW M88 com borboletas individuais |

### Boxer 6 / flat-6 (Porsche 911) → perfis `boxer6`, `boxer6-turbo` (carro `flat6`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | vehicle car porsche 911 revving engine motor boxer (jerry.berumen) | https://freesound.org/people/jerry.berumen/sounds/772802/ | CC BY 4.0 | 0:53 | WAV 24-bit/96 kHz, mono | 14,5 MB | N | concessionária, Sony PCM-A10 | aceleradas de 911 com licença limpa e alta resolução |
| | 2006 Porsche Cayman S engine sound.wav (John64) | https://commons.wikimedia.org/wiki/File:2006_Porsche_Cayman_S_engine_sound.wav | CC BY-SA 3.0 | 0:33 | WAV | 3,2 MB | **VC** | microfone **preso ao carro**, arrancada "vigorosa" até velocidade de estrada | **varredura em carga** (com trocas de marcha) de flat-6 aspirado; vento/pneu prováveis |
| | porsche_911 (mharo) | https://freesound.org/people/mharo/sounds/55727/ | **CC0** | 0:10 | WAV 16-bit/44,1 kHz, estéreo | 1,7 MB | P | 911 na rua em Barcelona; comentário: "air-cooled de verdade" | CC0, mas passagem com rua |
| | Porsche 992 (Mr.Alexandre) | https://commons.wikimedia.org/wiki/File:Porsche_992_-_engine_and_exhaust_sound_(YouTube_PqvY5ONBjxw).opus | CC BY 3.0 (YT→Commons) | 0:48 | Opus | 691 KB | ? | — | o 992 biturbo do carro `flat6` |

### Boxer 4 (Subaru EJ, coletor desigual) → perfil `boxer4`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | WRX - Exhaust sounds (ulose2piranha) | https://freesound.org/people/ulose2piranha/sounds/273334/ | **CC0** | 0:35 | WAV 16-bit/44,1 kHz, estéreo | 6,0 MB | L/N | Impreza WRX 2003 (EJ205, header desigual), turbo-back de 3": lenta, aceleradas em vários rpm, **assobio de turbo**, chocalho de peças soltas; "um pouco abafado" | o **rumble** autêntico em CC0, com lenta e aceleradas |
| | subaru impreza start up-idle-launch limiter (t33kno) | https://freesound.org/people/t33kno/sounds/369797/ | **CC0** | 0:29 | WAV 16-bit/44,1 kHz, estéreo | 4,9 MB | 1/L | Impreza 2003: partida, lenta, **limitador de largada** | partida e lenta (loop de rumble) e one-shot de 2-step |
| | Subaru WRX STI (Hungarian Supercar Spotters) | https://commons.wikimedia.org/wiki/File:Subaru_WRX_STI_-_engine_and_exhaust_sound_(YouTube--bynUdphkbc).opus | CC BY 3.0 (YT→Commons) | 5:21 | Opus | 5,1 MB | ? | spotters | STI (EJ257) |

### I5 (Audi) → perfil `i5`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | RG Volvo Engine (cmusounddesign) | https://freesound.org/people/cmusounddesign/sounds/95838/ | CC BY 4.0 | 0:32 | WAV 16-bit/44,1 kHz, estéreo | 5,4 MB | L/N (provável) | Volvo 2.4 cinco cilindros **turbo**, mic suspenso ~20 cm acima do protetor de calor do turbo (cofre) | I5 turbo com licença limpa; camada de motor/turbo |
| | Audi TT RS (L'argus) | https://commons.wikimedia.org/wiki/File:Audi_TT_RS_-_engine_and_exhaust_sound_(YouTube_4c7BUfLJOXk).opus | CC BY 3.0 (YT→Commons) | 0:44 | Opus | 410 KB | ? | canal de revista automotiva (conteúdo próprio) | o I5 2.5 TFSI da Audi, pelo escape |
| | Audi RS3 (Jay Chesterman) | https://commons.wikimedia.org/wiki/File:Audi_RS3_-_engine_and_exhaust_sound_(YouTube_uuEytKIzqeY).opus | CC BY 3.0 (YT→Commons) | 8:57 | Opus | 6,6 MB | ? | vlog: **fala provável** | muito material de I5 |
| (só análise) | Volvo S60 Engine Ramp Test (el-bee) | https://freesound.org/people/el-bee/sounds/644879/ | **CC BY-NC 4.0** | 0:46 | WAV 24-bit/96 kHz | 12,6 MB | **VC** com marcadores de rpm | rampas em 2ª marcha com o rpm anotado | **não pode ir para o jogo.** Serve para validar o rastreador de rpm da Parte B (há verdade de referência) |

### I4 turbo (Silvia S15 / SR20) → perfil `i4-turbo` (carro `sylva`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Nissan 200SX (Built For Drift) | https://commons.wikimedia.org/wiki/File:Nissan_200SX_-_engine_and_exhaust_sound_(YouTube_rnzeQ2QDOV8).opus | CC BY 3.0 (YT→Commons) | 2:10 | Opus | 1,7 MB | ? | canal de drift | o 200SX S14 europeu usa **SR20DET**; o S13 usa CA18DET. Confirmar a geração no vídeo |
| | Nissan 200SX (S13) with modified exhaust (Adam Vrtílka) | https://commons.wikimedia.org/wiki/File:Nissan_200SX_(S13)_with_modified_exhaust_-_engine_and_exhaust_sound_(YouTube_QF3N_McYdwk).opus | CC BY 3.0 (YT→Commons) | 1:27 | Opus | 1,1 MB | ? | — | I4 turbo Nissan da mesma família (provável CA18DET) |
| | Peugeot 406 Turbo (HKS blow-off valve) (nick7100) | https://commons.wikimedia.org/wiki/File:Peugeot_406_Turbo_(turbocharged,_HKS_blow-off_valve)_-_engine_and_exhaust_sound_(YouTube_kx0Tvu4_K04).opus | CC BY 3.0 (YT→Commons) | 1:17 | Opus | 871 KB | ? | — | I4 turbo genérico **com BOV atmosférica HKS**: o "pssh" do Sylva |

> **Armadilha:** "Nissan Silvia - engine and exhaust sound" no Commons é um S15 com **1JZ (I6) swap**, segundo o título do vídeo de origem. Não é SR20.
> No Freesound não há SR20 nem Silvia com CC0/BY.

### I4 aspirado (pequeno 1.6 Miata e de giro alto) → perfis `i4-pequeno` (carro `roadster`) e `i4` (carros `ninja`, `alta`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Renault 19 underhood acceleration (lovretta) | https://freesound.org/people/lovretta/sounds/141240/ | **CC0** | 1:22 | FLAC 24-bit/44,1 kHz, estéreo | 14,9 MB | **VC + desaceleração** | C2J carburado de ~72 cv; partidas, derrapagem, **várias acelerações fortes até 6000 rpm, cada uma seguida de desaceleração até a lenta**, blips até 7000. Microfone barato no cofre, MiniDisc, para-vento ineficaz | o melhor CC0 para granular de I4 pequeno: tem **as duas bases (on-load e off-load)** do mesmo motor |
| ★ (giro alto) | 2002-Honda-F20C.ogg (Tyler Riddle) | https://commons.wikimedia.org/wiki/File:2002-Honda-F20C.ogg | CC BY 3.0 | 2:17 | OGG | 4,2 MB | ? (cofre) | F20C do S2000 gravado **no cofre** com Audio-Technica + interface USB; gravação própria | I4 aspirado de 9000 rpm, perfeito para o `ninja` (VTEC). Ouvir para ver se há varredura |
| | Mazda MX-5 Miata (Ride in Japan) | https://commons.wikimedia.org/wiki/File:Mazda_MX-5_Miata_-_engine_and_exhaust_sound_(YouTube_wKeTXxwpkS0).opus | CC BY 3.0 (YT→Commons) | 9:11 | Opus | 6,5 MB | ? | canal de passeios: **onboard provável, talvez com música** | o Miata do `roadster` |
| | Miata Start and Stop Exterior (TurboTheSergal) | https://freesound.org/people/TurboTheSergal/sounds/523352/ | CC BY 4.0 | 0:06 | MP3 323k, mono | 249 KB | 1 | MX-5 NA 1.6 europeu 1990, escape original (o autor confirma) | partida e desligamento do carro exato |
| | Zero car Toyota Corolla AE86 (Antti Lepänen) | https://commons.wikimedia.org/wiki/File:Zero_car_Toyota_Corolla_1600_GT_2_Door_AE86_J%C3%A4%C3%A4skyl%C3%A4n_Talviralli_2023_Kuohu.opus | CC BY 4.0 | 0:20 | Opus | 308 KB | P | AE86 no rali de inverno (gravação própria) | 4A-GE em carga, curto |

### I3 → perfil `i3`

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | HR12DE-March-K13.oga (Oq10pass) | https://commons.wikimedia.org/wiki/File:HR12DE-March-K13.oga | **CC0** | 0:26 | OGG | 1,5 MB | ? | Nissan March 1.2 aspirado (I3); o autor diz que o som foi **"tunado" (processado)** para realçar | o único I3 CC0 achado |
| | Volkswagen up! GTI (Supercars67) | https://commons.wikimedia.org/wiki/File:Volkswagen_up!_GTI_-_engine_and_exhaust_sound_(YouTube_X5nj5rDeoJI).opus | CC BY 3.0 (YT→Commons) | 0:38 | Opus | 568 KB | ? | nome de canal agregador: **risco** | I3 1.0 turbo (o perfil `i3` do jogo é turbo) |

### Rotativo (RX-7 / RX-8) → perfil `rotativo` (carro `rotor`)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Tipo | Qualidade | Por que serve |
|---|---|---|---|---|---|---|---|---|---|
| ★ | Mazda RX-7 (Taz Ringer) | https://commons.wikimedia.org/wiki/File:Mazda_RX-7_-_engine_and_exhaust_sound_(YouTube_4z0y1H2REvE).opus | CC BY 3.0 (YT→Commons) | 4:58 | Opus | 4,4 MB | ? | canal pessoal | o único rotativo longo com licença aberta |
| | Mazda RX-8 (cz125cz125) | https://commons.wikimedia.org/wiki/File:Mazda_RX-8_-_engine_and_exhaust_sound_(YouTube_u-Lc2Nt3OR8).opus | CC BY 3.0 (YT→Commons) | 0:25 | Opus | 363 KB | ? | canal pessoal | Renesis aspirado |

O Freesound (buscas "rotary", "wankel", "rx7", "rx8", "mazda") e o Pixabay ("rotary engine", "rx7") não retornaram nenhum rotativo real com CC0/BY.

### One-shots (todas as famílias)

| | Título (autor) | URL | Licença | Duração | Formato | Tamanho | Uso |
|---|---|---|---|---|---|---|---|
| ★ estouro | Car Antilag (No cleanup, 32float) (modusmogulus) | https://freesound.org/people/modusmogulus/sounds/797835/ | **CC0** | 0:11 | WAV 32f/48 kHz, estéreo | 4,1 MB | anti-lag/estouros brutos (Tascam X8): pops e ALS |
| estouro | car pass by - afterfire crackle…anti-lag (klankbeeld) | https://freesound.org/people/klankbeeld/sounds/873008/ | CC BY 4.0 | 0:12 | WAV 32-bit/48 kHz, estéreo | 4,4 MB | crepitar de "crackle map" (Polo/Golf) em passagem |
| ★ BOV | Turbo Spooling and Blow Off (EwanPenman11) | https://freesound.org/people/EwanPenman11/sounds/659544/ | **CC0** | 0:05 | WAV 16-bit/44,1 kHz, estéreo | 940 KB | spool + blow-off numa passagem (tem Doppler: usar só o "pssh") |
| ★ partida | Engine-Starter Grind (lonemonk) | https://freesound.org/people/lonemonk/sounds/167910/ | CC BY 4.0 | 0:01,7 | WAV 16-bit/44,1 kHz | 299 KB | motor de arranque girando (partida falhada de Ford 460) |
| partida | Car Ignition Key – Engine Starting Running Idle 2 (RutgerMuller), #50898 | https://freesound.org/people/RutgerMuller/sounds/50898/ | CC0 (já em `som-motor.md`) | 0:04,8 | WAV 16/44,1, mono | — | chave + arranque + pega |
| 2-step | subaru impreza…launch limiter (t33kno) | (ver boxer 4) | CC0 | — | — | — | limitador de largada |

**Loops de rpm constante (on-load e off-load):** nenhum foi achado como arquivo pronto. As fontes de "regime constante" são a **marcha lenta** (Chrysler pelo escape, Subaru, Ferrari 360) e, para os demais regimes, **ciclos extraídos das varreduras** (Parte B).

## A.3 Riscos e observações de licença

1. **YT→Commons.** Em outubro de 2026, um usuário do Commons ("Braiion", "for RevGuessr") subiu em massa ~500 trilhas de vídeos marcados como CC BY no YouTube. O Commons registra a licença do vídeo na época, com arquivo no archive.org, mas os arquivos estão em **"License review needed"** (pelo menos o do Silvia, conferido). O CC BY do YouTube **só vale se o canal for o autor da filmagem**. Prioridade:
   - **Mais confiáveis:** canais de spotters, oficinas e fabricantes com filmagem própria (Hungarian Supercar Spotters, FiExhaust, Heup Motorsport, Taz Ringer, KG's Garage, L'argus, Matteo Torrisi Officina, aTOz, Built For Drift).
   - **Evitar:** nomes de agregador ("Luxury Cars Videos", "Supercars1989", "DREAM CARS", "NISSAN CARS", "Car Trends", "NewsTechCars", "Supercars67", "Best Sport CARS Video", "Super Cars for you").
   - Além disso, essas trilhas foram reencodadas duas vezes (AAC do YouTube → Opus) e podem ter **fala ou música**.
2. **CC BY-SA** (arquivos Edvvc de Goodwood, Altair78, John64, Triumph I6): o arquivo de áudio derivado tem de sair como BY-SA, com crédito. Juridicamente é compatível com o jogo, mas cria uma licença a mais para rastrear em `CREDITS`.
3. **CC BY 3.0 × 4.0:** as duas exigem crédito com título, autor, link, licença e indicação de modificação. Formato sugerido para `CREDITS`: `"Título" — Autor — URL — CC BY 4.0 — cortado, filtrado e convertido para Opus`.
4. **Fontes fora do Freesound/Commons:**
   - **muted.io "Performance Cars"** é CC0: 68 amostras, 96 kHz/24-bit, estéreo, download gratuito via Ko-fi. A página **não lista os carros**, e o Ko-fi bloqueou leitura automática. Conferir à mão: pode cobrir várias famílias de uma vez.
   - **OpenGameArt** bloqueou leitura automática (403). Pelas listagens: "racing car engine sound loops" (CC0, variações só de pitch) e "Engine loop heavy vehicle/tank" (CC BY 3.0/GPL).
   - **Pixabay:** licença própria, não CC. Uso comercial sem crédito, com proibição de redistribuir o arquivo "standalone"; dentro de um jogo, pode. Muitos itens são espelhos "freesound_community", então é melhor ir ao original no Freesound para saber autor e licença. As buscas não acharam nada específico por família.
   - **BBC Sound Effects:** licença RemArc, **não comercial** (pessoal, educacional, pesquisa). Fica fora do jogo. A página de licença bloqueou leitura automática.
   - **Sonniss GameAudioGDC:** royalty-free, uso comercial dentro de jogos, sem crédito obrigatório; **proibido** revender ou redistribuir os arquivos como efeitos soltos e **proibido treinar IA** [G18]. As listas de conteúdo por ano ficam em planilhas externas, não conferidas. Nas buscas, as bibliotecas de carro da Sonniss (ex.: Audi R8 V10) apareceram como **produtos pagos**.

---

# Parte B — Como os jogos fazem som de motor a partir de gravações

## B.1 Panorama

| Técnica | Quem usa (fontes) | Gravação necessária | Prós | Contras |
|---|---|---|---|---|
| **Loops cruzados** por rpm, com conjuntos **on-load** e **off-load** | Forza 2/5 [G4][G3], Project CARS (>100 arquivos por carro) [G3], BeamNG [G9], Assetto Corsa (camadas idle/low/mid/high no FMOD) [G10], Chrome Racer (3 arquivos) [G8] | regimes fixos em dinamômetro, ou rampas cortadas em loops | barato em CPU; previsível; ferramentas prontas (blend tracks) | 3–4 dias de edição por carro [G3]; phasing nos crossfades; chipmunk/muddy se o pitch esticar demais [G3] |
| **Granular síncrono ao ciclo** | Crankcase REV (Wwise) [G3][G5], AudioMotors (FMOD) [G6], TONIC (Black Rock) [G7], HSOLA (acadêmico) [G1], patente Harman [G2] | **uma rampa** de aceleração e outra de desaceleração | ~10 min por carro [G3]; sem loops audíveis; preserva o timbre real em cada rpm | precisa de análise precisa (rpm e fronteiras de ciclo); pode soar "sintético" sem cuidado [G3] |
| **Granular ingênuo** (grãos de duração fixa em ms) | script Unity de exemplo [G11]; protótipo indie [G12] | rampa | simples | corta pulsos no meio: ritmo irregular e "sci-fi" [G11] |
| **Síntese / modelo físico** | GT7 (sintetizador por modelagem física sem formas de onda gravadas, CEDEC 2024; sistema GTES) [G13][G14]; AutoDash hoje | nenhuma (ou só para calibrar) | leve; caráter controlável por parâmetro | difícil soar "gravado" |
| **Aditiva dirigida por análise** | Doerfler & Wyse 2026 [G15] | gravações + traços de rpm/torque | parâmetros por ordem do motor | precisa de muitas ordens (128 osciladores) e tabelas por rpm × torque |

**Nota sobre Audiokinetic:** o "Wwise Motion" é o produto de **vibração e háptica** (force feedback), não de som de motor. No Wwise, o motor de carro sai de três caminhos:
- **Blend Containers** com loops [G16];
- o plug-in **Crankcase REV** [G5];
- o **SoundSeed Grain**, um granular genérico [G17]. Nele, a posição de leitura pode ir num RTPC ligado ao rpm, e o início dos grãos pode "grudar" em **marcadores** (detecção de transientes ou marcadores embutidos no arquivo). Não há um modo "síncrono ao ciclo" documentado.

## B.2 Loops cruzados: como os AAA fazem

- **Regimes:** a carga tem três estados: on-load, off-load e regime constante. O **regime constante costuma ser uma mistura sutil de on e off** [G4b]. On-load se grava em rampa subindo; off-load, em rampa descendo [G4b]. Dinamômetro hidráulico (DynaPack) é silencioso, mas **não desacelera o motor** [G4b].
- **Mapa:** cada loop tem um rpm "natural" e deve ter pitch o mais estático possível ao longo do loop [G16]. O jogo ajusta `playbackRate = rpm / rpmDoLoop` e cruza com o vizinho. O Forza 2 mapeava os loops para faixas de rpm da física e gravava "o mais alto possível no conta-giros" [G4].
- **Fórmula do slide do Forza:** o slide traz "RPM = FundamentalFrequency*60 #of cylinders" [G4]. Para quatro tempos, a fórmula correta é `rpm = 120·f_ign / N` (a de `som-motor.md` §1.1). O slide parece perder o fator 2 ou se referir a outra ordem.
- **Camadas** (Forza 5): motor, admissão, escape, transmissão, turbo e compressor como fontes separadas, com rpm próprio para motor, turbo, compressor e transmissão, mais acelerador, carga, torque, pressão de turbo, embreagem e marcha [G3]. O escape muda com acelerador, carga, marcha e boost, e tem burble/backfire na desaceleração [G3]. No Forza 2, o whine de transmissão era dirigido por `EngineRPM` e `TransmissionRPM` [G4].
- **BeamNG** [G9]:
  - duas camadas, `soundConfig` (motor e admissão, perto do cofre) e `soundConfigExhaust` (escape, a maior parte do volume externo);
  - cada uma com conjunto on-load e off-load, misturados por `maxLoadMix` e `minLoadMix`;
  - exemplo de valores: `onLoadGain` 1, `offLoadGain` 0,4, `maxLoadMix` 0,67, `minLoadMix` 0, `mainGain` −9 dB no motor e +2 dB no escape;
  - um parâmetro `fundamentalFrequencyCylinderCount` (o nº de cilindros **da fonte gravada**) e `eqFundamentalGain` (realçar ou cortar a ordem de ignição);
  - suavizadores separados para rpm e carga, com entrada e saída;
  - partida, desligamento, afterfire, turbo, compressor e transmissão ficam "em volta" das duas camadas.
- **Assetto Corsa** (modders) [G10]: camadas idle/low/mid/high suavizadas no FMOD. O volume on-throttle escala com o torque. No off-throttle, o escape fica bem mais alto que o motor. Há camadas separadas de escape e de cofre, com cone de 180° para o motor dianteiro.
- **Chrome Racer** (Web Audio, o caso mais próximo do AutoDash) [G8]:
  - só 3 arquivos: "acelera e loop" (com loop de 5 a 9 s), "desacelera" e "lenta";
  - o acelerador vira **posição de leitura** no arquivo de aceleração: `start = throttle × 3 s`;
  - ao soltar o pedal, guarda a posição e toca a desaceleração;
  - o time tentou 5–6 arquivos por camada com crossfade e "crosspitch" e achou "decepcionante", porque o crosspitch "não pode ser largo demais ou soa sintético".
- **Ferramenta de loops a partir de rampa** (Tazman Engine Loop Creator) [G19]:
  - FFT da rampa, escolha de um harmônico de referência (de preferência a fundamental) e **"achatamento" do pitch** do loop por esse traço;
  - marcadores em cruzamentos de zero **e em ciclos regulares do motor** (por nº de cilindros e tempos);
  - **ajustar o nº de cilindros reduz o phasing no crossfade**, porque as fronteiras caem no mesmo ponto do ciclo;
  - o rpm-base do loop é o do centro da região.
- **Dica do Audiokinetic:** desenhar os loops para que os crossfades on/off-load **nunca coincidam** com os de rpm [G16]. Conferir a afinação ao longo de toda a faixa, ajustando o pitch no ponto de sobreposição até os dois loops "baterem" [G16].
- **Microfones:** os slides do Forza citam a regra **3:1** de coerência de fase entre microfones e um pad de −20 dB [G4]. O artigo de captação cita escape, admissão e cockpit como as posições mínimas, com windjammer obrigatório e longe do calor do escape [G4b].

## B.3 Granular síncrono ao ciclo: o que se sabe dos produtos

- **REV (Crankcase):**
  - rastreia as componentes harmônicas de uma rampa e fatia "na granularidade de pistões individuais disparando" [G3];
  - os ciclos podem ser **pulados** (tocar mais rápido), **repetidos** (mais devagar), segurados ou invertidos [G3];
  - tem câmbio e embreagem virtuais e mistura em camadas de load e offload [G3];
  - parâmetros de jogo: rpm, acelerador e carga/torque [G5];
  - custo indie citado em 2018: US$ 1500 pelo motor (1ª plataforma), US$ 1500 pelo editor e US$ 750 por plataforma adicional [G12].
- **AudioMotors (AudioGaming, FMOD):**
  - analisa uma gravação "subindo e descendo de giro" e acha **automaticamente** as posições dos grãos, um por ciclo de combustão, "síncronas ao pitch (rpm)"; a análise sai em SDIF e pode ser corrigida à mão [G6];
  - parâmetros: **nº de cilindros e nº de voltas por evento de ignição** (para converter Hz em rpm), "harmonic factor", "grain factor" e aleatorização; controle de "drive" para carga on/off, com efeitos de carga em aceleração, desaceleração e trocas [G6];
  - usado no WRC 5 (`som-motor.md` [F25]).
- **TONIC (Black Rock, Split/Second):** analisa varreduras "do mínimo ao máximo e de volta à lenta" e monta um **banco de ciclos** que o motor costura em tempo real; permite misturar gravações de carros diferentes em motores "híbridos" [G7].
- **HSOLA (Jagla, Maillard e Martin, JASA 2012)** [G1]: cada amostra "contém o som emitido durante **um ciclo do motor** mais a sobreposição necessária para transições suaves". Extraída de **uma** gravação com rotação variando continuamente, ela sintetiza mudanças de rotação arbitrárias. É uma extensão do PSOLA da fala, e o artigo se declarava "patent pending" em 2012. O texto completo (HAL) bloqueou leitura automática, então janela e sobreposição exatas **não foram conferidas**.
- **Patente Harman US 12.243.510 B2** (concedida em 2025, prioridade 2021) [G2]: síntese de som de motor por PSOLA. Ela mostra parâmetros concretos:
  - marcas de pitch por autocorrelação, segmentos de um período e janela de **2–3× o comprimento do segmento**;
  - pitch alterado **pelo espaçamento** dos segmentos sobrepostos, **sem reamostrar**;
  - amostras base em **passos de 500 rpm de 0 a 9000** (19 pontos);
  - faixas grandes divididas em regiões com amostras próprias (ex.: 500→5000 rpm em três regiões);
  - janelas pré-aplicadas offline.

  É do mundo de som sintético para carro elétrico/real (ESE) e serve como **referência de números**. Os riscos de patente estão na seção B.9.

## B.4 Camadas típicas

| Camada | Fonte física | Gravação | Dirigida por | No AutoDash (sugestão) |
|---|---|---|---|---|
| Escape | pulsos de escape, tubo, abafador | mic atrás/ao lado da ponteira | rpm, carga, acelerador; burble/estouro no off-load [G3] | granular (ou a síntese atual) |
| Admissão / cofre | ruído de admissão, comando, injetores | mic no cofre (perto do filtro/borboleta) | rpm, acelerador | granular de gravação "underhood" (Renault 19, Studebaker, F355, F20C) |
| Bloco / estrutural | vibração | contato (ex.: Mini Cooper S CC0 de `som-motor.md`) | rpm | só para câmera interna |
| Transmissão | engrenamento dos dentes | cockpit/assoalho | rpm do motor e da transmissão [G4] | síntese: `f = rpm/60 × relação × nº de dentes` **(estimativa)** |
| Turbo / compressor | eixo, pás, BOV, surge | mic na admissão do turbo [G3] | rpm do turbo, boost, acelerador [G3][G4] | síntese (já existe) + one-shot de BOV |
| Pneus, vento | — | — | slip, velocidade | síntese (já existe) |

## B.5 On-load × off-load

- **Duas bases de grãos** (ou dois conjuntos de loops): on-load, de aceleração em marcha ou dinamômetro, e off-load, de desaceleração com o pé fora (motor arrastado pelas rodas) [G4b][G9]. **Aceleradas em ponto morto não são on-load:** a carga é quase só a inércia, o timbre fica mais "vazio" e cada blip dura pouco (poucos ciclos por faixa de rpm, ver B.7).
- **Mistura:** `peso_on = clamp(minLoadMix + (maxLoadMix − minLoadMix)·carga)` à moda do BeamNG [G9], com a carga suavizada (τ ~60 ms, como em `som-motor.md` §5.2). Grãos on e off do mesmo rpm **não são coerentes entre si** (vêm de passagens diferentes), então a mistura entre as bases usa **ganho de potência constante** (equal-power). Já entre grãos consecutivos da mesma base, usa-se **ganho constante** (linear), como explicado em B.8.
- **Partial throttle:** é só um valor intermediário de carga. O Racer resolveu sem mistura, só trocando de arquivo e guardando a posição [G8].
- **Overrun:** os estouros entram como one-shots aleatórios no off-load acima de um rpm, como já faz a síntese, independentes da base granular.

## B.6 Estimar a curva de rpm de uma gravação (rastreio da ordem de ignição)

Objetivo: obter `rpm(t)` e, mais importante, o **ângulo do virabrequim θ(t)**, que dá as fronteiras exatas de ciclo.

**Relações** (de `som-motor.md` §1.1):
- Quatro tempos: `f_ign = rpm/60 × N/2`, logo `rpm = 120·f_ign/N`. O ciclo dura `720°`, ou `T_ciclo = 120/rpm` s: 133 ms a 900 rpm, 40 ms a 3000 e 13,3 ms a 9000.
- Ordem k: `f_k = k·rpm/60`. A ordem de ignição é `N/2` (I4 → 2; V8 → 4; V10 → 5; I5 → 2,5).
- Rotativo de 2 rotores: um pulso por rotor por volta do eixo, `f_ign = 2·rpm/60` (ordem 2), e o "ciclo" que se repete é uma volta do eixo (360°). Para o granular, usar 2 voltas mesmo assim, para capturar a diferença entre os rotores.

**Pipeline offline** (script Node ou Python que gera um JSON de grãos; números **(estimativa)** salvo indicação):

1. **Preparar:** mono, 48 kHz, passa-alta 20 Hz. Remover trechos com Doppler (passagens) e cortar o topo distorcido (ex.: o Supra no dinamômetro).
2. **Espectrograma:** STFT com janela Hann de 4096 amostras (85 ms; bin de 11,7 Hz), hop de 256 (5,3 ms), zero-padding ×4 e interpolação parabólica do pico. A janela precisa cobrir ~2–3 ciclos na lenta; numa rampa rápida, compensa rastrear uma **ordem alta** (2× ou 3× a de ignição), que tem mais Hz por rpm.
3. **Saliência por soma harmônica** em uma grade de rpm (lenta…corte, passo de 5–10 rpm):
   `S(t, r) = Σ_{h=1..H} w_h · |X(t, h·f_ign(r))|^0,5`, com `w_h = h^−0,3` e H até ~2 kHz.
   Somar todos os múltiplos da ordem de ignição **evita o erro de oitava** (travar na metade ou no dobro). Somar também as meias-ordens (`k·rpm/120`) com peso menor ajuda nos motores irregulares (V8 cruzado, boxer UEL, I5).
4. **Viterbi** (programação dinâmica, como no rastreio de cristas do [G20] e no `rpmtrack` [G21]): custo `−log S + λ·|Δr|`, com `|Δr|` máximo por hop de ~25 rpm em aceleração em marcha (≈ 5000 rpm/s) e ~100 rpm em blip de ponto morto (≈ 20 mil rpm/s). Restringir ao intervalo do motor (lenta…corte) e, numa rampa, usar prior de monotonicidade.
5. **Refino por fase:** demodular a ordem rastreada (heterodinar por `exp(−j·2π∫h·f_ign dt)`, passa-baixa de ~20 Hz) e somar a fase residual. Alternativa: filtro de Vold-Kalman, como o `rpmtrack` faz no segundo estágio (crista grossa → forma de onda da ordem por Vold-Kalman → crista fina) [G21]. O resultado é a fase contínua da ordem, `Φ_h(t)`.
6. **Ângulo do virabrequim:** `θ(t) = Φ_h(t) / (2π) × 720° / (h·N/2)`, em graus. A ordem de ignição avança 2π a cada `720/N` graus. Derivando, `rpm(t) = (dθ/dt)/6`.
7. **Validar:**
   - com uma gravação que tenha verdade de referência: o pack Volvo S60 da el-bee (CC BY-NC) tem **marcadores de rpm** nas rampas e pode ser usado **só para teste**;
   - pela coerência: cortar ciclos a cada 720° e medir a correlação normalizada entre ciclos vizinhos; esperar > 0,8 **(estimativa)**. Queda brusca indica deslize de fase (um ciclo a mais ou a menos).
8. **Ambiguidade de θ0:** a fase da ordem de ignição só define θ módulo `720/N`. Dentro de **uma** gravação isso não importa, porque θ é contínuo e todos os ciclos ficam cortados no mesmo ponto. **Entre bases** (on × off, escape × admissão), é preciso alinhar o cilindro de partida: correlacionar um ciclo de cada base em rpm parecido e deslocar θ0 em múltiplos de `720/N` até a correlação máxima. Sem isso, o padrão irregular do V8 cruzado "pula" ao trocar de base.

## B.7 Cortar os grãos

- **Tamanho do grão = 1 ciclo completo (720°).** Um grão de um só intervalo de ignição (`720/N`) apagaria as meias-ordens, e o V8 cruzado, o boxer UEL e o I5 perderiam o caráter. O REV fala em fatias por pistão [G3] e o HSOLA em um ciclo por amostra [G1]. Para o AutoDash, o ciclo inteiro é o mais seguro.
- **Onde cortar (θ0):** no ponto de **menor energia** do ciclo. Calcular a média síncrona do envelope (RMS em função de `θ mod 720`) e escolher o mínimo, em geral logo antes de um pulso. O crossfade cai então na cauda de um pulso, não no ataque. Ajuste fino de ±2–5% do período por correlação cruzada com o ciclo anterior (a ideia do WSOLA), em vez de cruzamento de zero.
- **Sobreposição:** duas opções.
  - **(a) Concatenativa:** grão = 1 ciclo + cauda de sobreposição de `L_ov = clamp(0,2·T_ciclo; 2 ms; T_ciclo/N)`, com **crossfade linear** (ganho constante). Ciclos vizinhos alinhados são coerentes, e um crossfade de potência constante daria um "calombo" de +3 dB a cada junção, ouvido como trêmulo na taxa de ciclo **(estimativa)**.
  - **(b) Estilo PSOLA:** janela Hann de 2 ciclos centrada na marca, com passo de 1 ciclo. Hann a 50% soma 1, então não há modulação de nível. Média 2 ciclos e suaviza a variação ciclo a ciclo. É o que a patente Harman descreve com janela de 2–3 períodos [G2].
- **Densidade de grãos:** uma rampa de 1000→7000 rpm em 8 s tem ~`8 × 4000/120 ≈ 267` ciclos. O passo entre grãos vizinhos é de ~22 rpm: ~2% a 1000 rpm e ~0,3% a 7000. Se o jogo escolhe o grão mais próximo, a reamostragem necessária fica **≤ ±1%**, inaudível como "chipmunk".
  - Um blip em ponto morto de 1000→6000 em 0,5 s tem só ~29 ciclos, com passo de ~170 rpm (3–17%). Por isso as **varreduras lentas em carga** valem mais que blips.
- **Tabela gerada:** para cada grão, `{início (amostra), comprimento, rpmMedio, carga: "on"|"off", camada}`, mais a gravação reamostrada mono. Tamanho estimado: 10 s em Opus 96 kbps ≈ 120 KB por camada e base. Com escape + admissão e on + off, ≈ 0,5 MB por motor **(estimativa)**. Os 19 perfis não precisam de 19 gravações: famílias compartilham base com EQ diferente, e o arquivo carrega sob demanda (custo zero, ADR 0004).

## B.8 Síntese em tempo real (AudioWorklet)

```
estado: φ (graus, 0..720), grãoAtual, posLeitura, grãoAnterior (para a cauda)
a cada amostra:
  φ += 6·rpm·dt
  se φ ≥ 720:                          // novo ciclo
     φ -= 720
     candidatos = grãos da base (on/off) com |rpmMedio − rpm| mínimo (k=3..5 mais próximos)
     g = sorteio entre os candidatos, sem repetir o anterior   // evita "metralhadora" em rpm constante
     ρ = rpm / g.rpmMedio              // reamostragem pequena (≤ ~1–2%)
     começa g em posLeitura = g.início; o grão anterior continua só na cauda L_ov
  saída = ler(g, posLeitura) · rampaEntrada + ler(anterior, posCauda) · rampaSaída   // linear
  posLeitura += ρ (interpolação cúbica Hermite)
mistura on/off: duas instâncias do laço acima (uma por base), peso equal-power pela carga
```

- O tempo de cada grão é `T_ciclo(rpm)`. Como `ρ = rpm/rpm_grão`, o grão reamostrado dura exatamente um ciclo no rpm-alvo, e a fase do jogo e a do grão andam juntas.
- **Acima ou abaixo do que foi gravado** (ex.: a gravação vai a 6000 e o perfil a 8500): três opções.
  - Esticar `ρ` até ~+10–15% **(estimativa)**.
  - Usar o modo PSOLA: espaçar os grãos mais perto **sem reamostrar**. O pitch sobe e as ressonâncias do escape ficam no lugar, o que é fisicamente certo, porque tubo e abafador não mudam com o rpm [G2].
  - Cruzar para a síntese atual.
- **Mudanças bruscas** (troca de marcha, limitador): o granular só pula para o grão do novo rpm. Para o limitador, **pular ciclos** (silenciar 1 a cada 2–3) dá o "brap" (`som-motor.md` §7).
- **Por que no worklet:** a taxa de grãos é `rpm/120`, só 75 por segundo a 9000 rpm, mas a junção precisa ser exata à amostra. Agendar `AudioBufferSourceNode` pela thread principal sofre com o jitter do frame. A gravação decodificada (`decodeAudioData`) vai uma vez para o worklet por `postMessage` (Float32Array).

## B.9 Truques contra "phasing" e "chipmunk"

1. **Não esticar o pitch:** o chipmunk vem de reamostrar demais, porque as ressonâncias (que deveriam ficar fixas em Hz) sobem junto. O granular resolve **escolhendo o grão do rpm certo** (B.7). Em loops, limitar o esticamento: o Racer descreve o crosspitch largo como "sintético" [G8], e o artigo do Designing Sound cita loops antigos "muddy" no grave e "chipmunk" no agudo [G3]. Sugestão: loops em **progressão geométrica** de ~+15% de rpm, o que limita a reamostragem a ±7,5% e dá ~16 loops de 900 a 8000 rpm por base de carga **(estimativa)**.
2. **Afinar o rpm natural de cada loop ou grão pela análise** (B.6), não pelo conta-giros do vídeo. Um erro de 1% no rpm natural vira batimento entre dois loops no crossfade (ex.: 3 Hz a 300 Hz).
3. **"Achatar" o pitch dentro de cada loop** (time-warp pelo traço de rpm) antes de usar [G19]. Um loop gravado em "regime constante" sempre deriva um pouco.
4. **Loops com número inteiro de ciclos de 720°, cortados no mesmo θ0:** assim dois loops vizinhos estão **em fase** no crossfade, e um crossfade linear não faz filtro pente. É por isso que a ferramenta da Tazman pede o nº de cilindros [G19] e o BeamNG pede `fundamentalFrequencyCylinderCount` [G9]. Se não der para alinhar, usar crossfade equal-power **curto**.
5. **Nunca cruzar rpm e carga ao mesmo tempo** [G16]: escalonar as zonas de crossfade on/off e de rpm.
6. **Microfones:** não somar dois microfones correlacionados sem compensar o atraso (regra 3:1 [G4]). Melhor um microfone por camada (escape, admissão) e mixar pela câmera.
7. **Variação sem loop audível:** em rpm constante, sortear entre os 3–5 grãos mais próximos sem repetir o anterior. Somar jitter de ±0,3% em `ρ` e ±0,5 dB **(estimativa)**. O script de Unity aleatoriza levemente o rpm de busca pelo mesmo motivo [G11].
8. **Ruído de fundo da gravação:** vento, pneu e público viram um chiado que "bombeia" a cada troca de grão. Pré-processar com redução espectral leve e preferir gravações de cofre, dinamômetro ou ponto morto, ou ainda "underhood": o Renault 19 tem para-vento ineficaz, então é preciso limpar.
9. **Grão de duração fixa em ms (granular ingênuo)** corta pulsos no meio. O próprio autor do script de Unity avisa que motores com pulsos audíveis soam irregulares e "sci-fi" [G11], e o protótipo indie com saltos duros entre marcadores dava cliques audíveis [G12]. Por isso, grão síncrono ao ciclo e com crossfade.
10. **Patentes:** granular de motor e PSOLA de motor têm patentes da indústria. A Harman tem a US 12.243.510 [G2], e o HSOLA era "patent pending" em 2012 [G1]. PSOLA e OLA são técnicas antigas e genéricas, mas, se o jogo um dia for comercial, vale uma checagem. **Não é parecer jurídico.**

## B.10 Gravar o próprio carro (opção de custo zero)

Se nenhuma gravação livre servir para um perfil, a receita dos profissionais [G4b][G3] adaptada ao celular **(estimativa)**:
- **Dois microfones/celulares**, um no escape (a ~50 cm, de lado, nunca no jato quente) e um no cofre (perto do filtro de ar). Para-vento de espuma ou "pelúcia".
- **Rampas em 2ª ou 3ª marcha** em subida leve (carga alta, rampa lenta de ~6–10 s da lenta ao corte), depois tirar o pé e deixar descer até a lenta (off-load). 3–5 repetições. Anotar o rpm em voz alta ou filmar o conta-giros para validar o rastreador.
- **Ponto morto:** lenta de 30 s (loop de lenta) e blips (one-shots).
- Sem música, sem conversa, motor quente.

---

## Tabela-resumo: melhor candidato por família

| Família → perfis | ★ Melhor | Licença | Tamanho | Tipo |
|---|---|---|---|---|
| V8 cruzado → `v8-cruzado`, `v8-cruzado-ford` | 1953 Studebaker Idle up to 6000rpm (lonemonk) | CC BY 4.0 | 1,2 MB | varredura em ponto morto (cofre) |
| V8 plano → `v8-plano` | Ferrari 360 Spider - engine sound (PritzProductions) | CC0 | 10,4 MB | carro parado, de perto |
| V6 → `v6` | DeLorean DMC-12 (V6 PRV) (SkyernAklea) | CC BY 4.0 | 29,6 MB | lenta/aceleradas (V6 irregular) |
| V6 biturbo → `v6-biturbo` | mercedes benz c43 AMG exhaust rev slow rear (jerry.berumen) | CC BY 4.0 | 12,7 MB | aceleradas lentas pelo escape |
| V10 → `v10` | Audi R8 Idling Reving Backfire (Jonas_Jocys) | CC BY 4.0 | 35,3 MB | lenta/aceleradas/estouro (confirmar V10) |
| V12 → `v12` | Lambo idle and rev (cheesepuff) | CC0 | 2,0 MB | lenta/aceleradas (qualidade de vídeo) |
| W16 → `w16` | Bugatti Chiron (aTOz, YT→Commons) | CC BY 3.0 | 1,5 MB | ? (risco de proveniência) |
| I6 → `i6`, `i6-corrida` | Import car revs on Chassis Dyno with Turbo (editboy23) | CC0 | 6,5 MB | **dinamômetro, em carga** |
| Flat-6 → `boxer6`, `boxer6-turbo` | vehicle car porsche 911 revving… (jerry.berumen) | CC BY 4.0 | 14,5 MB | aceleradas |
| Boxer 4 → `boxer4` | WRX - Exhaust sounds (ulose2piranha) | CC0 | 6,0 MB | lenta/aceleradas, turbo |
| I5 → `i5` | RG Volvo Engine (cmusounddesign) | CC BY 4.0 | 5,4 MB | cofre, turbo |
| I4 turbo → `i4-turbo` | Nissan 200SX (Built For Drift, YT→Commons) | CC BY 3.0 | 1,7 MB | ? (confirmar SR20) |
| I4 pequeno → `i4-pequeno` | Renault 19 underhood acceleration (lovretta) | CC0 | 14,9 MB | **acelerações em carga + desacelerações** |
| I4 giro alto → `i4` | 2002-Honda-F20C.ogg (Tyler Riddle) | CC BY 3.0 | 4,2 MB | cofre |
| I3 → `i3` | HR12DE-March-K13.oga (Oq10pass) | CC0 | 1,5 MB | ? (processado) |
| Rotativo → `rotativo` | Mazda RX-7 (Taz Ringer, YT→Commons) | CC BY 3.0 | 4,4 MB | ? (risco de proveniência) |
| One-shots | Car Antilag (CC0), Turbo Spooling and Blow Off (CC0), Engine-Starter Grind (CC BY 4.0) | — | 4,1 MB / 940 KB / 299 KB | estouro / BOV / partida |

**Próximo passo sugerido:** o dono ouve os previews dos ★. Para os aprovados, baixar só o trecho útil, registrar em `CREDITS` e rodar o rastreador de rpm (B.6) primeiro no pack Volvo da el-bee (verdade de referência, só para teste) e depois no Supra no dinamômetro e no Renault 19.

---

## Fontes

**Gravações (páginas conferidas em 14/11/2026)**
- Freesound: as URLs de cada som estão nas tabelas da Parte A. Buscas usadas: `https://freesound.org/search/?q=<termo>&f=license:("Creative Commons 0" OR "Attribution")`.
- Wikimedia Commons, categoria "Sounds of automobiles" (617 arquivos): https://commons.wikimedia.org/wiki/Category:Sounds_of_automobiles. Metadados (licença, autor, tamanho, duração) obtidos pela API `imageinfo/extmetadata`. A página do Silvia mostra a nota "License review needed" e a origem 1JZ: https://commons.wikimedia.org/wiki/File:Nissan_Silvia_-_engine_and_exhaust_sound_(YouTube_ugy3NWCI7H8).opus
- muted.io "Performance Cars" (CC0, 68 amostras): https://muted.io/performance-cars
- OpenGameArt (bloqueado para leitura automática): https://opengameart.org/content/racing-car-engine-sound-loops
- Pixabay Content License: https://pixabay.com/service/license-summary/
- [G18] Sonniss GameAudioGDC (licença, cláusula de IA): https://sonniss.com/gameaudiogdc

**Técnica**
- [G1] Jagla, Maillard, Martin (2012), "Sample-based engine noise synthesis using an enhanced pitch-synchronous overlap-and-add method", JASA 132(5):3098–3108, doi:10.1121/1.4754663. HAL: https://hal.archives-ouvertes.fr/hal-00730614 · versão ICASSP 2012 (HSOLA): https://hal.archives-ouvertes.fr/hal-00661228v2. Só o resumo foi lido; o texto completo bloqueou leitura automática.
- [G2] Patente US 12.243.510 B2 (Harman), "Methods and systems for engine sound synthesis": https://patents.google.com/patent/US12243510
- [G3] Designing Sound, "Vehicle Engine Design: Project CARS, Forza Motorsport 5 and REV" (2014): https://designingsound.org/2014/08/11/vehicle-engine-design-project-cars-forza-motorsport-5-and-rev/
- [G4] Slides GDC 2007, "Advanced Audio Techniques for Forza Motorsport 2" (cópia em sambuz): https://www.sambuz.com/doc/forza-motorsport-2-pdf-document-839764
- [G4b] Game Developer, "Capturing Engine Sounds for Games": https://www.gamedeveloper.com/audio/capturing-engine-sounds-for-games
- [G5] Audiokinetic, plug-in Crankcase REV: https://www.audiokinetic.com/products/plug-ins/crankcase-rev/ · REV2: https://www.audiokinetic.com/en/make-racing-engine-sound-based-on-rev2/ (403 para leitura automática) · Unity: https://github.com/CrankcaseAudio/CrankcaseAudioREVUnity
- [G6] MCV, "How to make racing car engines roar using AudioMotors & FMOD": https://www.mcvuk.com/development/how-to-make-racing-car-engines-roar-using-audiomotors-fmod
- [G7] MCV, Black Rock (Split/Second), ferramenta TONIC: https://mcvuk.com/?p=123130
- [G8] web.dev, "Case Study - The Sounds of Racer": https://web.dev/racer-sound
- [G9] BeamNG, "Engine Sound Tuning": https://documentation.beamng.com/modding/vehicle/sections/sounds/engine_audio/ · wiki "Sound": https://wiki.beamng.com/Sound
- [G10] Assetto Corsa Mods, guias de som FMOD: https://www.assettocorsamods.net/goto/post?id=8825 e https://assettocorsamods.net/posts/9710/
- [G11] jonas-hack, "granular-synthesis-for-engine-audio" (Unity): https://github.com/jonas-hack/granular-synthesis-for-engine-audio
- [G12] Imphenzia, "That's Racing – Engine Audio" (devlog): https://imphenzia.itch.io/thats-racing/devlog/37275/engine-audio
- [G13] GDC Vault 2024, "Gran Turismo 7: Sound Design of the Real Driving Simulator": https://gdcvault.com/play/1034189/-Gran-Turismo-7-Sound
- [G14] GTPlanet, Polyphony explica o som do GT7 (ASJ, set/2026): https://www.gtplanet.net/polyphony-digital-explains-how-gran-turismo-7-engine-sounds-work-reveals-lotus-evora-and-amg-one-20260925/ (403 para leitura automática; resumo pela busca)
- [G15] Doerfler & Wyse (2026), "Analysis-Driven Procedural Generation of an Engine Sound Dataset with Embedded Control Annotations", arXiv:2603.07584: https://arxiv.org/html/2603.07584v1
- [G16] Audiokinetic, "Loop-Based Car Engine Design with Wwise" partes 1 e 2: https://audiokinetic.com/loop-based-car-engine-design-with-wwise-part-1 e https://www.audiokinetic.com/en/loop-based-car-engine-design-with-wwise-part-2 (403 para leitura automática; dicas pelo resumo da busca e por `som-motor.md` [F25])
- [G17] Audiokinetic, SoundSeed Grain: https://www.audiokinetic.com/products/plug-ins/soundseed-grain/ · "The Making of SoundSeed Grain": https://www.audiokinetic.com/en/the-making-of-soundseed-grain/
- [G19] Tazman Audio, Engine Loop Creator, "Overview": https://tazman-audio.screenstepslive.com/m/120646/l/1745172-overview
- [G20] Rastreio de cristas por programação dinâmica (rotação de fan a partir de áudio de sobrevoo), J. Aircraft, doi:10.2514/1.C037371: https://www.citedrive.com/en/discovery/estimation-of-the-fan-rotational-speed-using-flyover-audio-recordings/
- [G21] MathWorks, `rpmtrack` (crista grossa por STFT/FSST com penalidades + Vold-Kalman): https://ch.mathworks.com/help/signal/ref/rpmtrack.html
