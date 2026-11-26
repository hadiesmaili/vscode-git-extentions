import { execFile, spawn } from 'node:child_process';

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

export interface RunOptions {
  stdin?: string;
  /** Accept these non-zero exit codes. */
  okCodes?: number[];
  /** Kill git after this many ms (0 = no limit). */
  timeout?: number;
}

const ENV = {
  ...process.env,
  LC_ALL: 'C',
  LANG: 'C',
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
};

/** Thin wrapper over the git CLI. Arguments are never passed through a shell. */
export class GitClient {
  constructor(
    readonly cwd: string,
    private readonly gitPath = 'git',
  ) {}

  run(args: string[], opts: RunOptions = {}): Promise<string> {
    const full = ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args];
    if (opts.stdin !== undefined) return this.runWithStdin(full, opts);
    return new Promise((resolve, reject) => {
      execFile(
        this.gitPath,
        full,
        { cwd: this.cwd, env: ENV, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8', timeout: opts.timeout ?? 0 },
        (err, stdout, stderr) => {
          if (err) {
            const code = typeof err.code === 'number' ? err.code : null;
            if (code !== null && opts.okCodes?.includes(code)) return resolve(stdout);
            if (err.killed) return reject(new GitError(`git ${args[0]} timed out`, stderr, null));
            return reject(new GitError(cleanError(stderr) || err.message, stderr, code));
          }
          resolve(stdout);
        },
      );
    });
  }

  private runWithStdin(args: string[], opts: RunOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = spawn(this.gitPath, args, { cwd: this.cwd, env: ENV });
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      p.stdout.on('data', (d: Buffer) => out.push(d));
      p.stderr.on('data', (d: Buffer) => err.push(d));
      p.on('error', reject);
      p.on('close', (code) => {
        const stdout = Buffer.concat(out).toString('utf8');
        const stderr = Buffer.concat(err).toString('utf8');
        if (code === 0 || (code !== null && opts.okCodes?.includes(code))) resolve(stdout);
        else reject(new GitError(cleanError(stderr) || `git exited with ${code}`, stderr, code));
      });
      p.stdin.end(opts.stdin);
    });
  }

  /** Raw bytes, for file contents. */
  runBuffer(args: string[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      execFile(
        this.gitPath,
        args,
        { cwd: this.cwd, env: ENV, maxBuffer: 256 * 1024 * 1024, encoding: 'buffer' },
        (err, stdout, stderr) => {
          if (err) reject(new GitError(cleanError(stderr.toString()) || err.message, stderr.toString(), null));
          else resolve(stdout);
        },
      );
    });
  }
}

function cleanError(stderr: string): string {
  return stderr
    .split('\n')
    .map((l) => l.replace(/^(fatal|error): /, '').trim())
    .filter((l) => l && !l.startsWith('hint:'))
    .join('\n');
}
