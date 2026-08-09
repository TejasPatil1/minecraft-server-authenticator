import net from "net";

// Real readiness check: EC2 can report "running" while the OS is still
// booting and Fabric hasn't opened the game port yet. This is what
// distinguishes "starting" from actually "online".
export function checkPortOpen(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}
