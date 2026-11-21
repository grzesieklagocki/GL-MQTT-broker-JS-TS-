import { MqttBroker } from "./MqttBroker";
import { MqttTcpListener } from "./MqttTcpListener";

const host = "127.0.0.1";
const port = 1883;
// Development only: accept connections without checking credentials.
const broker = new MqttBroker({ canLogin: () => true });
const listener = new MqttTcpListener(host, port);

function stopBroker(): void {
  console.log("Stopping broker...");

  void broker
    .stop()
    .then(() => console.log("Broker stopped."))
    .catch((error: unknown) => {
      console.error("Could not stop the broker:", error);
      process.exitCode = 1;
    });
}

listener.listeningHandler = () => {
  console.log(
    `Development broker listening on ${host}:${port} (no authentication)`
  );
};

broker.on("brokerError", ({ source, error }) => {
  console.error(`Broker error (${source}):`, error);
  if (source === "network-listener") {
    process.exitCode = 1;
    stopBroker();
  }
});

broker.on("connection", (event) => {
  console.log(
    `New connection (id:${event.connectionId}) from ${event.connectionInfo}`
  );
});

process.once("SIGINT", stopBroker); // stop the broker on Ctrl+C signal
broker.addConnectionListener(listener);
