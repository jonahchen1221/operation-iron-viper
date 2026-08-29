type SoundEvent =
  | 'jump' | 'playerFire' | 'laser' | 'enemyDown' | 'playerDown' | 'revive'
  | 'pickup' | 'checkpoint' | 'bossAlarm' | 'bossBurst' | 'bossDown'
  | 'stageClear' | 'victory' | 'gameOver' | 'linkActive' | 'missionStart';

export class Sfx {
  private context: AudioContext | null = null;
  private enabled = true;

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playEvents(events: readonly string[]): void {
    if (!this.enabled || !this.context) return;
    for (const event of events) this.play(event as SoundEvent);
  }

  private play(event: SoundEvent): void {
    if (!this.context) return;
    if (event === 'playerFire') this.tone(160, 0.035, 'square', 0.035, -45);
    else if (event === 'laser') this.tone(680, 0.08, 'sawtooth', 0.045, -380);
    else if (event === 'jump') this.tone(180, 0.08, 'square', 0.03, 110);
    else if (event === 'enemyDown') this.noise(0.055, 0.035);
    else if (event === 'playerDown') { this.noise(0.18, 0.08); this.tone(120, 0.24, 'sawtooth', 0.05, -80); }
    else if (event === 'pickup') this.sequence([440, 660, 880], 0.045, 0.035);
    else if (event === 'revive') this.sequence([220, 330, 495, 740], 0.055, 0.035);
    else if (event === 'checkpoint') this.sequence([330, 440, 660], 0.07, 0.03);
    else if (event === 'linkActive') this.sequence([220, 330, 440, 660, 880], 0.04, 0.04);
    else if (event === 'bossAlarm') this.sequence([95, 75, 95, 75], 0.13, 0.055);
    else if (event === 'bossBurst') this.tone(80, 0.11, 'square', 0.04, 35);
    else if (event === 'bossDown') { this.noise(0.5, 0.12); this.sequence([180, 150, 120, 90], 0.11, 0.05); }
    else if (event === 'missionStart') this.sequence([196, 294, 392], 0.08, 0.035);
    else if (event === 'stageClear') this.sequence([262, 330, 392, 523], 0.1, 0.04);
    else if (event === 'victory') this.sequence([262, 330, 392, 523, 659, 784], 0.12, 0.045);
    else if (event === 'gameOver') this.sequence([220, 196, 165, 110], 0.15, 0.04);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, slide = 0, delay = 0): void {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private sequence(notes: number[], length: number, volume: number): void {
    notes.forEach((note, index) => this.tone(note, length, 'square', volume, 0, index * length * 0.88));
  }

  private noise(duration: number, volume: number): void {
    const context = this.context;
    if (!context) return;
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Sound is client-only and does not affect deterministic simulation.
    for (let index = 0; index < frames; index++) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(gain).connect(context.destination);
    source.start();
  }
}
