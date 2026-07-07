import { AppError } from "@src/AppError";
import { ConnectPacketV4 } from "../types";

/**
 * Asserts that the given CONNECT packet has valid variable header according to MQTT v4 specs.
 * @param packet - The CONNECT packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidConnectVariableHeaderV4(packet: ConnectPacketV4) {
  // If the protocol name is incorrect the Server MAY disconnect the Client,
  // or it MAY continue processing the CONNECT packet in accordance with some other specification.
  // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification.
  // [MQTT-3.1.2-1]
  if (packet.protocol.name !== "MQTT")
    throw new AppError(
      `Invalid protocol name: ${packet.protocol.name}, expected "MQTT for MQTT 3.1.1" [MQTT-3.1.2-1]`
    );

  // The Server MUST respond to the CONNECT Packet with a CONNACK return code 0x01 (unacceptable protocol level)
  // and then disconnect the Client if the Protocol Level is not supported by the Server.
  // [MQTT-3.1.2-2]
  if (packet.protocol.level !== 4) {
    throw new AppError(
      `Invalid protocol level: ${packet.protocol.level}, expected 4 for MQTT 3.1.1 [MQTT-3.1.2-2]`
    );
  }

  // If the Will Flag is set to 1, the Will QoS and Will Retain fields in the Connect Flags will be used by the Server,
  // and the Will Topic and Will Message fields MUST be present in the payload.
  // [MQTT-3.1.2-9]
  if (
    packet.flags.willFlag &&
    (packet.payload.willTopic === undefined ||
      packet.payload.willMessage === undefined)
  )
    throw new AppError(
      "If the Will Flag is set to 1 ...the Will Topic and Will Message fields MUST be present in the payload [MQTT-3.1.2-9]"
    );

  // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload.
  // [MQTT-3.1.2-11]
  if (
    !packet.flags.willFlag &&
    (packet.payload.willTopic !== undefined ||
      packet.payload.willMessage !== undefined)
  )
    throw new AppError(
      "If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero and the Will Topic and Will Message fields MUST NOT be present in the payload [MQTT-3.1.2-11]"
    );

  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
  // [MQTT-3.1.2-13]
  if (!packet.flags.willFlag && packet.flags.willQoS !== 0)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00) [MQTT-3.1.2-13], [MQTT-3.1.2-11]"
    );

  // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02).
  // It MUST NOT be 3 (0x03).
  // [MQTT-3.1.2-14]
  if (
    packet.flags.willFlag &&
    packet.flags.willQoS !== 0b00 &&
    packet.flags.willQoS !== 0b01 &&
    packet.flags.willQoS !== 0b10
  )
    throw new AppError(
      "If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03) [MQTT-3.1.2-14]"
    );

  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
  // [MQTT-3.1.2-15]
  if (!packet.flags.willFlag && packet.flags.willRetain)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0 [MQTT-3.1.2-15], [MQTT-3.1.2-11]"
    );

  // If the User Name Flag is set to 0, a user name MUST NOT be present in the payload.
  // [MQTT-3.1.2-18]
  if (!packet.flags.userName && packet.payload.userName !== undefined)
    throw new AppError(
      "If the User Name Flag is set to 0, a user name MUST NOT be present in the payload [MQTT-3.1.2-18]"
    );

  // If the User Name Flag is set to 1, a user name MUST be present in the payload.
  // [MQTT-3.1.2-19]
  if (packet.flags.userName && packet.payload.userName === undefined)
    throw new AppError(
      "If the User Name Flag is set to 1, a user name MUST be present in the payload [MQTT-3.1.2-19]"
    );

  // If the Password Flag is set to 0, a password MUST NOT be present in the payload.
  // [MQTT-3.1.2-20]
  if (!packet.flags.password && packet.payload.password !== undefined)
    throw new AppError(
      "If the Password Flag is set to 0, a password MUST NOT be present in the payload [MQTT-3.1.2-20]"
    );

  // If the Password Flag is set to 1, a password MUST be present in the payload.
  // [MQTT-3.1.2-21]
  if (packet.flags.password && packet.payload.password === undefined)
    throw new AppError(
      "If the Password Flag is set to 1, a password MUST be present in the payload [MQTT-3.1.2-21]"
    );

  // If the User Name Flag is set to 0, the Password Flag MUST be set to 0.
  // [MQTT-3.1.2-22]
  if (!packet.flags.userName && packet.flags.password)
    throw new AppError(
      "If the User Name Flag is set to 0, the Password Flag MUST be set to 0 [MQTT-3.1.2-22]"
    );
}

/**
 * Asserts that the given CONNECT packet is valid according to MQTT v4 specs.
 * @param packet - The CONNECT packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidConnectPayloadV4(packet: ConnectPacketV4) {
  // The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload.
  // [MQTT-3.1.3-3]
  if (packet.payload.clientIdentifier === undefined)
    throw new AppError(
      "The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload [MQTT-3.1.3-3]"
    );

  // The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length, and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".
  // [MQTT-3.1.3-5]
  const clientIdentifier = packet.payload.clientIdentifier;

  // allow zero-byte ClientId [MQTT-3.1.3-6]
  if (clientIdentifier.length > 0) {
    if (clientIdentifier.length > 23)
      throw new AppError(
        `The Client Identifier has invalid length: ${clientIdentifier.length}. It must be between 1 and 23 UTF-8 encoded bytes in length [MQTT-3.1.3-5]`
      );

    const allowedCharsRegex = /^[0-9a-zA-Z]+$/;
    const hasDisallowedChars = !allowedCharsRegex.test(clientIdentifier);

    if (hasDisallowedChars)
      throw new AppError(
        `The Client Identifier contains invalid characters: "${clientIdentifier}". ` +
          `Only "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" are allowed. [MQTT-3.1.3-5]`
      );
  }

  // If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1.
  // [MQTT-3.1.3-7]
  if (
    packet.payload.clientIdentifier.length === 0 &&
    !packet.flags.cleanSession
  )
    throw new AppError(
      `If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1 [MQTT-3.1.3-7].`
    );
}
