# casa o espectro médio de um trecho do banco (fonte B) com o de outro (fonte A) e regrava o MP3
# uso: casar_timbre.py banco_dir nome saida_dir A_ini-A_fim B_ini-B_fim fracao
import sys, json, subprocess, shutil, numpy as np
from scipy.signal import welch, firwin2, fftconvolve
bdir, nome, sdir = sys.argv[1:4]
(a0, a1), (b0, b1) = [tuple(map(float, s.split("-"))) for s in sys.argv[4:6]]
FR = float(sys.argv[6]); SR = 32000
j = json.load(open(f"{bdir}/{nome}.json"))
raw = subprocess.run(["ffmpeg","-v","error","-i",f"{bdir}/{nome}.mp3","-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True,check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
d = np.argmax(np.abs(x[:int((j["clique"]+0.08)*SR)]))/SR - j["clique"]   # atraso do codificador
sl = lambda t0, t1: slice(int((t0+d)*SR), int((t1+d)*SR))
fA, PA = welch(x[sl(a0,a1)], SR, nperseg=4096); _, PB = welch(x[sl(b0,b1)], SR, nperseg=4096)
# suaviza em 1/3 de oitava
def suave(P):
    out = np.empty_like(P)
    for i, f in enumerate(fA):
        m = (fA >= f*2**(-1/6)) & (fA <= f*2**(1/6)) if f > 0 else (fA == 0)
        out[i] = P[m].mean()
    return out
g = 10*np.log10(suave(PA)/suave(PB)); g -= np.median(g[(fA>80)&(fA<300)])  # não mexe no corpo grave
g = np.clip(g*FR, -15, 15); g[fA < 80] = 0; g[fA > 3000] = np.minimum(g[fA > 3000], 0)
fir = firwin2(2049, fA/(SR/2), 10**(g/20)); fir_d = 1024
print("ganho (dB) por banda:", " ".join(f"{int(f)}:{g[np.argmin(abs(fA-f))]:+.1f}" for f in [100,200,400,800,1200,1600,2400,3200,5000]))
y = x.copy(); s = sl(b0-0.2, b1+0.2); seg = x[s]
yf = fftconvolve(seg, fir)[fir_d:fir_d+len(seg)]
# rampa de 50 ms nas bordas para não criar degrau
r = np.ones(len(seg)); n = int(0.05*SR); r[:n] = np.linspace(0,1,n); r[-n:] = np.linspace(1,0,n)
y[s] = seg*(1-r) + yf*r
# mantém o nível do trecho B como era antes do EQ (só o timbre muda)
sb = sl(b0, b1); k = np.sqrt(np.mean(x[sb]**2) / np.mean(y[sb]**2))
y[s] = seg*(1-r) + yf*k*r
print(f"nível do trecho B preservado: x{k:.2f}")
pk = np.abs(y).max(); y = y/pk*0.97 if pk > 0.97 else y
tmp = f"{sdir}/{nome}.wav"
import scipy.io.wavfile as wf; wf.write(tmp, SR, (y*32767).astype(np.int16))
subprocess.run(["ffmpeg","-v","error","-y","-i",tmp,"-c:a","libmp3lame","-b:a","112k",f"{sdir}/{nome}.mp3"],check=True)
shutil.copy(f"{bdir}/{nome}.json", f"{sdir}/{nome}.json")
print("ok", f"{sdir}/{nome}.mp3")
