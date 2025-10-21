import { PacketType } from "@mqtt/protocol/shared/types";
import { parseConnectPacketV4 } from "@mqtt/protocol/v4/decoding/parsers/parseConnectPacketV4";
import { IMQTTReaderV4 } from "@mqtt/protocol/v4/types";
import { describe, it, expect } from "vitest";
import { createConnectReaderMock } from "./mocks";
import { AppError } from "@src/AppError";

const fixedHeader = {
  packetType: PacketType.CONNECT,
  flags: 0,
  remainingLength: 12,
};

describe("parseConnectPacketV4", () => {
  const readerMock = {} as unknown as IMQTTReaderV4;

  it(`parse CONNECT packet`, () => {
    const willMessage = new Uint8Array([0xfc]);
    const password = new Uint8Array([0x01]);
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b11001110, // User Name, Password, Will and Clean Session Flags set, Will QoS 1
      0xdc, // keep alive
      "id", // client id
      "/", // will topic
      willMessage, // will message
      "user", // user name
      password // password
    );

    const packet = parseConnectPacketV4(fixedHeader, readerMock);

    expect(packet.typeId).toBe(PacketType.CONNECT);

    expect(packet.protocol.name).toBe("MQTT");
    expect(packet.protocol.level).toBe(4);

    expect(packet.flags.userName).toBe(true);
    expect(packet.flags.password).toBe(true);
    expect(packet.flags.willRetain).toBe(false);
    expect(packet.flags.willQoS).toBe(0x01);
    expect(packet.flags.cleanSession).toBe(true);

    expect(packet.keepAlive).toBe(0xdc);

    expect(packet.payload.clientIdentifier).toBe("id");
    expect(packet.payload.willTopic).toBe("/");
    expect(packet.payload.willMessage).toEqual(willMessage);
    expect(packet.payload.userName).toEqual("user");
    expect(packet.payload.password).toEqual(password);

    expect(readerMock.readString).toBeCalledTimes(4); // protocol name, client id, will topic, user name
    expect(readerMock.readOneByteInteger).toBeCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toBeCalledTimes(1); // keep alive
    expect(readerMock.readBytes).toBeCalledTimes(2); // will message, password
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
      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
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

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
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
      const readerMock = {
        remaining: remaining,
      } as unknown as IMQTTReaderV4;

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid packet remaining length in reader/
      );
    });
  });

  // If the protocol name is incorrect the Server MAY disconnect the Client,
  // or it MAY continue processing the CONNECT packet in accordance with some other specification.
  // In the latter case, the Server MUST NOT continue to process the CONNECT packet in line with this specification
  // [MQTT-3.1.2-1].
  it(`throws an Error for invalid protocol name`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "INVALID", // protocol name
      4, // protocol level
      0b00000000, // flags
      0x00, // keep alive
      "id" // client id
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /Invalid protocol name/
    );

    expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
    expect(readerMock.readOneByteInteger).not.toBeCalled();
    expect(readerMock.readTwoByteInteger).not.toBeCalled();
    expect(readerMock.readBytes).not.toBeCalled();
  });

  // The Server MUST respond to the CONNECT Packet with a CONNACK return code 0x01 (unacceptable protocol level)
  // and then disconnect the Client if the Protocol Level is not supported by the Server
  // [MQTT-3.1.2-2].
  it(`throws an Error for invalid protocol level`, () => {
    [1, 2, 3, 5].forEach((level) => {
      const readerMock = createConnectReaderMock(
        [
          12, // remaining
          0,
        ],
        "MQTT", // protocol name
        level, // protocol level
        0b00000000, // flags
        0x00, // keep alive
        "id" // client id
      );

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
        /Invalid protocol level/
      );

      expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
      expect(readerMock.readOneByteInteger).toHaveBeenCalledOnce(); // protocol level
      expect(readerMock.readTwoByteInteger).not.toBeCalled();
      expect(readerMock.readBytes).not.toBeCalled();
    });
  });

  // The Server MUST validate that the reserved flag in the CONNECT Control Packet is set to zero
  // and disconnect the Client if it is not zero
  // [MQTT-3.1.2-3].
  it(`throws an Error for invalid reserved flag`, () => {
    [0b00000001, 0b11000001, 0b00110101, 0b11101111].forEach((invalidFlags) => {
      const readerMock = createConnectReaderMock(
        [
          12, // remaining
          0,
        ],
        "MQTT", // protocol name
        4, // protocol level
        invalidFlags // flags
      );

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
        /reserved flag/
      );

      expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
      expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
      expect(readerMock.readTwoByteInteger).not.toBeCalled();
      expect(readerMock.readBytes).not.toBeCalled();
    });
  });

  // If the Will Flag is set to 1, the Will QoS and Will Retain fields in the Connect Flags will be used by the Server,
  // and the Will Topic and Will Message fields MUST be present in the payload
  // [MQTT-3.1.2-9].
  it(`throws an Error for missing Will Topic when Will Flag is set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000100, // Will Flag set
      0x00, // keep alive
      "id", // client id
      new AppError("Missing Will Topic") // will topic
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      "Missing Will Topic"
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, will topic
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).not.toBeCalled();
  });

  it(`throws an Error for missing Will Message when Will Flag is set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000100, // Will Flag set
      0x00, // keep alive
      "id", // client id
      "/", // will topic
      new AppError("Missing Will Message") // will message
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      "Missing Will Message"
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, will topic
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).toHaveBeenCalledOnce(); // will message
  });

  // If the Will Flag is set to 0 the Will QoS and Will Retain fields in the Connect Flags MUST be set to zero
  // and the Will Topic and Will Message fields MUST NOT be present in the payload
  // [MQTT-3.1.2-11].
  it(`throws an Error for present Will Topic and Will Message when Will Flag is not set`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 16,
    };
    const readerMock = createConnectReaderMock(
      [
        16, // remaining
        3,
        3,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000000, // Will Flag not set
      0x00, // keep alive
      "id", // client id
      "/" // will topic
    );

    // if will flag is not set, parsing function not read will topic and will message
    // and they should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /unread/
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the Will Flag is set to 0, then the Will QoS MUST be set to 0 (0x00).
  // [MQTT-3.1.2-13]
  it(`throws an Error for invalid Will QoS when Will Flag is not set`, () => {
    [0x01, 0x02].forEach((invalidWillQoS) => {
      const readerMock = createConnectReaderMock(
        [
          12, // remaining
          0,
        ],
        "MQTT", // protocol name
        4, // protocol level
        invalidWillQoS << 4 // Will Flag not set
      );

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
        /Will QoS/
      );

      expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
      expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
      expect(readerMock.readTwoByteInteger).not.toHaveBeenCalled();
      expect(readerMock.readBytes).not.toHaveBeenCalled();
    });
  });

  // If the Will Flag is set to 1, the value of Will QoS can be 0 (0x00), 1 (0x01), or 2 (0x02). It MUST NOT be 3 (0x03).
  // [MQTT-3.1.2-14]
  it(`throws an Error for invalid Will QoS when Will Flag is set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00011100 // Will Flag set, QoS 3
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(/QoS/);

    expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).not.toHaveBeenCalled();
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the Will Flag is set to 0, then the Will Retain Flag MUST be set to 0.
  // [MQTT-3.1.2-15]
  it(`throws an Error for invalid Will Retain Flag when Will Flag is not set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00100000 // Will Flag not set, Will Retain Flag set
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /Will Retain/
    );

    expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).not.toHaveBeenCalled();
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the User Name Flag is set to 0, a user name MUST NOT be present in the payload.
  // [MQTT-3.1.2-18]
  it(`throws an Error for present User Name when User Name Flag is not set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        6,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000000, // User Name Flag not set
      0x00, // keep alive
      "id", // client id
      undefined, // will topic
      undefined, // will message
      "user" // user name
    );

    // if user name flag is not set, parsing function not read user name
    // and it should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /unread/
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the User Name Flag is set to 1, a user name MUST be present in the payload.
  // [MQTT-3.1.2-19]
  it(`throws an Error for missing User Name when User Name Flag is set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b10000000, // User Name Flag set
      0x00, // keep alive
      "id", // client id
      undefined, // will topic
      undefined, // will message
      new AppError("User Name")
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      "User Name"
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, user name
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledTimes(1); // keep alive
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the Password Flag is set to 0, a password MUST NOT be present in the payload.
  // [MQTT-3.1.2-20]
  it(`throws an Error for present Password when Password Flag is not set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        3,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000000, // Password Flag not set
      0x00, // keep alive
      "id" // client id
    );

    // if password flag is not set, parsing function not read password
    // and it should remain in the reader
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /unread/
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // If the Password Flag is set to 1, a password MUST be present in the payload.
  // [MQTT-3.1.2-21]
  it(`throws an Error for missing Password when Password Flag is set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b11000000, // User Name and Password Flags set
      0x00, // keep alive
      "id", // client id
      undefined, // will topic
      undefined, // will message
      "user", // user name
      new AppError("Password")
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      "Password"
    );

    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, user name
    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readBytes).toHaveBeenCalledOnce(); // password
  });

  // If the User Name Flag is set to 0, the Password Flag MUST be set to 0.
  // [MQTT-3.1.2-22]
  it(`throws an Error for Password Flag set when User Name Flag is not set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b01000000 // User Name Flag not set, Password Flag set
    );

    expect(() => {
      parseConnectPacketV4(fixedHeader, readerMock);
    }).toThrowError("MQTT-3.1.2-22");

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol leve, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledTimes(0);
    expect(readerMock.readString).toHaveBeenCalledOnce(); // protocol name
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // These fields, if present, MUST appear in the order Client Identifier, Will Topic, Will Message, User Name, Password.
  // [MQTT-3.1.3-1]
  it(`parses the payload fields in the correct order`, () => {
    const clientId = "id";
    const willTopic = "will topic";
    const willMessage = new Uint8Array([1, 2, 3]);
    const userName = "user name";
    const password = new Uint8Array([3, 2, 1]);

    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b11000100, // User Name, Password Flags and Will Flag set
      0x00, // keep alive
      clientId, // client id
      willTopic, // will topic
      willMessage, // will message
      userName, // user name
      password // password
    );

    const packet = parseConnectPacketV4(fixedHeader, readerMock);

    expect(packet.payload.clientIdentifier).toBe(clientId);
    expect(packet.payload.willTopic).toBe(willTopic);
    expect(packet.payload.willMessage).toBe(willMessage);
    expect(packet.payload.userName).toBe(userName);
    expect(packet.payload.password).toBe(password);

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readString).toHaveBeenCalledTimes(4); // protocol name, client id, user name, password
    expect(readerMock.readBytes).toHaveBeenCalledTimes(2); // will message, password
  });

  // The Client Identifier (ClientId) MUST be present and MUST be the first field in the CONNECT packet payload.
  // [MQTT-3.1.3-3]
  it(`throw an Error for missing ClientId`, () => {
    const fixedHeader = {
      packetType: PacketType.CONNECT,
      flags: 0,
      remainingLength: 10,
    };
    const readerMock = createConnectReaderMock(
      [
        10, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000000, // Clean Session flag not set
      0x00, // keep alive
      undefined // client id
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      "remaining"
    );

    expect(readerMock.readOneByteInteger).not.toHaveBeenCalled();
    expect(readerMock.readTwoByteInteger).not.toHaveBeenCalled();
    expect(readerMock.readString).not.toHaveBeenCalled();
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // The ClientId MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-4]
  it(`throw an Error for invalid encoded ClientId`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000100, // Will Flag set
      0x00, // keep alive
      new Error("Id") // client id
    );

    // parseConnectPacketV4 not validate UTF-8 encoding by itself
    // provided IMQTTReaderV4 is responsible for decoding UTF-8 strings
    // simulate that it throws an error when reading client id
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(/Id/);

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol leve, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length,
  // and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".
  // [MQTT-3.1.3-5]
  // A Server MAY allow a Client to supply a ClientId that has a length of zero bytes.
  // However if it does so the Server MUST treat this as a special case and assign a unique ClientId to that Client.
  // It MUST then process the CONNECT packet as if the Client had provided that unique ClientId.
  // [MQTT-3.1.3-6]
  it(`throw an Error for invalid ClientId`, () => {
    ["a".repeat(24), "invalid!", "with space"].forEach((invalidId) => {
      const readerMock = createConnectReaderMock(
        [
          12, // remaining
          0,
        ],
        "MQTT", // protocol name
        4, // protocol level
        0b00000000, // Clean Session flag not set
        0x00, // keep alive
        invalidId // client id
      );

      expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
        /Client Id/
      );

      expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol level, flags
      expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
      expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
      expect(readerMock.readBytes).not.toHaveBeenCalled();
    });
  });

  // If the Client supplies a zero-byte ClientId, the Client MUST also set CleanSession to 1.
  // [MQTT-3.1.3-7]
  it(`throw an Error for zero length ClientId when Clean Session flag is not set`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000000, // Clean Session flag not set
      0x00, // keep alive
      "" // client id
    );

    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /ClientId/
    );

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol leve, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readString).toHaveBeenCalledTimes(2); // protocol name, client id
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // The Will Topic MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-10]
  it(`throw an Error for invalid encoded Will Topic`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b00000100, // Will Flag set
      0x00, // keep alive
      "id", // client id
      new Error("Will Topic") // will topic
    );

    // parseConnectPacketV4 not validate UTF-8 encoding by itself
    // provided IMQTTReaderV4 is responsible for decoding UTF-8 strings
    // simulate that it throws an error when reading will topic
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /Will Topic/
    );

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol leve, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, will topic
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });

  // The User Name MUST be a UTF-8 encoded string as defined in Section 1.5.3.
  // [MQTT-3.1.3-11]
  it(`throw an Error for invalid encoded User Name`, () => {
    const readerMock = createConnectReaderMock(
      [
        12, // remaining
        0,
      ],
      "MQTT", // protocol name
      4, // protocol level
      0b10000000, // User Name Flag set
      0x00, // keep alive
      "id", // client id
      undefined, // will topic
      undefined, // will message
      new AppError("User Name")
    );

    // parseConnectPacketV4 not validate UTF-8 encoding by itself
    // provided IMQTTReaderV4 is responsible for decoding UTF-8 strings
    // simulate that it throws an error when reading will topic
    expect(() => parseConnectPacketV4(fixedHeader, readerMock)).toThrow(
      /User Name/
    );

    expect(readerMock.readOneByteInteger).toHaveBeenCalledTimes(2); // protocol leve, flags
    expect(readerMock.readTwoByteInteger).toHaveBeenCalledOnce(); // keep alive
    expect(readerMock.readString).toHaveBeenCalledTimes(3); // protocol name, client id, will topic
    expect(readerMock.readBytes).not.toHaveBeenCalled();
  });
});
