/**
 * Generates a random client identifier for MQTT clients.
 * It ensures that the generated identifier adheres to the MQTT specification,
 * which requires client identifiers to be between 1 and 23 UTF-8 encoded bytes in length
 * and to contain only alphanumeric characters.
 * @returns A random client identifier string.
 */
export const generateRandomClientId: () => string = () => {
  //The Server MUST allow ClientIds which are between 1 and 23 UTF-8 encoded bytes in length,
  // and that contain only the characters "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
  // [MQTT-3.1.3-5].
  const length = getRandomNumber(1, 23);
  let identifier = "";

  for (let i = 0; i < length; i++) {
    identifier += getRandomChar();
  }

  return identifier;
};

const getRandomChar: () => string = () => {
  const allowedChars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const iMax = allowedChars.length - 1;
  const i = getRandomNumber(0, iMax);

  return allowedChars.charAt(i);
};

const getRandomNumber = (from: number, to: number) =>
  Math.floor(from + to * Math.random());
