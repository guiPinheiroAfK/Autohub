# Trilha de giro de uma gravação do Engine Simulator (dinamômetro), sem rastreador.
# No simulador a puxada no dinamômetro é uma reta (a velocidade do dinamômetro sobe
# a taxa fixa) e a lenta é constante: em vez de seguir a linha quadro a quadro (que
# erra de oitava ou pula de linha), ajusta uma reta de giro à puxada e uma constante
# à lenta, pelo "pente" das harmônicas da explosão (soma nas ordens k × f, menos as
# meias ordens entre elas). Gera o mesmo <prefixo>_trilha.npz do rastrear.py.
# uso: python -P trilha_dino.py entrada.wav prefixo cilindros "lenta:a-b,..." "puxada:a-b"
# PENTE=volta (ambiente): ajusta pelo pente de todas as ordens inteiras da volta (sem
# descontar meias ordens), para motores em que a linha da volta domina.
# RETA="t:rpm" (ambiente): fixa a puxada pela reta medida na linha dominante
# (inclinação 500 rpm/s), sem busca. Use quando o pente erra (V8 e V12 do simulador).
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import stft
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

src, pref, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
lentas = [tuple(map(float, s.split(":")[1].split("-"))) if ":" in s else tuple(map(float, s.split("-"))) for s in sys.argv[4].split(",")]
pa, pb = map(float, sys.argv[5].split(":")[1].split("-"))
sr, x = wavfile.read(src); x = x.astype(np.float64)
if x.ndim > 1: x = x.mean(axis=1)
x /= np.abs(x).max()
hop = 480
f, t, Z = stft(x, sr, nperseg=4096, noverlap=4096 - hop, nfft=16384, window="hann", boundary=None, padded=False)
L = np.log(np.abs(Z) + 1e-9); L -= np.median(L, axis=0, keepdims=True)
ordem = N / 2  # explosões por volta
R = np.arange(300, 12001, 10.0)           # grade de giro (rpm)
fe = R / 60 * ordem                        # frequência de explosão
df = f[1] - f[0]
def amostra(fr):  # log-magnitude interpolada em fr (vetor), todos os quadros
    i = np.clip(fr / df, 0, len(f) - 2); i0 = i.astype(int); w = i - i0
    return L[i0] * (1 - w)[:, None] + L[i0 + 1] * w[:, None]
import os
S = np.zeros((len(R), len(t)))
if os.environ.get("PENTE") == "volta":
    for k in range(1, 25): S += amostra(k * R / 60)
else:
    for k in range(1, 7): S += amostra(k * fe) - 0.5 * amostra((k - 0.5) * fe)
S = S.T  # [quadro, giro]
def idx(r): return np.clip(np.round((r - R[0]) / 10).astype(int), 0, len(R) - 1)
f0 = np.full(len(t), np.nan)
for a, b in lentas:
    m = (t >= a) & (t <= b)
    rl = R[np.argmax(S[m].mean(0) * (R < 2000))]
    f0[m] = rl / 60 * ordem; print(f"lenta {a}-{b}s: {rl:.0f} rpm")
m = (t >= pa) & (t <= pb); tt = t[m] - pa; Sm = S[m]
if os.environ.get("RETA"):
    tr, rr = map(float, os.environ["RETA"].split(":")); b = 500.0; r0 = rr + b * (pa - tr)
    f0[m] = (r0 + b * tt) / 60 * ordem
    print(f"puxada {pa}-{pb}s (reta fixa): {r0:.0f} -> {r0 + b * (pb - pa):.0f} rpm")
melhor = (-1e9, 0, 0) if not os.environ.get("RETA") else None
for r0 in (np.arange(300, 4000, 20.0) if melhor else []):
    for b in np.arange(440, 560, 2.0):  # o dinamômetro sobe 500 rpm/s (engine_sim_application.cpp); a faixa evita o erro de oitava (~250)
        sc = Sm[np.arange(len(tt)), idx(r0 + b * tt)].mean()
        if sc > melhor[0]: melhor = (sc, r0, b)
if melhor: _, r0, b = melhor
for r0_ in [] if not melhor else np.arange(r0 - 20, r0 + 20, 2.0):  # refino
    for b_ in np.arange(b - 4, b + 4, 0.5):
        sc = Sm[np.arange(len(tt)), idx(r0_ + b_ * tt)].mean()
        if sc > melhor[0]: melhor = (sc, r0_, b_)
if melhor:
    _, r0, b = melhor
    f0[m] = (r0 + b * tt) / 60 * ordem
    print(f"puxada {pa}-{pb}s: {r0:.0f} -> {r0 + b * (pb - pa):.0f} rpm ({b:.1f} rpm/s)")
ok = ~np.isnan(f0); f0 = np.interp(t, t[ok], f0[ok]); conf = ok.astype(float)
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop * 4) / (hop * 4), mode="same"))[np.clip((t * sr).astype(int), 0, len(x) - 1)]
np.savez(pref + "_trilha.npz", t=t, f0=f0, conf=conf, rms=rms, sr=sr)
mm = f < 2500
plt.figure(figsize=(16, 5)); plt.pcolormesh(t, f[mm], L[mm], shading="auto", cmap="magma", vmin=-2, vmax=4)
for k in (1, 2): plt.plot(t, f0 * k, "c-" if k == 1 else "c:", lw=0.8)
plt.tight_layout(); plt.savefig(pref + "_trilha.png", dpi=55)
