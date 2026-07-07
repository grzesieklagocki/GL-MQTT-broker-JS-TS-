import { AppError } from "@src/AppError";
import { ConnectFlagsV4, ConnectionPayloadV4, ProtocolInfoV4 } from "../types";

/**
 * Asserts that the given CONNECT packet has valid variable header according to MQTT v4 specs.
 * @param packet - The CONNECT packet to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidConnectVariableHeaderV4(
  protocol: {
    name: string;
    level: number;
  },
  flags: ConnectFlagsV4
): asserts protocol is ProtocolInfoV4 {
  _assertValidConnectProtocolV4(protocol);
  _assertValidConnectFlags(flags);
}

/**
 * Asserts that the given CONNECT packet is valid according to MQTT v4 specs.
 * @param clientIdentifier - The client identifier to validate.
 * @throws AppError if the packet is invalid.
 */
export function _assertValidConnectPayloadV4(clientIdentifier: string) {
  // The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload.
  // [MQTT-3.1.3-3]
  if (clientIdentifier === undefined)
    throw new AppError(
      "The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload [MQTT-3.1.3-3]"
    );

  // The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length, and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".
  // [MQTT-3.1.3-5]
  //
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
}

/**
 * Asserts that the given CONNECT packet has valid flags and payload according to MQTT v4 specs.
 * It validates the relationship between the flags and the presence of fields in the payload.
 * @param flags - The ConnectFlagsV4 object containing the flags to validate.
 * @param payload - The ConnectionPayloadV4 object containing the payload to validate.
 * @throws AppError if the flags or payload are invalid.
 */
export function _assertValidConnectPacketV4(
  flags: ConnectFlagsV4,
  payload: ConnectionPayloadV4
) {
  // If the Will Flag is set to 1, the Will QoS and Will Retain fields in the Connect Flags will be used by the Server,
  // and the Will Topic and Will Message fields MUST be present in the payload.
  // [MQTT-3.1.2-9]
  if (
    flags.willFlag &&
    (payload.willTopic === undefined || payload.willMessage === undefined)
  )
    throw new AppError(
      "If the Will Flag is set to 1 ...the Will Topic and Will Message fields MUST be present in the payload [MQTT-3.1.2-9]"
    );

  // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload.
  // [MQTT-3.1.2-11]
  if (
    !flags.willFlag &&
    (payload.willTopic !== undefined || payload.willMessage !== undefined)
  )
    throw new AppError(
      "If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero and the Will Topic and Will Message fields MUST NOT be present in the payload [MQTT-3.1.2-11]"
    );

  // If the User Name Flag is set to 0, a user name MUST NOT be present in the payload.
  // [MQTT-3.1.2-18]
  if (!flags.userName && payload.userName !== undefined)
    throw new AppError(
      "If the User Name Flag is set to 0, a user name MUST NOT be present in the payload [MQTT-3.1.2-18]"
    );

  // If the User Name Flag is set to 1, a user name MUST be present in the payload.
  // [MQTT-3.1.2-19]
  if (flags.userName && payload.userName === undefined)
    throw new AppError(
      "If the User Name Flag is set to 1, a user name MUST be present in the payload [MQTT-3.1.2-19]"
    );

  // If the Password Flag is set to 0, a password MUST NOT be present in the payload.
  // [MQTT-3.1.2-20]
  if (!flags.password && payload.password !== undefined)
    throw new AppError(
      "If the Password Flag is set to 0, a password MUST NOT be present in the payload [MQTT-3.1.2-20]"
    );

  // If the Password Flag is set to 1, a password MUST be present in the payload.
  // [MQTT-3.1.2-21]
  if (flags.password && payload.password === undefined)
    throw new AppError(
      "If the Password Flag is set to 1, a password MUST be present in the payload [MQTT-3.1.2-21]"
    );

  // If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1.
  // [MQTT-3.1.3-7]
  if (payload.clientIdentifier.length === 0 && !flags.cleanSession)
    throw new AppError(
      `If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1 [MQTT-3.1.3-7].`
    );
}

/**
 * Asserts that the given protocol information in the CONNECT packet is valid according to MQTT v4 specs.
 * @param protocol - The protocol information to validate.
 * @throws AppError if the protocol information is invalid.
 */
export function _assertValidConnectProtocolV4(protocol: {
  name: string;
  level: number;
}): asserts protocol is ProtocolInfoV4 {
  // If the protocol name is incorrect the Server MAY disconnect the Client,
  // or it MAY continue processing the CONNECT packet in accordance with some other specification.
  // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification.
  // [MQTT-3.1.2-1]
  if (protocol.name !== "MQTT")
    throw new AppError(
      `Invalid protocol name: ${protocol.name}, expected "MQTT for MQTT 3.1.1" [MQTT-3.1.2-1]`
    );

  // The Server MUST respond to the CONNECT Packet with a CONNACK return code 0x01 (unacceptable protocol level)
  // and then disconnect the Client if the Protocol Level is not supported by the Server.
  // [MQTT-3.1.2-2]
  if (protocol.level !== 4) {
    throw new AppError(
      `Invalid protocol level: ${protocol.level}, expected 4 for MQTT 3.1.1 [MQTT-3.1.2-2]`
    );
  }
}

/**
 * Asserts that the given CONNECT packet has valid flags according to MQTT v4 specs.
 * @param flags - The object containing the flags to validate.
 * @throws AppError if the flags are invalid.
 */
export function _assertValidConnectFlags(flags: {
  userName: boolean;
  password: boolean;
  willRetain: boolean;
  willQoS: number;
  willFlag: boolean;
  cleanSession: boolean;
  reserved: boolean;
}): asserts flags is ConnectFlagsV4 {
  // The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero and disconnect the Client if it is not zero.
  // [MQTT-3.1.2-3]
  if (flags.reserved !== false)
    throw new AppError(
      "The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero and disconnect the Client if it is not zero [MQTT-3.1.2-3]"
    );

  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
  // [MQTT-3.1.2-13]
  if (!flags.willFlag && flags.willQoS !== 0)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00) [MQTT-3.1.2-13], [MQTT-3.1.2-11]"
    );

  // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02).
  // It MUST NOT be 3 (0x03).
  // [MQTT-3.1.2-14]
  if (
    flags.willFlag &&
    flags.willQoS !== 0b00 &&
    flags.willQoS !== 0b01 &&
    flags.willQoS !== 0b10
  )
    throw new AppError(
      "If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03) [MQTT-3.1.2-14]"
    );

  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
  // [MQTT-3.1.2-15]
  if (!flags.willFlag && flags.willRetain)
    throw new AppError(
      "If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0 [MQTT-3.1.2-15], [MQTT-3.1.2-11]"
    );

  // If the User Name Flag is set to 0, the Password Flag MUST be set to 0.
  // [MQTT-3.1.2-22]
  if (!flags.userName && flags.password)
    throw new AppError(
      "If the User Name Flag is set to 0, the Password Flag MUST be set to 0 [MQTT-3.1.2-22]"
    );
}
