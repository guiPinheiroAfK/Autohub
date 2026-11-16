# Refina a trilha de giro pela fase e gera marcas síncronas (uma por explosão).
# uso: python -P marcas.py entrada.wav prefixo "t0-t1,t2-t3" [k] [H]
# k = períodos da linha rastreada por grão. 1 = um grão por explosão (4 em linha);
# para motores de explosão desigual (V8, boxer...) use o ciclo inteiro de 720°:
# k = ordem da linha × 2 (ex.: V8 rastreando a explosão, ordem 4 → k = 8).
import sys, json, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, pref, faixas = sys.argv[1], sys.argv[2], sys.argv[3]
K = int(sys.argv[4]) if len(sys.argv) > 4 else 1
d = np.load(pref + "_trilha.npz")
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.ndim > 1: x = x.mean(axis=1)
x /= np.abs(x).max()
n = np.arange(len(x)) / sr
# H: a fase é refinada na H-ésima harmônica da trilha (no modo pente a trilha é o
# espaçamento entre linhas, fraco; a linha de explosão, forte, fica em H × trilha)
H = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
f0 = np.interp(n, d["t"], d["f0"]) * H
phi = 2 * np.pi * np.cumsum(f0) / sr
z = x * np.exp(-1j * phi)
sos = butter(4, 6.0, fs=sr, output="sos")
zl = sosfiltfilt(sos, z.real) + 1j * sosfiltfilt(sos, z.imag)
psi = np.unwrap(np.angle(zl))
Phi = phi + psi
fin = np.gradient(Phi) * sr / (2 * np.pi)
amp = np.abs(zl)
# marcas onde a fase cruza múltiplos de 2π·K (um grão a cada K períodos)
k = np.floor(Phi / (2 * np.pi * K))
cross = np.where(np.diff(k) > 0)[0]
# interpolação sub-amostra
fr = (2 * np.pi * K * k[cross + 1] - Phi[cross]) / (Phi[cross + 1] - Phi[cross])
tm = (cross + fr) / sr
segs = [tuple(map(float, s.split("-"))) for s in faixas.split(",")]
dentro = np.zeros(len(tm), bool)
for a, b in segs: dentro |= (tm >= a) & (tm <= b)
# por marca: frequência local, derivada, nível
fm = np.interp(tm, n, fin) / K
per = np.diff(tm, prepend=tm[0] - 1 / fm[0])
fper = 1 / np.maximum(per, 1e-4)
rmsm = np.interp(tm, d["t"], d["rms"])
# derivada suavizada da frequência (Hz/s)
fs_ = np.interp(tm, d["t"], np.convolve(d["f0"], np.ones(15) / 15, mode="same")) * H / K
dfdt = np.gradient(fs_, tm)
ok = dentro & (np.abs(fper - fm) / fm < 0.12)
# Hz/s na escala do grão. A puxada do dinamômetro (500 rpm/s) dá 500/120 = 4,17 Hz/s
# com K = cilindros; 15/K passava disso no 3 cilindros (5) e tudo virava "estável".
lim = 15.0 / max(K, 4)
classe = np.where(dfdt > lim, 1, np.where(dfdt < -lim, 0, 2))  # 1 sobe (carga), 0 cai (alívio), 2 estável
print("marcas", len(tm), "úteis", ok.sum(), "sobe", (ok & (classe == 1)).sum(), "cai", (ok & (classe == 0)).sum(), "estável", (ok & (classe == 2)).sum())
np.savez(pref + "_marcas.npz", tm=tm, f=fper, classe=classe, ok=ok, rms=rmsm, dfdt=dfdt)
fig, ax = plt.subplots(2, 1, figsize=(16, 8))
ax[0].plot(d["t"], d["f0"], "k", lw=0.6)
for c, col in [(1, "r"), (0, "b"), (2, "g")]:
    s = ok & (classe == c)
    ax[0].plot(tm[s], fper[s], ".", color=col, ms=1.5)
ax[1].hist([fper[ok & (classe == 1)], fper[ok & (classe == 0)], fper[ok & (classe == 2)]], bins=60, color=["r", "b", "g"], stacked=True)
plt.tight_layout(); plt.savefig(pref + "_marcas.png", dpi=65)
