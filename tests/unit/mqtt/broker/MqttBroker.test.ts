import { beforeEach, describe, expect, it, vi } from "vitest";
import { MqttBroker } from "@mqtt/broker/MqttBroker";
import {
  AcceptedConnection,
  IConnectionListener,
} from "@mqtt/broker/types";

describe("MqttBroker", () => {
  let broker: MqttBroker;
  let listenerMock: IConnectionListener;
  let secondListenerMock: IConnectionListener;
  let connectionMock: AcceptedConnection;

  const createListenerMock = (): IConnectionListener => ({
    listen: vi.fn(),
    stop: vi.fn(),
    connectionHandler: vi.fn(),
    closeHandler: vi.fn(),
  });

  const createConnectionMock = (info: string): AcceptedConnection => ({
    info,
    transport: {
      send: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      packetReceivedHandler: vi.fn(),
      disconnectHandler: vi.fn(),
    },
  });

  beforeEach(() => {
    broker = new MqttBroker();
    listenerMock = createListenerMock();
    secondListenerMock = createListenerMock();
    connectionMock = createConnectionMock("test connection");
  });

  describe("method", () => {
    describe("addConnectionListener()", () => {
      it("calls listen() once when a listener is added", () => {
        broker.addConnectionListener(listenerMock);

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(listenerMock.stop).not.toHaveBeenCalled();
      });

      it("handles connections accepted synchronously during listen()", () => {
        const connectionListener = vi.fn();
        broker.on("connection", connectionListener);
        vi.mocked(listenerMock.listen).mockImplementation(() => {
          listenerMock.connectionHandler(connectionMock);
        });

        broker.addConnectionListener(listenerMock);

        expect(connectionListener).toHaveBeenCalledExactlyOnceWith({
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
      });

      it("rejects adding the same listener twice without restarting it or replacing its handlers", () => {
        broker.addConnectionListener(listenerMock);
        const connectionHandler = listenerMock.connectionHandler;
        const closeHandler = listenerMock.closeHandler;

        expect(() => broker.addConnectionListener(listenerMock)).toThrow();

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(listenerMock.connectionHandler).toBe(connectionHandler);
        expect(listenerMock.closeHandler).toBe(closeHandler);
      });

      it("rethrows an error from listen()", () => {
        const error = new Error("Listen failed");
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });

        expect(() => broker.addConnectionListener(listenerMock)).toThrow(error);
        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
      });

      it("allows adding a listener again after listen() fails", () => {
        const error = new Error("Listen failed");
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });
        expect(() => broker.addConnectionListener(listenerMock)).toThrow(error);

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("allows adding a listener again if it closes synchronously during listen()", () => {
        vi.mocked(listenerMock.listen).mockImplementationOnce(() => {
          listenerMock.closeHandler();
        });
        broker.addConnectionListener(listenerMock);

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("starts two different listeners independently", () => {
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);

        expect(listenerMock.listen).toHaveBeenCalledExactlyOnceWith();
        expect(secondListenerMock.listen).toHaveBeenCalledExactlyOnceWith();
      });

      it("keeps the first listener accepting connections when the second listener fails to start", () => {
        const error = new Error("Listen failed");
        const connectionListener = vi.fn();
        
        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);
        
        vi.mocked(secondListenerMock.listen).mockImplementationOnce(() => {
          throw error;
        });

        expect(() => broker.addConnectionListener(secondListenerMock)).toThrow(
          error
        );
        
        listenerMock.connectionHandler(connectionMock);

        expect(connectionListener).toHaveBeenCalledExactlyOnceWith({
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
        expect(listenerMock.stop).not.toHaveBeenCalled();
      });
    });
  });

  describe("on listener event", () => {
    describe("connection", () => {
      it("accepts connections from both listeners", () => {
        const connectionListener = vi.fn();
        const secondConnection = createConnectionMock("second connection");
        
        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);

        listenerMock.connectionHandler(connectionMock);
        secondListenerMock.connectionHandler(secondConnection);

        expect(connectionListener).toHaveBeenCalledTimes(2);
        expect(connectionListener).toHaveBeenNthCalledWith(1, {
          connectionId: expect.any(Number),
          connectionInfo: connectionMock.info,
        });
        expect(connectionListener).toHaveBeenNthCalledWith(2, {
          connectionId: expect.any(Number),
          connectionInfo: secondConnection.info,
        });
        expect(connectionListener.mock.calls[0][0].connectionId).not.toBe(
          connectionListener.mock.calls[1][0].connectionId
        );
      });
    });

    describe("close", () => {
      it("allows adding a closed listener again", () => {
        broker.addConnectionListener(listenerMock);
        listenerMock.closeHandler();

        expect(() => broker.addConnectionListener(listenerMock)).not.toThrow();

        expect(listenerMock.listen).toHaveBeenCalledTimes(2);
      });

      it("does not stop another listener or close accepted connections", () => {
        const connectionListener = vi.fn();
        
        broker.on("connection", connectionListener);
        broker.addConnectionListener(listenerMock);
        broker.addConnectionListener(secondListenerMock);
        listenerMock.connectionHandler(connectionMock);

        listenerMock.closeHandler();
        secondListenerMock.connectionHandler(
          createConnectionMock("second connection")
        );

        expect(connectionListener).toHaveBeenCalledTimes(2);
        expect(secondListenerMock.stop).not.toHaveBeenCalled();
        expect(connectionMock.transport.disconnect).not.toHaveBeenCalled();
      });

      it("reports a listener error through brokerError", () => {
        const error = new Error("Listener failed");
        const errorListener = vi.fn();
        
        broker.on("brokerError", errorListener);
        broker.addConnectionListener(listenerMock);

        listenerMock.closeHandler(error);

        expect(errorListener).toHaveBeenCalledExactlyOnceWith({
          source: "network-listener",
          error,
        });
      });
    });
  });
  describe("on transport disconnect", () => {
    it.each([undefined, new Error("Transport failed")])(
      "reports connection closure once (error: %s)",
      (error) => {
        const connectionListener = vi.fn();
        const closeListener = vi.fn();
        
        broker.on("connection", connectionListener);
        broker.on("connectionClosed", closeListener);
        broker.addConnectionListener(listenerMock);
        listenerMock.connectionHandler(connectionMock);
        
        const { connectionId } = connectionListener.mock.calls[0][0];

        connectionMock.transport.disconnectHandler(error);
        connectionMock.transport.disconnectHandler(error);

        expect(closeListener).toHaveBeenCalledExactlyOnceWith({
          connectionId,
          connectionInfo: connectionMock.info,
          ...(error
            ? { reason: "transport-error", error }
            : { reason: "transport-closed" }),
        });
      }
    );
  });
});
