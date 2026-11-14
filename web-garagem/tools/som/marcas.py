# Refina a trilha de giro pela fase e gera marcas síncronas (uma por explosão).
# uso: python -P marcas.py entrada.wav prefixo "t0-t1,t2-t3"
import sys, json, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, pref, faixas = sys.argv[1], sys.argv[2], sys.argv[3]
d = np.load(pref + "_trilha.npz")
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.ndim > 1: x = x.mean(axis=1)
x /= np.abs(x).max()
n = np.arange(len(x)) / sr
f0 = np.interp(n, d["t"], d["f0"])
phi = 2 * np.pi * np.cumsum(f0) / sr
z = x * np.exp(-1j * phi)
sos = butter(4, 6.0, fs=sr, output="sos")
zl = sosfiltfilt(sos, z.real) + 1j * sosfiltfilt(sos, z.imag)
psi = np.unwrap(np.angle(zl))
Phi = phi + psi
fin = np.gradient(Phi) * sr / (2 * np.pi)
amp = np.abs(zl)
# marcas onde a fase cruza múltiplos de 2π
k = np.floor(Phi / (2 * np.pi))
cross = np.where(np.diff(k) > 0)[0]
# interpolação sub-amostra
fr = (2 * np.pi * k[cross + 1] - Phi[cross]) / (Phi[cross + 1] - Phi[cross])
tm = (cross + fr) / sr
segs = [tuple(map(float, s.split("-"))) for s in faixas.split(",")]
dentro = np.zeros(len(tm), bool)
for a, b in segs: dentro |= (tm >= a) & (tm <= b)
# por marca: frequência local, derivada, nível
fm = np.interp(tm, n, fin)
per = np.diff(tm, prepend=tm[0] - 1 / fm[0])
fper = 1 / np.maximum(per, 1e-4)
rmsm = np.interp(tm, d["t"], d["rms"])
# derivada suavizada da frequência (Hz/s)
fs_ = np.interp(tm, d["t"], np.convolve(d["f0"], np.ones(15) / 15, mode="same"))
dfdt = np.gradient(fs_, tm)
ok = dentro & (np.abs(fper - fm) / fm < 0.12)
classe = np.where(dfdt > 15, 1, np.where(dfdt < -15, 0, 2))  # 1 sobe (carga), 0 cai (alívio), 2 estável
print("marcas", len(tm), "úteis", ok.sum(), "sobe", (ok & (classe == 1)).sum(), "cai", (ok & (classe == 0)).sum(), "estável", (ok & (classe == 2)).sum())
np.savez(pref + "_marcas.npz", tm=tm, f=fper, classe=classe, ok=ok, rms=rmsm, dfdt=dfdt)
fig, ax = plt.subplots(2, 1, figsize=(16, 8))
ax[0].plot(d["t"], d["f0"], "k", lw=0.6)
for c, col in [(1, "r"), (0, "b"), (2, "g")]:
    s = ok & (classe == c)
    ax[0].plot(tm[s], fper[s], ".", color=col, ms=1.5)
ax[1].hist([fper[ok & (classe == 1)], fper[ok & (classe == 0)], fper[ok & (classe == 2)]], bins=60, color=["r", "b", "g"], stacked=True)
plt.tight_layout(); plt.savefig(pref + "_marcas.png", dpi=65)
