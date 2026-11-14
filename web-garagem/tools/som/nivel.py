# Mede o nível (RMS) dos grãos de carga do banco já em MP3 e grava "nivel" no
# JSON: o jogo iguala o volume entre gravações diferentes por esse número.
# uso: python -P nivel.py pasta nome
import sys, json, os, subprocess, numpy as np
pasta, nome = sys.argv[1], sys.argv[2]
js = os.path.join(pasta, nome + ".json"); j = json.load(open(js))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(pasta, nome + ".mp3"), "-f", "f32le", "-ac", "1", "-ar", "32000", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32); sr = 32000
v = []
for c, esq, dir_, hz, classe, g in j["graos"]:
    if classe != 1: continue
    a, b = int((c - esq) * sr), int((c + dir_) * sr)
    if 0 <= a < b <= len(x): v.append(np.sqrt(np.mean(x[a:b] ** 2)) * g)
j["nivel"] = round(float(np.median(v)), 4)
json.dump(j, open(js, "w"), separators=(",", ":"))
print(nome, "nivel", j["nivel"], "graos de carga", len(v))
