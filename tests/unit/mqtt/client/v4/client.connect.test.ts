import { AppError } from "@src/AppError";
import { PacketType } from "@mqtt/protocol/shared/types";
import {
  MqttPacketV4Factory,
  Will,
} from "@mqtt/protocol/v4/MqttPacketV4Factory";
import { AnyPacketV4, ConnackReturnCodeV4 } from "@mqtt/protocol/v4/types";
import { MqttAuth } from "@mqtt/shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMqttClientV4TestContext } from "./createMqttClientV4TestContext";

type TestContext = ReturnType<typeof createMqttClientV4TestContext>;

let testContext: TestContext;
let transportMock: TestContext["transportMock"];
let client: TestContext["client"];

const refusedConnackCodes = [
  ConnackReturnCodeV4.CONNECTION_REFUSED_BAD_USER_NAME_OR_PASSWORD,
  ConnackReturnCodeV4.CONNECTION_REFUSED_IDENTIFIER_REJECTED,
  ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED,
  ConnackReturnCodeV4.CONNECTION_REFUSED_SERVER_UNAVAILABLE,
  ConnackReturnCodeV4.CONNECTION_REFUSED_UNACCEPTABLE_PROTOCOL_VERSION,
] as const;

describe("connect()", () => {
  beforeEach(() => {
    testContext = createMqttClientV4TestContext();
    ({ transportMock, client } = testContext);
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.clearAllTimers();
      vi.useRealTimers();
    }

    vi.clearAllMocks();
  });

  describe("connection state", () => {
    it("has DISCONNECTED state before connecting", () => {
      expect(client.getConnectionStatus()).toBe("DISCONNECTED");
      expect(client.isConnected).toBe(false);
    });

    it("has CONNECTING state while waiting for CONNACK", async () => {
      let statusDuringConnect: string | undefined;
      let isConnectedDuringConnect: boolean | undefined;

      await connectWithResponse(testContext.connackAccepted, {
        beforeResponse: () => {
          statusDuringConnect = client.getConnectionStatus();
          isConnectedDuringConnect = client.isConnected;
        },
      });

      expect(statusDuringConnect).toBe("CONNECTING");
      expect(isConnectedDuringConnect).toBe(false);
    });

    it("has CONNECTED state after accepted CONNACK", async () => {
      await connectWithResponse(testContext.connackAccepted);

      expect(client.getConnectionStatus()).toBe("CONNECTED");
      expect(client.isConnected).toBe(true);
    });

    it.each(refusedConnackCodes)(
      "returns to DISCONNECTED after refused CONNACK code %s",
      async (returnCode) => {
        const connack = MqttPacketV4Factory.createConnackPacketV4(
          true,
          returnCode
        );

        const response = await connectWithResponse(connack);

        expect(response.returnCode).toBe(returnCode);
        expect(response.sessionPresent).toBe(true);
        expect(client.getConnectionStatus()).toBe("DISCONNECTED");
        expect(client.isConnected).toBe(false);
      }
    );
  });

  describe("CONNECT packet", () => {
    it("connects the transport and sends CONNECT with default parameters", async () => {
      await connectWithResponse(testContext.connackAccepted);

      expect(transportMock.connect).toHaveBeenCalledExactlyOnceWith();
      expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
      );
    });

    it("passes provided parameters to the CONNECT packet", async () => {
      const auth: MqttAuth = {
        user: "user",
        password: new Uint8Array([1, 2, 3]),
      };

      const will: Will = {
        topic: "will/topic",
        message: new Uint8Array([4, 5, 6]),
        qos: 1,
        retain: true,
      };

      const connack = MqttPacketV4Factory.createConnackPacketV4(
        true,
        ConnackReturnCodeV4.CONNECTION_ACCEPTED
      );

      const response = await connectWithResponse(connack, {
        clientIdentifier: "clientID",
        auth,
        will,
        keepAlive: 120,
        cleanSession: false,
      });

      expect(response).toEqual({
        returnCode: ConnackReturnCodeV4.CONNECTION_ACCEPTED,
        sessionPresent: true,
        clientIdentifier: "clientID",
      });
      expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
        MqttPacketV4Factory.createConnectPacketV4(
          false,
          120,
          "clientID",
          auth.user,
          auth.password,
          will
        )
      );
    });

    it("generates a valid client identifier when it is not provided", async () => {
      transportMock.send.mockImplementationOnce(async () => {
        transportMock.emit("packetReceived", testContext.connackAccepted);
      });

      const response = await client.connect();

      expect(response.clientIdentifier).toMatch(/^[a-zA-Z0-9]{1,23}$/);
    });
  });

  describe("CONNACK handling", () => {
    it("returns connection information from CONNACK", async () => {
      const connack = MqttPacketV4Factory.createConnackPacketV4(
        true,
        ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED
      );

      await expect(connectWithResponse(connack)).resolves.toEqual({
        returnCode: ConnackReturnCodeV4.CONNECTION_REFUSED_NOT_AUTHORIZED,
        sessionPresent: true,
        clientIdentifier: "",
      });
    });

    it("emits disconnect with error when another CONNACK is received after connecting", async () => {
      await connectWithResponse(testContext.connackAccepted);

      const disconnectListener = vi.fn();
      client.on("disconnect", disconnectListener);

      transportMock.emit("packetReceived", testContext.connackAccepted);

      expect(disconnectListener).toHaveBeenCalledExactlyOnceWith(
        new AppError(
          "Client received unexpected CONNACK packet. Current status: CONNECTED"
        )
      );
    });
  });

  describe("errors and timeouts", () => {
    it("rejects and returns to DISCONNECTED when transport connect rejects", async () => {
      transportMock.connect.mockRejectedValueOnce(
        new Error("TRANSPORT CONNECT ERROR")
      );

      await expect(client.connect("")).rejects.toThrow(
        /TRANSPORT CONNECT ERROR/
      );

      expect(transportMock.connect).toHaveBeenCalledExactlyOnceWith();
      expect(client.getConnectionStatus()).toBe("DISCONNECTED");
      expect(client.isConnected).toBe(false);
    });

    it("rejects when client is not DISCONNECTED", async () => {
      await connectWithResponse(testContext.connackAccepted);

      expect(client.isConnected).toBe(true);
      await expect(client.connect("")).rejects.toThrow(/not disconnected/i);
    });

    describe("timeouts", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      it("rejects when transport connect does not resolve before timeout", async () => {
        transportMock.connect.mockImplementationOnce(
          () => new Promise<void>(() => {})
        );

        const promise = client.connect("");
        const assertion = expect(promise).rejects.toThrow(/timeout/i);

        expect(transportMock.connect).toHaveBeenCalledExactlyOnceWith();

        await vi.advanceTimersByTimeAsync(5_000);
        await assertion;

        expect(client.getConnectionStatus()).toBe("DISCONNECTED");
        expect(client.isConnected).toBe(false);
      });

      it("rejects when CONNACK is not received before timeout", async () => {
        const promise = client.connect("");
        const assertion = expect(promise).rejects.toThrow(/timeout/i);

        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;

        expect(client.getConnectionStatus()).toBe("DISCONNECTED");
        expect(client.isConnected).toBe(false);
      });

      it("ignores another packet type and rejects after CONNACK timeout", async () => {
        const unsuback = MqttPacketV4Factory.createPacketWithIdentifierV4(
          PacketType.UNSUBACK,
          1
        );

        const promise = connectWithResponse(unsuback);
        const assertion = expect(promise).rejects.toThrow(/timeout/i);

        await vi.advanceTimersByTimeAsync(10_000);
        await assertion;

        expect(transportMock.send).toHaveBeenCalledExactlyOnceWith(
          MqttPacketV4Factory.createConnectPacketV4(true, 60, "")
        );
        expect(client.getConnectionStatus()).toBe("DISCONNECTED");
        expect(client.isConnected).toBe(false);
      });
    });
  });
});

interface ConnectWithResponseOptions {
  beforeResponse?: () => void;
  clientIdentifier?: string;
  auth?: MqttAuth;
  will?: Will;
  keepAlive?: number;
  cleanSession?: boolean;
}

const connectWithResponse = (
  response: AnyPacketV4,
  options: ConnectWithResponseOptions = {}
) => {
  transportMock.send.mockImplementationOnce(async () => {
    options.beforeResponse?.();
    transportMock.emit("packetReceived", response);
  });

  return client.connect(
    options.clientIdentifier ?? "",
    options.auth,
    options.will,
    options.keepAlive,
    options.cleanSession
  );
};
