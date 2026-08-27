import { MqttAuth } from "@mqtt/shared/types";

export class MqttAuthFactory {
  private static readonly encoder = new TextEncoder();

  /**
   * Creates an MqttAuth object with the provided user and optional password. If the password is provided as a string, it is converted to a Uint8Array using a TextEncoder.
   * @param user - The username for the MQTT authentication.
   * @param password - The password for the MQTT authentication, which can be either a Uint8Array or a string. If it is a string, it will be encoded to a Uint8Array.
   * @returns An MqttAuth object containing the user and the optional password as a Uint8Array.
   */
  public static create(user: string, password?: Uint8Array | string): MqttAuth {
    return {
      user: user,
      password: password
        ? typeof password === "string"
          ? this.encoder.encode(password)
          : password
        : undefined,
    };
  }
}
