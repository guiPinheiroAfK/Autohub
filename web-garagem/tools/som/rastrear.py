# Rastreia a frequência de explosão (ordem de ignição) de uma gravação de motor.
# uso: python -P rastrear.py entrada.wav saida_prefixo fmin fmax f_inicial
import sys, os, json, numpy as np
from scipy.io import wavfile
from scipy.signal import stft, butter, sosfiltfilt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, pref = sys.argv[1], sys.argv[2]
fmin, fmax, f_ini = float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
NH = 3
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.ndim > 1: x = x.mean(axis=1)
x /= np.abs(x).max()
hop = 480
f, t, Z = stft(x, sr, nperseg=4096, noverlap=4096 - hop, nfft=16384, window="hann", boundary=None, padded=False)
mag = np.abs(Z)
L = np.log(mag + 1e-7)
L -= np.median(L, axis=0, keepdims=True)  # branqueia por quadro
df = f[1] - f[0]
cands = np.arange(fmin, fmax, 0.25)
# soma harmônica (log), pesos decrescentes; penaliza meio-harmônicos (erro de oitava)
score = np.zeros((len(cands), L.shape[1]))
for k in range(1, NH + 1):
    w = [1.0, 0.45, 0.25][k - 1]
    idx = np.clip(np.round(cands * k / df).astype(int), 0, len(f) - 1)
    score += w * L[idx]
    idxm = np.clip(np.round(cands * (k - 0.5) / df).astype(int), 0, len(f) - 1)
    score -= 0.0 * w * L[idxm]
score /= NH
# MODO=pente: rastreia o ESPAÇAMENTO entre as linhas (todas as harmônicas até
# ~1,2 kHz), descontando o meio entre elas. Não pula de linha quando a mais forte
# muda ao longo da varredura (V8, boxer: linhas a cada meia ordem, muito juntas)
if os.environ.get("MODO") == "pente":
    score = np.zeros((len(cands), L.shape[1]))
    for i, c in enumerate(cands):
        h = np.arange(1, max(4, min(40, int(1200 / c))) + 1)
        on = np.clip(np.round(h * c / df).astype(int), 0, len(f) - 1)
        off = np.clip(np.round((h + 0.5) * c / df).astype(int), 0, len(f) - 1)
        score[i] = L[on].mean(axis=0) - L[off].mean(axis=0)
# restrições opcionais: argv[6] = "t0-t1:f0-f1;..."
if len(sys.argv) > 6:
    for r in sys.argv[6].split(";"):
        tt, ff = r.split(":"); a, b = map(float, tt.split("-")); lo, hi = map(float, ff.split("-"))
        fr = (t >= a) & (t <= b); bad = (cands < lo) | (cands > hi)
        score[np.ix_(bad, fr)] = -50
# PRIOR="t:hz,t:hz,...": trilha aproximada lida a olho no espectrograma; a busca
# fica a ±BANDA (padrão 7%) dela. Resolve a ambiguidade entre linhas vizinhas.
if os.environ.get("PRIOR"):
    kp = np.array([[float(v) for v in par.split(":")] for par in os.environ["PRIOR"].split(",")])
    fp = np.exp(np.interp(t, kp[:, 0], np.log(kp[:, 1])))
    banda = float(os.environ.get("BANDA", "0.07"))
    fora = np.abs(np.log(cands[:, None] / fp[None, :])) > banda
    score[fora] = -50
# Viterbi com salto máximo proporcional
nT = score.shape[1]
logc = np.log(cands)
# salto máximo por quadro de 10 ms (SALTO=0.015 para varreduras lentas, onde a
# linha vizinha está perto e o rastreador pularia de harmônica)
maxjump = float(os.environ.get("SALTO", "0.07"))
back = np.zeros((len(cands), nT), dtype=np.int32)
acc = score[:, 0] - 4.0 * np.abs(logc - np.log(f_ini)) * 10
for j in range(1, nT):
    # janela de transição: para cada candidato, melhor anterior dentro de maxjump
    new = np.full(len(cands), -1e18)
    bk = np.zeros(len(cands), dtype=np.int32)
    # aproximação por deslocamentos discretos em log
    for s in range(-60, 61):
        src_i = np.arange(len(cands)) - s
        ok = (src_i >= 0) & (src_i < len(cands))
        d = np.abs(logc[ok] - logc[src_i[ok]])
        val = acc[src_i[ok]] - 25.0 * d * d / (maxjump ** 2) * 0.02 - 30.0 * (d > maxjump)
        better = val > new[ok]
        tgt = np.where(ok)[0][better]
        new[tgt] = val[better]
        bk[tgt] = src_i[ok][better]
    acc = new + score[:, j]
    back[:, j] = bk
path = np.zeros(nT, dtype=np.int32)
path[-1] = int(np.argmax(acc))
for j in range(nT - 1, 0, -1):
    path[j - 1] = back[path[j], j]
f0 = cands[path]
conf = score[path, np.arange(nT)]
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 4) / (hop * 4), mode="same"))[np.clip((t * sr).astype(int), 0, len(x) - 1)]
np.savez(pref + "_trilha.npz", t=t, f0=f0, conf=conf, rms=rms, sr=sr)
fig, ax = plt.subplots(3, 1, figsize=(16, 10), gridspec_kw={"height_ratios": [4, 1, 1]})
m = f <= fmax * 3
ax[0].pcolormesh(t, f[m], 20 * np.log10(mag[m] + 1e-9), shading="auto", vmin=-90, vmax=-10, cmap="magma")
ax[0].plot(t, f0, "c", lw=0.8)
ax[1].plot(t, conf); ax[1].set_ylabel("conf")
ax[2].plot(t, 20 * np.log10(rms + 1e-9)); ax[2].set_ylabel("dB")
for a in ax: a.set_xlim(0, t[-1])
plt.tight_layout(); plt.savefig(pref + "_trilha.png", dpi=65)
print("quadros", nT, "f0 min/max", f0.min(), f0.max())
