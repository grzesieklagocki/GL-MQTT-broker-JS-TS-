import { AnyPacketV4 } from "@mqtt/protocol/v4/types";
import { PromiseExecutor } from "@mqtt/shared/types";
import { performActionWithTimeout } from "./performActionWithTimeout";
import { PacketType } from "../protocol/shared/types";

type RequestResponsePacket = AnyPacketV4;
type RequestPacketWithIdentifier = AnyPacketV4 & { identifier: number };

export class RequestManager {
  // for storing pending requests
  private readonly pendingRequests = new Map<
    number,
    PromiseExecutor<RequestResponsePacket>
  >();

  /**
   * Creates an instance of RequestManager.
   * @param sendAction - A function that sends a request packet and returns a promise that resolves when the packet is sent.
   */
  constructor(
    private readonly sendAction: (
      packet: RequestResponsePacket
    ) => Promise<void>
  ) {}

  /**
   * Sends a request packet and waits for the corresponding response packet.
   * @param packet - The request packet to send.
   * @param timeoutSeconds - The timeout duration in seconds to wait for the response.
   * @param timeoutError - The error to throw if the timeout occurs.
   * @returns A promise that resolves with the response packet or rejects with an error.
   */
  public async sendAndWaitForResponse(
    packet: RequestResponsePacket,
    timeoutSeconds: number,
    timeoutError: Error
  ): Promise<RequestResponsePacket> {
    if (!this.isPacketWithIdentifier(packet)) {
      throw new Error("Packet identifier is undefined.");
    }

    const action = () =>
      new Promise<RequestResponsePacket>((resolve, reject) => {
        // store the resolve and reject functions in the pendingRequests Map
        this.pendingRequests.set(packet.identifier, {
          resolve: resolve,
          reject: reject,
        });

        try {
          // send packet
          this.sendAction(packet).catch(reject);
        } catch (error) {
          reject(error);
        }
      });

    try {
      const response = await performActionWithTimeout(
        action,
        timeoutSeconds,
        timeoutError
      );

      if (response.typeId !== packet.typeId + 1)
        throw new Error(
          `Packet type: ${PacketType[response.typeId]} not matches expected response for identifier: ${packet.identifier}.`
        );

      return response;
    } finally {
      // cleanup (e.g. after timeout)
      this.pendingRequests.delete(packet.identifier);
    }
  }

  /**
   * Completes a pending request by resolving the corresponding promise with the provided response packet.
   * @param response - The response packet to complete the pending request.
   */
  public complete(response: RequestResponsePacket) {
    if (!this.isPacketWithIdentifier(response)) {
      throw new Error("Packet identifier is undefined.");
    }

    const identifier = response.identifier;
    const request = this.pendingRequests.get(identifier);

    if (!request)
      throw new Error(`No pending request for identifier: ${identifier}`);

    request.resolve!(response);

    // delete from pendingRequests Map
    this.pendingRequests.delete(identifier);
  }

  private isPacketWithIdentifier(
    packet: RequestResponsePacket
  ): packet is RequestPacketWithIdentifier {
    return "identifier" in packet && typeof packet.identifier === "number";
  }
}
