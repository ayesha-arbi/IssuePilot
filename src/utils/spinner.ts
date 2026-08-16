/**
 * Lightweight, zero-dependency terminal spinner for stderr.
 * Keeps stdout clean for markdown outputs.
 */

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL = 80;

export class Spinner {
  private timer: NodeJS.Timeout | null = null;
  private currentFrame = 0;
  private text = "";
  private isTTY: boolean;

  constructor() {
    this.isTTY = Boolean(process.stderr && process.stderr.isTTY);
  }

  public start(text: string): this {
    this.text = text;
    this.currentFrame = 0;

    if (this.timer) {
      clearInterval(this.timer);
    }

    if (!this.isTTY) {
      process.stderr.write(`[...] ${text}\n`);
      return this;
    }

    this.render();
    this.timer = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % FRAMES.length;
      this.render();
    }, INTERVAL);

    return this;
  }

  public update(text: string): this {
    this.text = text;
    if (!this.isTTY && text) {
      process.stderr.write(`[...] ${text}\n`);
    } else {
      this.render();
    }
    return this;
  }

  public stop(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.isTTY) {
      process.stderr.write(`\r\x1b[K`);
    }
    return this;
  }

  public succeed(text?: string): this {
    this.stop();
    const message = text || this.text;
    process.stderr.write(`✔ ${message}\n`);
    return this;
  }

  public fail(text?: string): this {
    this.stop();
    const message = text || this.text;
    process.stderr.write(`✖ ${message}\n`);
    return this;
  }

  private render(): void {
    if (this.isTTY) {
      const frame = FRAMES[this.currentFrame];
      process.stderr.write(`\r\x1b[K${frame} ${this.text}`);
    }
  }
}

export const globalSpinner = new Spinner();
