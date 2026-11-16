# Junta trechos de bancos já gerados (banco.py) num banco só, cada um valendo numa
# faixa de giro. Serve quando nenhuma gravação cobre o giro todo: a lenta vem de
# uma, o meio de outra, o alto de outra, e o motor gravado (motor-gravado.ts) toca
# tudo como um banco único.
# uso: python -P juntar.py saida_dir nome "pasta/banco@rpm_min-rpm_max[@ganho[@passa_baixa_hz]];..." [bitrate_kbps]
# CURVA="rpm:dB,rpm:dB,..." (ambiente): leva o volume gravado em função do giro para essa curva
#   (só o formato conta; o nível absoluto é ajustado depois). Gravações de cofre sobem 20 dB ou
#   mais da lenta ao alto giro; o motor de verdade sobe ~12. Também esconde a emenda entre fontes.
#   rpm = giro do virabrequim (Hz do grão × 60 × voltasPorGrao). Todos os bancos
#   precisam ter o mesmo voltasPorGrao e a mesma taxa.
# O nível entre fontes é igualado no giro em que elas se encontram (mediana do RMS
# dos grãos numa janela de ±6%); sem sobreposição vale o ganho manual (3º campo,
# padrão 1) sobre o nível da fonte anterior no seu giro mais baixo.
import sys, json, os, subprocess, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt

saida, nome, spec = sys.argv[1:4]
kbps = int(sys.argv[4]) if len(sys.argv) > 4 else 112
SR = 32000
PREF, CLIQUE = 0.25, 0.1
CURVA = [tuple(map(float, p.split(":"))) for p in os.environ["CURVA"].split(",")] if os.environ.get("CURVA") else None

fontes = []
for item in spec.split(";"):
    p = item.split("@")
    base, (a, b) = p[0], map(float, p[1].split("-"))
    g = float(p[2]) if len(p) > 2 and p[2] else 1.0
    lp = float(p[3]) if len(p) > 3 else 0.0  # passa-baixa opcional (Hz): tira o chiado de cofre de uma fonte mais brilhante que as outras
    j = json.load(open(base + ".json"))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", base + ".mp3", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    # alinha pelo clique (o MP3 pode ter atraso do codificador)
    ate = int((j["clique"] + 0.08) * SR)
    desvio = int(np.argmax(np.abs(x[:ate]))) / SR - j["clique"]
    if lp > 0: x = sosfiltfilt(butter(4, lp, fs=SR, output="sos"), x)
    gr = np.array(j["graos"])
    gr[:, 0] += desvio
    rpm = gr[:, 3] * 60 * j.get("voltasPorGrao", 0.5)
    rms = np.zeros(len(gr))
    for i, (c, e, d, hz, cl, gn) in enumerate(gr):
        s0, s1 = int((c - e) * SR), int((c + d) * SR)
        rms[i] = np.sqrt(np.mean(x[s0:s1] ** 2)) * gn if 0 <= s0 < s1 <= len(x) else np.nan
    fontes.append(dict(base=base, j=j, x=x, gr=gr, rpm=rpm, rms=rms, a=a, b=b, g=g, voltas=j.get("voltasPorGrao", 0.5)))
assert len({f["voltas"] for f in fontes}) == 1, "voltasPorGrao diferente entre as fontes"

def nivel_em(f, r0):
    m = (np.abs(np.log(f["rpm"] / r0)) < 0.06) & np.isfinite(f["rms"])
    return float(np.median(f["rms"][m])) if m.sum() >= 3 else None

# escala de cada fonte (multiplica o ganho dos grãos)
escala = [1.0]
for k in range(1, len(fontes)):
    ant, f = fontes[k - 1], fontes[k]
    ref = max(f["a"], ant["a"])  # giro de encontro: o mais baixo da fonte nova, se a anterior chega lá
    na, nf = nivel_em(ant, f["a"] * 1.0), nivel_em(f, f["a"] * 1.0)
    if na is not None and nf is not None:
        e = escala[k - 1] * na / nf
        modo = f"igualada em {f['a']:.0f} rpm"
    else:
        na, nf = nivel_em(ant, ant["a"] * 1.05) or np.nanmedian(ant["rms"]), nivel_em(f, f["a"] * 1.05) or np.nanmedian(f["rms"])
        e = escala[k - 1] * (na / nf) * f["g"]
        modo = "sem sobreposição: nível mediano x ganho manual"
    escala.append(e)
    print(f"{os.path.basename(f['base'])}: x{e:.3f} ({modo})")

pedacos, graos, off = [], [], 0.0
for f, e in zip(fontes, escala):
    sel = (f["rpm"] >= f["a"]) & (f["rpm"] <= f["b"])
    ids = np.where(sel)[0]
    if len(ids) == 0: continue
    # recorta o áudio do primeiro ao último grão escolhido (com folga de 0,2 s)
    t0 = max(0.0, f["gr"][ids, 0].min() - f["gr"][ids, 1].max() - 0.05)
    t1 = min(len(f["x"]) / SR, f["gr"][ids, 0].max() + f["gr"][ids, 2].max() + 0.05)
    # trechos contíguos de grãos escolhidos podem ter buracos grandes; mantém o bloco inteiro (simples)
    y = f["x"][int(t0 * SR):int(t1 * SR)].copy()
    n = int(0.004 * SR); y[:n] *= np.linspace(0, 1, n); y[-n:] *= np.linspace(1, 0, n)
    for i in ids:
        c, esq, dr, hz, cl, gn = f["gr"][i]
        graos.append([c - t0 + off, esq, dr, hz, int(cl), gn * e])
    pedacos.append(y)
    off += len(y) / SR
    print(f"{os.path.basename(f['base'])}: {len(ids)} grãos de {f['a']:.0f} a {f['b']:.0f} rpm, {len(y)/SR:.1f} s")

pre = np.zeros(int(PREF * SR)); pre[int(CLIQUE * SR)] = 1.0
y = np.concatenate([pre] + pedacos)
graos = [[g[0] + PREF] + g[1:] for g in graos]
pico = np.abs(y[int(PREF * SR):]).max()
y = y / pico * 0.97  # só o áudio; os ganhos são relativos
if CURVA:
    hzs = np.array([g[3] for g in graos]); rp = hzs * 60 * fontes[0]["voltas"]
    amp = np.zeros(len(graos))
    for i, (c, esq, dr, hz, cl, gn) in enumerate(graos):
        s0, s1 = int((c - esq) * SR), int((c + dr) * SR)
        amp[i] = np.sqrt(np.mean(y[s0:s1] ** 2)) * gn
    cls = np.array([g[4] for g in graos])
    def mediana(r, k):  # por classe (carga, alívio, estável): cada uma segue a curva; poucas amostras: todas as classes
        m = (np.abs(np.log(rp / r)) < 0.1) & (cls == k)
        return np.median(amp[m]) if m.sum() >= 4 else np.median(amp[np.abs(np.log(rp / r)) < 0.1])
    med = np.array([mediana(r, k) for r, k in zip(rp, cls)])
    cr, cd = np.log([p[0] for p in CURVA]), [p[1] for p in CURVA]
    alvo = np.interp(np.log(rp), cr, cd)
    corr = 10 ** ((alvo - 20 * np.log10(med)) / 20)
    graos = [[c, e, d, hz, cl, gn * k] for (c, e, d, hz, cl, gn), k in zip(graos, corr)]
    print("CURVA aplicada: correção de %.1f a %.1f dB" % (20 * np.log10(corr.min()), 20 * np.log10(corr.max())))
# o ganho acumula as escalas entre fontes e pode ficar enorme: leva o nível dos
# grãos de carga (a medida do nivel.py) para ~0,1, como nos outros bancos, para o
# jogo não cair no limite do ajuste de volume (audio.ts: 0,4 a 3,5)
ALVO_NIVEL = 0.10
v = []
for c, esq, dr, hz, cl, gn in graos:
    if cl != 1: continue
    s0, s1 = int((c - esq) * SR), int((c + dr) * SR)
    if 0 <= s0 < s1 <= len(y): v.append(np.sqrt(np.mean(y[s0:s1] ** 2)) * gn)
k = ALVO_NIVEL / float(np.median(v))
graos = [[c, e, d, hz, cl, gn * k] for c, e, d, hz, cl, gn in graos]
print(f"ganhos x{k:.3f} (nível dos grãos de carga {float(np.median(v)):.3f} -> {ALVO_NIVEL})")
os.makedirs(saida, exist_ok=True)
wav = os.path.join(saida, nome + ".wav")
wavfile.write(wav, SR, (y * 32767).astype(np.int16))
mp3 = os.path.join(saida, nome + ".mp3")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", f"{kbps}k", mp3], check=True)
os.remove(wav)
# o ganho do grão (relativo ao áudio) já carrega a escala entre fontes; o nível
# absoluto é medido depois por nivel.py
out = {"arquivo": nome + ".mp3", "clique": CLIQUE, "voltasPorGrao": fontes[0]["voltas"], "sr": SR, "duracao": round(len(y) / SR, 4),
       "graos": [[round(a, 5), round(b, 6), round(c, 6), round(d, 3), int(e), round(float(h), 3)] for a, b, c, d, e, h in graos]}
json.dump(out, open(os.path.join(saida, nome + ".json"), "w"), separators=(",", ":"))
print("dur", out["duracao"], "graos", len(graos), "mp3 KB", os.path.getsize(mp3) // 1024)
