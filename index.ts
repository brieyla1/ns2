import { syncData } from './sync';
import config from './config';
import { updateGlobalLinks } from './globalLinks';

async function main_loop() {
  await updateGlobalLinks();
  while (true) {
    // Start the sync process immediately
    await syncData();

    // Then sleep for 10s
    await new Promise((resolve) => setTimeout(resolve, (Number(config?.poll_interval) || 5) * 1000));
  }
}

main_loop();
