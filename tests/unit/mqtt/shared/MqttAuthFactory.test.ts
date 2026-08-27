import { describe, expect, it } from "vitest";
import { MqttAuthFactory } from "@mqtt/shared/MqttAuthFactory";

describe("MqttAuthFactory", () => {
  const user = "UserName";
  const password = {
    uint8Array: new Uint8Array([
      0xc5, 0xbc, 0xc3, 0xb3, 0xc5, 0x82, 0xc4, 0x87,
    ]),
    string: "żółć",
  };

  it("creates MqttAuth with only user", () => {
    const auth = MqttAuthFactory.create(user);

    expect(auth.user).toBe(user);
    expect(auth.password).toBeUndefined();
  });

  it("creates MqttAuth with user and password as Uint8Array", () => {
    const auth = MqttAuthFactory.create(user, password.uint8Array);

    expect(auth.user).toBe(user);
    expect(auth.password).toBe(password.uint8Array);
  });

  it("creates MqttAuth with user and password as string", () => {
    const auth = MqttAuthFactory.create(user, password.string);

    expect(auth.user).toBe(user);
    expect(auth.password).toEqual(password.uint8Array);
  });
});
