import { parentPort, workerData } from 'worker_threads';

if (parentPort) {
  parentPort.postMessage({
    taskId: workerData && typeof workerData.taskId === 'string' ? workerData.taskId : undefined
  });
}
