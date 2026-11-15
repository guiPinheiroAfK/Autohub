# tools/som — banco de grãos do motor gravado

Transforma uma gravação de motor (acelerando e soltando) no banco que
`src/game/autodash/sound/motor-gravado.ts` toca em qualquer giro. Roda uma vez,
fora do jogo; o resultado vai para `public/autodash/som/`.

Precisa de Python 3 com `numpy`, `scipy` e `matplotlib`, e do `ffmpeg` no PATH.
Use `python -P` (não põe a pasta do script no caminho de importação).

## Etapas

1. **`rastrear.py`**: acha a frequência de explosão (giro/60 × cilindros/2) ao
   longo da gravação. Usa soma harmônica no espectrograma e Viterbi para seguir a
   linha sem saltos. Gera `<prefixo>_trilha.npz` e um PNG para conferir a olho.
   Restrições opcionais por trecho (ex.: a lenta, onde a linha forte é a 4ª
   harmônica) evitam erro de oitava.
2. **`marcas.py`**: refina a fase da explosão (heteródino na trilha + passa-baixa)
   e marca cada explosão com precisão de sub-amostra. Classifica cada marca: carga
   (giro subindo), alívio (caindo) ou estável.
3. **`banco.py`**: recorta os trechos úteis, gera o MP3 (com um clique de
   alinhamento em 0,1 s: o jogo o acha e corrige o atraso do codificador) e o JSON
   de grãos `[centro, período esq., período dir., Hz, classe, ganho]`.

## Renault 19 (r19-i4), como foi gerado

Fonte: Freesound #141240, "Renault 19 underhood acceleration", de lovretta (CC0),
prévia HQ em MP3, convertida para WAV mono 48 kHz com
`ffmpeg -i 141240_581937-hq.mp3 -ac 1 -ar 48000 r19.wav`.

```bash
python -P rastrear.py r19.wav renault 18 300 26 "0-3.55:22-32;25.5-30.2:22-32"
python -P marcas.py r19.wav renault "0.6-19.4,25.6-80.5"
python -P banco.py r19.wav renault "0.6-19.4,25.6-58,74-80.5" ../../public/autodash/som r19-i4 32000
```

Resultado: 58 s, 6264 grãos (2749 de alívio, 2161 de carga, 1354 estáveis), de
25 a 244 Hz de explosão (≈ 750 a 7300 rpm), MP3 de 112 kbps com ~800 KB.

## Grão por ciclo (V8, boxer, 6 em linha)

Em motor de explosão desigual o caráter (o "burble" do V8 cruzado, o ronco do
boxer) está no padrão do ciclo inteiro, não em cada explosão. Por isso o grão
pode cobrir `k` períodos da linha rastreada (`marcas.py ... k`) e o banco diz
quantas voltas do virabrequim cada grão representa (`banco.py ... voltas`):
0,5 = uma explosão de 4 em linha; 2 = o ciclo de 720°.

Como escolher `k`: `periodo.py` (no scratch da sessão; a ideia é a correlação
entre trechos separados por m períodos da linha) mostra em que múltiplo a onda
se repete de verdade. O `k` precisa ser múltiplo desse período.

Rastreamento em varreduras lentas ou com linhas muito juntas:
- `SALTO=0.012` limita o salto por quadro (não pula para a linha vizinha);
- `PRIOR="t:hz,t:hz,..."` + `BANDA=0.08`: trilha aproximada lida a olho no
  espectrograma, a busca fica perto dela;
- `MODO=pente`: rastreia o espaçamento entre todas as linhas (ambíguo entre
  múltiplos: use junto com `PRIOR`).
- `marcas.py ... k H`: no modo pente, refina a fase na H-ésima harmônica.

`nivel.py pasta nome` grava no JSON o nível dos grãos de carga; o jogo iguala o
volume das gravações por ele.

### Bancos gerados (prévias HQ do Freesound convertidas para WAV mono 48 kHz)

```bash
# V8 cruzado — Studebaker 1953 (#238847, CC BY 4.0). Linha rastreada = 6ª do ciclo
PRIOR="2.6:80,3:88,4:98,6:108,10:122,15:140,18:150,20:162,22:180,23:198,24:215,25:230,26:245,27.8:262,28.1:215,28.3:205,28.7:240,30:270,32.3:285,33.5:180,34.3:110,35:95,39:95" SALTO=0.03 python -P rastrear.py v8.wav v8c 50 320 88
# (depois: pente guiado pela linha/6, PRIOR gerado da trilha anterior, BANDA=0.1 MODO=pente SALTO=0.02, faixa 8–60)
python -P marcas.py v8.wav v8c "2.8-35.2" 6 6
python -P banco.py v8.wav v8c "2.8-35.2" ../../public/autodash/som v8-cruzado 32000 2

# V8 plano — Ferrari 360 (#241083, CC0). Linha = explosão (ordem 4), grão = ciclo (k = 8)
SALTO=0.05 python -P rastrear.py f360.wav f360 50 330 100 "17.6-26:65-80"
python -P marcas.py f360.wav f360 "1.2-35" 8
python -P banco.py f360.wav f360 "1.2-35" ../../public/autodash/som v8-plano 32000 2

# 6 em linha — Supra no dinamômetro (#496171, CC0). Linha = explosão (ordem 3), k = 6
PRIOR="0.5:115,1:105,2:120,3:190,4:215,4.5:150,5:130,6:170,7:220,7.6:170,8:160,9:180,10:200,10.7:210,11.2:150,11.5:160,15:170,20:185,21:205,22:230,23:275,24:340,25:395,25.6:420,26.2:370,27:260,28:170,29:105,30:92,31:80" BANDA=0.08 SALTO=0.05 python -P rastrear.py supra.wav supra 60 460 115
python -P marcas.py supra.wav supra "0.3-31.5" 6
python -P banco.py supra.wav supra "0.3-31.5" ../../public/autodash/som i6 32000 2

# boxer 6 — Porsche 911 (#772802, CC BY 4.0). Só lenta e 27–41 s (as aceleradas rápidas o rastreador não segue)
SALTO=0.1 python -P rastrear.py p911.wav p911 25 420 35 "3-8.8:30-40;46.5-50.5:30-40;26-27.5:30-40"
python -P marcas.py p911.wav p911 "2.8-8.8,27.4-41.2,46.6-50.6" 6
python -P banco.py p911.wav p911 "2.8-8.8,27.4-41.2,46.6-50.6" ../../public/autodash/som boxer6 32000 2

for n in r19-i4 v8-cruzado v8-plano i6 boxer6; do python -P nivel.py ../../public/autodash/som $n; done
```

Descartados depois de baixar: "WRX - Exhaust sounds" (#273334; trechos
repetidos idênticos, parece laço editado) e "Lambo idle and rev" (#112075; áudio
de vídeo com ruído, sem periodicidade estável). Boxer 4 e V12 seguem na síntese.

## V8 cruzado novo (`v8-escape`): três gravações num banco só

Nenhuma gravação livre de V8 cobre a lenta ao alto giro com o microfone no escape.
O banco `v8-escape` junta três, cada uma valendo numa faixa de giro, com
`juntar.py` (decodifica os bancos, concatena, iguala o nível e recodifica):

- lenta (~800 rpm): Chrysler 1964, microfone no escape (#240671, lonemonk, CC BY 4.0), 48 s de lenta estável;
- meio (2000–3650 rpm): "nascar24chevyrev2" (#43485, enginemusic, CC BY 3.0). Só os 2,3–9,05 s (subida) e 9,45–10,1 s (queda); o resto tem outros motores de fundo e a lenta com uma linha de 150 Hz (zumbido de rede) que o rastreador seguia por engano;
- alto (3500–6000 rpm): o próprio banco `v8-cruzado` (Studebaker 1953), com passa-baixa de 3 kHz porque é mais brilhante (cofre) que as outras duas (sem filtro o timbre pula de 460 para 800 Hz de centroide na emenda).

Faixas e giros foram lidos no espectrograma. Em todas a linha rastreada é a 4ª ordem (explosão), `k = 8`, 2 voltas por grão. **Cuidado com o rastreador no NASCAR:** com várias linhas ele cai na lenta ou na oitava errada; o `PRIOR` abaixo é a trilha lida a olho.

```bash
# originais: prévias HQ do Freesound convertidas com ffmpeg -ac 1 -ar 48000 (cada uma numa pasta nova, fora do repo)
python -P rastrear.py chrysler.wav chr 40 75 53 "0-3:40-75"            # SALTO=0.03
python -P marcas.py chrysler.wav chr "4-46" 8
python -P banco.py chrysler.wav chr "4-26" $MID chrysler 32000 2

PRIOR="0:150,2.0:150,3:175,4:200,5:228,6:245,9.1:250,9.3:230,9.6:150,10:105,12:100" BANDA=0.07 SALTO=0.05 python -P rastrear.py nascar.wav nas 70 330 150
python -P marcas.py nascar.wav nas "2.3-9.05,9.45-10.1" 8
python -P banco.py nascar.wav nas "2.3-9.05,9.45-10.1" $MID nascar 32000 2

# junta: "banco@rpm_min-rpm_max[@ganho[@passa_baixa_hz]]". O ganho 1,43 do NASCAR deixa a lenta ~3 dB abaixo do giro mais baixo dele
CURVA="800:-44,2000:-43,3400:-41,5000:-38,6000:-38" python -P juntar.py $MID v8-escape   "$MID/chrysler@700-900;$MID/nascar@2000-3650@1.43;../../public/autodash/som/v8-cruzado@3500-6000@@3000" 112
cp $MID/v8-escape.* ../../public/autodash/som/ && python -P nivel.py ../../public/autodash/som v8-escape
```

**Timbre do alto casado com o meio (15/11).** O trecho do Studebaker (alto) soava
"outro motor": centroide 650–930 Hz contra 300–540 do NASCAR. `casar_timbre.py`
mede o espectro médio dos dois trechos do banco (1/3 de oitava), aplica 80% da
diferença como EQ de fase linear (±15 dB, nada acima de 3 kHz, que o passa-baixa
já tirou) só no trecho B, preserva o nível dele e regrava o MP3. Os grãos não
mudam (o clique de alinhamento corrige o atraso do codificador).

```bash
python -P casar_timbre.py ../../public/autodash/som v8-escape $SAIDA 21.8-29.7 32.9-44.7 0.8
cp $SAIDA/v8-escape.* ../../public/autodash/som/ && python -P nivel.py ../../public/autodash/som v8-escape
```

`CURVA` (ambiente) leva o volume gravado por grão para uma curva em função do giro, por
classe (carga, alívio, estável): as gravações de cofre sobem mais de 20 dB da lenta ao alto
giro e o motor de verdade sobe uns 12. O nível absoluto não importa (o jogo iguala por
`nivel`).

### Ouvir sem abrir o jogo: `render-motor.test.ts`

Renderiza o som como `audio.ts` o monta (síntese por guias de onda + banco, com os ganhos de
`misturarGravacao`, EQ e saturação; sem compressor, eco e efeitos) em WAV, nos giros que se
pedir e numa varredura. Serve para medir espectro e volume e para comparar antes e depois:

```bash
RENDER_MOTOR=/pasta/saida RENDER_TAG=depois RENDER_PERFIS=v8-cruzado,v8-plano RENDER_GIROS=1500,3000,5000,6500   npx vitest run src/game/autodash/__tests__/render-motor.test.ts
```

## Bancos do Engine Simulator (`sim-*`)

Gravação: Engine Simulator v0.1.11a (MIT). O simulador lê o teclado por Raw Input e
ignora tecla simulada, então a pessoa pilota (A ignição, S partida, D dinamômetro,
R pé no fundo) e um gravador de loopback (WASAPI, `pyaudiowpatch`) grava a saída.
Roteiro por motor: 3 s de lenta, D + R até o dinamômetro desligar no redline, 3 s
no corte, solta. Volume do simulador perto de 50 (Z + roda) para não clipar.

Sem rastreador: a puxada do dinamômetro sobe a 500 rpm/s em linha reta, então
`trilha_dino.py` ajusta uma reta pelo pente das harmônicas (ou fixa a reta medida na
linha dominante com `RETA="t:rpm"`, como no V8 e no V12, em que o pente erra) e uma
constante na lenta. `nivelar_lenta.py` sobe a lenta até 18 dB abaixo da puxada
(no simulador ela sai até 45 dB abaixo).

```bash
python -P trilha_dino.py v10.wav v10 10 "lenta:2-11" "puxada:11.9-27.7"
RETA="39.3:1245" python -P trilha_dino.py v8.wav v8 8 "lenta:29.5-38.5" "puxada:39.3-49.3"
RETA="21.5:3440" python -P trilha_dino.py v12.wav v12 12 "lenta:4-20" "puxada:21.5-37"
python -P nivelar_lenta.py jz.wav "lenta:1-4.5" "puxada:9.3-19.1"   # gera jz_niv.wav
python -P marcas.py v10.wav v10 "2-11,11.9-27.7" 10      # k = cilindros (grão de 720°)
python -P banco.py v10.wav v10 "2-11,11.9-27.7" ../../public/autodash/som sim-v10-lfa 32000 2
python -P nivel.py ../../public/autodash/som sim-v10-lfa
```

Janelas usadas: V8 lenta 29,5–38,5 / puxada 39,3–49,3; VTEC 1–5 / 8–22,7; VQ35 1–5,5 /
6,4–17,5; 2JZ 1–4,5 / 9,3–19,1; RB26 1–5 / 11,1–24,9; V10 2–11 / 11,9–27,7; V12 4–20 /
21,5–37 (só até ~11200 rpm; o 412 T2 vai a 18000).

## Partida

Freesound #50898, "Car Ignition Key - Engine Starting Running Idle 2.wav", de
RutgerMuller (CC0): os primeiros 2,6 s com fade-out a partir de 1,6 s.

```bash
ffmpeg -i 50898_179538-hq.mp3 -t 2.6 -af "afade=t=out:st=1.6:d=1.0" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k partida.mp3
```
