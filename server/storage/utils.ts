// server/storage/utils.ts

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  export function currentTimestamp() {
    return new Date().toISOString();
  }