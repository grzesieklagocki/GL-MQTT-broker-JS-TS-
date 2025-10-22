import { PacketType } from "@mqtt/protocol/shared/types";
import { parseConnectPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnectPacketV4";
import { MQTTReaderV4 } from "@mqtt/protocol/v4/decoding/MQTTReaderV4";
import { describe, it, expect } from "vitest";

const fixedHeader = {
  packetType: PacketType.CONNECT,
  flags: 0b0000,
  remainingLength: 12,
};

// common array for tests
const array = new Uint8Array([
  // protocol name length: 4
  0x00, 0x04,
  // protocol name: "MQTT"
  0x4d, 0x51, 0x54, 0x54,
  // protocol level: 4
  0x04,
  // flags: 0b00000000
  0b00000000,
  // keep alive: 0xabdc
  0xab, 0xdc,
  // client identifier length: 0
  0x00, 0x00,
  // client identifier: empty
]);

// arrays with invalid UTF-8 sequences (for testing UTF-8 string parsing)
const invalidUtf8Arrays = [
  // Overlong encoding of '/'
  [0x00, 0x02, 0xc0, 0xaf], // U+002F '/' encoded as 0xC0 0xAF (invalid overlong form)
  // Surrogate half (UTF-16 range D800–DFFF)
  [0x00, 0x03, 0xed, 0xa0, 0x80], // U+D800 (illegal in UTF-8 per RFC 3629)
  // Truncated sequence (missing continuation byte)
  [0x00, 0x01, 0xc2],
  // Lone continuation byte (single 0x80 cannot start a UTF-8 sequence)
  [0x00, 0x01, 0x80],
  // Out-of-range (> U+10FFFF)
  [0x00, 0x04, 0xf4, 0x90, 0x80, 0x80],
  // Invalid start byte (F8 = disallowed, UTF-8 max 0xF4)
  [0x00, 0x05, 0xf8, 0x80, 0x80, 0x80, 0x80],
];

describe("parseConnectPacketV4", () => {
  it(`parse CONNECT packet`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 29,
    };
    const willMessage = new Uint8Array([0xfc]);
    const password = new Uint8Array([0xbb]);
    const array = new Uint8Array([
      // protocol name length: 4
      0x00, 0x04,
      // protocol name: "MQTT"
      0x4d, 0x51, 0x54, 0x54,
      // protocol level: 4
      0x04,
      // flags: 0b11001110 (User Name, Password, Will and Clean Session Flags set, Will QoS 1)
      0b11001110,
      // keep alive: 0xabdc
      0xab, 0xdc,
      // client identifier length: 2
      0x00, 0x02,
      // client identifier: "id"
      0x69, 0x64,
      // will topic length: 1
      0x00, 0x01,
      // will topic: "/"
      0x2f,
      // will message length: 1
      0x00, 0x01,
      // will message
      0xfc,
      // user name length: 4
      0x00, 0x04,
      // user name: "user"
      0x75, 0x73, 0x65, 0x72,
      // password length: 1
      0x00, 0x01,
      // password: 0xbb
      0xbb,
    ]);
    const reader = new MQTTReaderV4(array);

    const packet = parseConnectPacketV4(fixedHeader, reader);

    expect(packet.typeId).toBe(PacketType.CONNECT);

    expect(packet.protocol.name).toBe("MQTT");
    expect(packet.protocol.level).toBe(4);

    expect(packet.flags.userName).toBe(true);
    expect(packet.flags.password).toBe(true);
    expect(packet.flags.willRetain).toBe(false);
    expect(packet.flags.willQoS).toBe(0x01);
    expect(packet.flags.cleanSession).toBe(true);

    expect(packet.keepAlive).toBe(0xabdc);

    expect(packet.payload.clientIdentifier).toBe("id");
    expect(packet.payload.willTopic).toBe("/");
    expect(packet.payload.willMessage).toEqual(willMessage);
    expect(packet.payload.userName).toEqual("user");
    expect(packet.payload.password).toEqual(password);
  });

  it(`throws an Error for other packet types`, () => {
    [
      PacketType.CONNACK,
      PacketType.PUBLISH,
      PacketType.PUBACK,
      PacketType.PUBREC,
      PacketType.PUBREL,
      PacketType.PUBCOMP,
      PacketType.SUBSCRIBE,
      PacketType.SUBACK,
      PacketType.UNSUBSCRIBE,
      PacketType.UNSUBACK,
      PacketType.PINGREQ,
      PacketType.PINGRESP,
      PacketType.DISCONNECT,
    ].forEach((invalidPacketType) => {
      const fixedHeader = {
        packetType: invalidPacketType,
        flags: 0,
        remainingLength: 12,
      };
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet type/
      );
    });
  });

  // Where a flag bit is marked as “Reserved” in Table 2.2 - Flag Bits,
  // it is reserved for future use and MUST be set to the value listed in that table.
  // [MQTT-2.2.2-1]
  it(`throws an Error for invalid flags`, () => {
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80].forEach((invalidFlags) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: invalidFlags,
        remainingLength: 12,
      };
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet flags/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (declared in fixed header)`, () => {
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((invalidRemainingLength) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: 0,
        remainingLength: invalidRemainingLength,
      };
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length/
      );
    });
  });

  it(`throws an Error for invalid remaining bytes count (in reader)`, () => {
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach((remaining) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: 0,
        remainingLength: 12,
      };
      const array = new Uint8Array(remaining); // smaller than required
      const reader = new MQTTReaderV4(array); // so reader has less bytes (remaining) than required (min 12)

      expect(reader.remaining).toBe(remaining);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Invalid packet remaining length in reader/
      );
    });
  });

  // If the protocol name is incorrect the Server MAY disconnect the Client,
  // or it MAY continue processing the CONNECT packet in accordance with some other specification.
  // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification
  // [MQTT-3.1.2-1].
  it(`throws an Error for invalid protocol name`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 14,
    };
    const array = new Uint8Array([
      // protocol name length: 6
      0x00, 0x06,
      // protocol name: "MQIsdp" - older protocol name
      0x4d, 0x49, 0x73, 0x64, 0x70, 0x20,
      // protocol level: 4
      0x04,
      // flags: 0b00000000
      0b00000000,
      // keep alive: 0x00dc
      0xab, 0xdc,
      // client identifier length: 2
      0x00, 0x00,
      // client identifier: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Invalid protocol name/
    );
  });

  // The Server MUST respond to the CONNECT Packet with a CONNACK return code 0x01 (unacceptable protocol level)
  // and then disconnect the Client if the Protocol Level is not supported by the Server
  // [MQTT-3.1.2-2].
  it(`throws an Error for invalid protocol level`, () => {
    [1, 2, 3, 5].forEach((level) => {
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level
        level,
        // flags: 0b00000000
        0b00000000,
        // keep alive: 0x00dc
        0xab,
        0xdc,
        // client identifier length: 2
        0x00,
        0x00,
        // client identifier: empty
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Invalid protocol level/
      );
    });
  });

  // The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero
  // and disconnect the Client if it is not zero
  // [MQTT-3.1.2-3].
  it(`throws an Error for invalid reserved flag`, () => {
    [0b00000001, 0b11000001, 0b00110101, 0b11101111].forEach((invalidFlags) => {
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level: 4
        0x04,
        // flags (reserved flag set)
        invalidFlags,
        // keep alive: 0x00dc
        0xab,
        0xdc,
        // client identifier length: 2
        0x00,
        0x00,
        // client identifier: empty
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /reserved flag/
      );
    });
  });

  // If the Will Flag is set to 1, the Will QoS and Will Retain fields in the Connect Flags will be used by the Server,
  // and the Will Topic and Will Message fields MUST be present in the payload
  // [MQTT-3.1.2-9].
  it(`throws an Error for missing Will Topic when Will Flag is set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 15,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags:
      0b00000100, // Will Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // will topic missing
      // will message length: 1
      0x00,
      0x01,
      // will message: 0xfc
      0xfc,
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Data reading error/ // parser tries to read will topic but it's missing
    );
  });

  it(`throws an Error for missing Will Message when Will Flag is set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 15,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags:
      0b00000100, // Will Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // will topic length: 1
      0x00,
      0x01,
      // will topic: "/"
      0x2f,
      // will message missing
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Data reading error/
    );
  });

  // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload
  // [MQTT-3.1.2-11].
  it(`throws an Error for present Will Topic and Will Message when Will Flag is not set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 18,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags:
      0b00000010, // Will Flag not set, Clean Session Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // will topic length: 1
      0x00,
      0x01,
      // will topic: "/"
      0x2f,
      // will message length: 1
      0x00,
      0x01,
      // will message: 0xfc
      0xfc,
    ]);
    const reader = new MQTTReaderV4(array);

    // if will flag is not set, parsing function not read will topic and will message
    // and they should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(/unread/);
  });

  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
  // [MQTT-3.1.2-13]
  it(`throws an Error for invalid Will QoS when Will Flag is not set`, () => {
    [0x01, 0x02].forEach((invalidWillQoS) => {
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level: 4
        0x04,
        // flags: 0b00000000
        invalidWillQoS << 4,
        // keep alive: 0x00dc
        0xab,
        0xdc,
        // client identifier length: 2
        0x00,
        0x00,
        // client identifier: empty
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Will QoS/
      );
    });
  });

  // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03).
  // [MQTT-3.1.2-14]
  it(`throws an Error for invalid Will QoS when Will Flag is set`, () => {
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b00011100, // Will Flag set, QoS 3
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(/QoS/);
  });

  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
  // [MQTT-3.1.2-15]
  it(`throws an Error for invalid Will Retain Flag when Will Flag is not set`, () => {
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b00100000, // Will Flag not set, Will Retain Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Will Retain/
    );
  });

  // If the User Name Flag is set to 0, a user name MUST NOT be present in the payload.
  // [MQTT-3.1.2-18]
  it(`throws an Error for present User Name when User Name Flag is not set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 15,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b00000010, // User Name Flag not set, Clean Session Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // no will topic
      // no will message
      // user name length: 1
      0x00,
      0x01,
      // user name: "u"
      0x75,
    ]);
    const reader = new MQTTReaderV4(array);

    // if user name flag is not set, parsing function not read user name
    // and it should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(/unread/);
  });

  // If the User Name Flag is set to 1, a user name MUST be present in the payload.
  // [MQTT-3.1.2-19]
  it(`throws an Error for missing User Name when User Name Flag is set`, () => {
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b10000010, // User Name Flag set, Clean Session Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // no will topic
      // no will message
      // missing user name
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Data reading error/
    );
  });

  // If the Password Flag is set to 0, a password MUST NOT be present in the payload.
  // [MQTT-3.1.2-20]
  it(`throws an Error for present Password when Password Flag is not set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 18,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b10000010, // User Name Flag set, Password Flag not set, Clean Session Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // no will topic
      // no will message
      // user name length: 1
      0x00,
      0x01,
      // user name: "u"
      0x75,
      // password length: 1
      0x00,
      0x01,
      // password: 0xbb
      0xbb,
    ]);
    const reader = new MQTTReaderV4(array);

    // if password flag is not set, parsing function not read password
    // and it should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(/unread/);
  });

  // If the Password Flag is set to 1, a password MUST be present in the payload.
  // [MQTT-3.1.2-21]
  it(`throws an Error for missing Password when Password Flag is set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 15,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b11000010, // User Name Flag set, Password Flag set, Clean Session Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
      // no will topic
      // no will message
      // user name length: 1
      0x00,
      0x01,
      // user name: "u"
      0x75,
      // missing password
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /Data reading error/
    );
  });

  // If the User Name Flag is set to 0, the Password Flag MUST be set to 0.
  // [MQTT-3.1.2-22]
  it(`throws an Error for Password Flag set when User Name Flag is not set`, () => {
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags
      0b01000000, // User Name Flag not set, Password Flag set
      // keep alive: 0x00dc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => {
      parseConnectPacketV4(fixedHeader, reader);
    }).toThrowError("MQTT-3.1.2-22");
  });

  // These fields, if present, MUST appear in the order Client Identifier, Will Topic, Will Message, User Name, Password.
  // [MQTT-3.1.3-1]
  it(`parses the payload fields in the correct order`, () => {
    const clientId = "id";
    const willTopic = "will topic";
    const willMessage = new Uint8Array([1, 2, 3]);
    const userName = "user name";
    const password = new Uint8Array([3, 2, 1]);

    const packetLength =
      clientId.length +
      willTopic.length +
      willMessage.length +
      userName.length +
      password.length +
      20;
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: packetLength,
    };
    const encoder = new TextEncoder();
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags: 0b11000100,
      0b11001100, // User Name, Password Flags and Will Flag set
      // keep alive: 0xabdc
      0xab,
      0xdc,
      // client identifier length
      0x00,
      clientId.length,
      // client identifier
      ...encoder.encode(clientId),
      // will topic length
      0x00,
      willTopic.length,
      // will topic
      ...encoder.encode(willTopic),
      // will message length
      0x00,
      willMessage.length,
      // will message
      ...willMessage,
      // user name length: 4
      0x00,
      userName.length,
      // user name: "user"
      ...encoder.encode(userName),
      // password length: 1
      0x00,
      password.length,
      // password: 0xbb
      ...password,
    ]);
    const reader = new MQTTReaderV4(array);

    const packet = parseConnectPacketV4(fixedHeader, reader);

    expect(packet.payload.clientIdentifier).toBe(clientId);
    expect(packet.payload.willTopic).toBe(willTopic);
    expect(packet.payload.willMessage).toStrictEqual(willMessage);
    expect(packet.payload.userName).toBe(userName);
    expect(packet.payload.password).toStrictEqual(password);
  });

  // The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload.
  // [MQTT-3.1.3-3]
  it(`throw an Error for missing ClientId`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 10,
    };
    const array = new Uint8Array([
      // protocol name length: 4
      0x00, 0x04,
      // protocol name: "MQTT"
      0x4d, 0x51, 0x54, 0x54,
      // protocol level: 4
      0x04,
      // flags: 0b00000000
      0b00000000,
      // keep alive: 0xabdc
      0xab, 0xdc,
      // missing client identifier
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /remaining length in reader/
    );
  });

  // The ClientId MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-4]
  it(`throw an Error for invalid encoded ClientId`, () => {
    invalidUtf8Arrays.forEach((invalidClientId) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: 0,
        remainingLength: 10 + invalidClientId.length,
      };
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level: 4
        0x04,
        // flags: 0b00000000
        0b00000000,
        // keep alive: 0xabdc
        0xab,
        0xdc,
        // client identifier
        ...invalidClientId,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Data reading error/
      );
    });
  });

  // The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length,
  // and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".
  // [MQTT-3.1.3-5]
  // A Server MAY allow a Client to supply a ClientId that has a length of zero bytes.
  // However if it does so the Server MUST treat this as a special case and assign a unique ClientId to that Client.
  // It MUST then process the CONNECT packet as if the Client had provided that unique ClientId.
  // [MQTT-3.1.3-6]
  it(`throw an Error for invalid ClientId`, () => {
    ["a".repeat(24), "invalid!", "with space", "含有非ASCII字符"].forEach(
      (invalidId) => {
        const encoder = new TextEncoder();
        const invalidIdArray = encoder.encode(invalidId);

        const fixedHeader = {
          packetType: PacketType.CONNECT,
          flags: 0,
          remainingLength: 12 + invalidIdArray.length,
        };
        const array = new Uint8Array([
          // protocol name length: 4
          0x00,
          0x04,
          // protocol name: "MQTT"
          0x4d,
          0x51,
          0x54,
          0x54,
          // protocol level: 4
          0x04,
          // flags: 0b00000000
          0b00000010, // Clean Session flag set
          // keep alive: 0xabdc
          0xab,
          0xdc,
          // client identifier length
          0x00,
          invalidId.length,
          // client identifier
          ...invalidIdArray,
        ]);
        const reader = new MQTTReaderV4(array);

        expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
          /Client Id/
        );
      }
    );
  });

  // If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1.
  // [MQTT-3.1.3-7]
  it(`throw an Error for zero length ClientId when Clean Session flag is not set`, () => {
    const array = new Uint8Array([
      // protocol name length: 4
      0x00,
      0x04,
      // protocol name: "MQTT"
      0x4d,
      0x51,
      0x54,
      0x54,
      // protocol level: 4
      0x04,
      // flags: 0b00000000
      0b00000000, // Clean Session flag not set
      // keep alive: 0xabdc
      0xab,
      0xdc,
      // client identifier length: 2
      0x00,
      0x00,
      // client identifier: empty
    ]);
    const reader = new MQTTReaderV4(array);

    expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
      /MQTT-3.1.3-7/
    );
  });

  // The Will Topic MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-10]
  it(`throw an Error for invalid encoded Will Topic`, () => {
    invalidUtf8Arrays.forEach((invalidWillTopic) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: 0,
        remainingLength: 17 + invalidWillTopic.length,
      };
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level: 4
        0x04,
        // flags: 0b00000100 (Will Flag set)
        0b00000100,
        // keep alive: 0xabdc
        0xab,
        0xdc,
        // client identifier length: 2
        0x00,
        0x02,
        // client identifier: "id"
        0x69,
        0x64,
        // will topic
        ...invalidWillTopic,
        // will message length: 1
        0x00,
        0x01,
        // will message
        0xfc,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Data reading error/
      );
    });
  });

  // The User Name MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-11]
  it(`throw an Error for invalid encoded User Name`, () => {
    invalidUtf8Arrays.forEach((invalidUserName) => {
      const fixedHeader = {
        packetType: PacketType.CONNECT,
        flags: 0,
        remainingLength: 20 + invalidUserName.length,
      };
      const array = new Uint8Array([
        // protocol name length: 4
        0x00,
        0x04,
        // protocol name: "MQTT"
        0x4d,
        0x51,
        0x54,
        0x54,
        // protocol level: 4
        0x04,
        // flags: 0b10000100 (User Name and Will Flags set)
        0b10000100,
        // keep alive: 0xabdc
        0xab,
        0xdc,
        // client identifier length: 2
        0x00,
        0x02,
        // client identifier: "id"
        0x69,
        0x64,
        // will topic length: 1
        0x00,
        0x01,
        // will topic: "/"
        0x2f,
        // will message length: 1
        0x00,
        0x01,
        // will message
        0xfc,
        // user name
        ...invalidUserName,
      ]);
      const reader = new MQTTReaderV4(array);

      expect(() => parseConnectPacketV4(fixedHeader, reader)).toThrow(
        /Data reading error/
      );
    });
  });
});
