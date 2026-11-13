import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.SourceDataLine;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.Timer;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.GradientPaint;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.geom.Rectangle2D;
import java.awt.geom.RoundRectangle2D;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * AutoDash — jogo de corrida/desvio em Java Swing.
 * Compilar: javac -encoding UTF-8 --release 8 AutoDash.java
 * Rodar:    java AutoDash
 *
 * Controles: setas/A-D dirigem · botão ESQ do mouse (ou W/cima) acelera ·
 * botão DIR (ou S/baixo) freia · ESC pausa.
 */
public class AutoDash extends JPanel implements ActionListener, KeyListener, MouseListener {

    // ---------- Constantes de mundo ----------
    static final int W = 480, H = 700;
    static final int ROAD_L = 70, ROAD_R = 410;
    static final int LANES = 4;
    static final double LANE_W = (ROAD_R - ROAD_L) / (double) LANES;
    static final int PLAYER_Y = H - 170;
    static final double KMH = 24; // px/frame -> km/h

    enum State { MENU, GARAGE, PLAYING, PAUSED, GAME_OVER }
    enum Body { GT, MUSCLE, NINJA, GHOST }

    // ---------- Garagem ----------
    static final Color[] PAINTS = {
        new Color(0xE0342F), new Color(0xF59E0B), new Color(0x22D3EE), new Color(0x8B5CF6),
        new Color(0x4ADE80), new Color(0xF472B6), new Color(0xF8FAFC), new Color(0x334155),
        new Color(0xFACC15), new Color(0x1D4ED8)
    };
    static final String[] STRIPES = { "sem faixa", "central", "dupla", "lateral" };

    static class CarSpec {
        final String name, desc;
        final Body body;
        final double maxSpeed, handling, accel;
        int paint, stripe;
        CarSpec(String name, Body body, int paint, double maxSpeed, double handling, double accel, String desc) {
            this.name = name; this.body = body; this.paint = paint; this.stripe = 1;
            this.maxSpeed = maxSpeed; this.handling = handling; this.accel = accel; this.desc = desc;
        }
        Color paintColor() { return PAINTS[paint]; }
        int width() {
            switch (body) {
                case MUSCLE: return 50;
                case NINJA:  return 40;
                default:     return 44;
            }
        }
    }

    // Extensível: no futuro a garagem pode ser carregada da API do Autohub
    // (cada projeto do usuário vira um carro com stats derivados do repo).
    static List<CarSpec> loadGarage() {
        List<CarSpec> g = new ArrayList<CarSpec>();
        g.add(new CarSpec("AUTOHUB GT", Body.GT,     0, 10.5, 6.6, 0.060, "Equilibrado. O clássico da casa."));
        g.add(new CarSpec("MUSCLE 71",  Body.MUSCLE, 1, 12.5, 4.8, 0.075, "Reto ninguém segura. Curva é outra história."));
        g.add(new CarSpec("NINJA RS",   Body.NINJA,  2,  9.5, 9.0, 0.055, "Ágil demais. Costura o trânsito."));
        g.add(new CarSpec("FANTASMA X", Body.GHOST,  3, 11.2, 7.2, 0.045, "Rápido e preciso, mas acelera devagar."));
        return g;
    }

    // ---------- Trânsito ----------
    enum VType {
        CAR(44, 76, 2.8, 1.0), MOTO(22, 52, 4.2, 1.0), TRUCK(50, 122, 2.0, 0.5), BUS(48, 112, 2.4, 0.4);
        final int w, len; final double baseSpd, spdVar;
        VType(int w, int len, double baseSpd, double spdVar) { this.w = w; this.len = len; this.baseSpd = baseSpd; this.spdVar = spdVar; }
    }

    class Vehicle {
        VType type;
        double x, y, ownSpeed;
        int lane, targetLane;
        boolean changing, passed;
        int blink;
        Color color;
    }

    // ---------- Powerups ----------
    static final int PU_NITRO = 0, PU_SHIELD = 1, PU_MULT = 2;

    class PowerUp { int type; double x, y; double pulse; }

    // ---------- Partículas ----------
    class Particle {
        double x, y, vx, vy, size;
        int life, maxLife;
        Color color;
    }

    // ---------- Estado ----------
    State state = State.MENU;
    final List<CarSpec> garage = loadGarage();
    int carIdx = 0;

    double playerX = ROAD_L + LANE_W * 1.5;
    double speed, distance, score;
    int highscore;
    boolean newRecord;
    int spawnTimer, puTimer, framesAlive;
    double menuScroll;
    int gear = 1, shiftFlash;
    int nitroT, multT;
    boolean shield;
    boolean mouseGas, mouseBrake;

    final List<Vehicle> traffic = new ArrayList<Vehicle>();
    final List<PowerUp> powerups = new ArrayList<PowerUp>();
    final List<Particle> particles = new ArrayList<Particle>();
    final Set<Integer> keys = new HashSet<Integer>();
    final Random rng = new Random();
    final Timer timer = new Timer(16, this);

    static final Color[] TRAFFIC_COLORS = {
        new Color(0x64748B), new Color(0x0EA5E9), new Color(0x84CC16),
        new Color(0xEC4899), new Color(0xEAB308), new Color(0xF8FAFC), new Color(0x7C3AED)
    };
    // limites de km/h de cada marcha (1ª a 6ª)
    static final int[] GEAR_KMH = { 0, 45, 90, 135, 180, 230, 400 };

    AutoDash() {
        setPreferredSize(new java.awt.Dimension(W, H));
        setFocusable(true);
        addKeyListener(this);
        addMouseListener(this);
        highscore = loadHighscore();
        loadCustom();
        timer.start();
    }

    // ---------- Persistência ----------
    static Path hsFile()     { return Paths.get(System.getProperty("user.home"), ".autodash_highscore"); }
    static Path customFile() { return Paths.get(System.getProperty("user.home"), ".autodash_custom"); }

    static int loadHighscore() {
        try { return Integer.parseInt(new String(Files.readAllBytes(hsFile()), StandardCharsets.UTF_8).trim()); }
        catch (Exception e) { return 0; }
    }
    static void saveHighscore(int hs) {
        try { Files.write(hsFile(), String.valueOf(hs).getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) {}
    }
    void loadCustom() {
        try {
            List<String> lines = Files.readAllLines(customFile(), StandardCharsets.UTF_8);
            for (int i = 0; i < lines.size() && i < garage.size(); i++) {
                String[] p = lines.get(i).split(",");
                garage.get(i).paint = Math.floorMod(Integer.parseInt(p[0].trim()), PAINTS.length);
                garage.get(i).stripe = Math.floorMod(Integer.parseInt(p[1].trim()), STRIPES.length);
            }
        } catch (Exception ignored) {}
    }
    void saveCustom() {
        StringBuilder sb = new StringBuilder();
        for (CarSpec c : garage) sb.append(c.paint).append(",").append(c.stripe).append("\n");
        try { Files.write(customFile(), sb.toString().getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) {}
    }

    // ---------- Loop ----------
    @Override public void actionPerformed(ActionEvent e) {
        menuScroll += 3;
        if (state == State.PLAYING) tick();
        if (state == State.PLAYING || state == State.GAME_OVER) updateParticles();
        repaint();
    }

    boolean throttle() { return mouseGas || keys.contains(KeyEvent.VK_UP) || keys.contains(KeyEvent.VK_W); }
    boolean braking()  { return mouseBrake || keys.contains(KeyEvent.VK_DOWN) || keys.contains(KeyEvent.VK_S); }

    void tick() {
        CarSpec car = garage.get(carIdx);
        framesAlive++;
        double difficulty = Math.min(1.0, distance / 70000.0);

        // --- física: acelerador / freio / banguela ---
        double maxSpd = car.maxSpeed * (nitroT > 0 ? 1.45 : 1.0);
        if (nitroT > 0) { speed = Math.min(maxSpd, speed + car.accel * 3.5); nitroT--; }
        else if (throttle()) speed = Math.min(maxSpd, speed + car.accel);
        else if (braking())  speed = Math.max(1.2, speed - 0.16);
        else                 speed = Math.max(1.2, speed * 0.996 - 0.008);
        if (multT > 0) multT--;

        distance += speed;
        score += speed * 0.12 * (multT > 0 ? 2 : 1);

        // --- câmbio ---
        int kmh = (int) (speed * KMH);
        int g = 1;
        while (g < 6 && kmh >= GEAR_KMH[g]) g++;
        if (g != gear) { Sfx.tone(g > gear ? 220 : 180, 55, 0.35); shiftFlash = 12; }
        gear = g;
        if (shiftFlash > 0) shiftFlash--;

        // --- direção ---
        double steer = car.handling * (0.75 + 0.25 * Math.min(1, speed / 6));
        if (keys.contains(KeyEvent.VK_LEFT) || keys.contains(KeyEvent.VK_A))  playerX -= steer;
        if (keys.contains(KeyEvent.VK_RIGHT) || keys.contains(KeyEvent.VK_D)) playerX += steer;
        double halfW = car.width() / 2.0 + 4;
        playerX = Math.max(ROAD_L + halfW, Math.min(ROAD_R - halfW, playerX));

        // --- partículas do carro ---
        boolean burnout = throttle() && speed < 4.5;
        if (nitroT > 0) {
            emit(playerX - 10, PLAYER_Y + 74, 0, 3.5, 8, 14, rng.nextBoolean() ? new Color(0xFB923C) : new Color(0xFDE047));
            emit(playerX + 10, PLAYER_Y + 74, 0, 3.5, 8, 14, rng.nextBoolean() ? new Color(0xFB923C) : new Color(0xFDE047));
        } else if (burnout && framesAlive % 2 == 0) {
            emit(playerX - car.width() / 2.0 + 4, PLAYER_Y + 66, rng.nextGaussian() * 0.8, 1.5, 12, 45, new Color(0xE2E8F0));
            emit(playerX + car.width() / 2.0 - 4, PLAYER_Y + 66, rng.nextGaussian() * 0.8, 1.5, 12, 45, new Color(0xE2E8F0));
        } else if (throttle() && framesAlive % 4 == 0) {
            emit(playerX - 9, PLAYER_Y + 76, rng.nextGaussian() * 0.3, 2.2, 5, 26, new Color(0x94A3B8));
            emit(playerX + 9, PLAYER_Y + 76, rng.nextGaussian() * 0.3, 2.2, 5, 26, new Color(0x94A3B8));
        }

        // --- spawn de trânsito ---
        if (--spawnTimer <= 0) {
            spawnTimer = (int) (56 - 32 * difficulty) + rng.nextInt(14);
            int lane1 = spawnVehicle();
            if (lane1 >= 0 && difficulty > 0.2 && rng.nextDouble() < 0.3 + 0.3 * difficulty) spawnVehicle();
        }

        // --- spawn de powerup ---
        if (--puTimer <= 0) {
            puTimer = 380 + rng.nextInt(280);
            PowerUp p = new PowerUp();
            p.type = rng.nextInt(3);
            p.x = ROAD_L + LANE_W * (rng.nextInt(LANES) + 0.5);
            p.y = -40;
            powerups.add(p);
        }

        // --- trânsito: movimento, troca de faixa, colisão ---
        Rectangle2D me = box(playerX, PLAYER_Y, car.width(), 76);
        for (int i = traffic.size() - 1; i >= 0; i--) {
            Vehicle v = traffic.get(i);
            v.y += speed - v.ownSpeed;

            if (!v.changing && (v.type == VType.CAR || v.type == VType.MOTO)
                    && v.y > 40 && v.y < H - 260 && rng.nextDouble() < 0.0022 * (0.5 + difficulty)) {
                int t = v.lane + (rng.nextBoolean() ? 1 : -1);
                if (t >= 0 && t < LANES && laneClearAround(t, v.y, 150)) { v.targetLane = t; v.changing = true; }
            }
            if (v.changing) {
                double tx = ROAD_L + LANE_W * (v.targetLane + 0.5);
                v.blink++;
                v.x += Math.signum(tx - v.x) * Math.min(1.4, Math.abs(tx - v.x));
                if (Math.abs(tx - v.x) < 0.5) { v.lane = v.targetLane; v.changing = false; v.blink = 0; }
            }

            if (!v.passed && v.y > PLAYER_Y + 76) {
                v.passed = true;
                if (Math.abs(v.x - playerX) < (v.type.w + car.width()) * 0.85) {
                    score += 100 * (multT > 0 ? 2 : 1);
                    Sfx.tone(1300, 70, 0.35);
                }
            }
            if (v.y > H + v.type.len || v.y < -320) {
                traffic.remove(i);
            } else if (framesAlive > 30 && me.intersects(box(v.x, v.y, v.type.w, v.type.len))) {
                if (shield) {
                    shield = false;
                    traffic.remove(i);
                    burst(v.x, v.y + v.type.len / 2.0, 22, new Color(0x60A5FA));
                    Sfx.seq(new double[]{700, 500, 350}, 70, 0.45);
                } else {
                    crash();
                    return;
                }
            }
        }

        // --- powerups: movimento e coleta ---
        for (int i = powerups.size() - 1; i >= 0; i--) {
            PowerUp p = powerups.get(i);
            p.y += speed - 2.5;
            p.pulse += 0.15;
            if (p.y > H + 40) { powerups.remove(i); continue; }
            if (Math.hypot(p.x - playerX, p.y - (PLAYER_Y + 38)) < 44) {
                powerups.remove(i);
                Sfx.seq(new double[]{660, 880, 1180}, 55, 0.4);
                if (p.type == PU_NITRO)  { nitroT = 240; Sfx.noise(300, 0.3); }
                if (p.type == PU_SHIELD) shield = true;
                if (p.type == PU_MULT)   multT = 480;
            }
        }
    }

    int spawnVehicle() {
        double roll = rng.nextDouble();
        VType t = roll < 0.55 ? VType.CAR : roll < 0.70 ? VType.MOTO : roll < 0.88 ? VType.TRUCK : VType.BUS;
        List<Integer> free = new ArrayList<Integer>();
        for (int l = 0; l < LANES; l++) if (laneClearAround(l, -60, 200)) free.add(l);
        if (free.isEmpty()) return -1;
        int lane = free.get(rng.nextInt(free.size()));
        Vehicle v = new Vehicle();
        v.type = t;
        v.lane = lane; v.targetLane = lane;
        v.x = ROAD_L + LANE_W * (lane + 0.5);
        v.y = -t.len - rng.nextInt(50);
        v.ownSpeed = t.baseSpd + rng.nextDouble() * t.spdVar;
        v.color = t == VType.BUS ? new Color(0xFACC15) : TRAFFIC_COLORS[rng.nextInt(TRAFFIC_COLORS.length)];
        traffic.add(v);
        return lane;
    }

    boolean laneClearAround(int lane, double y, double margin) {
        for (Vehicle v : traffic) {
            int vl = v.changing ? v.targetLane : v.lane;
            if ((vl == lane || v.lane == lane) && Math.abs(v.y - y) < margin + v.type.len) return false;
        }
        return true;
    }

    static Rectangle2D box(double cx, double cy, int w, int len) {
        return new Rectangle2D.Double(cx - w / 2.0 + 5, cy + 5, w - 10, len - 10);
    }

    void emit(double x, double y, double vx, double vy, double size, int life, Color c) {
        Particle p = new Particle();
        p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.size = size;
        p.life = life; p.maxLife = life; p.color = c;
        particles.add(p);
    }

    void burst(double x, double y, int n, Color c) {
        for (int i = 0; i < n; i++) {
            double a = rng.nextDouble() * Math.PI * 2, sp = 1 + rng.nextDouble() * 4;
            emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 4 + rng.nextInt(6), 30 + rng.nextInt(20), c);
        }
    }

    void updateParticles() {
        for (int i = particles.size() - 1; i >= 0; i--) {
            Particle p = particles.get(i);
            p.x += p.vx; p.y += p.vy;
            p.size *= 1.02;
            if (--p.life <= 0) particles.remove(i);
        }
    }

    void startRun() {
        traffic.clear(); powerups.clear(); particles.clear();
        playerX = ROAD_L + LANE_W * 1.5;
        speed = 1.2; distance = 0; score = 0;
        spawnTimer = 60; puTimer = 400; framesAlive = 0;
        gear = 1; shiftFlash = 0; nitroT = 0; multT = 0; shield = false;
        newRecord = false;
        state = State.PLAYING;
        Sfx.seq(new double[]{520, 520, 780}, 110, 0.4);
    }

    void crash() {
        Sfx.noise(400, 0.6);
        burst(playerX, PLAYER_Y + 38, 34, new Color(0xFB923C));
        burst(playerX, PLAYER_Y + 38, 18, new Color(0xEF4444));
        int finalScore = (int) score;
        if (finalScore > highscore) { highscore = finalScore; newRecord = true; saveHighscore(highscore); }
        state = State.GAME_OVER;
    }

    // ---------- Input ----------
    @Override public void keyPressed(KeyEvent e) {
        int k = e.getKeyCode();
        keys.add(k);
        switch (state) {
            case MENU:
                if (k == KeyEvent.VK_ENTER) { state = State.GARAGE; Sfx.tone(880, 60, 0.35); }
                break;
            case GARAGE:
                if (k == KeyEvent.VK_LEFT)  { carIdx = (carIdx + garage.size() - 1) % garage.size(); Sfx.tone(660, 45, 0.3); }
                if (k == KeyEvent.VK_RIGHT) { carIdx = (carIdx + 1) % garage.size(); Sfx.tone(660, 45, 0.3); }
                if (k == KeyEvent.VK_C) { CarSpec c = garage.get(carIdx); c.paint = (c.paint + 1) % PAINTS.length; saveCustom(); Sfx.tone(990, 40, 0.3); }
                if (k == KeyEvent.VK_V) { CarSpec c = garage.get(carIdx); c.stripe = (c.stripe + 1) % STRIPES.length; saveCustom(); Sfx.tone(990, 40, 0.3); }
                if (k == KeyEvent.VK_ENTER) startRun();
                if (k == KeyEvent.VK_ESCAPE) state = State.MENU;
                break;
            case PLAYING:
                if (k == KeyEvent.VK_ESCAPE || k == KeyEvent.VK_P) { state = State.PAUSED; Sfx.tone(440, 60, 0.3); }
                break;
            case PAUSED:
                if (k == KeyEvent.VK_ESCAPE || k == KeyEvent.VK_P || k == KeyEvent.VK_ENTER) state = State.PLAYING;
                if (k == KeyEvent.VK_M) state = State.MENU;
                break;
            case GAME_OVER:
                if (k == KeyEvent.VK_ENTER) state = State.GARAGE;
                if (k == KeyEvent.VK_M) state = State.MENU;
                break;
        }
    }
    @Override public void keyReleased(KeyEvent e) { keys.remove(e.getKeyCode()); }
    @Override public void keyTyped(KeyEvent e) {}

    @Override public void mousePressed(MouseEvent e) {
        if (e.getButton() == MouseEvent.BUTTON1) {
            if (state == State.PLAYING) mouseGas = true;
            else if (state == State.MENU) { state = State.GARAGE; Sfx.tone(880, 60, 0.35); }
            else if (state == State.GAME_OVER) state = State.GARAGE;
        }
        if (e.getButton() == MouseEvent.BUTTON3 && state == State.PLAYING) mouseBrake = true;
    }
    @Override public void mouseReleased(MouseEvent e) {
        if (e.getButton() == MouseEvent.BUTTON1) mouseGas = false;
        if (e.getButton() == MouseEvent.BUTTON3) mouseBrake = false;
    }
    @Override public void mouseClicked(MouseEvent e) {}
    @Override public void mouseEntered(MouseEvent e) {}
    @Override public void mouseExited(MouseEvent e) {}

    // ---------- Render ----------
    @Override protected void paintComponent(Graphics g0) {
        super.paintComponent(g0);
        Graphics2D g = (Graphics2D) g0;
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        double scroll = (state == State.MENU || state == State.GARAGE) ? menuScroll : distance;
        drawRoad(g, scroll);

        switch (state) {
            case MENU:      drawMenu(g); break;
            case GARAGE:    drawGarage(g); break;
            case PLAYING:   drawWorld(g); drawHud(g); break;
            case PAUSED:    drawWorld(g); drawHud(g); drawPause(g); break;
            case GAME_OVER: drawWorld(g); drawGameOver(g); break;
        }
    }

    void drawRoad(Graphics2D g, double scroll) {
        g.setPaint(new GradientPaint(0, 0, new Color(0x14532D), 0, H, new Color(0x166534)));
        g.fillRect(0, 0, W, H);
        g.setColor(new Color(0, 0, 0, 30));
        int stripe = 80;
        int off = (int) (scroll % (stripe * 2));
        for (int y = -stripe * 2 + off; y < H; y += stripe * 2) {
            g.fillRect(0, y, ROAD_L, stripe);
            g.fillRect(ROAD_R, y, W - ROAD_R, stripe);
        }
        g.setPaint(new GradientPaint(ROAD_L, 0, new Color(0x2B2B31), ROAD_R, 0, new Color(0x232329)));
        g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
        g.setColor(new Color(0xF8FAFC));
        g.fillRect(ROAD_L - 6, 0, 6, H);
        g.fillRect(ROAD_R, 0, 6, H);
        g.setColor(new Color(255, 255, 255, 170));
        int dash = 34, gap = 26, cycle = dash + gap;
        int doff = (int) (scroll % cycle);
        for (int l = 1; l < LANES; l++) {
            int x = (int) (ROAD_L + LANE_W * l);
            for (int y = -cycle + doff; y < H; y += cycle) g.fillRoundRect(x - 3, y, 6, dash, 6, 6);
        }
    }

    void drawWorld(Graphics2D g) {
        for (PowerUp p : powerups) drawPowerUp(g, p);
        for (Vehicle v : traffic) drawVehicle(g, v);
        drawParticles(g);
        CarSpec car = garage.get(carIdx);
        if (shield) {
            g.setColor(new Color(96, 165, 250, 90));
            g.fillOval((int) playerX - car.width() / 2 - 12, PLAYER_Y - 12, car.width() + 24, 100);
            g.setColor(new Color(96, 165, 250, 180));
            g.drawOval((int) playerX - car.width() / 2 - 12, PLAYER_Y - 12, car.width() + 24, 100);
        }
        drawPlayerCar(g, playerX, PLAYER_Y, car);
        // linhas de velocidade nas bordas
        int kmh = (int) (speed * KMH);
        if (kmh > 200 && state == State.PLAYING) {
            g.setColor(new Color(255, 255, 255, 60));
            for (int i = 0; i < 6; i++) {
                int x = rng.nextBoolean() ? 8 + rng.nextInt(50) : W - 58 + rng.nextInt(50);
                int y = rng.nextInt(H);
                g.fillRect(x, y, 2, 30 + rng.nextInt(40));
            }
        }
    }

    void drawParticles(Graphics2D g) {
        for (Particle p : particles) {
            int alpha = (int) (200.0 * p.life / p.maxLife);
            g.setColor(new Color(p.color.getRed(), p.color.getGreen(), p.color.getBlue(), Math.max(0, Math.min(255, alpha))));
            int s = (int) p.size;
            g.fillOval((int) (p.x - s / 2.0), (int) (p.y - s / 2.0), s, s);
        }
    }

    // ---------- Desenho dos carros ----------
    void drawPlayerCar(Graphics2D g, double cx, double cy, CarSpec spec) {
        int w = spec.width(), h = 76;
        int x = (int) (cx - w / 2.0), y = (int) cy;
        Color body = spec.paintColor();

        g.setColor(new Color(0, 0, 0, 70));
        g.fillRoundRect(x - 3, y + 4, w + 6, h, 16, 16);
        g.setColor(new Color(0x18181B));
        g.fillRoundRect(x - 4, y + 8, 8, 18, 4, 4);
        g.fillRoundRect(x + w - 4, y + 8, 8, 18, 4, 4);
        g.fillRoundRect(x - 4, y + h - 26, 8, 18, 4, 4);
        g.fillRoundRect(x + w - 4, y + h - 26, 8, 18, 4, 4);

        g.setPaint(new GradientPaint(x, y, body.brighter(), x + w, y, body.darker()));
        if (spec.body == Body.GHOST) {
            Polygon p = new Polygon();
            p.addPoint(x + w / 2, y);
            p.addPoint(x + w, y + 16);
            p.addPoint(x + w, y + h - 6);
            p.addPoint(x + w - 8, y + h);
            p.addPoint(x + 8, y + h);
            p.addPoint(x, y + h - 6);
            p.addPoint(x, y + 16);
            g.fill(p);
        } else {
            g.fill(new RoundRectangle2D.Double(x, y, w, h, spec.body == Body.NINJA ? 24 : 16, spec.body == Body.NINJA ? 24 : 16));
        }

        // faixas customizáveis
        g.setColor(new Color(255, 255, 255, 80));
        switch (spec.stripe) {
            case 1: g.fillRect(x + w / 2 - 4, y + 3, 8, h - 6); break;
            case 2: g.fillRect(x + w / 2 - 9, y + 3, 6, h - 6); g.fillRect(x + w / 2 + 3, y + 3, 6, h - 6); break;
            case 3: g.fillRect(x + 3, y + 3, 5, h - 6); g.fillRect(x + w - 8, y + 3, 5, h - 6); break;
        }

        // identidade por carroceria
        g.setColor(new Color(0, 0, 0, 90));
        if (spec.body == Body.MUSCLE) g.fillRoundRect(x + w / 2 - 8, y + 6, 16, 12, 4, 4); // entrada de ar no capô
        if (spec.body == Body.GT)     g.fillRoundRect(x - 2, y + h - 8, w + 4, 6, 4, 4);   // aerofólio
        if (spec.body == Body.NINJA)  { g.fillRect(x, y + 30, 3, h - 44); g.fillRect(x + w - 3, y + 30, 3, h - 44); } // saia lateral
        if (spec.body == Body.GHOST)  { g.fillRect(x + 6, y + h - 10, 8, 8); g.fillRect(x + w - 14, y + h - 10, 8, 8); } // aletas

        g.setColor(new Color(0x0F172A));
        g.fillRoundRect(x + 6, y + 16, w - 12, 15, 8, 8);
        g.fillRoundRect(x + 6, y + h - 26, w - 12, 11, 8, 8);
        g.setColor(new Color(0xFEF08A));
        g.fillRoundRect(x + 4, y + 2, 9, 5, 4, 4);
        g.fillRoundRect(x + w - 13, y + 2, 9, 5, 4, 4);
        // luz de freio
        if (state == State.PLAYING && braking()) {
            g.setColor(new Color(0xEF4444));
            g.fillRoundRect(x + 4, y + h - 5, 10, 4, 3, 3);
            g.fillRoundRect(x + w - 14, y + h - 5, 10, 4, 3, 3);
        }
    }

    void drawVehicle(Graphics2D g, Vehicle v) {
        int w = v.type.w, len = v.type.len;
        int x = (int) (v.x - w / 2.0), y = (int) v.y;
        g.setColor(new Color(0, 0, 0, 70));
        g.fillRoundRect(x - 3, y + 4, w + 6, len, 14, 14);

        switch (v.type) {
            case MOTO: {
                g.setColor(new Color(0x18181B));
                g.fillRoundRect(x + w / 2 - 4, y, 8, 16, 4, 4);
                g.fillRoundRect(x + w / 2 - 4, y + len - 16, 8, 16, 4, 4);
                g.setPaint(new GradientPaint(x, y, v.color.brighter(), x + w, y, v.color.darker()));
                g.fillRoundRect(x + 3, y + 10, w - 6, len - 20, 10, 10);
                g.setColor(new Color(0x0F172A)); // capacete
                g.fillOval(x + w / 2 - 7, y + len / 2 - 9, 14, 14);
                g.setColor(v.color.brighter());
                g.fillOval(x + w / 2 - 5, y + len / 2 - 7, 10, 6);
                break;
            }
            case TRUCK: {
                g.setColor(new Color(0x475569)); // baú
                g.fillRoundRect(x, y + 30, w, len - 32, 8, 8);
                g.setColor(new Color(0x334155));
                g.drawRoundRect(x, y + 30, w, len - 32, 8, 8);
                g.drawLine(x + 6, y + 40, x + 6, y + len - 10);
                g.drawLine(x + w - 6, y + 40, x + w - 6, y + len - 10);
                g.setPaint(new GradientPaint(x, y, v.color.brighter(), x + w, y, v.color.darker())); // cabine
                g.fillRoundRect(x + 2, y, w - 4, 30, 10, 10);
                g.setColor(new Color(0x0F172A));
                g.fillRoundRect(x + 7, y + 8, w - 14, 10, 6, 6);
                g.setColor(new Color(0x18181B));
                g.fillRoundRect(x - 4, y + 6, 8, 16, 4, 4);
                g.fillRoundRect(x + w - 4, y + 6, 8, 16, 4, 4);
                g.fillRoundRect(x - 4, y + len - 40, 8, 16, 4, 4);
                g.fillRoundRect(x + w - 4, y + len - 40, 8, 16, 4, 4);
                g.fillRoundRect(x - 4, y + len - 20, 8, 16, 4, 4);
                g.fillRoundRect(x + w - 4, y + len - 20, 8, 16, 4, 4);
                break;
            }
            case BUS: {
                g.setPaint(new GradientPaint(x, y, v.color.brighter(), x + w, y, v.color.darker()));
                g.fillRoundRect(x, y, w, len, 12, 12);
                g.setColor(new Color(0x0F172A));
                g.fillRoundRect(x + 6, y + 8, w - 12, 12, 6, 6);
                for (int wy = y + 28; wy < y + len - 18; wy += 18) { // janelas laterais
                    g.fillRoundRect(x + 3, wy, 7, 12, 3, 3);
                    g.fillRoundRect(x + w - 10, wy, 7, 12, 3, 3);
                }
                g.setColor(new Color(0x18181B));
                g.fillRoundRect(x - 4, y + 10, 8, 18, 4, 4);
                g.fillRoundRect(x + w - 4, y + 10, 8, 18, 4, 4);
                g.fillRoundRect(x - 4, y + len - 30, 8, 18, 4, 4);
                g.fillRoundRect(x + w - 4, y + len - 30, 8, 18, 4, 4);
                break;
            }
            default: {
                g.setColor(new Color(0x18181B));
                g.fillRoundRect(x - 4, y + 8, 8, 18, 4, 4);
                g.fillRoundRect(x + w - 4, y + 8, 8, 18, 4, 4);
                g.fillRoundRect(x - 4, y + len - 26, 8, 18, 4, 4);
                g.fillRoundRect(x + w - 4, y + len - 26, 8, 18, 4, 4);
                g.setPaint(new GradientPaint(x, y, v.color.brighter(), x + w, y, v.color.darker()));
                g.fillRoundRect(x, y, w, len, 16, 16);
                g.setColor(new Color(0x0F172A));
                g.fillRoundRect(x + 6, y + 14, w - 12, 15, 8, 8);
                g.fillRoundRect(x + 6, y + len - 26, w - 12, 11, 8, 8);
            }
        }
        // seta piscando ao trocar de faixa
        if (v.changing && (v.blink / 8) % 2 == 0) {
            g.setColor(new Color(0xFB923C));
            int bx = v.targetLane > v.lane ? x + w + 2 : x - 8;
            g.fillRoundRect(bx, y + len / 2 - 4, 6, 8, 3, 3);
        }
    }

    void drawPowerUp(Graphics2D g, PowerUp p) {
        int r = 17 + (int) (Math.sin(p.pulse) * 2);
        int x = (int) p.x, y = (int) p.y;
        Color c = p.type == PU_NITRO ? new Color(0xFB923C) : p.type == PU_SHIELD ? new Color(0x60A5FA) : new Color(0xFDE047);
        g.setColor(new Color(c.getRed(), c.getGreen(), c.getBlue(), 60));
        g.fillOval(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2);
        g.setColor(new Color(0x0F172A));
        g.fillOval(x - r, y - r, r * 2, r * 2);
        g.setColor(c);
        g.setStroke(new java.awt.BasicStroke(2.5f));
        g.drawOval(x - r, y - r, r * 2, r * 2);
        g.setStroke(new java.awt.BasicStroke(1f));
        if (p.type == PU_NITRO) {
            Polygon bolt = new Polygon();
            bolt.addPoint(x + 3, y - 10); bolt.addPoint(x - 7, y + 2); bolt.addPoint(x - 1, y + 2);
            bolt.addPoint(x - 3, y + 10); bolt.addPoint(x + 7, y - 2); bolt.addPoint(x + 1, y - 2);
            g.fillPolygon(bolt);
        } else if (p.type == PU_SHIELD) {
            Polygon sh = new Polygon();
            sh.addPoint(x, y - 9); sh.addPoint(x + 8, y - 5); sh.addPoint(x + 8, y + 2);
            sh.addPoint(x, y + 10); sh.addPoint(x - 8, y + 2); sh.addPoint(x - 8, y - 5);
            g.fillPolygon(sh);
        } else {
            g.setFont(new Font("Consolas", Font.BOLD, 15));
            g.drawString("2X", x - 10, y + 5);
        }
    }

    // ---------- HUD ----------
    void drawHud(Graphics2D g) {
        g.setColor(new Color(0, 0, 0, 120));
        g.fillRoundRect(10, 10, 200, 64, 14, 14);
        g.setColor(Color.WHITE);
        g.setFont(new Font("Consolas", Font.BOLD, 22));
        g.drawString("PONTOS " + (int) score, 22, 36);
        g.setFont(new Font("Consolas", Font.PLAIN, 15));
        g.setColor(new Color(255, 255, 255, 160));
        g.drawString("recorde " + highscore, 22, 60);
        if (multT > 0) {
            g.setColor(new Color(0xFDE047));
            g.setFont(new Font("Consolas", Font.BOLD, 15));
            g.drawString("2X!", 150, 60);
        }

        drawGearPanel(g);
        drawActivePowerups(g);
    }

    void drawGearPanel(Graphics2D g) {
        int px = W - 78, py = H - 300, pw = 66, ph = 236;
        g.setColor(new Color(0, 0, 0, 130));
        g.fillRoundRect(px, py, pw, ph, 14, 14);

        int kmh = (int) (speed * KMH);
        // coluna 1ª..6ª com a marcha atual em destaque
        for (int i = 1; i <= 6; i++) {
            int gy = py + 14 + (6 - i) * 27;
            if (i == gear) {
                g.setColor(shiftFlash > 0 ? Color.WHITE : new Color(0xFDE047));
                g.setFont(new Font("Consolas", Font.BOLD, 22));
                g.drawString(i + "ª", px + 10, gy + 18);
            } else {
                g.setColor(new Color(255, 255, 255, 70));
                g.setFont(new Font("Consolas", Font.PLAIN, 15));
                g.drawString(i + "ª", px + 14, gy + 16);
            }
        }
        // conta-giros vertical
        double lo = GEAR_KMH[gear - 1], hi = GEAR_KMH[gear];
        double rpm = Math.max(0, Math.min(1, (kmh - lo) / (hi - lo)));
        int barH = 156, barY = py + 16;
        g.setColor(new Color(255, 255, 255, 35));
        g.fillRoundRect(px + pw - 20, barY, 10, barH, 6, 6);
        int fill = (int) (barH * rpm);
        g.setColor(rpm > 0.85 ? new Color(0xEF4444) : rpm > 0.6 ? new Color(0xFB923C) : new Color(0x4ADE80));
        g.fillRoundRect(px + pw - 20, barY + barH - fill, 10, fill, 6, 6);

        g.setColor(nitroT > 0 ? new Color(0xFB923C) : Color.WHITE);
        g.setFont(new Font("Consolas", Font.BOLD, 17));
        g.drawString(String.valueOf(kmh), px + 10, py + ph - 26);
        g.setColor(new Color(255, 255, 255, 140));
        g.setFont(new Font("Consolas", Font.PLAIN, 12));
        g.drawString("km/h", px + 10, py + ph - 10);
    }

    void drawActivePowerups(Graphics2D g) {
        int x = W - 78, y = 14;
        g.setFont(new Font("Consolas", Font.BOLD, 13));
        if (nitroT > 0) {
            g.setColor(new Color(0xFB923C));
            g.drawString("NITRO", x, y + 11);
            g.fillRect(x, y + 16, (int) (60.0 * nitroT / 240), 5);
            y += 30;
        }
        if (multT > 0) {
            g.setColor(new Color(0xFDE047));
            g.drawString("2X PTS", x, y + 11);
            g.fillRect(x, y + 16, (int) (60.0 * multT / 480), 5);
            y += 30;
        }
        if (shield) {
            g.setColor(new Color(0x60A5FA));
            g.drawString("ESCUDO", x, y + 11);
        }
    }

    // ---------- Telas ----------
    void drawOverlay(Graphics2D g) {
        g.setColor(new Color(0, 0, 0, 160));
        g.fillRect(0, 0, W, H);
    }

    void centered(Graphics2D g, String s, int y) {
        int w = g.getFontMetrics().stringWidth(s);
        g.drawString(s, (W - w) / 2, y);
    }

    void drawMenu(Graphics2D g) {
        drawOverlay(g);
        g.setColor(new Color(0xE0342F));
        g.setFont(new Font("Consolas", Font.BOLD, 62));
        centered(g, "AUTODASH", 220);
        g.setColor(new Color(255, 255, 255, 200));
        g.setFont(new Font("Consolas", Font.PLAIN, 18));
        centered(g, "desvie do trânsito. sobreviva.", 260);
        g.setColor(new Color(0xFDE047));
        g.setFont(new Font("Consolas", Font.BOLD, 22));
        if ((menuScroll / 30) % 2 < 1) centered(g, "[ENTER ou CLIQUE]  garagem", 400);
        g.setColor(new Color(255, 255, 255, 150));
        g.setFont(new Font("Consolas", Font.PLAIN, 15));
        centered(g, "recorde: " + highscore, 450);
        centered(g, "setas/A-D dirigem", 560);
        centered(g, "mouse ESQ acelera · mouse DIR freia", 585);
        centered(g, "(ou W/S) · ESC pausa", 610);
    }

    void drawGarage(Graphics2D g) {
        drawOverlay(g);
        CarSpec car = garage.get(carIdx);
        g.setColor(Color.WHITE);
        g.setFont(new Font("Consolas", Font.BOLD, 28));
        centered(g, "GARAGEM", 60);
        g.setFont(new Font("Consolas", Font.PLAIN, 15));
        g.setColor(new Color(255, 255, 255, 150));
        centered(g, "◀  " + (carIdx + 1) + "/" + garage.size() + "  ▶", 90);

        Graphics2D g2 = (Graphics2D) g.create();
        g2.translate(W / 2.0, 130);
        g2.scale(2, 2);
        drawPlayerCar(g2, 0, 0, car);
        g2.dispose();

        g.setColor(car.paintColor());
        g.setFont(new Font("Consolas", Font.BOLD, 26));
        centered(g, car.name, 330);
        g.setColor(new Color(255, 255, 255, 190));
        g.setFont(new Font("Consolas", Font.ITALIC, 14));
        centered(g, car.desc, 356);

        drawStat(g, "VELOCIDADE", car.maxSpeed / 12.5, 390);
        drawStat(g, "DIREÇÃO", car.handling / 9.0, 420);
        drawStat(g, "ACELERAÇÃO", car.accel / 0.075, 450);

        // customização
        g.setColor(new Color(255, 255, 255, 200));
        g.setFont(new Font("Consolas", Font.BOLD, 15));
        g.drawString("[C] pintura", 60, 505);
        g.drawString("[V] faixa: " + STRIPES[car.stripe], 250, 505);
        for (int i = 0; i < PAINTS.length; i++) {
            int dx = 62 + i * 24;
            g.setColor(PAINTS[i]);
            g.fillOval(dx, 518, 16, 16);
            if (i == car.paint) {
                g.setColor(Color.WHITE);
                g.setStroke(new java.awt.BasicStroke(2f));
                g.drawOval(dx - 2, 516, 20, 20);
                g.setStroke(new java.awt.BasicStroke(1f));
            }
        }

        g.setColor(new Color(0xFDE047));
        g.setFont(new Font("Consolas", Font.BOLD, 20));
        centered(g, "[ENTER]  acelerar!", 590);
        g.setColor(new Color(255, 255, 255, 130));
        g.setFont(new Font("Consolas", Font.PLAIN, 14));
        centered(g, "[ESC] voltar", 620);
    }

    void drawStat(Graphics2D g, String label, double frac, int y) {
        int bx = 150, bw = 210, bh = 12;
        g.setFont(new Font("Consolas", Font.PLAIN, 13));
        g.setColor(new Color(255, 255, 255, 170));
        g.drawString(label, bx - 100, y + 11);
        g.setColor(new Color(255, 255, 255, 40));
        g.fillRoundRect(bx, y, bw, bh, 8, 8);
        g.setColor(new Color(0x4ADE80));
        g.fillRoundRect(bx, y, (int) (bw * Math.min(1, frac)), bh, 8, 8);
    }

    void drawPause(Graphics2D g) {
        drawOverlay(g);
        g.setColor(Color.WHITE);
        g.setFont(new Font("Consolas", Font.BOLD, 44));
        centered(g, "PAUSADO", 320);
        g.setFont(new Font("Consolas", Font.PLAIN, 17));
        g.setColor(new Color(255, 255, 255, 180));
        centered(g, "[ENTER] continuar   [M] menu", 370);
    }

    void drawGameOver(Graphics2D g) {
        drawOverlay(g);
        g.setColor(new Color(0xEF4444));
        g.setFont(new Font("Consolas", Font.BOLD, 48));
        centered(g, "BATEU!", 250);
        g.setColor(Color.WHITE);
        g.setFont(new Font("Consolas", Font.BOLD, 26));
        centered(g, "pontos: " + (int) score, 310);
        g.setFont(new Font("Consolas", Font.PLAIN, 17));
        g.setColor(new Color(255, 255, 255, 170));
        centered(g, (int) (distance / 150) + " m percorridos", 342);
        if (newRecord) {
            g.setColor(new Color(0xFDE047));
            g.setFont(new Font("Consolas", Font.BOLD, 24));
            centered(g, "★ NOVO RECORDE! ★", 385);
        } else {
            g.setColor(new Color(255, 255, 255, 160));
            g.setFont(new Font("Consolas", Font.PLAIN, 18));
            centered(g, "recorde: " + highscore, 385);
        }
        g.setColor(new Color(0xFDE047));
        g.setFont(new Font("Consolas", Font.BOLD, 19));
        centered(g, "[ENTER/CLIQUE] garagem   [M] menu", 450);
    }

    // ---------- Som sintetizado (sem arquivos externos) ----------
    static class Sfx {
        interface Gen { byte sample(int i, int n, float sr); }

        static void tone(final double freq, final int ms, final double vol) {
            play(new Gen() { public byte sample(int i, int n, float sr) {
                double env = 1.0 - (double) i / n;
                return (byte) (Math.sin(2 * Math.PI * freq * i / sr) * 127 * vol * env);
            }}, ms);
        }
        static void noise(final int ms, final double vol) {
            final Random r = new Random();
            play(new Gen() { public byte sample(int i, int n, float sr) {
                double env = Math.pow(1.0 - (double) i / n, 2);
                return (byte) ((r.nextInt(255) - 127) * vol * env);
            }}, ms);
        }
        static void seq(final double[] freqs, final int msEach, final double vol) {
            play(new Gen() { public byte sample(int i, int n, float sr) {
                int seg = n / freqs.length;
                int f = Math.min(freqs.length - 1, i / seg);
                double li = i % seg;
                double env = 1.0 - li / seg;
                return (byte) (Math.sin(2 * Math.PI * freqs[f] * i / sr) * 127 * vol * env);
            }}, msEach * freqs.length);
        }
        static void play(final Gen gen, final int ms) {
            Thread t = new Thread(new Runnable() { public void run() {
                try {
                    float sr = 22050f;
                    int n = (int) (sr * ms / 1000);
                    byte[] buf = new byte[n];
                    for (int i = 0; i < n; i++) buf[i] = gen.sample(i, n, sr);
                    AudioFormat af = new AudioFormat(sr, 8, 1, true, false);
                    SourceDataLine line = AudioSystem.getSourceDataLine(af);
                    line.open(af);
                    line.start();
                    line.write(buf, 0, n);
                    line.drain();
                    line.close();
                } catch (Exception ignored) {}
            }});
            t.setDaemon(true);
            t.start();
        }
    }

    public static void main(String[] args) {
        javax.swing.SwingUtilities.invokeLater(new Runnable() { public void run() {
            JFrame f = new JFrame("AutoDash 🏁");
            f.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            f.setResizable(false);
            f.add(new AutoDash());
            f.pack();
            f.setLocationRelativeTo(null);
            f.setVisible(true);
        }});
    }
}
