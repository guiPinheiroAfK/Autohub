# Sobe o trecho de lenta de uma gravação do simulador até `db` abaixo da mediana da
# puxada (no simulador a lenta de borboleta fechada sai 25–40 dB abaixo; num carro de
# verdade fica ~15–20). Rampa de 50 ms nas bordas. Grava <entrada>_niv.wav.
# uso: python -P nivelar_lenta.py entrada.wav "lenta:a-b" "puxada:a-b" [db=18]
import sys, numpy as np
from scipy.io import wavfile
src = sys.argv[1]; la, lb = map(float, sys.argv[2].split(":")[1].split("-")); pa, pb = map(float, sys.argv[3].split(":")[1].split("-"))
db = float(sys.argv[4]) if len(sys.argv) > 4 else 18.0
sr, x = wavfile.read(src); x = x.astype(np.float64) / 32768
def rms_med(a, b):
    s = x[int(a * sr):int(b * sr)]; w = int(0.1 * sr)
    return np.median([np.sqrt(np.mean(s[i:i + w] ** 2)) for i in range(0, len(s) - w, w)])
rl, rp = rms_med(la, lb), rms_med(pa, pb)
alvo = rp * 10 ** (-db / 20); k = max(1.0, alvo / rl)
i0, i1, n = int(la * sr), int(lb * sr), int(0.05 * sr)
g = np.ones(len(x)); g[i0:i1] = k; g[i0:i0 + n] = np.linspace(1, k, n); g[i1 - n:i1] = np.linspace(k, 1, n)
y = np.clip(x * g, -1, 1)
wavfile.write(src.replace(".wav", "_niv.wav"), sr, (y * 32767).astype(np.int16))
print(f"lenta {20*np.log10(rl):.1f} dB, puxada {20*np.log10(rp):.1f} dB -> lenta x{k:.1f} ({20*np.log10(k):+.1f} dB)")
