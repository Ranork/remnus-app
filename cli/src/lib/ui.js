// Everything this CLI prints goes to **stderr**, without exception.
//
// `remnus mcp` speaks JSON-RPC over stdout: a single stray log line there corrupts
// the stream and the host reports the server as broken. Keeping all human output on
// stderr means no command can ever break that contract by accident.

const useColor =
  !process.env.NO_COLOR &&
  process.env.TERM !== 'dumb' &&
  process.stderr.isTTY;

const wrap = (code) => (text) => (useColor ? `[${code}m${text}[0m` : text);

export const dim = wrap('2');
export const bold = wrap('1');
export const green = wrap('32');
export const yellow = wrap('33');
export const red = wrap('31');
export const blue = wrap('34');

export function say(line = '') {
  process.stderr.write(`${line}\n`);
}

export function step(line) {
  say(`${blue('›')} ${line}`);
}

export function ok(line) {
  say(`${green('✓')} ${line}`);
}

export function warn(line) {
  say(`${yellow('!')} ${line}`);
}

export function fail(line) {
  say(`${red('✗')} ${line}`);
}

export function detail(line) {
  say(`  ${dim(line)}`);
}
