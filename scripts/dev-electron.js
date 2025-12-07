const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');

const DEV_URL = 'http://localhost:5173';

async function main() {
  await waitOn({
    resources: [DEV_URL],
    timeout: 30000,
    interval: 200
  });

  const electronBinary = require('electron');
  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: DEV_URL,
    ELECTRON_DEV_SERVER: 'true'
  };

  const child = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env,
    cwd: path.resolve(__dirname, '..')
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

