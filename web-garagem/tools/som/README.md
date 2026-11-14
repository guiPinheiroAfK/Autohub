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

## Partida

Freesound #50898, "Car Ignition Key - Engine Starting Running Idle 2.wav", de
RutgerMuller (CC0): os primeiros 2,6 s com fade-out a partir de 1,6 s.

```bash
ffmpeg -i 50898_179538-hq.mp3 -t 2.6 -af "afade=t=out:st=1.6:d=1.0" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k partida.mp3
```
