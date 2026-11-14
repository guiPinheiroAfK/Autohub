# Monta o banco de grãos: recorta os trechos úteis, grava o MP3 e o JSON de grãos.
# uso: python -P banco.py entrada.wav prefixo "a-b,c-d" saida_dir nome sr_saida [voltas_por_grao] [classe_fixa]
import sys, json, os, subprocess, numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

src, pref, faixas, outdir, nome = sys.argv[1:6]
sr_out = int(sys.argv[6]) if len(sys.argv) > 6 else 32000
# voltas do virabrequim por grão: 0,5 = uma explosão de 4 em linha; 2 = ciclo de 720°
voltas = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5
classe_fixa = int(sys.argv[8]) if len(sys.argv) > 8 else -1  # força a classe (gravação só de carga, p.ex.)
mk = np.load(pref + "_marcas.npz")
sr, x = wavfile.read(src)
x = x.astype(np.float64)
if x.ndim > 1: x = x.mean(axis=1)
x /= np.abs(x).max()
tm, f, classe, ok = mk["tm"], mk["f"], mk["classe"], mk["ok"]
segs = [tuple(map(float, s.split("-"))) for s in faixas.split(",")]
pedacos, graos, off = [], [], 0.0
FADE = 0.004
for a, b in segs:
    ia, ib = int(a * sr), int(b * sr)
    y = x[ia:ib].copy()
    nf = int(FADE * sr)
    y[:nf] *= np.linspace(0, 1, nf); y[-nf:] *= np.linspace(1, 0, nf)
    pedacos.append(y)
    marg = np.maximum(0.02, 1.4 / np.maximum(f, 1.0))  # o grão lê até ~1,3 período para cada lado
    idx = np.where((tm > a + marg) & (tm < b - marg))[0]
    for j in idx[1:-1]:
        if not (ok[j - 1] and ok[j] and ok[j + 1]): continue
        esq, dir_ = tm[j] - tm[j - 1], tm[j + 1] - tm[j]
        if max(esq, dir_) / min(esq, dir_) > 1.15: continue
        c = tm[j] - a + off
        s0, s1 = int((tm[j - 1]) * sr), int((tm[j + 1]) * sr)
        rms = float(np.sqrt(np.mean(x[s0:s1] ** 2)))
        graos.append([c, esq, dir_, 2 / (esq + dir_), int(classe[j]) if classe_fixa < 0 else classe_fixa, rms])
    off += (ib - ia) / sr
# prefixo de alinhamento: 0,25 s com um clique em 0,1 s. Decodificadores de MP3
# podem atrasar o áudio (atraso do codificador); o jogo acha o clique e corrige.
PREF, CLIQUE = 0.25, 0.1
pre = np.zeros(int(PREF * sr)); pre[int(CLIQUE * sr)] = 1.0
y = np.concatenate([pre] + pedacos)
graos = [[gg[0] + PREF] + gg[1:] for gg in graos]
g = np.array(graos)
# nível de referência suave por classe e frequência (mediana em bandas log)
lv = np.zeros(len(g))
lf = np.log(g[:, 3])
for k in (0, 1, 2):
    s = g[:, 4] == k
    for i in np.where(s)[0]:
        viz = s & (np.abs(lf - lf[i]) < 0.08)
        lv[i] = np.median(g[viz, 5])
ganho = np.clip(lv / np.maximum(g[:, 5], 1e-6), 0.5, 2.0)
# reamostra e normaliza
y2 = resample_poly(y, sr_out, sr) if sr_out != sr else y
pico = np.abs(y2[int(PREF * sr_out):]).max()
y2 = y2 / pico * 0.97
os.makedirs(outdir, exist_ok=True)
wav = os.path.join(outdir, nome + ".wav")
wavfile.write(wav, sr_out, (y2 * 32767).astype(np.int16))
flac = os.path.join(outdir, nome + ".mp3")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "112k", flac], check=True)
os.remove(wav)
saida = {
    "arquivo": nome + ".mp3", "clique": CLIQUE, "voltasPorGrao": voltas, "sr": sr_out, "duracao": round(len(y2) / sr_out, 4),
    # grão: [centro_s, periodo_esq_s, periodo_dir_s, freq_explosao_hz, classe(0 alivio,1 carga,2 estavel), ganho]
    "graos": [[round(a, 5), round(b, 6), round(c, 6), round(d, 3), int(e), round(float(h), 3)] for (a, b, c, d, e, _), h in zip(graos, ganho)],
}
json.dump(saida, open(os.path.join(outdir, nome + ".json"), "w"), separators=(",", ":"))
print("dur", saida["duracao"], "graos", len(graos), "flac KB", os.path.getsize(flac) // 1024, "json KB", os.path.getsize(os.path.join(outdir, nome + ".json")) // 1024)
for k in (0, 1, 2):
    s = g[:, 4] == k
    print("classe", k, s.sum(), "f", g[s, 3].min() if s.any() else 0, g[s, 3].max() if s.any() else 0, "rms med", np.median(g[s, 5]) if s.any() else 0)
