import { PacketType } from "../shared/types";
import {
  ConnackPacketV4,
  ConnackReturnCodeV4,
  ConnectFlagsV4,
  ConnectionPayloadV4,
  ConnectPacketV4,
  DisconnectPacketV4,
  PingreqPacketV4,
  PingrespPacketV4,
  PubackPacketV4,
  PubcompPacketV4,
  PublishFlagsV4,
  PublishPacketV4,
  PubrecPacketV4,
  PubrelPacketV4,
  SubackPacketV4,
  SubackReturnCodeV4,
  SubscribePacketV4,
  SubscriptionV4,
  UnsubackPacketV4,
  UnsubscribePacketV4,
} from "./types";

// Factory class for creating MQTT V4 packets of various types.
export class MqttPacketV4Factory {
  /**
   * Creates a simple MQTT packet (PINGREQ, PINGRESP, or DISCONNECT) with the specified type.
   * @param type - The type of the simple MQTT packet to create (PINGREQ, PINGRESP, or DISCONNECT).
   * @returns A simple MQTT packet object with the specified type.
   */
  public static createSimplePacketV4(type: SimplePacketV4Type): SimplePacketV4 {
    return { typeId: type };
  }

  /**
   * Creates an MQTT packet with an identifier (PUBACK, PUBREC, PUBREL, PUBCOMP, or UNSUBACK) with the specified type and identifier.
   * @param type - The type of the MQTT packet to create (PUBACK, PUBREC, PUBREL, PUBCOMP, or UNSUBACK).
   * @param identifier - The identifier for the MQTT packet.
   * @returns An MQTT packet object with the specified type and identifier.
   */
  public static createPacketWithIdentifierV4(
    type: PacketWithIdentifierV4Type,
    identifier: number
  ): PacketWithIdentifierV4 {
    return { typeId: type, identifier: identifier };
  }

  /**
   * Creates a CONNECT packet with the specified flags, keep-alive value, and connection payload.
   * @param flags - The connection flags for the CONNECT packet.
   * @param keepAlive - The keep-alive time value for the CONNECT packet.
   * @param payload - The connection payload for the CONNECT packet.
   * @returns A CONNECT packet object with the specified flags, keep-alive value, and connection payload.
   */
  public static createConnectPacketV4(
    flags: ConnectFlagsV4,
    keepAlive: number,
    payload: ConnectionPayloadV4
  ): ConnectPacketV4 {
    return {
      typeId: PacketType.CONNECT,
      protocol: { name: "MQTT", level: 4 },
      flags: flags,
      keepAlive: keepAlive,
      payload: payload,
    };
  }

  /**
   * Creates a CONNACK packet with the specified session present flag and connect return code.
   * @param sessionPresentFlag - A boolean indicating whether the session is present (true) or not (false).
   * @param connectReturnCode - The return code for the CONNACK packet, indicating the result of the connection attempt.
   * @returns A CONNACK packet object with the specified session present flag and connect return code.
   */
  public static createConnackPacketV4(
    sessionPresentFlag: boolean,
    connectReturnCode: ConnackReturnCodeV4
  ): ConnackPacketV4 {
    return {
      typeId: PacketType.CONNACK,
      sessionPresentFlag,
      connectReturnCode: connectReturnCode,
    };
  }

  /**
   * Creates a PUBLISH packet with the specified application message, flags, topic name, and optional identifier.
   * @param applicationMessage - The application message to be published in the PUBLISH packet.
   * @param flags - The flags for the PUBLISH packet, including QoS level, retain flag, and duplicate flag.
   * @param topicName - The topic name to which the application message will be published.
   * @param identifier - An optional identifier for the PUBLISH packet, used for QoS levels 1 and 2.
   * @returns A PUBLISH packet object with the specified application message, flags, topic name, and optional identifier.
   */
  public static createPublishPacketV4(
    applicationMessage: Uint8Array,
    flags: PublishFlagsV4,
    topicName: string,
    identifier?: number
  ): PublishPacketV4 {
    return {
      typeId: PacketType.PUBLISH,
      flags,
      identifier: identifier,
      topicName: topicName,
      applicationMessage,
    };
  }

  /**
   * Creates a SUBSCRIBE packet with the specified identifier and subscription list.
   * @param identifier - The identifier for the SUBSCRIBE packet, used to match the SUBACK response.
   * @param subscriptionList - An array of SubscriptionV4 objects representing the topics and QoS levels to subscribe to.
   * @returns A SUBSCRIBE packet object with the specified identifier and subscription list.
   */
  public static createSubscribePacketV4(
    identifier: number,
    subscriptionList: SubscriptionV4[]
  ): SubscribePacketV4 {
    return {
      typeId: PacketType.SUBSCRIBE,
      identifier: identifier,
      subscriptionList: subscriptionList,
    };
  }

  /**
   * Creates a SUBACK packet with the specified identifier and return code.
   * @param identifier - The identifier for the SUBACK packet, used to match the corresponding SUBSCRIBE request.
   * @param returnCode - The return code for the SUBACK packet, indicating the result of the subscription request.
   * @returns A SUBACK packet object with the specified identifier and return code.
   */
  public static createSubackPacketV4(
    identifier: number,
    returnCodes: SubackReturnCodeV4[]
  ): SubackPacketV4 {
    return {
      typeId: PacketType.SUBACK,
      identifier: identifier,
      returnCodeList: returnCodes,
    };
  }

  /**
   * Creates an UNSUBSCRIBE packet with the specified identifier and topic filter list.
   * @param identifier - The identifier for the UNSUBSCRIBE packet, used to match the corresponding UNSUBACK response.
   * @param topicFilterList - An array of topic filters representing the topics to unsubscribe from.
   * @returns An UNSUBSCRIBE packet object with the specified identifier and topic filter list.
   */
  public static createUnsubscribePacketV4(
    identifier: number,
    topicFilterList: string[]
  ): UnsubscribePacketV4 {
    return {
      typeId: PacketType.UNSUBSCRIBE,
      identifier: identifier,
      topicFilterList: topicFilterList,
    };
  }
}

// types for packets without variable header and payload
type SimplePacketV4 = PingreqPacketV4 | PingrespPacketV4 | DisconnectPacketV4;
export type SimplePacketV4Type =
  | PacketType.PINGREQ
  | PacketType.PINGRESP
  | PacketType.DISCONNECT;

type PacketWithIdentifierV4 =
  | PubackPacketV4
  | PubrecPacketV4
  | PubrelPacketV4
  | PubcompPacketV4
  | UnsubackPacketV4;
export type PacketWithIdentifierV4Type =
  | PacketType.PUBACK
  | PacketType.PUBREC
  | PacketType.PUBREL
  | PacketType.PUBCOMP
  | PacketType.UNSUBACK;
