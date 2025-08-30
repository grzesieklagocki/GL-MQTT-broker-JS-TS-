export type AnyPacketV4 =
  | ConnectPacketV4
  | ConnackPacketV4
  | PublishPacketV4
  | PubackPacketV4
  | PubrecPacketV4
  | PubrelPacketV4
  | PubcompPacketV4
  | SubscribePacketV4
  | SubackPacketV4
  | UnsubscribePacketV4
  | UnsubackPacketV4
  | PingreqPacketV4
  | PingrespPacketV4
  | DisconnectPacketV4;

import {
  ControlPacket,
  PacketType,
  PacketWithIdentifier,
  QoS,
} from "../shared/types";

// 1. CONNECT
export type ConnectPacketV4 = ControlPacket<PacketType.CONNECT> & {
  protocol: ProtocolInfoV4;
  flags: ConnectionFlagsV4;

  keepAlive: number;
};

export type ProtocolInfoV4 = {
  name: "MQTT";
  level: 4;
};

export type ConnectionFlagsV4 = {
  userName: boolean;
  password: boolean;
  willRetain: boolean;
  willQoS: QoS;
  willFlag: boolean;
  cleanSession: boolean;
};

export type ConnectionPayloadV4 = {
  clientIdentifier?: string;
  willTopic?: string;
  willMessage?: Uint8Array;
  userName?: string;
  password?: Uint8Array;
};

// 2. CONNACK
export type ConnackReturnCodeV4 = 0x00 | 0x01 | 0x02 | 0x03 | 0x04 | 0x05;

export type ConnackPacketV4 = ControlPacket<PacketType.CONNACK> & {
  sessionPresentFlag: boolean;
  connectReturnCode: ConnackReturnCodeV4;
};

// 3. PUBLISH
export type PublishPacketV4 = PacketWithIdentifier<PacketType.PUBLISH> & {
  flags: PublishFlagsV4;

  topicName: string;
  applicationMessage: Uint8Array;
};

export type PublishFlagsV4 = {
  dup: boolean;
  qosLevel: QoS;
  retain: boolean;
};

// 4. PUBACK
export type PubackPacketV4 = PacketWithIdentifier<PacketType.PUBACK>;

// 5. PUBREC
export type PubrecPacketV4 = PacketWithIdentifier<PacketType.PUBREC>;

// 6. PUBREL
export type PubrelPacketV4 = PacketWithIdentifier<PacketType.PUBREL>;

// 7. PUBCOMP
export type PubcompPacketV4 = PacketWithIdentifier<PacketType.PUBCOMP>;

// 8. SUBSCRIBE
export type SubscriptionV4 = [topicFilter: string, qos: QoS];

export type SubscribePacketV4 = PacketWithIdentifier<PacketType.SUBSCRIBE> & {
  subscriptionList: SubscriptionV4[];
};

// 9. SUBACK
export type SubackReturnCodeV4 = QoS | 0x80;

export type SubackPacketV4 = PacketWithIdentifier<PacketType.SUBACK> & {
  returnCode: SubackReturnCodeV4;
};

// 10. UNSUBSCRIBE
export type UnsubscribePacketV4 =
  PacketWithIdentifier<PacketType.UNSUBSCRIBE> & {
    topicFilterList: string[];
  };

// 11. UNSUBACK
export type UnsubackPacketV4 = PacketWithIdentifier<PacketType.UNSUBACK>;

// 12. PINGREQ
export type PingreqPacketV4 = ControlPacket<PacketType.PINGREQ>;

// 13. PINGRESP
export type PingrespPacketV4 = ControlPacket<PacketType.PINGRESP>;

// 14. DISCONNECT
export type DisconnectPacketV4 = ControlPacket<PacketType.DISCONNECT>;
