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

## Partida

Freesound #50898, "Car Ignition Key - Engine Starting Running Idle 2.wav", de
RutgerMuller (CC0): os primeiros 2,6 s com fade-out a partir de 1,6 s.

```bash
ffmpeg -i 50898_179538-hq.mp3 -t 2.6 -af "afade=t=out:st=1.6:d=1.0" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k partida.mp3
```
