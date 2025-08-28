export enum PacketType {
  CONNECT = 1, // Client request to connect to Server
  CONNACK = 2, // Connect acknowledgment
  PUBLISH = 3, // Publish message
  PUBACK = 4, // Publish acknowledgment
  PUBREC = 5, // Publish received (assured delivery part 1)
  PUBREL = 6, // Publish release (assured delivery part 2)
  PUBCOMP = 7, // Publish complete (assured delivery part 3)
  SUBSCRIBE = 8, // Client subscribe request
  SUBACK = 9, // Subscribe acknowledgment
  UNSUBSCRIBE = 10, // Unsubscribe request
  UNSUBACK = 11, // Unsubscribe acknowledgment
  PINGREQ = 12, // PING request
  PINGRESP = 13, // PING response
  DISCONNECT = 14, // Client is disconnecting
}

// BASE
export type ControlPacket<T extends PacketType> = {
  typeId: T;
};

export type PacketWithIdentifier<T extends PacketType> = ControlPacket<T> & {
  identifier: number;
};

export type FixedHeader = {
  packetType: PacketType;
  flags: number;
  remainingLength: number;
};
